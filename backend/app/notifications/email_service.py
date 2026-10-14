import smtplib
import os
import threading
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv

load_dotenv()  # Load environment variables from .env

EMAIL_USER = os.getenv('EMAIL_USER')
EMAIL_PASS = os.getenv('EMAIL_PASS')

def send_email(recipient, subject, body):
    """
    Your existing generic email sending function.
    """
    try:
        msg = MIMEMultipart()
        msg['From'] = EMAIL_USER
        msg['To'] = recipient
        msg['Subject'] = subject

        msg.attach(MIMEText(body, 'plain'))

        with smtplib.SMTP_SSL('smtp.gmail.com', 465) as server:
            server.login(EMAIL_USER, EMAIL_PASS)
            server.send_message(msg)

        print(f"[Email Sent] To: {recipient} | Subject: {subject}")
    except Exception as e:
        print(f"[Email Error] {str(e)}")


def send_password_reset_email(recipient_email, reset_link):
    """
    Sends a password reset email to the user with a unique reset link.
    """
    subject = "Password Reset Request"
    body = f"""
Hello,

We received a request to reset your password.
Please click the link below to set a new password:

{reset_link}

This link is valid for a limited time. If you did not request a password reset, please ignore this email.

Thank you,
The HealthLink Team
"""
    send_email(recipient_email, subject, body)


# ======================================================================
# Appointment notifications
# ======================================================================
LOCAL_TZ = ZoneInfo("Asia/Kolkata")


def _format_time(dt):
    """Appointment times are stored in UTC; show them in local time."""
    if dt is None:
        return "N/A"
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    local = dt.astimezone(LOCAL_TZ)
    return local.strftime("%A, %d %B %Y at %I:%M %p IST")


def build_appointment_info(appt):
    """
    Copy everything the emails need into a plain dict, so the email thread
    never touches the database session (and it still works after a delete).
    """
    from app.models import User  # imported here to avoid circular imports

    patient = User.query.get(appt.patient_id)
    doctor = User.query.get(appt.doctor_id)
    return {
        "id": appt.id,
        "patient_name": patient.name if patient else "Patient",
        "patient_email": patient.email if patient else None,
        "doctor_name": doctor.name if doctor else "Doctor",
        "doctor_email": doctor.email if doctor else None,
        "time": _format_time(appt.appointment_time),
        "reason": appt.reason or "-",
        "status": appt.status,
    }


def send_email_async(recipient, subject, body):
    """Send in a background thread so a slow mail server never blocks the API."""
    if not recipient:
        return
    threading.Thread(
        target=send_email, args=(recipient, subject, body), daemon=True
    ).start()


def _details(info):
    return (
        f"  Appointment ID : {info['id']}\n"
        f"  Patient        : {info['patient_name']}\n"
        f"  Doctor         : Dr. {info['doctor_name']}\n"
        f"  Date & time    : {info['time']}\n"
        f"  Reason         : {info['reason']}\n"
        f"  Status         : {info['status']}\n"
    )


def notify_appointment(event, info):
    """
    event: booked | status_changed | cancelled_by_patient | updated_by_admin | deleted_by_admin
    Never raises - a failed email must not break booking.
    """
    try:
        sign = "\nThank you,\nThe HealthLink Team\n"
        patient_to, doctor_to = info["patient_email"], info["doctor_email"]
        d = _details(info)

        if event == "booked":
            send_email_async(
                patient_to, "Appointment confirmed",
                f"Hello {info['patient_name']},\n\nYour appointment has been booked.\n\n{d}{sign}")
            send_email_async(
                doctor_to, "New appointment booked",
                f"Hello Dr. {info['doctor_name']},\n\nA patient has booked an appointment with you.\n\n{d}{sign}")

        elif event == "status_changed":
            send_email_async(
                patient_to, f"Appointment {info['status'].lower()}",
                f"Hello {info['patient_name']},\n\nYour appointment status is now: {info['status']}.\n\n{d}{sign}")

        elif event == "cancelled_by_patient":
            send_email_async(
                patient_to, "Appointment cancelled",
                f"Hello {info['patient_name']},\n\nYour appointment has been cancelled.\n\n{d}{sign}")
            send_email_async(
                doctor_to, "Appointment cancelled by patient",
                f"Hello Dr. {info['doctor_name']},\n\n{info['patient_name']} has cancelled this appointment.\n\n{d}{sign}")

        elif event == "updated_by_admin":
            for to, name in ((patient_to, info["patient_name"]), (doctor_to, "Dr. " + info["doctor_name"])):
                send_email_async(
                    to, "Appointment updated",
                    f"Hello {name},\n\nAn administrator has updated this appointment.\n\n{d}{sign}")

        elif event == "deleted_by_admin":
            for to, name in ((patient_to, info["patient_name"]), (doctor_to, "Dr. " + info["doctor_name"])):
                send_email_async(
                    to, "Appointment removed",
                    f"Hello {name},\n\nAn administrator has removed this appointment.\n\n{d}{sign}")
    except Exception as e:
        print(f"[Notify Error] {e}")
