# 📁 Backend Folder Structure
```

📁 backend/
│
├── 📁 app/ # Core application package
│ ├── 📁 auth/ # Authentication, JWT, and role validation
│ │ ├── auth.py # Registration and login logic
│ │ ├── jwt_handler.py # JWT encode/decode utilities
│ │ ├── middleware.py # Token and role-based access decorators
│ │ └── validators.py # Role validation helpers
│ │
│ ├── 📁 models/ # SQLAlchemy models
│ │ ├── user_model.py # User model (Admin, Doctor, Patient)
│ │ ├── ehr_model.py # EHR schema
│ │ └── appointment_model.py # Appointment schema
│ │
│ ├── 📁 ehr/ # EHR CRUD logic
│ │ └── ehr_crud.py
│ │
│ ├── 📁 appointments/ # Appointment booking and retrieval logic
│ │ └── appointment_crud.py
│ │
│ ├── 📁 notifications/ # Email and SMS utilities
│ │ ├── email_service.py
│ │ └── sms_service.py
│ │
│ ├── 📁 routes/ # All API route blueprints
│ │ ├── auth_routes.py
│ │ ├── admin_routes.py
│ │ ├── ehr_routes.py
│ │ ├── appointment_routes.py
│ │ └── user_routes.py
│ │
│ ├── 📁 utils/ # General helper utilities
│ │ └── helpers.py
│ │
│ ├── init.py # Application factory (Flask app creator)
│ └── extensions.py # Extensions like SQLAlchemy, Mail
│
├── 📁 instance/
│ └── healthcare.db # SQLite database (auto-created)
│
├── config.py # App configuration (uses .env)
├── run.py # App entry point for running Flask server
├── requirements.txt # Python dependencies

```
## API Endpoints

1.  **Auth Endpoints (/api/auth):**
    * POST /api/auth/register: Registers a new user.

Request body:
```
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "securePassword",
  "role": "admin | doctor | patient",
  "admin_secret": "SUPER_SECRET_ADMIN_KEY" // Only if role is admin
}

```
   * POST /api/auth/login: Logs in a user and returns a JWT token.
Request body:
```
{
  "email": "john@example.com",
  "password": "securePassword"
}
```
Response body:

```
{
  "token": "<JWT_TOKEN>",
  "role": "doctor",
  "name": "John Doe",
  "user_id": 2
}
```
2. ### Admin Endpoints (/api/admin):###
    * 🔐 Requires Admin JWT token
    
* GET /api/admin/doctors:
    * Returns a list of all registered doctors.
* GET /api/admin/patients:
    * Returns a list of all registered patients.
* GET /api/admin/ehrs:
    * Returns all EHR records in the system.
* DELETE /api/admin/doctor/<user_id>:
    * Deletes a doctor by user ID.
* DELETE /api/admin/patient/<user_id>:
    * Deletes a patient by user ID.
* DELETE /api/admin/ehr/<ehr_id>:
    * Deletes any EHR by its ID.

3. ### EHR Endpoints (/api/ehr): ###
    * 🔐 Requires Doctor or Patient token
    * POST /api/ehr/create: 
        * Create a new EHR (Doctor only). 

          Request body:
```
{
  "user_id": 5,
  "name": "Alice",
  "age": 30,
  "gender": "Female",
  "blood_group": "A+",
  "conditions": "Diabetes",
  "medications": "Metformin"
}
```
* PUT /api/ehr/update/<ehr_id>
    * Update EHR by ID (Doctor only).
* DELETE /api/ehr/delete/<ehr_id>
    * Delete EHR by ID (Doctor only).
* GET /api/ehr/patient/<patient_id>
    * Get all EHRs of a specific patient.
* Doctor: can view their patients' EHRs
* Patient: can view their own EHRs

4. ### 📅 Appointment Endpoints (/api/appointments): ###
    * 🔐 Authenticated access required
    * POST /api/appointments/book
        * Book an appointment (typically by patient).

          Request Body:
 ```
 {
  "doctor_id": 2,
  "patient_id": 5,
  "date": "2025-08-05",
  "time": "15:00",
  "reason": "Regular check-up"
}
 ```

* GET /api/appointments/patient/<patient_id>
    * Returns all appointments booked by the patient.
* GET /api/appointments/doctor/<doctor_id>
    * Returns all appointments for a specific doctor.