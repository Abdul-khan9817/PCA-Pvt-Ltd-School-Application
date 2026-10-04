import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, LayoutDashboard, GraduationCap, Users, BookOpen, ClipboardCheck, ListChecks, Megaphone, DollarSign, UserCircle, LogOut, Bell, Search, ChevronDown, TrendingUp, Star, AlertTriangle, Eye, Trash2, Edit, Plus, X, Check, Clock, BarChart2, Award, Briefcase, Mail, Phone, Shield, CheckSquare, Settings2, Home, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "../../shared/ui";
import { list } from "../../services/resource.service";
import { api } from "../../services/apiClient";
import { onResourceChange } from "../../services/socket.service";
import { C, ROW_COLORS } from "../../shared/runtime";

function TeacherAttendance() {
  const [att, setAtt] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0,10));
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [studentHistory, setStudentHistory] = useState([]);
  const [saved, setSaved] = useState(false);
  const [error,setError]=useState("");

  const mapStudentToAtt = (s, i) => ({
    id: s._id || s.id,
    name: s.user?.name || s.name || "Student",
    roll: s.roll || `S${(i || 0) + 1}`,
    studentId: s._id || s.id,
    classId: s.classId?._id || s.classId || null,
    status: ""
  });

  const loadStudents = () => {
    list("students","limit=2000")
      .then(r => {
        const studentList = r.data || r || [];
        const mapped = studentList.map(mapStudentToAtt);
        setAtt(mapped);
      })
      .catch((e)=>{ setError(e.message || "Failed to load students"); });
  };

  const loadAttendanceForDate = (date) => {
    api.get(`/attendance?from=${date}&to=${date}`)
      .then(r => {
        const records = r.data || r || [];
        const byStudent = new Map(records.map(record => [String(record.student?._id || record.student), record.status]));
        setAtt(prev => prev.map(student => ({
          ...student,
          status: byStudent.get(String(student.studentId)) === "Present" ? "P" : byStudent.get(String(student.studentId)) === "Absent" ? "A" : byStudent.get(String(student.studentId)) === "Leave" ? "L" : ""
        })));
      })
      .catch(() => {});
  };

  const loadStudentHistory = (studentId) => {
    if (!studentId) return;
    api.get(`/attendance?student=${studentId}`)
      .then(r => setStudentHistory((r.data || r || []).filter(record => ["Present", "Absent", "Leave"].includes(record.status))))
      .catch(() => setStudentHistory([]));
  };

  useEffect(()=>{
    loadStudents();

    const unsubStudents = onResourceChange("students", change => {
      if (change.action === "create") {
        setAtt(prev => {
          const newEntry = mapStudentToAtt(change.data, prev.length);
          if (prev.some(s => s.studentId === newEntry.studentId)) return prev;
          return [...prev, newEntry];
        });
      } else if (change.action === "update") {
        setAtt(prev => prev.map(s => {
          if (s.studentId === (change.data?._id || change.id)) {
            return { ...s, name: change.data?.user?.name || change.data?.name || s.name, roll: change.data?.roll || s.roll };
          }
          return s;
        }));
      } else if (change.action === "delete") {
        setAtt(prev => prev.filter(s => s.studentId !== change.id && s.id !== change.id));
      }
    });

    const unsubAtt = onResourceChange("attendance", change => {
      loadAttendanceForDate(selectedDate);
      loadStudentHistory(selectedStudentId);
    });

    return () => {
      unsubStudents?.();
      unsubAtt?.();
    };
  },[selectedDate, selectedStudentId]);

  useEffect(() => { loadAttendanceForDate(selectedDate); }, [selectedDate, att.length]);
  useEffect(() => { loadStudentHistory(selectedStudentId); }, [selectedStudentId]);

  const toggle=(id,status)=>{ setAtt(prev=>prev.map(s=>s.id===id?{...s,status}:s)); setSaved(false); };
  const present=att.filter(s=>s.status==="P").length;
  const absent=att.filter(s=>s.status==="A").length;
  const leave=att.filter(s=>s.status==="L").length;

  const handleSave = async () => { 
    try { 
      const date = selectedDate;
      const records = att.filter(s=>s.studentId && s.status).map(s=>({
        student: s.studentId,
        classId: s.classId,
        status: s.status==="P"?"Present":s.status==="A"?"Absent":"Leave"
      }));
      // Use bulk endpoint for better performance (1 request instead of N)
      await api.post("/attendance/mark-bulk", { records, date });
      setSaved(true);
      setError("");
      setTimeout(()=>setSaved(false), 3000);
    } catch(e){
      setError(e.message);
    }
  };

  return (
    <div style={{ padding:28 }}>{error&&<div style={{color:C.red,fontSize:13,marginBottom:12}}>{error}</div>}
      <div style={{ background:C.white, borderRadius:14, padding:22, boxShadow:"0 2px 8px rgba(0,0,0,.06)" }}>
        {/* Stats row */}
        <div style={{ display:"flex", gap:28, marginBottom:20, alignItems:"center" }}>
          <span style={{ color:C.teal, fontWeight:700, fontSize:14 }}>Present: {present}</span>
          <span style={{ color:C.red, fontWeight:700, fontSize:14 }}>Absent: {absent}</span>
          <span style={{ color:C.orange, fontWeight:700, fontSize:14 }}>Leave: {leave}</span>
          <span style={{ color:C.muted, fontWeight:600, fontSize:14 }}>Total: {att.length}</span>

          {/* Month filter and Save button */}
          <div style={{ marginLeft:"auto", display:"flex", gap:10, alignItems:"center", flexWrap:"wrap", justifyContent:"flex-end" }}>
            <select value={selectedStudentId} onChange={e=>setSelectedStudentId(e.target.value)} style={{ maxWidth:190, padding:"8px 10px", border:"1px solid "+C.border, borderRadius:10, fontSize:13 }}>
              <option value="">All students</option>
              {att.map(student=><option key={student.studentId} value={student.studentId}>{student.name} · {student.roll}</option>)}
            </select>
            <input type="date" value={selectedDate} onChange={e=>setSelectedDate(e.target.value)} style={{ padding:"8px 10px", border:"1px solid "+C.border, borderRadius:10, fontSize:13 }} />
          </div>
        </div>

        {/* Saved banner */}
        <AnimatePresence>
          {saved && (
            <motion.div
              initial={{ opacity:0, y:-8 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-8 }}
              style={{
                background:"#d1fae5", borderRadius:10, padding:"10px 16px",
                marginBottom:16, display:"flex", alignItems:"center", gap:8,
                border:"1px solid #6ee7b7"
              }}>
              <Check size={16} color={C.teal} />
              <span style={{ fontSize:13, fontWeight:600, color:C.teal }}>
                Attendance saved successfully! {present} Present · {absent} Absent · {leave} Leave
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <table className="rtable" style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead>
            <tr style={{ background:"#f8fafc" }}>
              <th style={{ padding:"10px 14px", textAlign:"left", fontSize:11, fontWeight:700, color:C.muted, width:40 }}>#</th>
              <th style={{ padding:"10px 14px", textAlign:"left", fontSize:11, fontWeight:700, color:C.muted }}>STUDENT NAME</th>
              <th style={{ padding:"10px 14px", textAlign:"left", fontSize:11, fontWeight:700, color:C.muted }}>ROLL NO</th>
              <th style={{ padding:"10px 14px", textAlign:"left", fontSize:11, fontWeight:700, color:C.muted }}>
                <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                  <Check size={14} color={C.accent} /> MARK ATTENDANCE
                </div>
              </th>
              <th style={{ padding:"10px 14px", textAlign:"left", fontSize:11, fontWeight:700, color:C.muted }}>STATUS</th>
            </tr>
          </thead>
          <tbody>
            {att.map((s,i)=>(
              <tr key={s.id} style={{ background:ROW_COLORS[i%ROW_COLORS.length], borderBottom:"1px solid "+C.border }}>
                <td className="rtable-full" style={{ padding:"14px 14px" }}>
                  <div style={{ fontWeight:700, fontSize:14 }}>{i+1}. {s.name}</div>
                  <div style={{ fontSize:11, color:C.muted }}>{s.roll}</div>
                </td>
                <td data-label="Mark" style={{ padding:"14px 14px" }}>
                  <div style={{ display:"flex", gap:8 }}>
                    {[{ label:"P", color:C.teal },{ label:"A", color:C.red },{ label:"L", color:C.orange }].map(opt=>(
                      <motion.button type="button" key={opt.label} whileHover={{ scale:1.08 }} whileTap={{ scale:0.92 }}
                        onClick={()=>toggle(s.id,opt.label)}
                        style={{
                          width:34, height:34, borderRadius:8, border:"none", cursor:"pointer",
                          fontWeight:700, fontSize:13,
                          background:s.status===opt.label ? opt.color : "#f0f0f0",
                          color:s.status===opt.label ? "#fff" : C.muted,
                          transition:"all .15s"
                        }} aria-pressed={s.status===opt.label}>
                        {opt.label}
                      </motion.button>
                    ))}
                  </div>
                </td>
                <td data-label="Status" style={{ padding:"14px 14px" }}>
                  <span style={{
                    background: s.status==="P" ? "#d1fae5" : s.status==="A" ? "#fee2e2" : s.status==="L" ? "#fef3c7" : "#f3f4f6",
                    color: s.status==="P" ? C.teal : s.status==="A" ? C.red : s.status==="L" ? C.orange : C.muted,
                    borderRadius:20, padding:"3px 12px", fontSize:12, fontWeight:600
                  }}>
                    {s.status==="P" ? "Present" : s.status==="A" ? "Absent" : s.status==="L" ? "Leave" : "Not marked"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>

        {selectedStudentId && (
          <div style={{ marginTop:18, padding:14, border: "1px solid "+C.border, borderRadius:10, overflowX:"auto" }}>
            <div style={{ fontSize:13, fontWeight:700, marginBottom:10 }}>Attendance history by date</div>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
              {[...studentHistory].sort((a,b)=>new Date(b.date)-new Date(a.date)).map(record=>{
                const statusColor = record.status === "Present" ? C.teal : record.status === "Absent" ? C.red : C.orange;
                return <button type="button" key={record._id} onClick={()=>setSelectedDate(new Date(record.date).toISOString().slice(0,10))} style={{ display:"flex", alignItems:"center", gap:6, padding:"6px 9px", border:"1px solid "+C.border, borderRadius:8, background:C.white, cursor:"pointer", fontSize:12 }}>
                  <span style={{ width:8, height:8, borderRadius:"50%", background:statusColor }} />
                  {new Date(record.date).toLocaleDateString()} · {record.status}
                </button>;
              })}
              {!studentHistory.length && <span style={{ color:C.muted, fontSize:12 }}>No recorded attendance for this student.</span>}
            </div>
          </div>
        )}

        {/* Bottom Save button */}
        <div style={{ marginTop:20, display:"flex", justifyContent:"flex-end" }}>
          <motion.button type="button"
            whileHover={{ scale:1.04 }} whileTap={{ scale:0.96 }}
            onClick={handleSave}
            style={{
              display:"flex", alignItems:"center", gap:6,
              background: saved ? C.teal : C.accent,
              color:"#fff", border:"none", borderRadius:10,
              padding:"11px 28px", cursor:"pointer",
              fontSize:14, fontWeight:700, transition:"background .2s"
            }}>
            {saved ? <><Check size={16} /> Saved!</> : <><Check size={16} /> Save Attendance</>}
          </motion.button>
        </div>
      </div>
    </div>
  );
}

export { TeacherAttendance };
