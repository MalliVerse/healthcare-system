import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

// --- Reusable Components ---

const Sidebar = ({ onAppointmentsClick, onHealthRecordClick, onMedicationsClick }) => (
  <div className="hidden md:flex w-64 bg-slate-900 p-6 flex-col">
    <h1 className="text-2xl font-bold text-white mb-10">MediCare</h1>
    <nav className="flex flex-col space-y-2">
      <a href="#" className="bg-cyan-500 text-white px-4 py-2 rounded-lg transition-colors duration-200">Dashboard</a>
      <button onClick={onAppointmentsClick} className="w-full text-left text-gray-400 hover:bg-slate-700 hover:text-white px-4 py-2 rounded-lg transition-colors duration-200">Appointments</button>
      <button onClick={onHealthRecordClick} className="w-full text-left text-gray-400 hover:bg-slate-700 hover:text-white px-4 py-2 rounded-lg transition-colors duration-200">Health Record</button>
      <button onClick={onMedicationsClick} className="w-full text-left text-gray-400 hover:bg-slate-700 hover:text-white px-4 py-2 rounded-lg transition-colors duration-200">Medications</button>
    </nav>
    <div className="mt-auto">
      <button className="w-full bg-red-600 text-white p-3 rounded-lg font-bold hover:bg-red-700 active:bg-red-800 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-400">
        <span>Emergency</span>
        <span className="block text-xl font-normal">100</span>
      </button>
    </div>
  </div>
);

const StatCard = ({ title, value, icon }) => (
  <div className="bg-slate-800 p-6 rounded-xl flex items-center space-x-4 hover:bg-slate-700 hover:-translate-y-1 transition-all duration-200 cursor-pointer">
    <div className="text-3xl">{icon}</div>
    <div>
      <p className="text-gray-400 text-sm">{title}</p>
      <p className="text-white text-xl font-bold">{value}</p>
    </div>
  </div>
);

const AppointmentCard = ({ appointment, doctors }) => {
  const appointmentUTC = new Date(appointment.appointment_time + 'Z');
  const appointmentDate = appointmentUTC.toLocaleDateString('en-IN', {
    weekday: 'long', month: 'long', day: 'numeric'
  });
  // Use 12-hour format for display
  const appointmentTime = appointmentUTC.toLocaleTimeString('en-IN', {
    hour: 'numeric', minute: '2-digit', hour12: true
  });
  const doctor = doctors.find(doc => doc.id === appointment.doctor_id);
  const doctorName = doctor ? doctor.name : `ID: ${appointment.doctor_id}`;
  const status = appointment.status || 'Scheduled';

  return (
    <div className="bg-slate-800 p-4 rounded-lg flex items-center justify-between hover:bg-slate-700 transition-colors duration-200">
      <div>
        <p className="text-white font-semibold">{appointmentDate}</p>
        <p className="text-gray-400 text-sm">with Dr. {doctorName}</p>
        <p className="text-sm text-cyan-300 mt-1 italic">Reason: {appointment.reason}</p>
      </div>
      <div className="flex flex-col items-end space-y-1">
        <div className="text-cyan-400 font-bold bg-slate-700 px-4 py-2 rounded-lg">
          {appointmentTime}
        </div>
        <span className={`text-xs font-bold px-2 py-1 rounded-full whitespace-nowrap ${
            status === 'Completed' ? 'bg-green-800 text-green-200' :
            status === 'Cancelled' ? 'bg-red-800 text-red-200' :
            'bg-cyan-800 text-cyan-200'
         }`}>
           {status.toUpperCase()}
        </span>
      </div>
    </div>
  );
};

// --- Modal Components ---

