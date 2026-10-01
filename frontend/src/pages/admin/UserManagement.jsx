import { useEffect, useState } from "react";
import { Plus, Users, Edit, Trash2, X, Check, Search, Eye, EyeOff, LockKeyhole, Mail, Copy } from "../../shared/ui";
import { api } from "../../services/apiClient";
import { C, ROW_COLORS } from "../../shared/runtime";
import { Portal } from "../../components/common/Portal";
import { Avatar } from "../../components/common/Avatar";
import { onResourceChange } from "../../services/socket.service";

/* ── Constants ── */
// FIX: these were the only options ever shown in the Class/Subject dropdowns —
// completely disconnected from the Class/Subject records the admin actually
// created (and used to create fake orphaned assignments). They now serve only
// as a fallback for the brief moment before real records finish loading.
const FALLBACK_CLASSES  = ["Nursery","LKG","UKG","1","2","3","4","5","6","7","8","9","10"];
const STAFF_ROLES = ["Principal","Vice Principal","Teacher"];
const GENDERS  = ["Male","Female","Other"];
const roleToApi = { "Principal":"principal","Vice Principal":"vice_principal","Teacher":"teacher" };
const STAFF_API_ROLES = ["principal","vice_principal","teacher"];

/* ── Blank forms ── */
const blankStudent = () => ({
  type:"student",
  firstName:"", middleName:"", lastName:"",
  phone:"", dob:"", gender:"Male",
  cls:"Nursery", sectionOptions:["A","B"], section:"A",
  roll:"", studentId:"", admissionDate:"",
  fatherName:"", motherName:"", guardianName:"", parentPhone:"",
  address:"", village:"", email:"", password:"", confirmPassword:""
});

const blankStaff = () => ({
  type:"staff",
  firstName:"", middleName:"", lastName:"",
  phone:"", email:"", dob:"", gender:"Male",
  staffRole:"Teacher", staffId:"",
  joiningDate:"", qualification:"", experience:"",
  address:"", village:"",
  password:"", confirmPassword:"", status:"active"
});

/* ── Validation ── */
const validate = (f, isEdit) => {
  if (!f.firstName?.trim()) return "First name is required";
  if (!f.lastName?.trim())  return "Last name is required";
  if (!/^\d{10}$/.test(f.phone)) return "Phone must be exactly 10 digits";
  if (!f.email?.trim())     return "Email is required";
  if (f.type==="student" && !f.roll?.trim()) return "Roll number is required";
  if (!isEdit && !f.password) return "Password is required";
  if (f.password && f.password.length < 8) return "Password must be at least 8 characters";
  if (f.password && f.password !== f.confirmPassword) return "Passwords do not match";
  return null;
};

/* ── Small UI helpers ── */
function SectionHeader({ title }) {
  return (
    <div style={{ gridColumn:"span 2", borderBottom:`1.5px solid ${C.border}`,
      paddingBottom:5, marginTop:10, marginBottom:2 }}>
      <span style={{ fontSize:10, fontWeight:800, color:C.muted,
        letterSpacing:1.2, textTransform:"uppercase" }}>{title}</span>
    </div>
  );
}

function Field({ label, value, onChange, type="text", required=false, half=false, readOnly=false, placeholder="" }) {
  const [visible, setVisible] = useState(false);
  const isPassword = type === "password";
  const inputType = isPassword ? (visible ? "text" : "password") : type;
  return (
    <div style={{ marginBottom:12, gridColumn: half ? "span 1" : "span 2", minWidth:0 }}>
      <label style={{ fontSize:12, fontWeight:700, display:"block",
        marginBottom:5, color:C.text }}>
        {label}{required && <span style={{ color:C.red }}> *</span>}
      </label>
      <div style={{ position:"relative" }}>
        <input type={inputType} value={value||""}
          readOnly={readOnly}
          placeholder={placeholder}
          autoComplete={isPassword ? "new-password" : "off"}
          onChange={e=>onChange?.(e.target.value)}
          style={{ width:"100%", padding: isPassword ? "9px 40px 9px 12px" : "9px 12px",
            borderRadius:10, border:`1.5px solid ${C.border}`, fontSize:13, outline:"none",
            boxSizing:"border-box", background: readOnly ? "#f8fafc" : "#fff" }}
          onFocus={e=>{ if(!readOnly) e.target.style.borderColor=C.accent; }}
          onBlur={e=>{ if(!readOnly) e.target.style.borderColor=C.border; }} />
        {isPassword && (
          <button type="button" onClick={()=>setVisible(v=>!v)}
            aria-label={visible ? "Hide password" : "Show password"}
            style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)",
              background:"transparent", border:"none", cursor:"pointer",
              color:C.muted, display:"flex", alignItems:"center", padding:2 }}>
            {visible ? <EyeOff size={16}/> : <Eye size={16}/>}
          </button>
        )}
      </div>
    </div>
  );
}


function Sel({ label, value, onChange, options, half=false }) {
  return (
    <div style={{ marginBottom:12, gridColumn: half ? "span 1" : "span 2", minWidth:0 }}>
      <label style={{ fontSize:12, fontWeight:700, display:"block",
        marginBottom:5, color:C.text }}>{label}</label>
      <select value={value||""} onChange={e=>onChange(e.target.value)}
        style={{ width:"100%", padding:"9px 12px", borderRadius:10,
          border:`1.5px solid ${C.border}`, fontSize:13, outline:"none",
          boxSizing:"border-box", background:"#fff" }}>
        {options.map(o => typeof o==="string"
          ? <option key={o} value={o}>{o}</option>
          : <option key={o.value} value={o.value}>{o.label}</option>
        )}
      </select>
    </div>
  );
}

function SectionPicker({ value, options, onSelect, onAdd }) {
  return (
    <div style={{ marginBottom:12, gridColumn:"span 1" }}>
      <label style={{ fontSize:12, fontWeight:700, display:"block",
        marginBottom:5, color:C.text }}>Section</label>
      <div style={{ display:"flex", gap:6, flexWrap:"wrap", alignItems:"center" }}>
        {options.map(s => (
          <button key={s} type="button" onClick={()=>onSelect(s)}
            style={{ padding:"6px 14px", borderRadius:8, cursor:"pointer",
              fontSize:13, fontWeight:700, border:"none",
              background: value===s ? C.accent : "#f4f6fb",
              color: value===s ? "#fff" : C.text }}>
            {s}
          </button>
        ))}
        <button type="button" onClick={onAdd}
          style={{ width:32, height:32, borderRadius:8,
            border:`1.5px dashed ${C.border}`, background:"transparent",
            cursor:"pointer", display:"grid", placeItems:"center",
            color:C.muted, fontSize:20, fontWeight:700 }}>+</button>
      </div>
    </div>
  );
}

/** One label/value line inside the View card — long values wrap instead of overflowing. */
function InfoRow({ label, children }) {
  return (
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:12, fontSize:13 }}>
      <span style={{ color:C.muted, fontWeight:600, flexShrink:0 }}>{label}</span>
      <span style={{ fontWeight:700, textAlign:"right", minWidth:0, overflowWrap:"anywhere" }}>{children}</span>
    </div>
  );
}

