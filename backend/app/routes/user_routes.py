import json
from flask import Blueprint, jsonify
from app.models import User, EHR # Import EHR model
from flask_jwt_extended import jwt_required, get_current_user # Import JWT tools
from app.extensions import db # Import db for querying

user_routes = Blueprint('user_routes', __name__)

# --- Endpoint for Public Doctor List (Unchanged) ---
@user_routes.route('/doctors', methods=['GET'])
def get_all_doctors():
    doctors = User.query.filter_by(role='doctor').all()
    # Parse the availability string into a JSON object for the frontend
    return jsonify([
        {
            "id": doctor.id,
            "name": doctor.name,
            "specialization": doctor.specialization or "General Physician",
            "availability": json.loads(doctor.availability) if doctor.availability else None
        } for doctor in doctors
    ]), 200

# --- Endpoint for Admin/Doctor getting ALL Patients (Unchanged) ---
# Note: The URL prefix /api/users is defined in __init__.py
@user_routes.route('/patients', methods=['GET'])
@jwt_required()
def get_all_patients():
    current_user = get_current_user()
    if current_user.role not in ['admin', 'doctor']:
        return jsonify({"msg":"Admin or Doctor access required!"}), 403

    patients = User.query.filter_by(role='patient').all()
    return jsonify([
        {
            "id": patient.id,
            "name": patient.name,
            "email": patient.email
        } for patient in patients
    ]), 200

# --- ✅ NEW Endpoint: Get Patients specific to the logged-in Doctor ---
# Note: The URL prefix /api/users is defined in __init__.py
@user_routes.route('/doctor/patients', methods=['GET'])
@jwt_required()
def get_doctor_specific_patients():
    """
    Returns a list of patients for whom the currently logged-in doctor
    has created an EHR record.
    """
    current_user = get_current_user()
    if current_user.role != 'doctor':
        return jsonify({"msg": "Doctors only!"}), 403

    try:
        # Find all unique patient IDs from EHR records created by this doctor
        # We query the EHR table for records created_by the current doctor,
        # select the distinct user_id (patient's ID) from those records.
        patient_ids_query = db.session.query(EHR.user_id).filter_by(created_by=current_user.id).distinct()
        patient_ids = [pid[0] for pid in patient_ids_query.all()] # Extract IDs

        if not patient_ids:
            return jsonify([]), 200 # Return empty list if no patients found

        # Fetch the full patient details for those IDs from the User table
        patients = User.query.filter(User.id.in_(patient_ids), User.role == 'patient').all()

        result = [{"id": p.id, "name": p.name, "email": p.email} for p in patients]
        return jsonify(result), 200

    except Exception as e:
        print(f"Error fetching doctor's patients: {e}")
        return jsonify({"error": "Failed to retrieve patients"}), 500