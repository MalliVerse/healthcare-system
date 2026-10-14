from flask import Flask
from flask_cors import CORS
from config import Config
from app.extensions import db, migrate, jwt

def create_app():
    """
    Application factory function to create and configure the Flask app.
    """
    app = Flask(__name__)
    CORS(app)  # Enable Cross-Origin Resource Sharing
    app.config.from_object(Config)

    # Initialize extensions with the Flask app
    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)

    # The app_context is necessary for Flask extensions to work correctly
    with app.app_context():
        # Import blueprints within the context to avoid circular imports
        from app.routes.auth_routes import auth_bp
        from app.routes.ehr_routes import ehr_bp
        from app.routes.admin_routes import admin_routes
        from app.routes.user_routes import user_routes
        from app.routes.appointment_routes import appointment_bp
        from app.routes.medication_routes import medication_bp

        # Register all the blueprints with the app
        app.register_blueprint(auth_bp, url_prefix='/api/auth')
        app.register_blueprint(ehr_bp, url_prefix='/api/ehr')
        app.register_blueprint(admin_routes, url_prefix='/api/admin')
        app.register_blueprint(user_routes, url_prefix='/api/users')
        app.register_blueprint(appointment_bp, url_prefix='/api/appointments')
        app.register_blueprint(medication_bp) # Prefix is already defined in the blueprint file

        # Import the jwt_handler to ensure the user_lookup_loader is registered.
        # This is the crucial link for get_current_user() to work.
        from app.auth import jwt_handler

        # Note: db.create_all() is removed. Flask-Migrate now handles all database schema management.

    return app