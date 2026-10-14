import json
from datetime import datetime

from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_current_user
from werkzeug.security import generate_password_hash
from email_validator import validate_email, EmailNotValidError

from app.models import User, EHR, Appointment, Medication
from app.extensions import db
from app.notifications.email_service import build_appointment_info, notify_appointment

admin_routes = Blueprint('admin_routes', __name__)

MANAGED_ROLES = ('doctor', 'patient')


# ---------------------------------------------------------------- helpers
def admin_required():
    current_user = get_current_user()
    if not current_user or current_user.role != 'admin':
        return jsonify({"msg": "Admins only!"}), 403
    return None


def _user_to_dict(u):
    return {
        "id": u.id,
        "name": u.name,
        "email": u.email,
        "role": u.role,
        "specialization": u.specialization,
        "availability": u.availability,
    }


def _appointment_to_dict(a):
    return {
        "id": a.id,
        "patient_id": a.patient_id,
        "patient_name": a.patient.name if a.patient else None,
        "doctor_id": a.doctor_id,
        "doctor_name": a.doctor.name if a.doctor else None,
        "appointment_time": a.appointment_time.isoformat() if a.appointment_time else None,
        "status": a.status,
        "reason": a.reason,
    }


def _ehr_to_dict(e):
    return {
        "ehr_id": e.id,
        "patient_id": e.user_id,
        "patient_name": e.patient.name if e.patient else None,
        "doctor_id": e.created_by,
        "doctor_name": e.doctor.name if e.doctor else None,
        "name": e.name,
        "age": e.age,
        "gender": e.gender,
        "blood_group": e.blood_group,
        "conditions": e.conditions,
    }


def _medication_to_dict(m):
    return {
        "id": m.id,
        "ehr_id": m.ehr_id,
        "patient_name": m.ehr.name if m.ehr else None,
        "prescribed_by_id": m.prescribed_by_id,
        "prescribed_by_name": m.prescribed_by.name if m.prescribed_by else None,
        "name": m.name,
        "dosage": m.dosage,
        "frequency": m.frequency,
        "start_date": m.start_date.isoformat() if m.start_date else None,
        "end_date": m.end_date.isoformat() if m.end_date else None,
        "notes": m.notes,
    }


def _parse_dt(value):
    """Parse an ISO datetime string (supports trailing Z) -> naive UTC datetime."""
    if value in (None, ""):
        return None
    value = str(value)
    if value.endswith('Z'):
        value = value.replace('Z', '+00:00')
    dt = datetime.fromisoformat(value)
    if dt.tzinfo is not None:
        from datetime import timezone
        dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


def _delete_user_cascade(user):
    """Remove a user and everything that references them."""
    # Appointments (as patient or doctor)
    Appointment.query.filter(
        (Appointment.patient_id == user.id) | (Appointment.doctor_id == user.id)
    ).delete(synchronize_session=False)

    # Medications prescribed by this user
    Medication.query.filter_by(prescribed_by_id=user.id).delete(synchronize_session=False)

    # EHRs belonging to this patient (and their medications)
    for ehr in EHR.query.filter_by(user_id=user.id).all():
        Medication.query.filter_by(ehr_id=ehr.id).delete(synchronize_session=False)
        db.session.delete(ehr)

    # EHRs created by this doctor for other patients: keep the record, clear the author
    EHR.query.filter_by(created_by=user.id).update({"created_by": None}, synchronize_session=False)

    db.session.flush()
    db.session.expire_all()
    db.session.delete(User.query.get(user.id))


# ---------------------------------------------------------------- users
@admin_routes.route('/users', methods=['GET'])
@jwt_required()
def get_all_users():
    err = admin_required()
    if err:
        return err
    users = User.query.filter(User.role.in_(MANAGED_ROLES)).order_by(User.id).all()
    return jsonify([_user_to_dict(u) for u in users]), 200


@admin_routes.route('/doctors', methods=['GET'])
@jwt_required()
def get_all_doctors():
    err = admin_required()
    if err:
        return err
    doctors = User.query.filter_by(role='doctor').all()
    return jsonify([_user_to_dict(d) for d in doctors]), 200


