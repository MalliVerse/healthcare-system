# app/routes/auth_routes.py

from flask import Blueprint
from app.auth.auth import register_user, login_user, forgot_password, reset_password

auth_bp = Blueprint("auth_bp", __name__)

@auth_bp.route("/register", methods=["POST"])
def register():
    return register_user()

@auth_bp.route("/login", methods=["POST"])
def login():
    return login_user()

@auth_bp.route("/forgot-password", methods=["POST"])
def forgot_password_route():
    return forgot_password()

@auth_bp.route("/reset-password", methods=["POST"])
def reset_password_route():
    return reset_password()
