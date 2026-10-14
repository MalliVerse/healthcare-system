# backend/app/auth/jwt_handler.py

from app.extensions import jwt
from app.models import User

# This function is the missing link that connects Flask-JWT-Extended to your User model.
# It tells the library how to load a user from the database given the ID from a token.
@jwt.user_lookup_loader
def user_lookup_callback(_jwt_header, jwt_data):
    """
    This function is called by Flask-JWT-Extended whenever a protected endpoint
    is accessed, and must return an object that identifies the current user.
    """
    # The 'sub' claim is the standard place for the subject/identity of a JWT.
    # In our login function, we set `identity=user.id`, so `jwt_data["sub"]` will be the user's ID.
    identity = jwt_data["sub"]
    return User.query.get(identity)