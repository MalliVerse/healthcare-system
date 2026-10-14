import smtplib
import os
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
