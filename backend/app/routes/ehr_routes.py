import json # Make sure json is imported
from flask import Blueprint, request, jsonify
from app.ehr.ehr_crud import (
    create_ehr_record,
    get_ehr_records,
    update_ehr_record,
    delete_ehr_record,
    search_ehr_record
)
from flask_jwt_extended import jwt_required, get_current_user
from app.models import EHR, User # Import models needed for the new route

ehr_bp = Blueprint('ehr_bp', __name__)

@ehr_bp.route('/create', methods=['POST'])
@jwt_required()
def create_record():
    current_user = get_current_user()
    data = request.get_json()
    return create_ehr_record(current_user, data)

@ehr_bp.route('/list', methods=['GET'])
@jwt_required()
def list_records():
    current_user = get_current_user()
    return get_ehr_records(current_user)

@ehr_bp.route('/update/<int:ehr_id>', methods=['PUT'])
@jwt_required()
def update_record(ehr_id):
    current_user = get_current_user()
    data = request.get_json()
    return update_ehr_record(current_user, ehr_id, data)

@ehr_bp.route('/delete/<int:ehr_id>', methods=['DELETE'])
@jwt_required()
def delete_record(ehr_id):
    current_user = get_current_user()
    return delete_ehr_record(current_user, ehr_id)

@ehr_bp.route('/search', methods=['POST'])
@jwt_required()
def search_records_post():
    current_user = get_current_user()
    return search_ehr_record(current_user)

# --- ✅ NEW ROUTE ADDED ---
@ehr_bp.route('/patient/<int:patient_id>', methods=['GET'])
@jwt_required()
def get_ehr_for_patient_by_doctor(patient_id):
    """
    Allows a logged-in doctor to fetch EHR records for a specific patient.
    """
    current_user = get_current_user()
    if current_user.role != 'doctor':
        return jsonify({"msg": "Access forbidden: Doctors only"}), 403

    # Optional: Check if patient exists
    patient = User.query.get(patient_id)
    if not patient or patient.role != 'patient':
        return jsonify({"error": "Patient not found"}), 404

    try:
        # Fetch EHR records specifically for the given patient_id
        ehr_records = EHR.query.filter_by(user_id=patient_id).all() # Use user_id as FK in EHR model

        ehr_list = []
        for record in ehr_records:
             conditions = json.loads(record.conditions) if record.conditions else []
             if isinstance(conditions, str): conditions = [conditions] # Defensive check
             ehr_list.append({
                "id": record.id,
                "user_id": record.user_id,
                "created_by": record.created_by,
                "name": record.name,
                "age": record.age,
                "gender": record.gender,
                "blood_group": record.blood_group,
                "conditions": conditions,
            })
        # Return in the format expected by the frontend modal {"ehrs": [...]}
        return jsonify({"ehrs": ehr_list}), 200

    except Exception as e:
        print(f"Error fetching EHR for patient {patient_id}: {e}")
        return jsonify({"error": "Internal Server Error during EHR retrieval"}), 500
# --- END OF NEW ROUTE ---


# This route is specifically for a patient getting their *own* EHR
@ehr_bp.route('/', methods=['GET'])
@jwt_required()
def get_patient_ehr_default():
    current_user = get_current_user()
    # The get_ehr_records function should handle the patient role correctly
    return get_ehr_records(current_user)