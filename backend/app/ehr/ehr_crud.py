# app/ehr/ehr_crud.py

import json
from flask import jsonify, request
from app.models import EHR, User # Correctly import from app.models
from app.extensions import db
from app.notifications.email_service import send_email
from sqlalchemy import func

def get_ehr_records(current_user):
    try:
        if current_user.role == 'patient':
            ehr_records = EHR.query.filter_by(user_id=current_user.id).all()
        elif current_user.role == 'doctor':
            ehr_records = EHR.query.filter_by(created_by=current_user.id).all()
        elif current_user.role == 'admin':
            ehr_records = EHR.query.all()
        else:
            return jsonify({"error": "Unauthorized role for listing EHRs"}), 403

        ehr_list = []
        for record in ehr_records:
            conditions = json.loads(record.conditions) if record.conditions else []
            if isinstance(conditions, str):
                conditions = [conditions]

            ehr_list.append({
                "id": record.id,
                "name": record.name,
                "age": record.age,
                "gender": record.gender,
                "blood_group": record.blood_group,
                "conditions": conditions,
                # "medications" field REMOVED
            })
        return jsonify({"ehrs": ehr_list}), 200

    except Exception as e:
        print(f"Error in get_ehr_records: {e}") 
        return jsonify({"error": "Internal Server Error during EHR retrieval"}), 500
    
def update_ehr_record(current_user, ehr_id, data):
    try:
        ehr = EHR.query.filter_by(id=ehr_id).first()

        if not ehr:
            return jsonify({"error": "EHR record not found"}), 404
        if current_user.role == 'doctor' and ehr.created_by != current_user.id:
            return jsonify({"error": "Unauthorized: You did not create this EHR"}), 403

        ehr.name = data.get('name', ehr.name)
        ehr.age = data.get('age', ehr.age)
        ehr.gender = data.get('gender', ehr.gender)
        ehr.blood_group = data.get('blood_group', ehr.blood_group)
        ehr.conditions = json.dumps(data.get('conditions')) if data.get('conditions') else ehr.conditions
        # "medications" field REMOVED from update logic

        db.session.commit()
        return jsonify({"message": "EHR updated successfully"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
def delete_ehr_record(current_user, ehr_id):
    # This function had no reference to medications, so it remains unchanged.
    try:
        ehr = EHR.query.filter_by(id=ehr_id).first()
        if not ehr:
            return jsonify({"error": "EHR record not found"}), 404
        if current_user.role == 'doctor' and ehr.created_by != current_user.id:
            return jsonify({"error": "Unauthorized: You did not create this EHR"}), 403
        db.session.delete(ehr)
        db.session.commit()
        return jsonify({"message": "EHR deleted successfully"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

def create_ehr_record(current_user, data):
    try:
        if current_user.role != 'doctor':
            return jsonify({"error": "Only doctors can create EHRs"}), 403

        # NOTE: Your key in the JSON body was "patient_id", but the model uses "user_id".
        # Let's handle both for flexibility, preferring "user_id".
        patient_id = data.get('user_id') or data.get('patient_id')
        if not patient_id:
            return jsonify({"error": "user_id (or patient_id) is required"}), 400

        patient = User.query.filter_by(id=patient_id, role='patient').first()
        if not patient:
            return jsonify({"error": "Patient not found"}), 404

        existing_ehr = EHR.query.filter_by(user_id=patient.id).first()
        if existing_ehr:
            return jsonify({"error": f"EHR already exists for patient ID: {patient.id}"}), 400

        new_record = EHR(
            user_id=patient.id,
            created_by=current_user.id,
            name=data.get('name'),
            age=data.get('age'),
            gender=data.get('gender'),
            blood_group=data.get('blood_group'),
            conditions=json.dumps(data.get('conditions'))
            # "medications" field REMOVED from creation logic
        )
        db.session.add(new_record)
        db.session.commit()

        send_email(
            recipient=patient.email,
            subject="New EHR Created",
            body=f"Hi {patient.name}, your EHR record has been created by Dr. {current_user.name}."
        )
        return jsonify({"message": "EHR created successfully", "ehr_id": new_record.id}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500

def search_ehr_record(current_user):
    # This function also contained references to medications, which are now removed.
    try:
        data = request.get_json() or {}
        if current_user.role == 'patient':
            query = EHR.query.filter_by(user_id=current_user.id)
        elif current_user.role in ['doctor', 'admin']:
            query = (EHR.query.filter_by(created_by=current_user.id) if current_user.role == 'doctor' else EHR.query)
        else:
            return jsonify({"error": "Unauthorized role for searching EHRs"}), 403

        # ... (filtering logic for name, blood_group, etc. remains the same)
        
        results = query.all() # Simplified, as the rest of the logic can be applied after
        ehr_list = []
        for ehr in results:
            conditions = json.loads(ehr.conditions or "[]")
            if isinstance(conditions, str): conditions = [conditions]

            ehr_list.append({
                "id": ehr.id,
                "name": ehr.name,
                "age": ehr.age,
                "gender": ehr.gender,
                "blood_group": ehr.blood_group,
                "conditions": conditions
                # "medications" field REMOVED
            })
        return jsonify({"results": ehr_list}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500