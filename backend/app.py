from app import create_app

app = create_app()

from app.routes.user_routes import user_routes
from app.routes.appointment_routes import appointment_bp

# Register the appointments blueprint
app.register_blueprint(user_routes, url_prefix='/api/users')
app.register_blueprint(appointment_bp, url_prefix='/api/appointments')
