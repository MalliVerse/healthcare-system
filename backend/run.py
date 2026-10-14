import os
from app import create_app
from app.extensions import db
from flask_migrate import Migrate
from dotenv import load_dotenv

# Load environment variables from the .env file
load_dotenv()

# Create the Flask application instance
app = create_app()

# Initialize Flask-Migrate with the app and db objects.
# This registers the 'db' command line utility.
migrate = Migrate(app, db)

if __name__ == '__main__':
    # Run the application using environment variables for configuration
    app.run(
        debug=os.getenv('FLASK_DEBUG', False),
        port=os.getenv('PORT', 5000),
    )