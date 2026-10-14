import os
import secrets
import datetime
from werkzeug.security import generate_password_hash, check_password_hash
from flask import request, jsonify
from flask_jwt_extended import create_access_token
from app.auth.validators import VALID_ROLES
from app.extensions import db
from app.models.user_model import User
from email_validator import validate_email, EmailNotValidError
from app.notifications.email_service import send_password_reset_email

# --- ✅ UPDATED: Added "specialization" and "availability" to the allowed list ---
ALLOWED_REGISTER_FIELDS = {"name", "email", "password", "role", "admin_secret", "specialization", "availability"}
REQUIRED_REGISTER_FIELDS = {"name", "email", "password", "role"}
RESET_TOKEN_LIFETIME_HOURS = 1

def _validate_registration_data(data):
    """
    Performs field and basic data validation for user registration.
    Returns a tuple: (error_response, status_code) or (None, None) on success.
    """
    extra_fields = set(data.keys()) - ALLOWED_REGISTER_FIELDS
    if extra_fields:
        return jsonify({"error": f"Unexpected fields: {', '.join(extra_fields)}"}), 400

    missing_fields = REQUIRED_REGISTER_FIELDS - set(data.keys())
    if missing_fields:
        return jsonify({"error": f"Missing required fields: {', '.join(missing_fields)}"}), 400
    
    email = data.get("email", "").strip().lower()
    role = data.get("role", "").lower()
    
    try:
        validate_email(email)
    except EmailNotValidError as e:
        return jsonify({"error": str(e)}), 400

    if role not in VALID_ROLES:
        return jsonify({"message": f"Invalid role. Valid roles: {', '.join(VALID_ROLES)}"}), 400

    return None, None


def register_user():
    """Handles new user registration with robust validation and security checks."""
    data = request.get_json()

    error_response, status_code = _validate_registration_data(data)
    if error_response:
        return error_response, status_code

    name = data.get("name")
    email = data.get("email").strip().lower()
    password = str(data.get("password", ""))
    role = data.get("role", "").lower()
    admin_secret = data.get("admin_secret")
    
    # --- ✅ ADDED: Get the new optional fields from the request ---
    specialization = data.get("specialization")
    availability = data.get("availability")

    if role != "patient":
        true_secret = os.getenv("ADMIN_SECRET")
        if not true_secret or admin_secret != true_secret:
            return jsonify({"error": f"Unauthorized to register as {role}"}), 403

    if User.query.filter_by(email=email).first():
        return jsonify({"message": "User already exists"}), 400

    hashed_pw = generate_password_hash(password, method='pbkdf2:sha256')

    # --- ✅ UPDATED: Pass the new fields when creating the User object ---
    new_user = User(
        name=name, 
        email=email, 
        password=hashed_pw, 
        role=role,
        specialization=specialization,
        availability=availability
    )
    db.session.add(new_user)
    db.session.commit()

    return jsonify({"message": f"{role.capitalize()} registered successfully!"}), 201


def login_user():
    """Handles user login and token generation."""
    data = request.get_json()
    email = data.get("email")
    password = data.get("password")

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    user = User.query.filter_by(email=email.strip().lower()).first()
    if not user:
        return jsonify({"error": "Email does not exist"}), 401

    if not check_password_hash(user.password, password):
        return jsonify({"error": "Incorrect password"}), 401

    token = create_access_token(identity=str(user.id), additional_claims={'role': user.role})

    return jsonify({
        "token": token,
        "role": user.role,
        "name": user.name,
        "user_id": user.id
    }), 200


def forgot_password():
    """
    Handles the request to initiate a password reset.
    """
    data = request.get_json()
    email = data.get("email", "").strip().lower()

    if not email:
        return jsonify({"error": "Email is required"}), 400

    user = User.query.filter_by(email=email).first()

    if user:
        token = secrets.token_urlsafe(32)
        token_expiration = datetime.datetime.now() + datetime.timedelta(hours=RESET_TOKEN_LIFETIME_HOURS)
        user.reset_token = token
        user.reset_token_expiration = token_expiration
        db.session.commit()
        base_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
        reset_link = f"{base_url}/reset-password?token={token}"
        send_password_reset_email(user.email, reset_link)

    return jsonify({"message": "If an account with that email exists, a password reset link has been sent."}), 200


def reset_password():
    """
    Handles the password reset request.
    """
    data = request.get_json()
    token = data.get("token")
    new_password = data.get("newPassword")

    if not token or not new_password:
        return jsonify({"error": "Token and new password are required"}), 400

    user = User.query.filter_by(reset_token=token).first()

    if not user or user.reset_token_expiration < datetime.datetime.now():
        if user:
            user.reset_token = None
            user.reset_token_expiration = None
            db.session.commit()
        return jsonify({"error": "Invalid or expired token."}), 400

    hashed_password = generate_password_hash(new_password, method='pbkdf2:sha256')
    user.password = hashed_password
    
    user.reset_token = None
    user.reset_token_expiration = None
    db.session.commit()

    return jsonify({"message": "Password has been successfully reset."}), 200