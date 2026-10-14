from app.extensions import db

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password = db.Column(db.String(200), nullable=False)
    role = db.Column(db.String(20), nullable=False)

    specialization = db.Column(db.String(100), nullable=True)
    # UPDATED: Availability is now stored as a JSON string for structured data
    availability = db.Column(db.Text, nullable=True) # e.g., '{"monday": {"start": "09:00", "end": "17:00"}}'

    patient_ehrs = db.relationship('EHR', backref='patient', lazy=True, foreign_keys='EHR.user_id')
    doctor_ehrs = db.relationship('EHR', backref='doctor', lazy=True, foreign_keys='EHR.created_by')
    reset_token = db.Column(db.String(255), nullable=True)
    reset_token_expiration = db.Column(db.DateTime, nullable=True)