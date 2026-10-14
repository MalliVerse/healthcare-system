# backend/app/models/__init__.py

from .user_model import User
from .ehr_model import EHR
from .appointment_model import Appointment
from .medication_model import Medication
from flask_migrate import Migrate
from app.extensions import db

migrate = Migrate()

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)
    db.init_app(app)
    migrate.init_app(app, db)
    return app

__all__ = [
    'User',
    'EHR',
    'Appointment',
    'Medication'
]