# backend/app/models/ehr_model.py

from app.extensions import db

class EHR(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)  # patient
    created_by = db.Column(db.Integer, db.ForeignKey("user.id"))               # doctor

    name = db.Column(db.String(100))
    age = db.Column(db.Integer)
    gender = db.Column(db.String(10))
    blood_group = db.Column(db.String(10))
    conditions = db.Column(db.Text)
    # medications = db.Column(db.Text) # <-- DELETE THIS LINE