@admin_routes.route('/patients', methods=['GET'])
@jwt_required()
def get_all_patients():
    current_user = get_current_user()
    if current_user.role not in ['admin', 'doctor']:
        return jsonify({"msg": "Admin or Doctor access required!"}), 403
    patients = User.query.filter_by(role='patient').all()
    return jsonify([_user_to_dict(p) for p in patients]), 200


@admin_routes.route('/user', methods=['POST'])
@jwt_required()
def create_user():
    err = admin_required()
    if err:
        return err
    data = request.get_json() or {}

    name = (data.get('name') or '').strip()
    email = (data.get('email') or '').strip().lower()
    password = str(data.get('password') or '')
    role = (data.get('role') or '').lower()

    if not name or not email or not password:
        return jsonify({"error": "Name, email and password are required"}), 400
    if role not in MANAGED_ROLES:
        return jsonify({"error": "Role must be doctor or patient"}), 400
    try:
        validate_email(email, check_deliverability=False)
    except EmailNotValidError as e:
        return jsonify({"error": str(e)}), 400
    if User.query.filter_by(email=email).first():
        return jsonify({"error": "A user with this email already exists"}), 400

    availability = data.get('availability')
    if isinstance(availability, (dict, list)):
        availability = json.dumps(availability)

    user = User(
        name=name,
        email=email,
        password=generate_password_hash(password, method='pbkdf2:sha256'),
        role=role,
        specialization=data.get('specialization') if role == 'doctor' else None,
        availability=availability if role == 'doctor' else None,
    )
    db.session.add(user)
    db.session.commit()
    return jsonify(_user_to_dict(user)), 201


@admin_routes.route('/user/<int:user_id>', methods=['PUT'])
@jwt_required()
def update_user(user_id):
    err = admin_required()
    if err:
        return err
    user = User.query.get(user_id)
    if not user or user.role not in MANAGED_ROLES:
        return jsonify({"error": "User not found"}), 404
    data = request.get_json() or {}

    if 'name' in data:
        name = (data['name'] or '').strip()
        if not name:
            return jsonify({"error": "Name cannot be empty"}), 400
        user.name = name

    if 'email' in data:
        email = (data['email'] or '').strip().lower()
        try:
            validate_email(email, check_deliverability=False)
        except EmailNotValidError as e:
            return jsonify({"error": str(e)}), 400
        existing = User.query.filter_by(email=email).first()
        if existing and existing.id != user.id:
            return jsonify({"error": "Another user already uses this email"}), 400
        user.email = email

    if data.get('password'):
        user.password = generate_password_hash(str(data['password']), method='pbkdf2:sha256')

    if user.role == 'doctor':
        if 'specialization' in data:
            user.specialization = data['specialization']
        if 'availability' in data:
            availability = data['availability']
            if isinstance(availability, (dict, list)):
                availability = json.dumps(availability)
            elif availability:
                try:
                    json.loads(availability)
                except ValueError:
                    return jsonify({"error": "Availability must be valid JSON"}), 400
            user.availability = availability or None

    db.session.commit()
    return jsonify(_user_to_dict(user)), 200


@admin_routes.route('/doctor/<int:user_id>', methods=['DELETE'])
@jwt_required()
def delete_doctor(user_id):
    err = admin_required()
    if err:
        return err
    user = User.query.filter_by(id=user_id, role='doctor').first()
    if not user:
        return jsonify({"error": "Doctor not found"}), 404
    _delete_user_cascade(user)
    db.session.commit()
    return jsonify({"message": "Doctor deleted successfully"}), 200


@admin_routes.route('/patient/<int:user_id>', methods=['DELETE'])
@jwt_required()
def delete_patient(user_id):
    err = admin_required()
    if err:
        return err
    user = User.query.filter_by(id=user_id, role='patient').first()
    if not user:
        return jsonify({"error": "Patient not found"}), 404
    _delete_user_cascade(user)
    db.session.commit()
    return jsonify({"message": "Patient deleted successfully"}), 200


# ---------------------------------------------------------------- appointments
@admin_routes.route('/appointments', methods=['GET'])
@jwt_required()
def get_all_appointments():
    err = admin_required()
    if err:
        return err
    appts = Appointment.query.order_by(Appointment.appointment_time.desc()).all()
    return jsonify([_appointment_to_dict(a) for a in appts]), 200


