import { useEffect, useState } from "react";
import { Calendar, Check } from "../../shared/ui";
import { C } from "../../shared/runtime";
import { api } from "../../services/apiClient";

const STATUSES = ["Present", "Absent", "Leave"];
const today = () => new Date().toISOString().slice(0, 10);

export function AdminStaffAttendance() {
  const [date, setDate] = useState(today);
  const [staff, setStaff] = useState([]);
  const [statuses, setStatuses] = useState({});
  const [notes, setNotes] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = async selectedDate => {
    setLoading(true);
    setError("");
    try {
      const result = await api.get(`/staff-attendance?date=${selectedDate}`);
      const rows = result.data || [];
      setStaff(rows);
      setStatuses(Object.fromEntries(rows.map(row => [row.staffId, row.status || "Present"])));
      setNotes(Object.fromEntries(rows.map(row => [row.staffId, row.note || ""])));
    } catch (err) {
      setError(err.message || "Unable to load staff attendance");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(date); }, [date]);

  const save = async () => {
    setSaving(true);
    setMessage("");
    setError("");
    try {
      await api.post("/staff-attendance/bulk", {
        date,
        records: staff.map(row => ({ staff: row.staffId, status: statuses[row.staffId] || "Present", note: notes[row.staffId] || "" }))
      });
      setMessage("Staff attendance saved");
    } catch (err) {
      setError(err.message || "Unable to save staff attendance");
    } finally {
      setSaving(false);
    }
  };

  return <div className="staff-attendance-page" style={{ padding: 28, maxWidth: 1100, margin: "0 auto" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: 20 }}>
      <div><h1 style={{ margin: 0, fontSize: 24, color: C.text }}>Staff Attendance</h1><p style={{ margin: "6px 0 0", color: C.muted, fontSize: 13 }}>Mark daily attendance for staff and use it in monthly salary calculations.</p></div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}><Calendar size={17} color={C.accent} /><input type="date" value={date} onChange={event => setDate(event.target.value)} style={{ padding: "10px 12px", border: "1px solid " + C.border, borderRadius: 9, color: C.text, background: C.white }} /></div>
    </div>
    {message && <div style={{ background: "#ecfdf5", color: C.teal, padding: "10px 14px", borderRadius: 9, marginBottom: 14, fontSize: 13, fontWeight: 600 }}>{message}</div>}
    {error && <div style={{ background: "#fef2f2", color: C.red, padding: "10px 14px", borderRadius: 9, marginBottom: 14, fontSize: 13, fontWeight: 600 }}>{error}</div>}
    <div style={{ background: C.white, borderRadius: 14, boxShadow: "0 2px 10px rgba(15,23,42,.07)", overflow: "hidden" }}>
      {loading ? <div style={{ padding: 50, textAlign: "center", color: C.muted }}>Loading staff...</div> : !staff.length ? <div style={{ padding: 50, textAlign: "center", color: C.muted }}>No staff records found.</div> : <>
        <div style={{ overflowX: "auto" }}><table className="rtable" style={{ width: "100%", borderCollapse: "collapse" }}><thead><tr style={{ background: "#f8fafc" }}>{["STAFF", "DESIGNATION", "STATUS", "NOTE"].map(label => <th key={label} style={{ padding: "12px 16px", textAlign: "left", color: C.muted, fontSize: 11 }}>{label}</th>)}</tr></thead><tbody>{staff.map((row, index) => <tr key={row.staffId} style={{ background: index % 2 ? "#fbfdff" : C.white, borderTop: "1px solid " + C.border }}><td className="rtable-full" style={{ padding: "12px 16px", fontWeight: 700, color: C.text }}>{row.name}</td><td data-label="Designation" style={{ padding: "12px 16px", color: C.muted, fontSize: 13 }}>{row.designation}</td><td data-label="Status" style={{ padding: "12px 16px" }}><div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{STATUSES.map(status => <button key={status} type="button" onClick={() => setStatuses(previous => ({ ...previous, [row.staffId]: status }))} style={{ minWidth: 82, padding: "8px 10px", borderRadius: 8, border: "1px solid " + (statuses[row.staffId] === status ? C.accent : C.border), background: statuses[row.staffId] === status ? C.accent : C.white, color: statuses[row.staffId] === status ? C.white : C.text, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{statuses[row.staffId] === status && <Check size={13} />} {status}</button>)}</div></td><td data-label="Note" style={{ padding: "12px 16px" }}><input value={notes[row.staffId] || ""} onChange={event => setNotes(previous => ({ ...previous, [row.staffId]: event.target.value }))} placeholder="Optional note" style={{ width: "100%", minWidth: 160, padding: "8px 10px", border: "1px solid " + C.border, borderRadius: 7, color: C.text }} /></td></tr>)}</tbody></table></div>
        <div style={{ display: "flex", justifyContent: "flex-end", padding: 16, borderTop: "1px solid " + C.border }}><button type="button" onClick={save} disabled={saving} style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 18px", border: 0, borderRadius: 9, background: C.accent, color: C.white, fontWeight: 700, cursor: saving ? "wait" : "pointer" }}><Check size={15} />{saving ? "Saving..." : "Save Attendance"}</button></div>
      </>}
    </div>
  </div>;
}
