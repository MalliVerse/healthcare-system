import React, { useState } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";

// --- Modal Component for Doctor Details ---
const DoctorDetailsModal = ({ onClose, onSave }) => {
  const [specialization, setSpecialization] = useState("");
  const [availability, setAvailability] = useState({
    monday: { active: false, start: "09:00", end: "17:00" },
    tuesday: { active: false, start: "09:00", end: "17:00" },
    wednesday: { active: false, start: "09:00", end: "17:00" },
    thursday: { active: false, start: "09:00", end: "17:00" },
    friday: { active: false, start: "09:00", end: "17:00" },
    saturday: { active: false, start: "09:00", end: "17:00" },
    sunday: { active: false, start: "09:00", end: "17:00" },
  });

  const handleDayToggle = (day) => {
    setAvailability(prev => ({
      ...prev,
      [day]: { ...prev[day], active: !prev[day].active }
    }));
  };

  const handleTimeChange = (day, type, value) => {
    setAvailability(prev => ({
      ...prev,
      [day]: { ...prev[day], [type]: value }
    }));
  };

  const handleSave = () => {
    const availabilityJSON = {};
    for (const day in availability) {
      if (availability[day].active) {
        availabilityJSON[day] = {
          start: availability[day].start,
          end: availability[day].end
        };
      }
    }
    
    onSave({
      specialization,
      availability: JSON.stringify(availabilityJSON)
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50">
      <div className="bg-slate-800 rounded-xl p-8 w-full max-w-2xl text-white mx-4">
        <h2 className="text-2xl font-bold mb-4">Doctor Details</h2>
        <p className="text-gray-400 mb-6">Please provide your specialization and weekly availability.</p>
        
        <div className="space-y-6">
          <div>
            <label htmlFor="specialization" className="block text-sm font-medium text-gray-300">Specialization</label>
            <input
              type="text"
              id="specialization"
              value={specialization}
              onChange={(e) => setSpecialization(e.target.value)}
              placeholder="e.g., Cardiologist, ENT"
              className="mt-1 block w-full bg-slate-700 border-slate-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-cyan-500 focus:border-cyan-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300">Availability</label>
            <div className="space-y-3 mt-2">
              {Object.keys(availability).map(day => (
                <div key={day} className="grid grid-cols-1 md:grid-cols-4 items-center gap-x-4 gap-y-2 p-3 bg-slate-700 rounded-lg">
                  <div className="flex items-center col-span-1">
                    <input type="checkbox" id={day} checked={availability[day].active} onChange={() => handleDayToggle(day)} className="h-4 w-4 rounded text-cyan-500 focus:ring-cyan-600"/>
                    <label htmlFor={day} className="ml-2 capitalize">{day}</label>
                  </div>
                  {availability[day].active && (
                    <>
                      <div className="col-span-1">
                        <label className="text-xs text-gray-400">From</label>
                        <input type="time" value={availability[day].start} onChange={(e) => handleTimeChange(day, 'start', e.target.value)} className="w-full bg-slate-600 border-slate-500 rounded-md text-sm p-1"/>
                      </div>
                      <div className="col-span-1">
                        <label className="text-xs text-gray-400">To</label>
                        <input type="time" value={availability[day].end} onChange={(e) => handleTimeChange(day, 'end', e.target.value)} className="w-full bg-slate-600 border-slate-500 rounded-md text-sm p-1"/>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end space-x-4 mt-8">
          <button type="button" onClick={onClose} className="bg-slate-600 hover:bg-slate-500 font-bold py-2 px-4 rounded-lg">Cancel</button>
          <button type="button" onClick={handleSave} className="bg-cyan-500 hover:bg-cyan-600 font-bold py-2 px-4 rounded-lg">Save Details</button>
        </div>
      </div>
    </div>
  );
};


// --- Main Register Component ---

const Register = () => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "patient",
    admin_secret: "",
    specialization: "",
    availability: ""
  });
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isDoctorModalOpen, setIsDoctorModalOpen] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });

    if (name === "role" && value === "doctor") {
      setIsDoctorModalOpen(true);
    }
  };

  const handleDoctorDetailsSave = (doctorData) => {
    setFormData(prevData => ({
      ...prevData,
      specialization: doctorData.specialization,
      availability: doctorData.availability,
    }));
    setIsDoctorModalOpen(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    
    const dataToSend = {
      name: formData.name,
      email: formData.email,
      password: formData.password,
      role: formData.role,
    };

    if (formData.role !== "patient") {
      dataToSend.admin_secret = formData.admin_secret;
      if (formData.role === "doctor") {
        dataToSend.specialization = formData.specialization;
        dataToSend.availability = formData.availability;
      }
    }

    try {
      await axios.post(
        "http://127.0.0.1:5000/api/auth/register",
        dataToSend
      );
      navigate("/login?registrationSuccess=true");
    } catch (err) {
      console.error("Registration failed:", err.response?.data || err.message);
      const errorMessage = err.response?.data?.message || err.response?.data?.error || "Registration failed. Please try again.";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-2xl mx-auto bg-slate-800 p-8 sm:p-10 rounded-2xl shadow-lg">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-white">Create Your MediCare Account</h1>
          <p className="text-gray-400 mt-2">Join our platform to manage your healthcare journey.</p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="name" className="block text-gray-300 font-semibold text-lg mb-2">Full Name</label>
            <input type="text" name="name" id="name" className="w-full p-4 bg-slate-700 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-cyan-500" placeholder="John Doe" value={formData.name} onChange={handleChange} required />
          </div>
          <div>
            <label htmlFor="email" className="block text-gray-300 font-semibold text-lg mb-2">Email Address</label>
            <input type="email" name="email" id="email" className="w-full p-4 bg-slate-700 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-cyan-500" placeholder="your.email@example.com" value={formData.email} onChange={handleChange} required />
          </div>
          <div>
            <label htmlFor="password" className="block text-gray-300 font-semibold text-lg mb-2">Password</label>
            <input type="password" name="password" id="password" className="w-full p-4 bg-slate-700 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-cyan-500" placeholder="••••••••" value={formData.password} onChange={handleChange} required />
          </div>
          <div>
            <label htmlFor="role" className="block text-gray-300 font-semibold text-lg mb-2">Register As</label>
            <select name="role" id="role" className="w-full p-4 bg-slate-700 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-cyan-500" value={formData.role} onChange={handleChange}>
              <option value="patient">Patient</option>
              <option value="doctor">Doctor</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          {formData.role !== "patient" && (
            <div>
              <label htmlFor="admin_secret" className="block text-gray-300 font-semibold text-lg mb-2">Admin Secret</label>
              <input type="password" name="admin_secret" id="admin_secret" className="w-full p-4 bg-slate-700 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-cyan-500" placeholder="Required for Doctor/Admin" value={formData.admin_secret} onChange={handleChange} required />
            </div>
          )}
          {error && (
            <div className="bg-red-900 border border-red-700 text-red-300 px-4 py-3 rounded-lg text-center font-medium animate-shake">
              {error}
            </div>
          )}
          <button type="submit" className={`w-full bg-cyan-500 hover:bg-cyan-600 text-white p-4 rounded-xl shadow-lg transition-all duration-300 text-xl font-bold flex items-center justify-center ${isLoading ? "opacity-70 cursor-not-allowed" : ""}`} disabled={isLoading}>
            {isLoading ? "Registering..." : "Create Account"}
          </button>
        </form>
        <p className="text-center mt-8 text-gray-400">
          Already have an account?{" "}
          <Link to="/login" className="text-cyan-400 hover:underline font-semibold">Login here</Link>
        </p>
      </div>
      
      {isDoctorModalOpen && (
        <DoctorDetailsModal 
          onClose={() => {
            setFormData(prev => ({...prev, role: 'patient'}));
            setIsDoctorModalOpen(false);
          }}
          onSave={handleDoctorDetailsSave} 
        />
      )}
    </div>
  );
};

export default Register;