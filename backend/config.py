import os

class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY", "supersecret")
    SQLALCHEMY_DATABASE_URI = "sqlite:///healthcare.db"
    SQLALCHEMY_TRACK_MODIFICATIONS = False
