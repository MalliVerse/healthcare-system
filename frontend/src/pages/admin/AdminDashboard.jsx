import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

const API = "http://127.0.0.1:5000/api/admin";

const TABS = [
  { key: "doctors", label: "Doctors" },
  { key: "patients", label: "Patients" },
  { key: "appointments", label: "Appointments" },
  { key: "ehrs", label: "EHR Records" },
  { key: "medications", label: "Medications" },
];

const STATUSES = ["Scheduled", "Completed", "Cancelled"];

// Fields shown in the edit/create form for each tab
const FORMS = {
  doctors: [
    { name: "name", label: "Full Name" },
    { name: "email", label: "Email", type: "email" },
    { name: "password", label: "Password (leave blank to keep)", type: "password" },
    { name: "specialization", label: "Specialization" },
    { name: "availability", label: "Availability (JSON)", type: "textarea" },
  ],
  patients: [
    { name: "name", label: "Full Name" },
    { name: "email", label: "Email", type: "email" },
    { name: "password", label: "Password (leave blank to keep)", type: "password" },
  ],
  appointments: [
    { name: "appointment_time", label: "Date & Time", type: "datetime-local" },
    { name: "status", label: "Status", type: "select", options: STATUSES },
    { name: "reason", label: "Reason", type: "textarea" },
  ],
  ehrs: [
    { name: "name", label: "Patient Name" },
    { name: "age", label: "Age", type: "number" },
    { name: "gender", label: "Gender" },
    { name: "blood_group", label: "Blood Group" },
    { name: "conditions", label: "Conditions", type: "textarea" },
  ],
  medications: [
    { name: "name", label: "Medication" },
    { name: "dosage", label: "Dosage" },
    { name: "frequency", label: "Frequency" },
    { name: "notes", label: "Notes", type: "textarea" },
  ],
};

const fmtDate = (iso) => {
  if (!iso) return "-";
  // The backend stores UTC without a timezone marker
  const d = new Date(/[zZ]|[+-]\d\d:\d\d$/.test(iso) ? iso : iso + "Z");
  return d.toLocaleString();
};

