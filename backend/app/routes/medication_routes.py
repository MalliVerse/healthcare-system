from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_current_user
from app.models import User, EHR, Medication
from app.extensions import db

medication_bp = Blueprint('medication_bp', __name__, url_prefix='/api/medications')


@medication_bp.route('/', methods=['GET'])
@jwt_required()
def get_user_medications():
    """
    Endpoint for a PATIENT to retrieve their own medication list.
    """
    current_user = get_current_user()
    if current_user.role != 'patient':
        return jsonify({"msg": "Access forbidden: Patients only"}), 403

    # Find all medications associated with the patient's EHR records
    medications = Medication.query.join(EHR).filter(EHR.user_id == current_user.id).order_by(Medication.start_date.desc()).all()

    medication_list = [
        {
            "id": med.id,
            "name": med.name,
            "dosage": med.dosage,
            "frequency": med.frequency,
            "start_date": med.start_date.isoformat(),
            "end_date": med.end_date.isoformat() if med.end_date else None,
            "prescribed_by_doctor_id": med.prescribed_by_id
        } for med in medications
    ]
    
    return jsonify({"medications": medication_list}), 200


@medication_bp.route('/', methods=['POST'])
@jwt_required()
def create_medication():
    """
    Endpoint for a DOCTOR to prescribe a new medication for a patient's EHR.
    """
    current_user = get_current_user()
    if current_user.role != 'doctor':
        return jsonify({"msg": "Access forbidden: Doctors only"}), 403

    data = request.get_json()
    ehr_id = data.get('ehr_id')
    name = data.get('name')
    dosage = data.get('dosage')
    frequency = data.get('frequency')

    if not all([ehr_id, name, dosage, frequency]):
        return jsonify({"error": "Missing required fields: ehr_id, name, dosage, frequency"}), 400

    # Verify that the EHR record exists before adding a medication to it
    ehr = EHR.query.get(ehr_id)
    if not ehr:
        return jsonify({"error": f"EHR record with id {ehr_id} not found"}), 404

    try:
        new_medication = Medication(
            ehr_id=ehr_id,
            prescribed_by_id=current_user.id, # The doctor's ID from the JWT
            name=name,
            dosage=dosage,
            frequency=frequency,
            notes=data.get('notes') # Optional notes field
        )
        
        db.session.add(new_medication)
        db.session.commit()

        return jsonify({
            "message": "Medication created successfully",
            "medication": {
                "id": new_medication.id,
                "name": new_medication.name,
                "dosage": new_medication.dosage,
                "frequency": new_medication.frequency,
                "start_date": new_medication.start_date.isoformat(),
                "prescribed_by_doctor_id": new_medication.prescribed_by_id
            }
        }), 201

    except Exception as e:
        db.session.rollback() # Roll back the session in case of an error
        return jsonify({"error": "An internal error occurred while creating medication", "details": str(e)}), 500