const AppointmentBookingModal = ({ onClose, onBookingSuccess }) => {
  const [doctors, setDoctors] = useState([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [selectedDoctorInfo, setSelectedDoctorInfo] = useState(null);
  const [selectedDateTime, setSelectedDateTime] = useState(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchDoctors = async () => {
      try {
        const response = await axios.get("http://127.0.0.1:5000/api/users/doctors");
        setDoctors(response.data || []);
      } catch (err) {
        setError("Could not fetch the list of doctors.");
      }
    };
    fetchDoctors();
  }, []);

  const handleDoctorChange = (e) => {
    const doctorId = e.target.value;
    setSelectedDoctorId(doctorId);
    setSelectedDateTime(null);
    const doctorDetails = doctors.find(doc => doc.id === parseInt(doctorId));
    setSelectedDoctorInfo(doctorDetails);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedDoctorId || !selectedDateTime || !reason) {
      setError("All fields are required.");
      return;
    }
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };
      const appointmentData = {
        doctor_id: parseInt(selectedDoctorId),
        appointment_time: selectedDateTime.toISOString(), // Send ISO to backend
        reason,
      };
      await axios.post("http://127.0.0.1:5000/api/appointments/book", appointmentData, { headers });
      onBookingSuccess();
    } catch (err) {
      const errorMessage = err.response?.data?.error || "Booking failed. Please try again.";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const isAvailableDay = (date) => {
    if (!selectedDoctorInfo || !selectedDoctorInfo.availability) return false;
    const dayName = date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    return selectedDoctorInfo.availability.hasOwnProperty(dayName);
  };

  const getAvailableTimes = (date) => {
    if (!date || !isAvailableDay(date)) return [];
    const dayName = date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const availability = selectedDoctorInfo.availability[dayName];
    let times = [];
    const [startHour, startMinute] = availability.start.split(':').map(Number);
    const [endHour, endMinute] = availability.end.split(':').map(Number);
    let baseDate = new Date(date);
    baseDate.setHours(0, 0, 0, 0);
    let startTime = new Date(baseDate);
    startTime.setHours(startHour, startMinute);
    let endTime = new Date(baseDate);
    endTime.setHours(endHour, endMinute);
    let currentTimeSlot = new Date(startTime);
    while (currentTimeSlot < endTime) {
      times.push(new Date(currentTimeSlot));
      currentTimeSlot.setMinutes(currentTimeSlot.getMinutes() + 30);
    }
    return times;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50">
      <div className="bg-slate-800 rounded-xl p-8 w-full max-w-lg text-white mx-4">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Book a New Appointment</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-3xl">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="doctor" className="block text-sm font-medium text-gray-300">Select Doctor</label>
            <select id="doctor" value={selectedDoctorId} onChange={handleDoctorChange} className="mt-1 block w-full bg-slate-700 border-slate-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-cyan-500 focus:border-cyan-500">
              <option value="" disabled>-- Choose a doctor --</option>
              {doctors.map(doc => <option key={doc.id} value={doc.id}>Dr. {doc.name} ({doc.specialization})</option>)}
            </select>
          </div>
          {selectedDoctorInfo && selectedDoctorInfo.availability && (
            <div className="bg-slate-700 p-3 rounded-md text-sm">
              <p><strong className="text-gray-400">Availability:</strong> {Object.entries(selectedDoctorInfo.availability).map(([day, times]) => `${day.charAt(0).toUpperCase() + day.slice(1)}: ${times.start} - ${times.end}`).join('; ')}</p>
            </div>
          )}
          {selectedDoctorInfo && !selectedDoctorInfo.availability && (
            <div className="bg-yellow-800 p-3 rounded-md text-sm">
              <p>This doctor has not specified their availability.</p>
            </div>
          )}
          <div>
            <label htmlFor="appointmentDate" className="block text-sm font-medium text-gray-300">Select an Available Slot</label>
            <DatePicker
                selected={selectedDateTime}
                onChange={(date) => setSelectedDateTime(date)}
                filterDate={isAvailableDay}
                includeTimes={getAvailableTimes(selectedDateTime || new Date())}
                showTimeSelect
                // Use 12-hour format for the picker
                dateFormat="MMMM d, yyyy h:mm aa"
                placeholderText="Click to select date and time"
                className="mt-1 block w-full bg-slate-700 border-slate-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-cyan-500 focus:border-cyan-500"
                disabled={!selectedDoctorId || !selectedDoctorInfo?.availability}
            />
          </div>
          <div>
            <label htmlFor="reason" className="block text-sm font-medium text-gray-300">Reason for Visit</label>
            <textarea id="reason" rows="3" value={reason} onChange={(e) => setReason(e.target.value)} className="mt-1 block w-full bg-slate-700 border-slate-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-cyan-500 focus:border-cyan-500"></textarea>
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex justify-end space-x-4 pt-2">
            <button type="button" onClick={onClose} className="bg-slate-600 hover:bg-slate-500 font-bold py-2 px-4 rounded-lg">Cancel</button>
            <button type="submit" disabled={loading} className="bg-cyan-500 hover:bg-cyan-600 font-bold py-2 px-4 rounded-lg disabled:opacity-50">{loading ? 'Booking...' : 'Confirm Appointment'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

const HealthRecordModal = ({ ehr, medications, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50">
      <div className="bg-slate-800 rounded-xl p-8 w-full max-w-3xl text-white mx-4">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">My Health Record</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-3xl">&times;</button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto pr-2 space-y-6">
          {ehr ? (
            <div className="bg-slate-700 p-6 rounded-lg">
              <h3 className="text-xl font-bold text-cyan-300 mb-4">{ehr.name}</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <p><strong className="text-gray-400">Age:</strong> {ehr.age}</p>
                <p><strong className="text-gray-400">Gender:</strong> {ehr.gender}</p>
                <p><strong className="text-gray-400">Blood Group:</strong> {ehr.blood_group}</p>
                <p className="col-span-2"><strong className="text-gray-400">Conditions:</strong> {(Array.isArray(ehr.conditions) ? ehr.conditions.join(', ') : 'None')}</p>
              </div>
            </div>
          ) : <p>No EHR data found.</p>}
          <div>
            <h3 className="text-xl font-bold mb-4">Medication History</h3>
            <div className="space-y-3">
              {medications.length > 0 ? medications.map(med => (
                <div key={med.id} className="bg-slate-700 p-3 rounded-lg">
                  <p className="font-semibold text-cyan-400">{med.name}</p>
                  <p className="text-xs text-gray-300">{med.dosage} - {med.frequency}</p>
                </div>
              )) : <p className="text-gray-400">No medications on record.</p>}
            </div>
          </div>
        </div>
        <button onClick={onClose} className="w-full mt-6 bg-cyan-500 text-white font-bold py-3 rounded-lg hover:bg-cyan-600">Close</button>
      </div>
    </div>
  );
};

const AppointmentModal = ({ appointments, doctors, onClose, onCancelAppointment }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50">
      <div className="bg-slate-800 rounded-xl p-8 w-full max-w-2xl text-white mx-4">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">My Appointments</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-3xl">&times;</button>
        </div>
        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
          {appointments.length > 0 ? appointments.map(app => {
            const doctor = doctors.find(doc => doc.id === app.doctor_id);
            const doctorName = doctor ? doctor.name : `ID: ${app.doctor_id}`;
            const appointmentUTC = new Date(app.appointment_time + 'Z');

            return (
              <div key={app.id} className="bg-slate-700 p-4 rounded-lg">
                <div className="flex justify-between items-start">
                    <div>
                        <p className="font-semibold">{appointmentUTC.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                        {/* Use 12-hour format */}
                        <p className="text-sm text-cyan-300">at {appointmentUTC.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })}</p>
                        <p className="text-xs text-gray-400">with Dr. {doctorName}</p>
                        <p className="text-sm text-gray-300 mt-1">Reason: {app.reason}</p>
                    </div>
                    <span className={`text-xs font-bold px-2 py-1 rounded-full whitespace-nowrap ${
                        app.status === 'Completed' ? 'bg-green-800 text-green-200' :
                        app.status === 'Cancelled' ? 'bg-red-800 text-red-200' :
                        'bg-cyan-800 text-cyan-200'
                     }`}>
                       {app.status || 'SCHEDULED'}
                    </span>
                </div>
                {(app.status || 'Scheduled') === 'Scheduled' && (
                    <div className="text-right mt-2">
                        <button
                            onClick={() => onCancelAppointment(app.id)}
                            className="text-xs bg-red-600 hover:bg-red-700 text-white font-semibold py-1 px-3 rounded-md transition-colors"
                        >
                            Cancel
                        </button>
                    </div>
                )}
              </div>
            )
          }) : <p className="text-gray-400 text-center py-8">You have no appointments booked.</p>}
        </div>
        <button onClick={onClose} className="w-full mt-6 bg-cyan-500 text-white font-bold py-3 rounded-lg hover:bg-cyan-600">Close</button>
      </div>
    </div>
  );
};

const MedicationModal = ({ medications, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50">
      <div className="bg-slate-800 rounded-xl p-8 w-full max-w-2xl text-white mx-4">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">My Medications</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-3xl">&times;</button>
        </div>
        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
          {medications.length > 0 ? (
            medications.map(med => (
              <div key={med.id} className="bg-slate-700 p-4 rounded-lg">
                <p className="font-bold text-lg text-cyan-300">{med.name}</p>
                <p className="text-sm text-gray-300">Dosage: {med.dosage} - {med.frequency}</p>
                <p className="text-xs text-gray-400 mt-1">
                  Prescribed: {new Date(med.start_date).toLocaleDateString()}
                  {med.end_date && ` — Ended: ${new Date(med.end_date).toLocaleDateString()}`}
                </p>
              </div>
            ))
          ) : (
            <p className="text-gray-400 text-center py-8">No medications found in your records.</p>
          )}
        </div>
        <button onClick={onClose} className="w-full mt-6 bg-cyan-500 text-white font-bold py-3 rounded-lg hover:bg-cyan-600">Close</button>
      </div>
    </div>
  );
};

// --- Main Dashboard Component ---

const PatientDashboard = () => {
  const [appointments, setAppointments] = useState([]);
  const [ehr, setEhr] = useState(null);
  const [medications, setMedications] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [isBookingModalOpen, setBookingModalOpen] = useState(false);
  const [isMedModalOpen, setMedModalOpen] = useState(false);
  const [isAppointmentModalOpen, setAppointmentModalOpen] = useState(false);
  const [isHealthRecordModalOpen, setHealthRecordModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const fetchData = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }
    try {
      setLoading(true);
      const headers = { Authorization: `Bearer ${token}` };
      const [appointResponse, ehrResponse, medResponse, doctorsResponse] = await Promise.all([
        axios.get("http://127.0.0.1:5000/api/appointments/", { headers }),
        axios.get("http://127.0.0.1:5000/api/ehr/", { headers }),
        axios.get("http://127.0.0.1:5000/api/medications/", { headers }),
        axios.get("http://127.0.0.1:5000/api/users/doctors")
      ]);
      setAppointments(appointResponse.data.appointments || []);
      const ehrList = ehrResponse.data.ehrs;
      setEhr(ehrList && ehrList.length > 0 ? ehrList[0] : null);
      setMedications(medResponse.data.medications || []);
      setDoctors(doctorsResponse.data || []);
    } catch (err) {
      console.error("Error fetching patient data:", err);
      setError("Failed to load dashboard data. Please try logging in again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [navigate]);

  const handleBookingSuccess = () => {
    setBookingModalOpen(false);
    fetchData();
  };

  const handleLogout = () => {
    localStorage.clear();
    navigate("/login");
  };

  const handleCancelAppointment = async (appointmentId) => {
    if (window.confirm("Are you sure you want to cancel this appointment?")) {
        try {
            const token = localStorage.getItem("token");
            const headers = { Authorization: `Bearer ${token}` };
            await axios.delete(`http://127.0.0.1:5000/api/appointments/${appointmentId}`, { headers });
            fetchData();
        } catch (err) {
            console.error("Failed to cancel appointment:", err);
            alert("Could not cancel the appointment. Please try again.");
        }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900 text-white text-xl">
        Loading Patient Data...
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-900 text-gray-200 font-sans">
      <Sidebar 
        onAppointmentsClick={() => setAppointmentModalOpen(true)}
        onHealthRecordClick={() => setHealthRecordModalOpen(true)}
        onMedicationsClick={() => setMedModalOpen(true)}
      />
      <main className="flex-1 p-4 md:p-8 overflow-y-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white">Health Dashboard</h1>
            <p className="text-gray-400 text-sm md:text-base">Your personal health overview</p>
          </div>
          <div className="flex items-center space-x-4">
            <span className="hidden sm:block text-white">Welcome, {ehr?.name || 'User'}</span>
            <button onClick={handleLogout} className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 active:bg-red-700 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-red-400">
              Logout
            </button>
          </div>
        </div>
        {error && <div className="mb-8 bg-red-800 text-red-200 p-4 rounded-lg">{error}</div>}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard 
            title="Next Visit" 
            value={appointments.filter(a => (a.status || 'Scheduled') === 'Scheduled')[0] ? new Date(appointments.filter(a => (a.status || 'Scheduled') === 'Scheduled')[0].appointment_time + 'Z').toLocaleDateString('en-IN') : 'None'} 
            icon="🗓️" 
          />
          <div onClick={() => setMedModalOpen(true)}>
            <StatCard 
              title="Active Medications" 
              value={medications.length}
              icon="💊" 
            />
          </div>
          <div onClick={() => setAppointmentModalOpen(true)}>
            <StatCard 
              title="Upcoming" 
              value={`${appointments.filter(a => (a.status || 'Scheduled') === 'Scheduled').length} appointments`}
              icon="🔔" 
            />
          </div>
          <StatCard 
            title="Health Score" 
            value="Good" 
            icon="💚" 
          />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <div className="bg-slate-800 p-6 rounded-xl">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-white">Upcoming Appointments</h2>
                <button onClick={() => setAppointmentModalOpen(true)} className="text-cyan-400 text-sm hover:underline hover:text-cyan-300 transition-colors">View All</button>
              </div>
              <div className="space-y-4">
                {appointments.filter(a => (a.status || 'Scheduled') === 'Scheduled').length > 0 ? (
                  appointments.filter(a => (a.status || 'Scheduled') === 'Scheduled').slice(0, 3).map(app => <AppointmentCard key={app.id} appointment={app} doctors={doctors} />)
                ) : (
                  <p className="text-gray-400">No upcoming appointments.</p>
                )}
              </div>
              <button onClick={() => setBookingModalOpen(true)} className="w-full mt-6 bg-cyan-500 text-white font-bold py-3 rounded-lg hover:bg-cyan-600 active:bg-cyan-700 transform hover:scale-105 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-cyan-400">
                + Book New Appointment
              </button>
            </div>
          </div>
          <div className="bg-slate-800 p-6 rounded-xl">
            <h2 className="text-xl font-bold text-white mb-4">Your Health Info</h2>
            <div className="space-y-4 text-sm">
              <div className="flex justify-between"><span className="text-gray-400">Blood Group</span> <span className="font-semibold text-white">{ehr?.blood_group || 'N/A'}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Conditions</span> <span className="font-semibold text-white text-right">{(Array.isArray(ehr?.conditions) ? ehr.conditions.join(", ") : "None")}</span></div>
              <div className="flex justify-between border-t border-slate-700 mt-4 pt-4"><span className="text-gray-400">Blood Pressure</span> <span className="font-semibold text-green-400">125/80 (Normal)</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Heart Rate</span> <span className="font-semibold text-green-400">72 bpm (Normal)</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Weight</span> <span className="font-semibold text-white">75 kg</span></div>
            </div>
          </div>
        </div>
      </main>
      
      {isBookingModalOpen && <AppointmentBookingModal onClose={() => setBookingModalOpen(false)} onBookingSuccess={handleBookingSuccess} />}
      {isMedModalOpen && <MedicationModal medications={medications} onClose={() => setMedModalOpen(false)} />}
      {isAppointmentModalOpen && <AppointmentModal appointments={appointments} doctors={doctors} onClose={() => setAppointmentModalOpen(false)} onCancelAppointment={handleCancelAppointment} />}
      {isHealthRecordModalOpen && <HealthRecordModal ehr={ehr} medications={medications} onClose={() => setHealthRecordModalOpen(false)} />}
    </div>
  );
};

export default PatientDashboard;