// Convert a stored UTC ISO string to the value a datetime-local input expects
const toLocalInput = (iso) => {
  if (!iso) return "";
  const d = new Date(/[zZ]|[+-]\d\d:\d\d$/.test(iso) ? iso : iso + "Z");
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [tab, setTab] = useState("doctors");
  const [data, setData] = useState({
    users: [], appointments: [], ehrs: [], medications: [],
  });
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null); // {type, text}
  const [modal, setModal] = useState(null); // {mode: 'edit'|'create', item}
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  const headers = { Authorization: `Bearer ${localStorage.getItem("token")}` };

  const flash = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  const logout = () => {
    localStorage.clear();
    navigate("/login");
  };

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [users, appointments, ehrs, medications] = await Promise.all([
        axios.get(`${API}/users`, { headers }),
        axios.get(`${API}/appointments`, { headers }),
        axios.get(`${API}/ehrs`, { headers }),
        axios.get(`${API}/medications`, { headers }),
      ]);
      setData({
        users: users.data,
        appointments: appointments.data,
        ehrs: ehrs.data,
        medications: medications.data,
      });
    } catch (err) {
      if (err.response && [401, 403, 422].includes(err.response.status)) {
        flash("error", "Session expired or not an admin. Please log in again.");
      } else {
        flash("error", "Could not load data. Is the backend running?");
      }
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => setSearch(""), [tab]);

  // ---------- rows for the current tab ----------
  const doctors = data.users.filter((u) => u.role === "doctor");
  const patients = data.users.filter((u) => u.role === "patient");

  const rowsByTab = {
    doctors, patients,
    appointments: data.appointments,
    ehrs: data.ehrs,
    medications: data.medications,
  };

  const q = search.trim().toLowerCase();
  const rows = (rowsByTab[tab] || []).filter((r) =>
    !q || JSON.stringify(r).toLowerCase().includes(q)
  );

  // ---------- endpoints per tab ----------
  const itemId = (r) => (tab === "ehrs" ? r.ehr_id : r.id);
  const updateUrl = (r) => {
    const id = itemId(r);
    if (tab === "doctors" || tab === "patients") return `${API}/user/${id}`;
    if (tab === "appointments") return `${API}/appointment/${id}`;
    if (tab === "ehrs") return `${API}/ehr/${id}`;
    return `${API}/medication/${id}`;
  };
  const deleteUrl = (r) => {
    const id = itemId(r);
    if (tab === "doctors") return `${API}/doctor/${id}`;
    if (tab === "patients") return `${API}/patient/${id}`;
    return updateUrl(r);
  };

  // ---------- modal handling ----------
  const openEdit = (item) => {
    const f = {};
    FORMS[tab].forEach((field) => {
      let v = item[field.name];
      if (field.name === "password") v = "";
      if (field.name === "appointment_time") v = toLocalInput(v);
      f[field.name] = v ?? "";
    });
    setForm(f);
    setModal({ mode: "edit", item });
  };

  const openCreate = () => {
    const f = {};
    FORMS[tab].forEach((field) => (f[field.name] = field.options ? field.options[0] : ""));
    setForm(f);
    setModal({ mode: "create", item: null });
  };

  const closeModal = () => setModal(null);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form };
      if (tab === "appointments" && payload.appointment_time) {
        payload.appointment_time = new Date(payload.appointment_time).toISOString();
      }
      if (modal.mode === "edit" && !payload.password) delete payload.password;

      if (modal.mode === "create") {
        const role = tab === "doctors" ? "doctor" : "patient";
        if (!payload.password) {
          flash("error", "Password is required for a new user.");
          setSaving(false);
          return;
        }
        await axios.post(`${API}/user`, { ...payload, role }, { headers });
        flash("success", `${role === "doctor" ? "Doctor" : "Patient"} created.`);
      } else {
        await axios.put(updateUrl(modal.item), payload, { headers });
        flash("success", "Changes saved.");
      }
      closeModal();
      loadAll();
    } catch (err) {
      const d = err.response?.data;
      flash("error", d?.error || d?.msg || d?.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (item) => {
    const warn =
      tab === "doctors" || tab === "patients"
        ? "This also deletes their appointments, EHR records and medications."
        : "This cannot be undone.";
    if (!window.confirm(`Delete this ${tab.slice(0, -1)}? ${warn}`)) return;
    try {
      await axios.delete(deleteUrl(item), { headers });
      flash("success", "Deleted.");
      loadAll();
    } catch (err) {
      const d = err.response?.data;
      flash("error", d?.error || d?.msg || "Delete failed.");
    }
  };

  // ---------- table columns ----------
  const columns = {
    doctors: [
      ["ID", (r) => r.id],
      ["Name", (r) => r.name],
      ["Email", (r) => r.email],
      ["Specialization", (r) => r.specialization || "-"],
    ],
    patients: [
      ["ID", (r) => r.id],
      ["Name", (r) => r.name],
      ["Email", (r) => r.email],
    ],
    appointments: [
      ["ID", (r) => r.id],
      ["Patient", (r) => r.patient_name || `#${r.patient_id}`],
      ["Doctor", (r) => r.doctor_name || `#${r.doctor_id}`],
      ["Time", (r) => fmtDate(r.appointment_time)],
      ["Status", (r) => r.status],
      ["Reason", (r) => r.reason || "-"],
    ],
    ehrs: [
      ["ID", (r) => r.ehr_id],
      ["Name", (r) => r.name],
      ["Age", (r) => r.age ?? "-"],
      ["Gender", (r) => r.gender || "-"],
      ["Blood", (r) => r.blood_group || "-"],
      ["Doctor", (r) => r.doctor_name || "-"],
      ["Conditions", (r) => r.conditions || "-"],
    ],
    medications: [
      ["ID", (r) => r.id],
      ["Patient", (r) => r.patient_name || "-"],
      ["Medication", (r) => r.name],
      ["Dosage", (r) => r.dosage || "-"],
      ["Frequency", (r) => r.frequency || "-"],
      ["Prescribed By", (r) => r.prescribed_by_name || "-"],
    ],
  }[tab];

  const counts = {
    doctors: doctors.length,
    patients: patients.length,
    appointments: data.appointments.length,
    ehrs: data.ehrs.length,
    medications: data.medications.length,
  };

  const canCreate = tab === "doctors" || tab === "patients";
  const inputCls =
    "w-full px-3 py-2 rounded-lg bg-slate-700 text-white border border-slate-600 focus:outline-none focus:border-cyan-400";

  return (
    <div className="fixed inset-0 overflow-auto bg-slate-900 text-white text-left">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-3xl font-bold">Admin Dashboard</h1>
            <p className="text-slate-400 text-sm">
              Manage doctors, patients and all their records.
            </p>
          </div>
          <button
            onClick={logout}
            className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 font-semibold"
          >
            Logout
          </button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`rounded-xl p-4 text-left border transition ${
                tab === t.key
                  ? "bg-cyan-600 border-cyan-400"
                  : "bg-slate-800 border-slate-700 hover:border-slate-500"
              }`}
            >
              <div className="text-2xl font-bold">{counts[t.key]}</div>
              <div className="text-sm text-slate-200">{t.label}</div>
            </button>
          ))}
        </div>

        {message && (
          <div
            className={`mb-4 px-4 py-3 rounded-lg ${
              message.type === "success" ? "bg-green-600" : "bg-red-600"
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${TABS.find((t) => t.key === tab).label.toLowerCase()}...`}
            className={`${inputCls} max-w-sm`}
          />
          <button
            onClick={loadAll}
            className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600"
          >
            Refresh
          </button>
          {canCreate && (
            <button
              onClick={openCreate}
              className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 font-semibold"
            >
              + Add {tab === "doctors" ? "Doctor" : "Patient"}
            </button>
          )}
        </div>

        {/* Table */}
        <div className="bg-slate-800 rounded-xl overflow-x-auto border border-slate-700">
          <table className="w-full text-sm">
            <thead className="bg-slate-700 text-slate-200">
              <tr>
                {columns.map(([h]) => (
                  <th key={h} className="px-4 py-3 text-left whitespace-nowrap">{h}</th>
                ))}
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={columns.length + 1} className="px-4 py-8 text-center text-slate-400">
                    Loading...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + 1} className="px-4 py-8 text-center text-slate-400">
                    Nothing to show.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={`${tab}-${itemId(r)}`} className="border-t border-slate-700 hover:bg-slate-750">
                    {columns.map(([h, get]) => (
                      <td key={h} className="px-4 py-3 max-w-xs truncate" title={String(get(r))}>
                        {get(r)}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button
                        onClick={() => openEdit(r)}
                        className="px-3 py-1 mr-2 rounded bg-cyan-600 hover:bg-cyan-700"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => remove(r)}
                        className="px-3 py-1 rounded bg-red-600 hover:bg-red-700"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit / Create modal */}
      {modal && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50 p-4">
          <form
            onSubmit={save}
            className="bg-slate-800 rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
          >
            <h2 className="text-xl font-bold mb-4">
              {modal.mode === "create" ? "Add" : "Edit"}{" "}
              {tab === "ehrs" ? "EHR record" : tab.slice(0, -1)}
            </h2>

            {FORMS[tab].map((f) => (
              <div key={f.name} className="mb-3">
                <label className="block text-sm text-slate-300 mb-1">{f.label}</label>
                {f.type === "textarea" ? (
                  <textarea
                    rows={3}
                    value={form[f.name] ?? ""}
                    onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
                    className={inputCls}
                  />
                ) : f.type === "select" ? (
                  <select
                    value={form[f.name] ?? ""}
                    onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
                    className={inputCls}
                  >
                    {(f.options.includes(form[f.name]) || !form[f.name]
                      ? f.options
                      : [form[f.name], ...f.options]
                    ).map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={f.type || "text"}
                    value={form[f.name] ?? ""}
                    onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
                    className={inputCls}
                    required={
                      modal.mode === "create" && ["name", "email", "password"].includes(f.name)
                    }
                  />
                )}
              </div>
            ))}

            <div className="flex justify-end gap-3 mt-5">
              <button
                type="button"
                onClick={closeModal}
                className="px-4 py-2 rounded-lg bg-slate-600 hover:bg-slate-500"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-700 font-semibold disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
