import json
from flask import request, jsonify
from app.models import Appointment, User
from app.extensions import db
from datetime import datetime, time # Import time
# Use zoneinfo for modern timezone handling (requires Python 3.9+)
# If using older Python, you might need 'pytz'
from zoneinfo import ZoneInfo

# Define the local timezone (adjust if your server/target timezone is different)
LOCAL_TIMEZONE = ZoneInfo("Asia/Kolkata")

# Helper function to format appointment data for the frontend
def _serialize_appointment(appt):
    # Ensure the stored time (assumed UTC) is sent as ISO format
    return {
        "id": appt.id,
        "doctor_id": appt.doctor_id,
        "patient_id": appt.patient_id,
        # Flask/SQLAlchemy usually stores timezone-naive in SQLite, but aware in PGSQL.
        # Sending as ISO format is standard. Frontend handles display conversion.
        "appointment_time": appt.appointment_time.isoformat(),
        "reason": appt.reason,
        "status": appt.status
    }

# Book an appointment (called by a logged-in patient)
def book_appointment(current_user, data):
    try:
        if current_user.role != 'patient':
            return jsonify({"error": "Only patients can book appointments"}), 403

        doctor_id = data.get('doctor_id')
        appointment_time_str = data.get('appointment_time')
        reason = data.get('reason')

        if not all([doctor_id, appointment_time_str, reason]):
            return jsonify({"error": "Doctor ID, appointment time, and reason are required"}), 400

        doctor = User.query.filter_by(id=doctor_id, role='doctor').first()
        if not doctor:
            return jsonify({"error": "Doctor not found"}), 404

        # --- Availability Validation Logic ---
        if not doctor.availability:
            return jsonify({"error": "This doctor has not specified their availability."}), 400

        try:
            availability_data = json.loads(doctor.availability)
        except json.JSONDecodeError:
            return jsonify({"error": "Doctor's availability is incorrectly configured."}), 500

        # Parse the incoming ISO string (which includes timezone info, typically UTC 'Z')
        try:
            # Handle potential 'Z' suffix
            if appointment_time_str.endswith('Z'):
                 appointment_time_str = appointment_time_str.replace('Z', '+00:00')
            # Create timezone-aware datetime object (in UTC)
            appointment_time_utc = datetime.fromisoformat(appointment_time_str)
        except (ValueError, TypeError) as e:
            print(f"Datetime parsing error: {e}")
            return jsonify({"error": "Invalid datetime format received from frontend."}), 400

        # --- Timezone Conversion and Comparison ---
        # Convert the UTC appointment time to the local timezone
        appointment_time_local = appointment_time_utc.astimezone(LOCAL_TIMEZONE)

        # Get the day of the week from the local time
        weekday_name = appointment_time_local.strftime('%A').lower()

        if weekday_name not in availability_data:
            return jsonify({"error": f"Doctor is not available on {weekday_name.capitalize()}s."}), 400

        # Get the doctor's start/end times (naive, assumed local)
        slot = availability_data[weekday_name]
        try:
            # Parse start/end times into time objects
            start_time_local = datetime.strptime(slot['start'], '%H:%M').time()
            end_time_local = datetime.strptime(slot['end'], '%H:%M').time()
        except (ValueError, KeyError):
             return jsonify({"error": "Doctor's availability time format is incorrect."}), 500

        # Compare the time part of the LOCAL appointment time with the doctor's schedule
        appointment_local_time_part = appointment_time_local.time()

        # Check if appointment time is within the slot (inclusive start, exclusive end)
        if not (start_time_local <= appointment_local_time_part < end_time_local):
             return jsonify({"error": f"Appointment time ({appointment_local_time_part.strftime('%H:%M')}) is outside the doctor's availability ({slot['start']} - {slot['end']}) for {weekday_name.capitalize()}."}), 400
        # --- End of Fix ---

        # Save the appointment using the original UTC time
        new_appointment = Appointment(
            patient_id=current_user.id,
            doctor_id=doctor.id,
            appointment_time=appointment_time_utc, # Store in UTC
            reason=reason,
            status='Scheduled'
        )

        db.session.add(new_appointment)
        db.session.commit()

        return jsonify({
            "message": "Appointment booked successfully",
            "appointment_id": new_appointment.id
        }), 201

    except Exception as e:
        db.session.rollback()
        print(f"Error during booking: {e}") # Log the specific error
        return jsonify({"error": "An internal server error occurred during booking.", "details": str(e)}), 500


# View appointments for the logged-in patient
def get_patient_appointments(current_user):
    try:
        appointments = Appointment.query.filter_by(patient_id=current_user.id).order_by(Appointment.appointment_time.asc()).all()
        result = [_serialize_appointment(a) for a in appointments]
        return jsonify({"appointments": result}), 200
    except Exception as e:
        print(f"Error getting patient appointments: {e}")
        return jsonify({"error": "Failed to retrieve appointments"}), 500


# View appointments for the logged-in doctor
def get_doctor_appointments(current_user):
    try:
        appointments = Appointment.query.filter_by(doctor_id=current_user.id).order_by(Appointment.appointment_time.asc()).all()
        result = [_serialize_appointment(a) for a in appointments]
        return jsonify({"appointments": result}), 200
    except Exception as e:
        print(f"Error getting doctor appointments: {e}")
        return jsonify({"error": "Failed to retrieve appointments"}), 500


# Update appointment status (called by a doctor)
def update_appointment_status(current_user, appointment_id, data):
    try:
        if current_user.role != 'doctor':
            return jsonify({"error": "Only doctors can update appointments"}), 403

        appointment = Appointment.query.get(appointment_id)
        if not appointment or appointment.doctor_id != current_user.id:
            return jsonify({"error": "Appointment not found or you are not authorized to edit it"}), 404

        new_status = data.get('status')
        valid_statuses = ['Scheduled', 'Completed', 'Cancelled']
        if new_status not in valid_statuses:
            return jsonify({"error": f"Invalid status. Must be one of: {', '.join(valid_statuses)}"}), 400

        appointment.status = new_status
        db.session.commit()

        return jsonify({
            "message": "Appointment status updated successfully",
            "appointment": _serialize_appointment(appointment)
        }), 200

    except Exception as e:
        db.session.rollback()
        print(f"Error updating appointment status: {e}")
        return jsonify({"error": "Failed to update status"}), 500


# Allows a patient to cancel their own appointment.
def cancel_appointment(current_user, appointment_id):
    try:
        appointment = Appointment.query.get(appointment_id)

        if not appointment:
            return jsonify({"error": "Appointment not found"}), 404

        # Security check: Ensure the person cancelling is the patient who booked it
        if appointment.patient_id != current_user.id:
            return jsonify({"error": "Unauthorized: You can only cancel your own appointments"}), 403

        # Optional: Add check to prevent cancelling completed/already cancelled appointments
        if appointment.status in ['Completed', 'Cancelled']:
             return jsonify({"error": f"Cannot cancel an appointment that is already {appointment.status}."}), 400


        db.session.delete(appointment)
        db.session.commit()

        return jsonify({"message": f"Appointment with ID {appointment_id} has been successfully cancelled."}), 200

    except Exception as e:
        db.session.rollback()
        print(f"Error cancelling appointment: {e}")
        return jsonify({"error": "An internal error occurred during cancellation.", "details": str(e)}), 500