/* ── Role helpers ── */
const roleDisplay = r => ({ student:"Student", teacher:"Teacher",
  principal:"Principal", vice_principal:"Vice Principal", admin:"Admin" }[r] || r);

const roleColor = r => ({
  student:       { bg:"#eef2ff", color:C.accent  },
  teacher:       { bg:"#d1fae5", color:C.teal    },
  principal:     { bg:"#ede9fe", color:C.purple  },
  vice_principal:{ bg:"#fef3c7", color:C.orange  },
}[r] || { bg:"#f3f4f6", color:C.muted });

/* ══════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════ */
export function UserManagement() {
  const [users,   setUsers]   = useState([]);
  const [tab,     setTab]     = useState("all");
  const [q,       setQ]       = useState("");
  const [open,    setOpen]    = useState(false);
  const [viewUser,setViewUser]= useState(null);
  const [editing, setEditing] = useState(null);
  const [formType,setFormType]= useState("student");
  const [form,    setForm]    = useState(blankStudent());
  const [loading, setLoading] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState("");
  const [showViewPass, setShowViewPass] = useState(false);
  const [copiedField, setCopiedField]   = useState("");
  const [isEditingPass, setIsEditingPass] = useState(false);
  const [newQuickPass, setNewQuickPass]   = useState("");
  const [savingQuickPass, setSavingQuickPass] = useState(false);
  const [quickPassMsg, setQuickPassMsg]   = useState("");
  const [classRecords, setClassRecords] = useState([]);

  // FIX: real dropdown options, derived from the classes/subjects the admin
  // actually created — not the old hardcoded FALLBACK_* lists. Falls back to
  // the static list only while records are still loading / none exist yet.
  const classGradeOptions = classRecords.length
    ? [...new Set(
        classRecords
          .slice()
          .sort((a, b) => (a.gradeLevelOrder ?? 999) - (b.gradeLevelOrder ?? 999))
          .map(item => item.gradeLevel || item.name)
      )]
    : FALLBACK_CLASSES;
  const sectionsForGrade = grade => {
    const secs = classRecords
      .filter(item => String(item.gradeLevel || item.name) === String(grade))
      .map(item => item.section)
      .filter(Boolean);
    return secs.length ? [...new Set(secs)] : ["A", "B"];
  };

  const copyToClipboard = (text, field) => {
    if (!text) return;
    try {
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement("textarea");
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopiedField(field);
      setTimeout(() => setCopiedField(""), 2000);
    } catch (_) {}
  };

  const patchForm = patch => setForm(prev=>({...prev,...patch}));
  const f = form;

  /* Load */
  const load = async () => {
    setLoading(true);
    try {
      const [res, classRes] = await Promise.all([
        api.get(`/users?limit=200`),
        api.get(`/classes?limit=100`)
      ]);
      setUsers(res.data || res || []);
      setClassRecords(classRes.data || classRes || []);
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  };
  useEffect(()=>{
    load();
    // Real-time: reload list when any user/student/staff is created, updated, or deleted
    const unsubUsers    = onResourceChange("users",    () => load());
    const unsubStudents = onResourceChange("students", () => load());
    const unsubStaff    = onResourceChange("staff",    () => load());
    return () => { unsubUsers?.(); unsubStudents?.(); unsubStaff?.(); };
  },[]);

  /* Filter */
  const filtered = users.filter(u=>{
    const role = u.role?.toLowerCase();
    if (role==="admin") return false;
    if (tab==="student") return role==="student";
    if (tab==="staff")   return STAFF_API_ROLES.includes(role);
    return true;
  }).filter(u=>
    !q ||
    u.name?.toLowerCase().includes(q.toLowerCase()) ||
    u.email?.toLowerCase().includes(q.toLowerCase())
  );

  /* Switch form type */
  const switchType = type => {
    setFormType(type);
    setForm(type==="student" ? blankStudent() : blankStaff());
    setError("");
  };

  /* Save */
  const handleSave = async () => {
    if (saving) return;
    const err = validate(f, !!editing);
    if (err) { setError(err); return; }
    setSaving(true); setError("");
    const name = [f.firstName,f.middleName,f.lastName].filter(Boolean).join(" ");
    const selectedClass = classRecords.find(item => {
      const grade = item.gradeLevel || item.name?.replace(/^Class\s*/i, "").split("-")[0];
      return String(grade) === String(f.cls) && String(item.section || "A") === String(f.section || "A");
    });
    try {
      if (editing) {
        // 1. Update user account (name, email, phone, password, status)
        const userBody = { name, phone:f.phone, email:f.email, status:f.status||"active" };
        if (f.password) userBody.password = f.password;
        await api.patch(`/users/${editing._id}`, userBody);

        // 2. Also update the linked student or staff record so role-specific fields are saved
        const isStudent = editing.role === "student";
        const isStaff   = STAFF_API_ROLES.includes(editing.role);
        if (isStudent) {
          // Find the linked student record and patch it
          const sRes = await api.get(`/students?limit=500`).catch(()=>null);
          const sList = sRes?.data || sRes || [];
          const rec = sList.find(r => String(r.user?._id || r.user) === String(editing._id));
          if (rec) {
            await api.patch(`/students/${rec._id}`, {
              roll:f.roll, studentId:f.studentId,
              classId:selectedClass?._id,
              gender:f.gender, dob:f.dob ? f.dob : undefined,
              cls:f.cls, section:f.section,
              admissionDate:f.admissionDate ? f.admissionDate : undefined,
              fatherName:f.fatherName, motherName:f.motherName,
              guardianName:f.guardianName, parentPhone:f.parentPhone,
              address:f.address, village:f.village,
              status:f.status||"active"
            });
          }
        } else if (isStaff) {
          // Find the linked staff record and patch it
          const stRes = await api.get(`/staff?limit=500`).catch(()=>null);
          const stList = stRes?.data || stRes || [];
          const rec = stList.find(r => String(r.user?._id || r.user) === String(editing._id));
          if (rec) {
            await api.patch(`/staff/${rec._id}`, {
              staffId:f.staffId, ...(f.staffId?.trim() ? { employeeId:f.staffId.trim() } : {}), gender:f.gender, dob:f.dob ? f.dob : undefined,
              designation:f.staffRole,
              joiningDate:f.joiningDate ? f.joiningDate : undefined,
              qualification:f.qualification, experience:f.experience,
              address:f.address, village:f.village,
              status:f.status||"active"
            });
          }
        }
      } else if (formType==="student") {
        const u = await api.post("/users",{
          name, email:f.email, password:f.password,
          role:"student", phone:f.phone, status:"active"
        });
        const uid = (u.data||u)._id;
        try {
          await api.post("/students",{
            user:uid, roll:f.roll, studentId:f.studentId, classId:selectedClass?._id,
            gender:f.gender, dob:f.dob ? f.dob : undefined, cls:f.cls, section:f.section,
            admissionDate:f.admissionDate ? f.admissionDate : undefined, fatherName:f.fatherName,
            motherName:f.motherName, guardianName:f.guardianName,
            parentPhone:f.parentPhone, address:f.address, village:f.village,
            gpa:0, status:"active"
          });
        } catch(sErr) {
          await api.delete(`/users/${uid}`).catch(()=>null);
          throw sErr;
        }
      } else {
        const role = roleToApi[f.staffRole]||"teacher";
        const u = await api.post("/users",{
          name, email:f.email, password:f.password,
          role, phone:f.phone, status:f.status||"active"
        });
        const uid = (u.data||u)._id;
        try {
          await api.post("/staff",{
            user:uid, staffId:f.staffId, ...(f.staffId?.trim() ? { employeeId:f.staffId.trim() } : {}), gender:f.gender, dob:f.dob ? f.dob : undefined,
            designation:f.staffRole,
            joiningDate:f.joiningDate ? f.joiningDate : undefined, qualification:f.qualification,
            experience:f.experience, address:f.address, village:f.village,
            status:f.status||"active"
          });
        } catch(stErr) {
          await api.delete(`/users/${uid}`).catch(()=>null);
          throw stErr;
        }
      }
      setOpen(false); setEditing(null);
      setForm(blankStudent()); await load();
    } catch(e) {
      setError(e.message||"Save failed");
    } finally { setSaving(false); }
  };

  /* View */
  const handleView = async u => {
    setShowViewPass(false);
    setCopiedField("");
    setIsEditingPass(false);
    setNewQuickPass("");
    setQuickPassMsg("");
    setViewUser({ ...u, loadingDetails: true });
    try {
      const isStudent = u.role === "student";
      const [userRes, roleRes] = await Promise.all([
        api.get(`/users/${u._id}`).catch(() => null),
        api.get(`/${isStudent ? "students" : "staff"}?limit=500`).catch(() => null)
      ]);
      const fullUser = userRes?.data || userRes || u;
      const list = roleRes?.data || roleRes || [];
      const rec = list.find(r => String(r.user?._id || r.user) === String(u._id));
      if (rec) {
        setViewUser({
          ...fullUser,
          ...rec,
          _id: u._id,
          role: u.role,
          name: fullUser.name || rec.name || u.name,
          email: fullUser.email || rec.email || u.email,
          phone: fullUser.phone || rec.phone || u.phone,
          passwordDisplay: fullUser.passwordDisplay || u.passwordDisplay,
          cls: rec.cls || (rec.classId?.name ? `${rec.classId.name}${rec.classId.section?`-${rec.classId.section}`:""}` : ""),
          roll: rec.roll || "",
          section: rec.section || "",
          studentId: rec.studentId || "",
          fatherName: rec.fatherName || "",
          motherName: rec.motherName || "",
          guardianName: rec.guardianName || "",
          parentPhone: rec.parentPhone || "",
          address: rec.address || fullUser.address || u.address || "",
          village: rec.village || fullUser.village || u.village || "",
          gender: rec.gender || fullUser.gender || "Male",
          status: rec.status || fullUser.status || "active",
          loadingDetails: false
        });
      } else {
        setViewUser({ ...fullUser, loadingDetails: false });
      }
    } catch {
      setViewUser({ ...u, loadingDetails: false });
    }
  };

  /* Quick Password Save in View Modal */
  const handleSaveQuickPass = async () => {
    if (!newQuickPass || newQuickPass.length < 8) {
      setQuickPassMsg("Password must be at least 8 characters");
      return;
    }
    setSavingQuickPass(true);
    setQuickPassMsg("");
    try {
      await api.patch(`/users/${viewUser._id}`, { password: newQuickPass });
      setViewUser(prev => ({ ...prev, passwordDisplay: newQuickPass }));
      setUsers(prev => prev.map(u => u._id === viewUser._id ? { ...u, passwordDisplay: newQuickPass } : u));
      setQuickPassMsg("Password updated successfully!");
      setIsEditingPass(false);
      setNewQuickPass("");
      setShowViewPass(true);
    } catch (e) {
      setQuickPassMsg(e.message || "Failed to update password");
    } finally {
      setSavingQuickPass(false);
    }
  };

  /* Edit */
  const handleEdit = async u => {
    const isStudent = u.role==="student";
    const type = isStudent ? "student" : "staff";
    setFormType(type);
    const parts = (u.name||"").split(" ");
    const base = {
      firstName: parts[0]||"", lastName: parts[parts.length-1]||"",
      middleName: parts.length>2 ? parts.slice(1,-1).join(" ") : "",
      phone:u.phone||"", email:u.email||"", status:u.status||"active",
      gender:u.gender||"Male", password:"", confirmPassword:"",
      oldPassword: u.passwordDisplay || ""
    };
    setForm(isStudent
      ? {...blankStudent(),...base}
      : {...blankStaff(),...base,
          staffRole:Object.entries(roleToApi).find(([,v])=>v===u.role)?.[0]||"Teacher"});
    setEditing(u); setError(""); setOpen(true);

    // Fetch the linked Student/Staff record AND fresh user record so class/roll/subject/oldPassword aren't lost
    try {
      const [userRes, roleRes] = await Promise.all([
        api.get(`/users/${u._id}`).catch(() => null),
        api.get(`/${isStudent?"students":"staff"}?limit=200`).catch(() => null)
      ]);
      const fullUser = userRes?.data || userRes || u;
      if (fullUser.passwordDisplay) {
        setEditing(prev => ({ ...prev, passwordDisplay: fullUser.passwordDisplay }));
        setForm(prev => ({ ...prev, oldPassword: fullUser.passwordDisplay, password: "", confirmPassword: "" }));
      }
      const list = roleRes?.data || roleRes || [];
      const rec = list.find(r => String(r.user?._id || r.user) === String(u._id));
      if (!rec) return;
      if (isStudent) {
        setForm(prev => ({
          ...prev,
          cls: rec.cls || (rec.classId?.name ? String(rec.classId.name).replace(/^Class\s*/i, '') : prev.cls || "1"),
          roll: rec.roll || "", studentId: rec.studentId || "",
          gender: rec.gender || prev.gender, dob: rec.dob ? rec.dob.slice(0,10) : "",
          section: rec.section || prev.section,
          admissionDate: rec.admissionDate ? rec.admissionDate.slice(0,10) : "",
          fatherName: rec.fatherName || "", motherName: rec.motherName || "",
          guardianName: rec.guardianName || "", parentPhone: rec.parentPhone || "",
          address: rec.address || fullUser.address || "", village: rec.village || fullUser.village || "",
        }));
      } else {
        setForm(prev => ({
          ...prev,
          staffId: rec.staffId || "", gender: rec.gender || prev.gender,
          dob: rec.dob ? rec.dob.slice(0,10) : "",
          joiningDate: rec.joiningDate ? rec.joiningDate.slice(0,10) : "",
          qualification: rec.qualification || "", experience: rec.experience || "",
          address: rec.address || fullUser.address || "", village: rec.village || fullUser.village || "",
        }));
      }
    } catch (e) { /* leave form as-is if fetch fails */ }
  };

  /* Toggle active/inactive */
  const handleToggleStatus = async u => {
    const next = u.status==="active" ? "inactive" : "active";
    if (!window.confirm(`${next==="active"?"Activate":"Deactivate"} ${u.name}?`)) return;
    try { await api.patch(`/users/${u._id}`,{status:next}); await load(); }
    catch(e){ setError(e.message); }
  };

  /* Delete (permanent) */
  const [permDelete, setPermDelete] = useState(null);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const openPermDelete = u => { setPermDelete(u); setConfirmText(""); setError(""); };
  const handleDelete = async () => {
    if (confirmText !== permDelete.email) { setError("Type the email exactly to confirm."); return; }
    setDeleting(true); setError("");
    try { await api.delete(`/users/${permDelete._id}/permanent`); setPermDelete(null); await load(); }
    catch(e){ setError(e.message); }
    finally { setDeleting(false); }
  };

  const closeModal = () => { setOpen(false); setEditing(null); setForm(blankStudent()); setError(""); };

  /* ── RENDER ── */
  return (
    <div className="um-page" style={{ padding:28 }}>
      <style>{`
.um-page { min-width: 0; max-width: 100%; box-sizing: border-box; overflow-x: clip; }
.um-card { min-width: 0; }
.um-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0 14px; }
.um-grid > * { min-width: 0; }
.um-modal { box-sizing: border-box; }
.um-modal input, .um-modal select { max-width: 100%; }

@media (min-width: 769px) {
  .um-table { min-width: 580px; }
}

@media (max-width: 768px) {
  .um-page { padding: 14px !important; }
  .um-card { padding: 14px !important; border-radius: 12px !important; }
  .um-tabs > button { flex: 1 1 0; padding: 8px 10px !important; }
  .um-search { min-width: 100% !important; flex: 1 1 100% !important; }
  .um-modal { padding: 18px !important; border-radius: 14px !important; max-height: 94vh !important; }
  .um-cred-row { flex-direction: column; align-items: flex-start !important; gap: 6px !important; }

  /* Record cards: compact rows + one row of 4 equal action icons */
  .um-table td { padding-top: 5px !important; padding-bottom: 5px !important; font-size: 12px !important; }
  .um-table td.rtable-actions { display: block !important; padding: 10px 12px !important; }
  .um-table td.rtable-actions > div { display: grid !important; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px !important; width: 100%; }
  .um-table td.rtable-actions button { width: 100% !important; min-width: 0 !important; height: 38px !important; margin: 0 !important; padding: 0 !important; display: grid !important; place-items: center; }
}

@media (max-width: 560px) {
  .um-grid { grid-template-columns: 1fr; }
  .um-grid > * { grid-column: 1 / -1 !important; }
  .um-grid > div:empty { display: none; }
  .um-create { width: 100%; justify-content: center; }
  .um-modal-btns { flex-direction: column-reverse; }
}
`}</style>
      <div className="um-card" style={{ background:C.white, borderRadius:16, padding:22, boxShadow:"0 2px 8px rgba(0,0,0,.06)" }}>

        {/* Header */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
          gap:16, marginBottom:20, flexWrap:"wrap" }}>
          <div>
            <div style={{ fontSize:22, fontWeight:800, color:C.text }}>User Accounts</div>
            <div style={{ fontSize:13, color:C.muted, marginTop:4 }}>Manage student and staff accounts</div>
          </div>
          <button type="button" className="um-create"
            onClick={()=>{ setEditing(null); switchType("student"); setOpen(true); }}
            style={{ display:"inline-flex", alignItems:"center", gap:8, border:0, borderRadius:10,
              height:44, padding:"0 18px",
              background:`linear-gradient(135deg,${C.accent},#6d5dfc)`,
              color:"#fff", fontWeight:700, cursor:"pointer", fontSize:14 }}>
            <Plus size={17}/> Create Account
          </button>
        </div>

        {/* Tabs + Search */}
        <div className="um-tabs" style={{ display:"flex", gap:10, marginBottom:18, flexWrap:"wrap", alignItems:"center" }}>
          {[["all","All"],["student","Students"],["staff","Staff"]].map(([v,l])=>(
            <button key={v} type="button" onClick={()=>setTab(v)}
              style={{ padding:"8px 18px", borderRadius:8, fontWeight:700, fontSize:13,
                cursor:"pointer", border: tab===v?"none":`1.5px solid ${C.border}`,
                background: tab===v ? C.accent : "#fff",
                color: tab===v ? "#fff" : C.muted }}>
              {l}
            </button>
          ))}
          <div className="um-search" style={{ flex:1, minWidth:200, display:"flex", alignItems:"center", gap:8,
            background:"#f4f6fb", borderRadius:10, padding:"8px 14px", boxSizing:"border-box" }}>
            <Search size={15} color={C.muted}/>
            <input value={q} onChange={e=>setQ(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&load()}
              placeholder="Search name or email..."
              style={{ border:"none", background:"transparent",
                outline:"none", fontSize:13, flex:1, width:"auto", minWidth:0 }}/>
          </div>
        </div>

        {error && !open && !permDelete && (
          <div style={{ background:"#fee2e2", color:"#dc2626", borderRadius:8,
            padding:"9px 14px", fontSize:13, marginBottom:14 }}>⚠️ {error}</div>
        )}

        {/* Table */}
        <div style={{ overflowX:"auto" }}>
          <table className="rtable um-table" style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead>
              <tr style={{ background:"#f8fafc" }}>
                {["USER","EMAIL","ROLE","STATUS","ACTIONS"].map(h=>(
                  <th key={h} style={{ textAlign:"left", padding:"10px 14px",
                    fontSize:11, fontWeight:700, color:C.muted,
                    borderBottom:`1px solid ${C.border}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((u,i)=>{
                const rc = roleColor(u.role);
                return (
                  <tr key={u._id} style={{ background:ROW_COLORS[i%ROW_COLORS.length],
                    borderBottom:`1px solid ${C.border}` }}>
                    <td className="rtable-full" style={{ padding:"12px 14px" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                        <Avatar name={u.name} size={34}/>
                        <div style={{ minWidth:0 }}>
                          <div style={{ fontWeight:700, fontSize:13, overflowWrap:"anywhere" }}>{u.name}</div>
                          <div style={{ fontSize:11, color:C.muted }}>{u.phone||"—"}</div>
                        </div>
                      </div>
                    </td>
                    <td data-label="Email" style={{ padding:"12px 14px", fontSize:12, color:C.muted, overflowWrap:"anywhere" }}>{u.email}</td>
                    <td data-label="Role" style={{ padding:"12px 14px" }}>
                      <span style={{ background:rc.bg, color:rc.color, borderRadius:20,
                        padding:"3px 10px", fontSize:12, fontWeight:700 }}>
                        {roleDisplay(u.role)}
                      </span>
                    </td>
                    <td data-label="Status" style={{ padding:"12px 14px" }}>
                      <span style={{
                        background: u.status==="active" ? "#d1fae5" : "#fee2e2",
                        color:      u.status==="active" ? C.teal    : "#dc2626",
                        borderRadius:20, padding:"3px 10px", fontSize:12, fontWeight:700 }}>
                        {u.status||"active"}
                      </span>
                    </td>
                    <td className="rtable-actions" style={{ padding:"12px 14px" }}>
                      <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                        {/* View */}
                        <button type="button" onClick={()=>handleView(u)} title="View"
                          style={{ width:30, height:30, border:0, borderRadius:7,
                            background:"#f0f9ff", color:"#0ea5e9",
                            cursor:"pointer", display:"grid", placeItems:"center" }}>
                          <Eye size={13}/>
                        </button>
                        {/* Edit */}
                        <button type="button" onClick={()=>handleEdit(u)} title="Edit"
                          style={{ width:30, height:30, border:0, borderRadius:7,
                            background:"#eef2ff", color:C.accent,
                            cursor:"pointer", display:"grid", placeItems:"center" }}>
                          <Edit size={13}/>
                        </button>
                        {/* Activate/Deactivate */}
                        <button type="button" onClick={()=>handleToggleStatus(u)}
                          title={u.status==="active"?"Deactivate":"Activate"}
                          style={{ width:30, height:30, border:0, borderRadius:7,
                            background: u.status==="active" ? "#fef3c7" : "#d1fae5",
                            color:      u.status==="active" ? C.orange   : C.teal,
                            cursor:"pointer", display:"grid", placeItems:"center" }}>
                          <Check size={13}/>
                        </button>
                        {/* Delete (permanent) */}
                        <button type="button" onClick={()=>openPermDelete(u)} title="Delete permanently"
                          style={{ width:30, height:30, border:0, borderRadius:7,
                            background:"#fee2e2", color:"#dc2626",
                            cursor:"pointer", display:"grid", placeItems:"center" }}>
                          <Trash2 size={13}/>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!loading && filtered.length===0 && (
                <tr><td colSpan={5} style={{ padding:32, textAlign:"center",
                  color:C.muted, fontSize:13 }}>No users found</td></tr>
              )}
            </tbody>
          </table>
          {loading && <div style={{ padding:20, textAlign:"center", color:C.muted }}>Loading…</div>}
        </div>
      </div>

      {/* ════════════ CREATE / EDIT MODAL ════════════ */}
      {open && (
        <Portal>
          <div onClick={e=>{if(e.target===e.currentTarget)closeModal();}}
            style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.5)",
              display:"grid", placeItems:"center", zIndex:9999, padding:16, boxSizing:"border-box" }}>
            <div className="um-modal" style={{ background:"#fff", borderRadius:18, padding:28,
              width:"100%", maxWidth:660, maxHeight:"92vh", overflowY:"auto" }}>

              {/* Modal header */}
              <div style={{ display:"flex", justifyContent:"space-between",
                alignItems:"center", marginBottom:20 }}>
                <div style={{ fontWeight:800, fontSize:18 }}>
                  {editing ? "Edit Account" : "Create Account"}
                </div>
                <button type="button" onClick={closeModal}
                  style={{ width:32, height:32, border:0, borderRadius:8,
                    background:"#f4f6fb", cursor:"pointer",
                    display:"grid", placeItems:"center" }}>
                  <X size={16}/>
                </button>
              </div>

              {/* Student / Staff toggle (create only) */}
              {!editing && (
                <div style={{ display:"flex", gap:6, marginBottom:22,
                  background:"#f4f6fb", borderRadius:12, padding:5 }}>
                  {[["student","🎓  Student"],["staff","👨‍🏫  Staff"]].map(([v,l])=>(
                    <button key={v} type="button" onClick={()=>switchType(v)}
                      style={{ flex:1, padding:"10px 0", borderRadius:9,
                        fontWeight:700, fontSize:14, border:"none", cursor:"pointer",
                        transition:"all .15s",
                        background: formType===v ? "#fff" : "transparent",
                        color:      formType===v ? C.accent : C.muted,
                        boxShadow:  formType===v ? "0 2px 8px rgba(0,0,0,.1)" : "none" }}>
                      {l}
                    </button>
                  ))}
                </div>
              )}

              {error && (
                <div style={{ background:"#fee2e2", color:"#dc2626", borderRadius:8,
                  padding:"9px 14px", fontSize:13, marginBottom:16 }}>⚠️ {error}</div>
              )}

              {/* ── STUDENT FORM ── */}
              {formType==="student" && (
                <div className="um-grid">
                  <SectionHeader title="Personal Information"/>
                  <Field label="First Name" required half value={f.firstName} onChange={v=>patchForm({firstName:v})}/>
                  <Field label="Middle Name" half value={f.middleName} onChange={v=>patchForm({middleName:v})}/>
                  <Field label="Last Name" required half value={f.lastName} onChange={v=>patchForm({lastName:v})}/>
                  <Field label="Phone (10 digits)" required half type="tel" value={f.phone} onChange={v=>patchForm({phone:v})}/>
                  <Field label="Date of Birth" half type="date" value={f.dob} onChange={v=>patchForm({dob:v})}/>
                  <Sel label="Gender" half value={f.gender} onChange={v=>patchForm({gender:v})} options={GENDERS}/>

                  <SectionHeader title="Academic Information"/>
                  <Field label="Roll No." required half value={f.roll} onChange={v=>patchForm({roll:v})}/>
                  <Field label="Student ID" half value={f.studentId} onChange={v=>patchForm({studentId:v})}/>
                  <Field label="Admission Date" half type="date" value={f.admissionDate} onChange={v=>patchForm({admissionDate:v})}/>

                  <SectionHeader title="Family Information"/>
                  <Field label="Father Name" half value={f.fatherName} onChange={v=>patchForm({fatherName:v})}/>
                  <Field label="Mother Name" half value={f.motherName} onChange={v=>patchForm({motherName:v})}/>
                  <Field label="Guardian Name" half value={f.guardianName} onChange={v=>patchForm({guardianName:v})}/>
                  <Field label="Parent Phone" half type="tel" value={f.parentPhone} onChange={v=>patchForm({parentPhone:v})}/>

                  <SectionHeader title="Address"/>
                  <Field label="Address" half value={f.address} onChange={v=>patchForm({address:v})}/>
                  <Field label="Village" half value={f.village} onChange={v=>patchForm({village:v})}/>

                  <SectionHeader title="Account"/>
                  <Field label="Email / Username" required half type="email" value={f.email} onChange={v=>patchForm({email:v})}/>
                  {editing ? (
                    <>
                      <Field label="Current / Old Password" half type="password" readOnly value={f.oldPassword || editing?.passwordDisplay || ""} placeholder="No password recorded"/>
                      <Field label="New Password" half type="password" value={f.password} onChange={v=>patchForm({password:v})}/>
                      <Field label="Confirm New Password" half type="password" value={f.confirmPassword} onChange={v=>patchForm({confirmPassword:v})}/>
                    </>
                  ) : (
                    <>
                      <div style={{ gridColumn:"span 1" }}/>
                      <Field label="Password" required half type="password" value={f.password} onChange={v=>patchForm({password:v})}/>
                      <Field label="Confirm Password" required half type="password" value={f.confirmPassword} onChange={v=>patchForm({confirmPassword:v})}/>
                    </>
                  )}
                </div>
              )}

              {/* ── STAFF FORM ── */}
              {formType==="staff" && (
                <div className="um-grid">
                  <SectionHeader title="Personal Information"/>
                  <Field label="First Name" required half value={f.firstName} onChange={v=>patchForm({firstName:v})}/>
                  <Field label="Middle Name" half value={f.middleName} onChange={v=>patchForm({middleName:v})}/>
                  <Field label="Last Name" required half value={f.lastName} onChange={v=>patchForm({lastName:v})}/>
                  <Field label="Phone (10 digits)" required half type="tel" value={f.phone} onChange={v=>patchForm({phone:v})}/>
                  <Field label="Email / Username" required half type="email" value={f.email} onChange={v=>patchForm({email:v})}/>
                  <Field label="Date of Birth" half type="date" value={f.dob} onChange={v=>patchForm({dob:v})}/>
                  <Sel label="Gender" half value={f.gender} onChange={v=>patchForm({gender:v})} options={GENDERS}/>

                  <SectionHeader title="Professional Information"/>
                  <Sel label="Staff Role" half value={f.staffRole}
                    onChange={v=>patchForm({staffRole:v})} options={STAFF_ROLES}/>
                  <Field label="Staff ID" half value={f.staffId} onChange={v=>patchForm({staffId:v})}/>

                  <Field label="Joining Date" half type="date" value={f.joiningDate}
                    onChange={v=>patchForm({joiningDate:v})}/>
                  <Field label="Qualification" half value={f.qualification}
                    onChange={v=>patchForm({qualification:v})}/>
                  <Field label="Experience (years)" half value={f.experience}
                    onChange={v=>patchForm({experience:v})}/>

                  <SectionHeader title="Address"/>
                  <Field label="Address" half value={f.address} onChange={v=>patchForm({address:v})}/>
                  <Field label="Village" half value={f.village} onChange={v=>patchForm({village:v})}/>

                  <SectionHeader title="Account"/>
                  {editing ? (
                    <>
                      <Field label="Current / Old Password" half type="password" readOnly value={f.oldPassword || editing?.passwordDisplay || ""} placeholder="No password recorded"/>
                      <div style={{ gridColumn:"span 1" }}/>
                      <Field label="New Password" half type="password" value={f.password} onChange={v=>patchForm({password:v})}/>
                      <Field label="Confirm New Password" half type="password" value={f.confirmPassword} onChange={v=>patchForm({confirmPassword:v})}/>
                    </>
                  ) : (
                    <>
                      <Field label="Password" required half type="password" value={f.password} onChange={v=>patchForm({password:v})}/>
                      <Field label="Confirm Password" required half type="password" value={f.confirmPassword} onChange={v=>patchForm({confirmPassword:v})}/>
                    </>
                  )}

                  <SectionHeader title="Status"/>
                  <Sel label="Account Status" half value={f.status}
                    onChange={v=>patchForm({status:v})}
                    options={[{value:"active",label:"Active"},{value:"inactive",label:"Inactive"}]}/>
                </div>
              )}

              {/* Buttons */}
              <div className="um-modal-btns" style={{ display:"flex", gap:10, marginTop:24 }}>
                <button type="button" onClick={handleSave} disabled={saving}
                  style={{ flex:1, height:46, border:0, borderRadius:12,
                    background:`linear-gradient(135deg,${C.accent},#6d5dfc)`,
                    color:"#fff", fontWeight:700, fontSize:15,
                    cursor:saving?"wait":"pointer", opacity:saving?0.75:1 }}>
                  {saving?"Saving…":editing?"Save Changes":"Create Account"}
                </button>
                <button type="button" onClick={closeModal}
                  style={{ flex:1, height:46, border:0, borderRadius:12,
                    background:"#f4f6fb", color:C.text,
                    fontWeight:600, fontSize:15, cursor:"pointer" }}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}

      {/* ════════════ PERMANENT DELETE MODAL ════════════ */}
      {permDelete && (
        <Portal>
          <div onClick={e=>{if(e.target===e.currentTarget)setPermDelete(null);}}
            style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.5)",
              display:"grid", placeItems:"center", zIndex:9999, padding:16, boxSizing:"border-box" }}>
            <div className="um-modal" style={{ background:"#fff", borderRadius:18, padding:28, width:"100%", maxWidth:440, maxHeight:"92vh", overflowY:"auto" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16, gap:10 }}>
                <div style={{ fontWeight:800, fontSize:18, color:"#b91c1c" }}>Permanently Delete Account</div>
                <button type="button" onClick={()=>setPermDelete(null)}
                  style={{ width:32, height:32, border:0, borderRadius:8, background:"#f4f6fb", flexShrink:0,
                    cursor:"pointer", display:"grid", placeItems:"center" }}>
                  <X size={16}/>
                </button>
              </div>
              <div style={{ background:"#fef2f2", border:"1px solid #fecaca", borderRadius:10,
                padding:"12px 14px", fontSize:13, color:"#991b1b", marginBottom:16, lineHeight:1.5, overflowWrap:"anywhere" }}>
                This cannot be undone. This will permanently erase <strong>{permDelete.name}</strong> ({permDelete.email}).
              </div>
              <label style={{ fontSize:12.5, fontWeight:700, display:"block", marginBottom:7, color:C.text, overflowWrap:"anywhere" }}>
                Type the email address to confirm: <strong>{permDelete.email}</strong>
              </label>
              <input value={confirmText} onChange={e=>setConfirmText(e.target.value)}
                placeholder={permDelete.email}
                style={{ width:"100%", height:44, border:`1px solid ${C.border}`, borderRadius:10,
                  padding:"0 12px", outline:"none", boxSizing:"border-box" }}/>
              {error && (
                <div style={{ background:"#fee2e2", color:"#dc2626", borderRadius:8,
                  padding:"9px 14px", fontSize:13, marginTop:12 }}>⚠️ {error}</div>
              )}
              <div style={{ display:"flex", gap:10, marginTop:18 }}>
                <button type="button" onClick={()=>setPermDelete(null)}
                  style={{ flex:1, height:44, border:0, borderRadius:10, background:"#f1f5f9",
                    color:C.text, fontWeight:600, cursor:"pointer" }}>
                  Cancel
                </button>
                <button type="button" disabled={deleting || confirmText!==permDelete.email} onClick={handleDelete}
                  style={{ flex:1, height:44, border:0, borderRadius:10, background:"#b91c1c",
                    color:"#fff", fontWeight:700, cursor:(deleting||confirmText!==permDelete.email)?"not-allowed":"pointer",
                    opacity:(deleting||confirmText!==permDelete.email)?0.6:1 }}>
                  {deleting ? "Deleting…" : "Delete Permanently"}
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}

      {/* ════════════ VIEW MODAL ════════════ */}
      {viewUser && (
        <Portal>
          <div onClick={e=>{if(e.target===e.currentTarget)setViewUser(null);}}
            style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.5)",
              display:"grid", placeItems:"center", zIndex:9999, padding:16, boxSizing:"border-box" }}>
            <div className="um-modal" style={{ background:"#fff", borderRadius:18, padding:28,
              width:"100%", maxWidth:540, maxHeight:"88vh", overflowY:"auto" }}>
              <div style={{ display:"flex", justifyContent:"space-between",
                alignItems:"center", marginBottom:18 }}>
                <div style={{ fontWeight:800, fontSize:18 }}>Account Details</div>
                <button type="button" onClick={()=>setViewUser(null)}
                  style={{ width:32, height:32, border:0, borderRadius:8,
                    background:"#f4f6fb", cursor:"pointer",
                    display:"grid", placeItems:"center" }}>
                  <X size={16}/>
                </button>
              </div>

              {/* Profile banner */}
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center",
                background:`linear-gradient(135deg,${C.accent},#7c3aed)`,
                borderRadius:14, padding:"20px", marginBottom:18 }}>
                <Avatar name={viewUser.name} size={60}/>
                <div style={{ color:"#fff", fontWeight:800, fontSize:17, marginTop:10, textAlign:"center", overflowWrap:"anywhere" }}>
                  {viewUser.name}
                </div>
                <div style={{ color:"rgba(255,255,255,.85)", fontSize:13, marginTop:3, textAlign:"center", overflowWrap:"anywhere" }}>
                  {viewUser.email}
                </div>
                <span style={{ marginTop:8, background:"rgba(255,255,255,.2)",
                  color:"#fff", borderRadius:20, padding:"3px 14px",
                  fontSize:12, fontWeight:700 }}>
                  {roleDisplay(viewUser.role)}
                </span>
              </div>

              {viewUser.loadingDetails && (
                <div style={{ textAlign:"center", padding:"10px 0", color:C.muted, fontSize:12 }}>
                  Loading full profile details…
                </div>
              )}

              {/* Login Credentials (Admin Access) */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: C.accent, letterSpacing: 1, textTransform: "uppercase", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                  <LockKeyhole size={13} /> Login Credentials (Admin Access)
                </div>
                <div style={{ background: "#f0f4ff", border: "1.5px solid #dbeafe", borderRadius: 12, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
                  
                  {/* Email */}
                  <div className="um-cred-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, fontSize: 13 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, color: C.muted, fontWeight: 600, flexShrink: 0 }}>
                      <Mail size={14} color={C.accent} /> Email / Username
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, maxWidth: "100%" }}>
                      <span style={{ fontWeight: 700, color: C.text, minWidth: 0, overflowWrap: "anywhere" }}>{viewUser.email}</span>
                      <button type="button" onClick={() => copyToClipboard(viewUser.email, "email")}
                        title="Copy Email"
                        style={{ flexShrink: 0, background: "#fff", border: `1px solid ${C.border}`, borderRadius: 6, width: 28, height: 28, display: "grid", placeItems: "center", cursor: "pointer", color: copiedField === "email" ? C.teal : C.muted }}>
                        {copiedField === "email" ? <Check size={13} color={C.teal} /> : <Copy size={13} />}
                      </button>
                    </div>
                  </div>

                  {/* Password */}
                  {!isEditingPass ? (
                    <div className="um-cred-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, fontSize: 13, borderTop: "1px solid #e0e7ff", paddingTop: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, color: C.muted, fontWeight: 600, flexShrink: 0 }}>
                        <LockKeyhole size={14} color={C.accent} /> Password
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", minWidth: 0, maxWidth: "100%" }}>
                        {viewUser.passwordDisplay ? (
                          <>
                            <span style={{ fontWeight: 700, fontFamily: showViewPass ? "inherit" : "monospace", fontSize: showViewPass ? 13 : 15, letterSpacing: showViewPass ? 0 : 2, color: C.text, minWidth: 0, overflowWrap: "anywhere" }}>
                              {showViewPass ? viewUser.passwordDisplay : "••••••••"}
                            </span>
                            <button type="button" onClick={() => setShowViewPass(!showViewPass)}
                              title={showViewPass ? "Hide Password" : "Show Password"}
                              style={{ flexShrink: 0, background: "#fff", border: `1px solid ${C.border}`, borderRadius: 6, width: 28, height: 28, display: "grid", placeItems: "center", cursor: "pointer", color: C.muted }}>
                              {showViewPass ? <EyeOff size={13} /> : <Eye size={13} />}
                            </button>
                            <button type="button" onClick={() => copyToClipboard(viewUser.passwordDisplay, "password")}
                              title="Copy Password"
                              style={{ flexShrink: 0, background: "#fff", border: `1px solid ${C.border}`, borderRadius: 6, width: 28, height: 28, display: "grid", placeItems: "center", cursor: "pointer", color: copiedField === "password" ? C.teal : C.muted }}>
                              {copiedField === "password" ? <Check size={13} color={C.teal} /> : <Copy size={13} />}
                            </button>
                            <button type="button" onClick={() => { setIsEditingPass(true); setNewQuickPass(""); setQuickPassMsg(""); }}
                              style={{ background: "transparent", border: "none", color: C.accent, fontSize: 11, fontWeight: 700, cursor: "pointer", textDecoration: "underline", marginLeft: 4 }}>
                              Change
                            </button>
                          </>
                        ) : (
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            <span style={{ fontSize: 12, color: C.muted, fontStyle: "italic" }}>Encrypted (Not stored in plain)</span>
                            <button type="button" onClick={() => { setIsEditingPass(true); setNewQuickPass(viewUser.role === "student" ? "Student@123" : "Welcome@123"); setQuickPassMsg(""); }}
                              style={{ background: C.accent, color: "#fff", border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                              Set Password
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div style={{ borderTop: "1px solid #e0e7ff", paddingTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>Set New Password for User:</div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <input
                          type="text"
                          value={newQuickPass}
                          onChange={e => setNewQuickPass(e.target.value)}
                          placeholder="Enter new password (min 8 chars)"
                          style={{ flex: 1, minWidth: 160, height: 34, borderRadius: 8, border: `1.5px solid ${C.border}`, padding: "0 10px", fontSize: 13, outline: "none", boxSizing: "border-box" }}
                        />
                        <button type="button" onClick={() => setNewQuickPass(`Pica@${Math.floor(1000 + Math.random() * 9000)}`)}
                          style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 8, padding: "0 10px", height: 34, fontSize: 11, fontWeight: 700, color: C.muted, cursor: "pointer" }}>
                          🎲 Generate
                        </button>
                        <button type="button" onClick={handleSaveQuickPass} disabled={savingQuickPass}
                          style={{ background: C.accent, color: "#fff", border: "none", borderRadius: 8, padding: "0 14px", height: 34, fontSize: 12, fontWeight: 700, cursor: savingQuickPass ? "wait" : "pointer" }}>
                          {savingQuickPass ? "Saving…" : "Save"}
                        </button>
                        <button type="button" onClick={() => { setIsEditingPass(false); setQuickPassMsg(""); }}
                          style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 8, padding: "0 10px", height: 34, fontSize: 12, fontWeight: 600, color: C.text, cursor: "pointer" }}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {quickPassMsg && (
                    <div style={{ fontSize: 12, color: quickPassMsg.includes("success") ? C.teal : C.red, fontWeight: 600 }}>
                      {quickPassMsg}
                    </div>
                  )}

                </div>
              </div>

              {/* Personal Information */}
              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:11, fontWeight:800, color:C.muted, letterSpacing:1, textTransform:"uppercase", marginBottom:6 }}>
                  Personal Information
                </div>
                <div style={{ background:"#f8fafc", borderRadius:10, padding:"10px 14px", display:"flex", flexDirection:"column", gap:8 }}>
                  <InfoRow label="Phone">{viewUser.phone||"—"}</InfoRow>
                  <InfoRow label="Gender">{viewUser.gender||"—"}</InfoRow>
                  <InfoRow label="Date of Birth">{viewUser.dob ? new Date(viewUser.dob).toLocaleDateString() : "—"}</InfoRow>
                  <InfoRow label="Status">
                    <span style={{
                      background: viewUser.status==="active" ? "#d1fae5" : "#fee2e2",
                      color:      viewUser.status==="active" ? C.teal    : "#dc2626",
                      borderRadius:12, padding:"2px 8px", fontSize:11, fontWeight:700 }}>
                      {viewUser.status||"active"}
                    </span>
                  </InfoRow>
                </div>
              </div>

              {/* Academic Details (if Student) */}
              {viewUser.role==="student" && (
                <div style={{ marginBottom:14 }}>
                  <div style={{ fontSize:11, fontWeight:800, color:C.muted, letterSpacing:1, textTransform:"uppercase", marginBottom:6 }}>
                    Academic Details
                  </div>
                  <div style={{ background:"#f8fafc", borderRadius:10, padding:"10px 14px", display:"flex", flexDirection:"column", gap:8 }}>
                    <InfoRow label="Roll Number">{viewUser.roll||"—"}</InfoRow>
                    <InfoRow label="Class / Section">
                      {viewUser.cls ? `${viewUser.cls}${viewUser.section ? ` (Sec ${viewUser.section})` : ""}` : "—"}
                    </InfoRow>
                    {viewUser.studentId && <InfoRow label="Student ID">{viewUser.studentId}</InfoRow>}
                    {viewUser.admissionDate && <InfoRow label="Admission Date">{new Date(viewUser.admissionDate).toLocaleDateString()}</InfoRow>}
                    {viewUser.gpa != null && <InfoRow label="GPA">{viewUser.gpa}</InfoRow>}
                  </div>
                </div>
              )}

              {/* Professional Details (if Staff) */}
              {STAFF_API_ROLES.includes(viewUser.role) && (
                <div style={{ marginBottom:14 }}>
                  <div style={{ fontSize:11, fontWeight:800, color:C.muted, letterSpacing:1, textTransform:"uppercase", marginBottom:6 }}>
                    Professional Details
                  </div>
                  <div style={{ background:"#f8fafc", borderRadius:10, padding:"10px 14px", display:"flex", flexDirection:"column", gap:8 }}>
                    <InfoRow label="Designation">{viewUser.designation||viewUser.staffRole||roleDisplay(viewUser.role)}</InfoRow>
                    {viewUser.department && <InfoRow label="Department">{viewUser.department}</InfoRow>}
                    {viewUser.subject && <InfoRow label="Subject">{viewUser.subject}</InfoRow>}
                    {viewUser.cls && <InfoRow label="Class">{viewUser.cls}{viewUser.section ? `-${viewUser.section}` : ""}</InfoRow>}
                    {viewUser.qualification && <InfoRow label="Qualification">{viewUser.qualification}</InfoRow>}
                    {viewUser.experience && <InfoRow label="Experience">{viewUser.experience} years</InfoRow>}
                    {viewUser.joiningDate && <InfoRow label="Joining Date">{new Date(viewUser.joiningDate).toLocaleDateString()}</InfoRow>}
                    {viewUser.staffId && <InfoRow label="Staff ID">{viewUser.staffId}</InfoRow>}
                  </div>
                </div>
              )}

              {/* Family Details (if Student) */}
              {viewUser.role==="student" && (viewUser.fatherName || viewUser.motherName || viewUser.guardianName || viewUser.parentPhone) && (
                <div style={{ marginBottom:14 }}>
                  <div style={{ fontSize:11, fontWeight:800, color:C.muted, letterSpacing:1, textTransform:"uppercase", marginBottom:6 }}>
                    Family Details
                  </div>
                  <div style={{ background:"#f8fafc", borderRadius:10, padding:"10px 14px", display:"flex", flexDirection:"column", gap:8 }}>
                    {viewUser.fatherName && <InfoRow label="Father's Name">{viewUser.fatherName}</InfoRow>}
                    {viewUser.motherName && <InfoRow label="Mother's Name">{viewUser.motherName}</InfoRow>}
                    {viewUser.guardianName && <InfoRow label="Guardian">{viewUser.guardianName}</InfoRow>}
                    {viewUser.parentPhone && <InfoRow label="Parent Phone">{viewUser.parentPhone}</InfoRow>}
                  </div>
                </div>
              )}

              {/* Address Details */}
              {(viewUser.address || viewUser.village) && (
                <div style={{ marginBottom:14 }}>
                  <div style={{ fontSize:11, fontWeight:800, color:C.muted, letterSpacing:1, textTransform:"uppercase", marginBottom:6 }}>
                    Address
                  </div>
                  <div style={{ background:"#f8fafc", borderRadius:10, padding:"10px 14px", display:"flex", flexDirection:"column", gap:8 }}>
                    {viewUser.address && <InfoRow label="Address">{viewUser.address}</InfoRow>}
                    {viewUser.village && <InfoRow label="Village">{viewUser.village}</InfoRow>}
                  </div>
                </div>
              )}

              {/* Single Close Button */}
              <div style={{ marginTop:20 }}>
                <button type="button" onClick={()=>setViewUser(null)}
                  style={{ width:"100%", height:44, border:0, borderRadius:10,
                    background:"#f4f6fb", color:C.text, fontWeight:700, fontSize:14, cursor:"pointer" }}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
}