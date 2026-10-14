from app.extensions import db
from datetime import datetime

class Medication(db.Model):
    __tablename__ = 'medication' # Explicitly name the table
    id = db.Column(db.Integer, primary_key=True)
    ehr_id = db.Column(db.Integer, db.ForeignKey('ehr.id'), nullable=False)
    prescribed_by_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False) # Doctor's ID
    
    name = db.Column(db.String(100), nullable=False)
    dosage = db.Column(db.String(50)) # e.g., "500mg"
    frequency = db.Column(db.String(100)) # e.g., "Twice a day with food"
    start_date = db.Column(db.DateTime, default=datetime.utcnow)
    end_date = db.Column(db.DateTime, nullable=True) # Can be null for ongoing medication
    notes = db.Column(db.Text, nullable=True)

    # This creates a relationship so you can access the EHR record from a Medication object
    ehr = db.relationship('EHR', backref=db.backref('medications_list', lazy='dynamic', cascade="all, delete-orphan"))
    
    # This creates a relationship to the User who prescribed it
    prescribed_by = db.relationship('User', foreign_keys=[prescribed_by_id])