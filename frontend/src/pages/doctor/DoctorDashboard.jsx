import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

// --- Reusable Components ---
const Sidebar = ({ handleLogout, onAppointmentsClick, onAllPatientsClick }) => (
  <div className="hidden md:flex w-64 bg-slate-900 p-6 flex-col">
    <h1 className="text-2xl font-bold text-white mb-10">MediCare</h1>
    <nav className="flex flex-col space-y-2">
      <a href="#" className="bg-cyan-500 text-white px-4 py-2 rounded-lg">Dashboard</a>
      <button onClick={onAppointmentsClick} className="w-full text-left text-gray-400 hover:bg-slate-700 hover:text-white px-4 py-2 rounded-lg">Appointments</button>
      <button onClick={onAllPatientsClick} className="w-full text-left text-gray-400 hover:bg-slate-700 hover:text-white px-4 py-2 rounded-lg">All Patients</button>
    </nav>
    <div className="mt-auto">
       <button onClick={handleLogout} className="w-full bg-red-600 text-white p-3 rounded-lg font-bold hover:bg-red-700 active:bg-red-800 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-400">
           Logout
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


// --- Modal Components ---

const PatientEHRModal = ({ patient, onClose, onDataChange }) => {
    const [ehrRecords, setEhrRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [editingEhr, setEditingEhr] = useState(null);
    const [addingMedicationTo, setAddingMedicationTo] = useState(null);

    useEffect(() => {
        const fetchEHR = async () => {
            if (!patient) return;
            setLoading(true);
            setError('');
            try {
                const token = localStorage.getItem("token");
                const response = await axios.get(`http://127.0.0.1:5000/api/ehr/patient/${patient.id}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setEhrRecords(response.data.ehrs || []);
            } catch (err) {
                setError(`Failed to fetch EHR for ${patient.name}. Ensure the endpoint exists and the token is valid.`);
                console.error("Fetch EHR Error:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchEHR();
    }, [patient]);

    const handleEditSubmit = async (e, ehrId) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const updatedData = {
            age: parseInt(formData.get('age')) || null,
            gender: formData.get('gender'),
            blood_group: formData.get('blood_group'),
            conditions: formData.get('conditions').split(',').map(c => c.trim()).filter(c => c)
        };
        Object.keys(updatedData).forEach(key => (updatedData[key] == null || updatedData[key] === '') && delete updatedData[key]);

        if (Object.keys(updatedData).length === 0) {
             alert('No changes detected.');
             setEditingEhr(null);
             return;
        }

        try {
            const token = localStorage.getItem("token");
            await axios.put(`http://127.0.0.1:5000/api/ehr/update/${ehrId}`, updatedData, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setEditingEhr(null);
            const response = await axios.get(`http://127.0.0.1:5000/api/ehr/patient/${patient.id}`, { headers: { Authorization: `Bearer ${token}` } });
            setEhrRecords(response.data.ehrs || []);
            alert('EHR updated successfully!');
        } catch(err) {
            alert(err.response?.data?.error || 'Failed to update EHR.');
            console.error("Update EHR Error:", err);
        }
    };
    
    const handleMedicationSubmit = async (e, ehrId) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const medData = {
            ehr_id: ehrId,
            name: formData.get('medName'),
            dosage: formData.get('dosage'),
            frequency: formData.get('frequency'),
            notes: formData.get('notes')
        };
        
        if (!medData.name || !medData.dosage || !medData.frequency) {
            alert('Medication name, dosage, and frequency are required.');
            return;
        }

        try {
            const token = localStorage.getItem("token");
             await axios.post(`http://127.0.0.1:5000/api/medications/`, medData, { headers: { Authorization: `Bearer ${token}` } });
            setAddingMedicationTo(null);
            alert('Medication added successfully!');
        } catch(err) {
             alert(err.response?.data?.error || 'Failed to add medication.');
             console.error("Add Medication Error:", err);
        }
    };

    if (!patient) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50">
            <div className="bg-slate-800 rounded-xl p-8 w-full max-w-4xl text-white mx-4">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold">EHR for {patient.name} (ID: {patient.id})</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white text-3xl">&times;</button>
                </div>
                <div className="max-h-[70vh] overflow-y-auto pr-2 space-y-6">
                    {loading && <p>Loading EHR...</p>}
                    {error && <p className="text-red-400">{error}</p>}
                    {!loading && ehrRecords.length === 0 && <p>No EHR records found for this patient.</p>}

                    {ehrRecords.map(ehr => (
                        <div key={ehr.id} className="bg-slate-700 p-4 rounded-lg mb-4">
                            {editingEhr === ehr.id ? (
                                <form onSubmit={(e) => handleEditSubmit(e, ehr.id)} className="space-y-3 text-sm">
                                    <h3 className="font-semibold text-lg mb-2">Editing Record ID: {ehr.id}</h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <input name="age" type="number" defaultValue={ehr.age} placeholder="Age" className="bg-slate-600 p-2 rounded"/>
                                        <input name="gender" defaultValue={ehr.gender} placeholder="Gender" className="bg-slate-600 p-2 rounded"/>
                                        <input name="blood_group" defaultValue={ehr.blood_group} placeholder="Blood Group (e.g., A+)" className="bg-slate-600 p-2 rounded"/>
                                    </div>
                                    <textarea name="conditions" defaultValue={(ehr.conditions || []).join(', ')} placeholder="Conditions (comma-separated)" className="w-full bg-slate-600 p-2 rounded" rows="2"></textarea>
                                    <div className="flex justify-end gap-2">
                                        <button type="button" onClick={() => setEditingEhr(null)} className="bg-slate-500 px-3 py-1 rounded">Cancel</button>
                                        <button type="submit" className="bg-cyan-500 px-3 py-1 rounded">Save Changes</button>
                                    </div>
                                </form>
                            ) : (
                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <h3 className="font-semibold text-lg">Record ID: {ehr.id}</h3>
                                        <button onClick={() => setEditingEhr(ehr.id)} className="text-xs bg-yellow-600 hover:bg-yellow-700 px-2 py-1 rounded">Edit Record</button>
                                    </div>
                                    <p><strong>Name:</strong> {ehr.name || patient.name}</p>
                                    <p><strong>Age:</strong> {ehr.age || 'N/A'}</p>
                                    <p><strong>Gender:</strong> {ehr.gender || 'N/A'}</p>
                                    <p><strong>Blood Group:</strong> {ehr.blood_group || 'N/A'}</p>
                                    <p><strong>Conditions:</strong> {(ehr.conditions || []).join(', ') || 'None'}</p>
                                    <button onClick={() => setAddingMedicationTo(ehr.id)} className="mt-2 text-xs bg-green-600 hover:bg-green-700 px-2 py-1 rounded">Add Medication</button>
                                </div>
                            )}
                             {addingMedicationTo === ehr.id && (
                                <form onSubmit={(e) => handleMedicationSubmit(e, ehr.id)} className="mt-4 p-3 bg-slate-600 rounded space-y-2 text-sm">
                                     <h4 className="font-semibold">Add New Medication for Record {ehr.id}</h4>
                                     <input name="medName" placeholder="Medication Name" required className="w-full bg-slate-500 p-2 rounded"/>
                                     <input name="dosage" placeholder="Dosage (e.g., 500mg)" required className="w-full bg-slate-500 p-2 rounded"/>
                                     <input name="frequency" placeholder="Frequency (e.g., Twice daily)" required className="w-full bg-slate-500 p-2 rounded"/>
                                     <textarea name="notes" placeholder="Notes (optional)" className="w-full bg-slate-500 p-2 rounded" rows="2"></textarea>
                                      <div className="flex justify-end gap-2">
                                        <button type="button" onClick={() => setAddingMedicationTo(null)} className="bg-slate-500 px-3 py-1 rounded">Cancel</button>
                                        <button type="submit" className="bg-green-500 px-3 py-1 rounded">Add Medication</button>
                                    </div>
                                </form>
                            )}
                        </div>
                    ))}
                </div>
                <button onClick={onClose} className="w-full mt-6 bg-cyan-500 text-white font-bold py-3 rounded-lg hover:bg-cyan-600">Close</button>
            </div>
        </div>
    );
};

const NewEHRModal = ({ patientId, onClose, onDataChange }) => {
    const [formData, setFormData] = useState({ name: '', age: '', gender: '', blood_group: '', conditions: ''});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleChange = (e) => {
        setFormData({...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const token = localStorage.getItem("token");
            const dataToSend = {
                user_id: patientId,
                name: formData.name,
                age: parseInt(formData.age),
                gender: formData.gender,
                blood_group: formData.blood_group,
                conditions: formData.conditions.split(',').map(c => c.trim()).filter(c => c)
            };
            await axios.post(`http://127.0.0.1:5000/api/ehr/create`, dataToSend, {
                headers: { Authorization: `Bearer ${token}` }
            });
            onDataChange();
            onClose();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to create EHR.');
            console.error("Create EHR Error:", err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50">
            <div className="bg-slate-800 rounded-xl p-8 w-full max-w-lg text-white mx-4">
                 <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold">Create New EHR for Patient ID: {patientId}</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white text-3xl">&times;</button>
                </div>
                 <form onSubmit={handleSubmit} className="space-y-4">
                    <input name="name" value={formData.name} onChange={handleChange} placeholder="Patient Name" required className="w-full bg-slate-700 p-2 rounded"/>
                    <input name="age" type="number" value={formData.age} onChange={handleChange} placeholder="Age" required className="w-full bg-slate-700 p-2 rounded"/>
                    <input name="gender" value={formData.gender} onChange={handleChange} placeholder="Gender" required className="w-full bg-slate-700 p-2 rounded"/>
                    <input name="blood_group" value={formData.blood_group} onChange={handleChange} placeholder="Blood Group" required className="w-full bg-slate-700 p-2 rounded"/>
                    <textarea name="conditions" value={formData.conditions} onChange={handleChange} placeholder="Conditions (comma-separated)" className="w-full bg-slate-700 p-2 rounded" rows="3"></textarea>
                    {error && <p className="text-sm text-red-400">{error}</p>}
                    <div className="flex justify-end space-x-4 pt-2">
                        <button type="button" onClick={onClose} className="bg-slate-600 px-4 py-2 rounded">Cancel</button>
                        <button type="submit" disabled={loading} className="bg-cyan-500 px-4 py-2 rounded disabled:opacity-50">{loading ? 'Saving...' : 'Create Record'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const PatientListModal = ({ title, patients, onClose, onSelectPatient, onAddNewEHR }) => (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50">
        <div className="bg-slate-800 rounded-xl p-8 w-full max-w-3xl text-white mx-4">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">{title}</h2>
                <button onClick={onClose} className="text-gray-400 hover:text-white text-3xl">&times;</button>
            </div>
            <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-2">
                {patients.length > 0 ? patients.map(p => (
                    <div key={p.id} className="bg-slate-700 p-3 rounded-lg flex flex-col sm:flex-row justify-between items-start sm:items-center text-sm hover:bg-slate-600 transition-colors">
                        <div className="mb-2 sm:mb-0">
                            <p className="font-semibold">{p.name}</p>
                            <p className="text-xs text-gray-400">{p.email}</p>
                        </div>
                         <div className="flex space-x-2 self-end sm:self-center">
                            <button
                                onClick={() => { onSelectPatient(p); onClose(); }}
                                className="text-xs bg-cyan-600 hover:bg-cyan-700 px-3 py-1 rounded-md whitespace-nowrap"
                            >
                                View EHR
                            </button>
                            <button
                                onClick={() => { onAddNewEHR(p.id); onClose(); }}
                                className="text-xs bg-green-600 hover:bg-green-700 px-3 py-1 rounded-md whitespace-nowrap"
                             >
                                Add New EHR
                             </button>
                        </div>
                    </div>
                )) : <p className="text-gray-400 text-center py-8">No patients found.</p>}
            </div>
             <button onClick={onClose} className="w-full mt-6 bg-cyan-500 text-white font-bold py-3 rounded-lg hover:bg-cyan-600">Close</button>
        </div>
    </div>
);

const DoctorAppointmentModal = ({ appointments, patients, onClose, onUpdateStatus }) => ( // Added onUpdateStatus
     <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50">
        <div className="bg-slate-800 rounded-xl p-8 w-full max-w-2xl text-white mx-4">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">Your Appointments</h2>
                <button onClick={onClose} className="text-gray-400 hover:text-white text-3xl">&times;</button>
            </div>
             <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-2">
                 {appointments.length > 0 ? appointments.map(app => {
                      const patient = patients.find(p => p.id === app.patient_id);
                      const patientName = patient ? patient.name : `Patient ID: ${app.patient_id}`;
                      const appTime = new Date(app.appointment_time + 'Z').toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
                      const appDate = new Date(app.appointment_time + 'Z').toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric'});
                      const appointmentStatuses = ['Scheduled', 'Completed', 'Cancelled']; // Define statuses here
                     return (
                          <div key={app.id} className="bg-slate-700 p-3 rounded-lg flex justify-between items-center text-sm">
                              <div>
                                  <p className="font-semibold">{patientName}</p>
                                  <p className="text-xs text-gray-400">{appDate} at {appTime}</p>
                                  <p className="text-xs text-cyan-300 italic truncate" title={app.reason}>Reason: {app.reason}</p>
                                  <p className="text-xs text-gray-500 mt-1">Appt ID: {app.id} / Patient ID: {app.patient_id}</p>
                              </div>
                               {/* Status Update Dropdown */}
                               <div className="flex items-center space-x-2">
                                    <span className={`text-xs font-bold px-2 py-1 rounded-full whitespace-nowrap ${
                                           app.status === 'Completed' ? 'bg-green-800 text-green-200' :
                                           app.status === 'Cancelled' ? 'bg-red-800 text-red-200' :
                                           'bg-cyan-800 text-cyan-200'
                                        }`}>
                                           {app.status || 'SCHEDULED'}
                                    </span>
                                    <select
                                        value={app.status || 'Scheduled'}
                                        onChange={(e) => onUpdateStatus(app.id, e.target.value)} // Call handler on change
                                        className="text-xs bg-slate-600 border border-slate-500 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                                    >
                                        <option value={app.status || 'Scheduled'} disabled hidden>{app.status || 'Scheduled'}</option>
                                        {appointmentStatuses
                                            .filter(status => status !== (app.status || 'Scheduled'))
                                            .map(status => (
                                            <option key={status} value={status}>{status}</option>
                                        ))}
                                    </select>
                               </div>
                          </div>
                     );
                 }) : <p className="text-gray-400 text-center py-8">No appointments found.</p>}
             </div>
             <button onClick={onClose} className="w-full mt-6 bg-cyan-500 text-white font-bold py-3 rounded-lg hover:bg-cyan-600">Close</button>
        </div>
    </div>
);

// --- Main Doctor Dashboard Component ---

const DoctorDashboard = () => {
  const [appointments, setAppointments] = useState([]);
  const [doctorPatients, setDoctorPatients] = useState([]); // Patients associated via EHR
  const [allPatients, setAllPatients] = useState([]); // ALL patients from admin route
  const [doctorInfo, setDoctorInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedPatient, setSelectedPatient] = useState(null); // For EHR Modal
  const [isNewEHRModalOpen, setIsNewEHRModalOpen] = useState(false);
  const [patientForNewEHR, setPatientForNewEHR] = useState(null);
  const [isAllPatientsModalOpen, setIsAllPatientsModalOpen] = useState(false); // Modal for all patients
  const [isAppointmentModalOpen, setIsAppointmentModalOpen] = useState(false); // Modal for appointments

  const navigate = useNavigate();

  const fetchData = async () => {
    const token = localStorage.getItem("token");
    const role = localStorage.getItem("role");
    const name = localStorage.getItem("name");

    if (!token || role !== 'doctor') {
      localStorage.clear();
      navigate("/login");
      return;
    }
    setDoctorInfo({ name: name || "Doctor" });
    setLoading(true);
    setError("");
    try {
      const headers = { Authorization: `Bearer ${token}` };

      const [appointResponse, doctorPatientsResponse, allPatientsResponse] = await Promise.all([
        axios.get("http://127.0.0.1:5000/api/appointments/doctor", { headers }),
        axios.get("http://127.0.0.1:5000/api/users/doctor/patients", { headers }),
        axios.get("http://127.0.0.1:5000/api/admin/patients", { headers })
      ]);

      setAppointments(appointResponse.data.appointments || []);
      setDoctorPatients(doctorPatientsResponse.data || []);
      setAllPatients(allPatientsResponse.data || []);

    } catch (err) {
      console.error("Error fetching doctor data:", err);
      let specificError = "Failed to load dashboard data.";
       if (err.response?.config?.url?.includes('/admin/patients')) specificError += " Could not fetch the full patient list.";
       else if (err.response?.config?.url?.includes('/doctor/patients')) specificError += " Could not fetch your assigned patients.";
       else if (err.response?.config?.url?.includes('/appointments/doctor')) specificError += " Could not fetch appointments.";
      setError(specificError);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [navigate]);

  const handleLogout = () => {
    localStorage.clear();
    navigate("/login");
  };

  const viewPatientEHR = (patient) => {
      setSelectedPatient(patient);
  };

  const openNewEHRModal = (patientId) => {
      setPatientForNewEHR(patientId);
      setIsNewEHRModalOpen(true);
  };

  const handleUpdateStatus = async (appointmentId, newStatus) => {
      if (!newStatus) return;

      try {
          const token = localStorage.getItem("token");
          const headers = { Authorization: `Bearer ${token}` };
          await axios.put(`http://127.0.0.1:5000/api/appointments/${appointmentId}/status`,
              { status: newStatus },
              { headers }
          );
          fetchData(); // Refresh data
          alert(`Appointment ${appointmentId} status updated to ${newStatus}.`);
      } catch (err) {
          console.error("Failed to update status:", err);
          alert(err.response?.data?.error || "Could not update appointment status.");
      }
  };


  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900 text-white text-xl">
        Loading Doctor Dashboard...
      </div>
    );
  }

  const todaysAppointments = appointments.filter(app => {
      const today = new Date().setHours(0,0,0,0);
      const appDate = new Date(app.appointment_time + 'Z').setHours(0,0,0,0);
      return today === appDate;
  }).length;

  const appointmentStatuses = ['Scheduled', 'Completed', 'Cancelled']; // Define statuses here


  return (
    <div className="flex min-h-screen bg-slate-900 text-gray-200 font-sans">
      <Sidebar
        handleLogout={handleLogout}
        onAppointmentsClick={() => setIsAppointmentModalOpen(true)}
        onAllPatientsClick={() => setIsAllPatientsModalOpen(true)}
      />
      <main className="flex-1 p-4 md:p-8 overflow-y-auto">
         <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white">Doctor Dashboard</h1>
            <p className="text-gray-400 text-sm md:text-base">Manage appointments and patient records.</p>
          </div>
          <div className="flex items-center space-x-4">
             <span className="hidden sm:block text-white">Welcome, Dr. {doctorInfo?.name || ''}</span>
          </div>
        </div>

        {error && <div className="mb-8 bg-red-800 text-red-200 p-4 rounded-lg">{error}</div>}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <StatCard title="Appointments Today" value={todaysAppointments} icon="🗓️" />
            <StatCard title="Your Patients (EHR Created)" value={doctorPatients.length} icon="👥" />
            {/* Add more stats */}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Upcoming Appointments Section */}
            <div className="bg-slate-800 p-6 rounded-xl">
                 <h2 className="text-xl font-bold text-white mb-4">Upcoming Appointments</h2>
                 <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                     {appointments.length > 0 ? appointments.map(app => {
                          const patientList = allPatients; // Use all patients for name lookup here
                          const patient = patientList.find(p => p.id === app.patient_id);
                          const patientName = patient ? patient.name : `Patient ID: ${app.patient_id}`;
                          const appTime = new Date(app.appointment_time + 'Z').toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
                          const appDate = new Date(app.appointment_time + 'Z').toLocaleDateString('en-IN', { day: '2-digit', month: 'short'});
                         return (
                              <div key={app.id} className="bg-slate-700 p-3 rounded-lg flex flex-col sm:flex-row justify-between sm:items-center text-sm hover:bg-slate-600 transition-colors">
                                  {/* Appointment Details */}
                                  <div className="mb-2 sm:mb-0 mr-4">
                                      <p className="font-semibold">{patientName}</p>
                                      <p className="text-xs text-gray-400">{appDate} at {appTime}</p>
                                      <p className="text-xs text-cyan-300 italic truncate max-w-xs" title={app.reason}>Reason: {app.reason}</p>
                                      <p className="text-xs text-gray-500 mt-1">Appt ID: {app.id} / Patient ID: {app.patient_id}</p>
                                  </div>
                                  {/* Status and Update Dropdown */}
                                  <div className="flex items-center space-x-2 self-end sm:self-center">
                                       <span className={`text-xs font-bold px-2 py-1 rounded-full whitespace-nowrap ${
                                           app.status === 'Completed' ? 'bg-green-800 text-green-200' :
                                           app.status === 'Cancelled' ? 'bg-red-800 text-red-200' :
                                           'bg-cyan-800 text-cyan-200'
                                        }`}>
                                           {app.status || 'SCHEDULED'}
                                        </span>
                                        <select
                                            // value={app.status || 'Scheduled'} // Use defaultValue to avoid controlled component warning if you don't update state immediately
                                            defaultValue={app.status || 'Scheduled'}
                                            onChange={(e) => handleUpdateStatus(app.id, e.target.value)}
                                            className="text-xs bg-slate-600 border border-slate-500 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                                            // Reset dropdown value after selection if needed, or rely on fetchData refresh
                                        >
                                            <option value={app.status || 'Scheduled'} disabled hidden>{app.status || 'Scheduled'}</option>
                                            {appointmentStatuses
                                                .filter(status => status !== (app.status || 'Scheduled'))
                                                .map(status => (
                                                <option key={status} value={status}>{status}</option>
                                            ))}
                                        </select>
                                  </div>
                              </div>
                         );
                     }) : <p className="text-gray-400">No upcoming appointments.</p>}
                 </div>
            </div>

            {/* "Your Patients" Section */}
             <div className="bg-slate-800 p-6 rounded-xl">
                 <h2 className="text-xl font-bold text-white mb-4">Your Patients (Created EHR)</h2>
                  <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                      {doctorPatients.length > 0 ? doctorPatients.map(p => (
                          <div key={p.id} className="bg-slate-700 p-3 rounded-lg flex flex-col sm:flex-row justify-between items-start sm:items-center text-sm hover:bg-slate-600 transition-colors">
                              <div className="mb-2 sm:mb-0">
                                  <p className="font-semibold">{p.name}</p>
                                  <p className="text-xs text-gray-400">{p.email}</p>
                              </div>
                              <div className="flex space-x-2 self-end sm:self-center">
                                  <button onClick={() => viewPatientEHR(p)} className="text-xs bg-cyan-600 hover:bg-cyan-700 px-3 py-1 rounded-md whitespace-nowrap">View/Edit EHR</button>
                                  <button onClick={() => openNewEHRModal(p.id)} className="text-xs bg-green-600 hover:bg-green-700 px-3 py-1 rounded-md whitespace-nowrap">Add EHR</button>
                              </div>
                          </div>
                      )) : <p className="text-gray-400">No patients found associated with your created records.</p>}
                  </div>
             </div>
        </div>
      </main>

      {/* Modals */}
      {selectedPatient && <PatientEHRModal patient={selectedPatient} onClose={() => setSelectedPatient(null)} onDataChange={fetchData} />}
      {isNewEHRModalOpen && <NewEHRModal patientId={patientForNewEHR} onClose={() => setIsNewEHRModalOpen(false)} onDataChange={fetchData} />}
      {isAllPatientsModalOpen && <PatientListModal title="All Patients" patients={allPatients} onClose={() => setIsAllPatientsModalOpen(false)} onSelectPatient={viewPatientEHR} onAddNewEHR={openNewEHRModal} />}
      {/* Pass the handler function to the modal */}
      {isAppointmentModalOpen && <DoctorAppointmentModal appointments={appointments} patients={allPatients} onClose={() => setIsAppointmentModalOpen(false)} onUpdateStatus={handleUpdateStatus}/>}
      
    </div>
  );
};

export default DoctorDashboard;