# backend/app/routes/appointment_routes.py
from flask import Blueprint, request
from flask_jwt_extended import jwt_required, get_current_user

from app.appointments.appointment_crud import (
    book_appointment,
    get_patient_appointments,
    get_doctor_appointments,
    update_appointment_status,
    cancel_appointment # <-- ADDED: Import the new function
)

appointment_bp = Blueprint('appointment_bp', __name__)

@appointment_bp.route('/book', methods=['POST'])
@jwt_required()
def book():
    current_user = get_current_user()
    data = request.get_json()
    return book_appointment(current_user, data)

@appointment_bp.route('/patient', methods=['GET'])
@jwt_required()
def view_patient_appointments():
    current_user = get_current_user()
    return get_patient_appointments(current_user)

@appointment_bp.route('/doctor', methods=['GET'])
@jwt_required()
def view_doctor_appointments():
    current_user = get_current_user()
    return get_doctor_appointments(current_user)

@appointment_bp.route('/<int:appointment_id>/status', methods=['PUT'])
@jwt_required()
def update_status(appointment_id):
    current_user = get_current_user()
    data = request.get_json()
    return update_appointment_status(current_user, appointment_id, data)

# --- ADDED: New route for cancelling an appointment ---
@appointment_bp.route('/<int:appointment_id>', methods=['DELETE'])
@jwt_required()
def cancel(appointment_id):
    current_user = get_current_user()
    return cancel_appointment(current_user, appointment_id)
# ----------------------------------------------------

@appointment_bp.route('/', methods=['GET'])
@jwt_required()
def get_patient_appointments_default():
    current_user = get_current_user()
    return get_patient_appointments(current_user)