@admin_routes.route('/appointment/<int:appt_id>', methods=['PUT'])
@jwt_required()
def update_appointment(appt_id):
    err = admin_required()
    if err:
        return err
    appt = Appointment.query.get(appt_id)
    if not appt:
        return jsonify({"error": "Appointment not found"}), 404
    data = request.get_json() or {}

    if 'status' in data and data['status']:
        appt.status = data['status']
    if 'reason' in data:
        appt.reason = data['reason']
    if data.get('appointment_time'):
        try:
            appt.appointment_time = _parse_dt(data['appointment_time'])
        except ValueError:
            return jsonify({"error": "Invalid appointment_time"}), 400

    db.session.commit()
    notify_appointment("updated_by_admin", build_appointment_info(appt))
    return jsonify(_appointment_to_dict(appt)), 200


@admin_routes.route('/appointment/<int:appt_id>', methods=['DELETE'])
@jwt_required()
def delete_appointment(appt_id):
    err = admin_required()
    if err:
        return err
    appt = Appointment.query.get(appt_id)
    if not appt:
        return jsonify({"error": "Appointment not found"}), 404
    info = build_appointment_info(appt)
    db.session.delete(appt)
    db.session.commit()
    notify_appointment("deleted_by_admin", info)
    return jsonify({"message": "Appointment deleted successfully"}), 200


# ---------------------------------------------------------------- EHR records
@admin_routes.route('/ehrs', methods=['GET'])
@jwt_required()
def get_all_ehrs():
    err = admin_required()
    if err:
        return err
    return jsonify([_ehr_to_dict(e) for e in EHR.query.order_by(EHR.id).all()]), 200


@admin_routes.route('/ehr/<int:ehr_id>', methods=['PUT'])
@jwt_required()
def update_any_ehr(ehr_id):
    err = admin_required()
    if err:
        return err
    ehr = EHR.query.get(ehr_id)
    if not ehr:
        return jsonify({"error": "EHR not found"}), 404
    data = request.get_json() or {}

    for field in ('name', 'gender', 'blood_group', 'conditions'):
        if field in data:
            setattr(ehr, field, data[field])
    if 'age' in data:
        try:
            ehr.age = int(data['age']) if data['age'] not in (None, '') else None
        except (TypeError, ValueError):
            return jsonify({"error": "Age must be a number"}), 400

    db.session.commit()
    return jsonify(_ehr_to_dict(ehr)), 200


@admin_routes.route('/ehr/<int:ehr_id>', methods=['DELETE'])
@jwt_required()
def delete_any_ehr(ehr_id):
    err = admin_required()
    if err:
        return err
    ehr = EHR.query.get(ehr_id)
    if not ehr:
        return jsonify({"error": "EHR not found"}), 404
    Medication.query.filter_by(ehr_id=ehr.id).delete(synchronize_session=False)
    db.session.delete(ehr)
    db.session.commit()
    return jsonify({"message": "EHR deleted successfully"}), 200


# ---------------------------------------------------------------- medications
@admin_routes.route('/medications', methods=['GET'])
@jwt_required()
def get_all_medications():
    err = admin_required()
    if err:
        return err
    meds = Medication.query.order_by(Medication.id).all()
    return jsonify([_medication_to_dict(m) for m in meds]), 200


@admin_routes.route('/medication/<int:med_id>', methods=['PUT'])
@jwt_required()
def update_medication(med_id):
    err = admin_required()
    if err:
        return err
    med = Medication.query.get(med_id)
    if not med:
        return jsonify({"error": "Medication not found"}), 404
    data = request.get_json() or {}

    for field in ('name', 'dosage', 'frequency', 'notes'):
        if field in data:
            setattr(med, field, data[field])
    for field in ('start_date', 'end_date'):
        if field in data:
            try:
                setattr(med, field, _parse_dt(data[field]))
            except ValueError:
                return jsonify({"error": f"Invalid {field}"}), 400

    db.session.commit()
    return jsonify(_medication_to_dict(med)), 200


@admin_routes.route('/medication/<int:med_id>', methods=['DELETE'])
@jwt_required()
def delete_medication(med_id):
    err = admin_required()
    if err:
        return err
    med = Medication.query.get(med_id)
    if not med:
        return jsonify({"error": "Medication not found"}), 404
    db.session.delete(med)
    db.session.commit()
    return jsonify({"message": "Medication deleted successfully"}), 200
