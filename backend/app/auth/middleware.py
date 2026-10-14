# app/auth/middleware.py

from functools import wraps
from flask import request, jsonify
from app.auth.jwt_handler import decode_token
from app.models.user_model import User
from app.extensions import db
import jwt
from jwt import ExpiredSignatureError, InvalidTokenError
from config import Config


def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if 'Authorization' in request.headers:
            token = request.headers['Authorization'].split()[1]
        
        if not token:
            return jsonify({'message': 'Token is missing'}), 401

        try:
            data = jwt.decode(token, Config.SECRET_KEY, algorithms=["HS256"])
            user_id = data['user_id']  # ← FIXED from 'id'
            current_user = User.query.filter_by(id=user_id).first()

            if not current_user:
                return jsonify({'message': 'User not found'}), 404
        except Exception as e:
            return jsonify({'message': 'Token is invalid', 'error': str(e)}), 401

        return f(current_user, *args, **kwargs)

    return decorated

def role_required(required_role):
    def decorator(f):
        @wraps(f)
        def wrapped(current_user, *args, **kwargs):
            if current_user.role != required_role:
                return jsonify({"error": f"Access denied. Requires '{required_role}' role"}), 403
            return f(current_user, *args, **kwargs)
        return wrapped
    return decorator
