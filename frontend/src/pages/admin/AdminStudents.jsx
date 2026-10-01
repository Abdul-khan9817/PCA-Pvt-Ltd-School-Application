import { useState, useEffect } from "react";
import { Search, Eye, EyeOff, LockKeyhole, Mail, Copy, Plus, X, Check, BookOpen } from "../../shared/ui";
import { C, ROW_COLORS } from "../../shared/runtime";
import { Avatar } from "../../components/common/Avatar";
import { Portal } from "../../components/common/Portal";
import { list, create, remove } from "../../services/resource.service";
import { api } from "../../services/apiClient";
import { onResourceChange } from "../../services/socket.service";
import { useMediaQuery } from "../../hooks/useMediaQuery";

const mapStudent = s => ({
  ...s,
  id:     s._id || s.id,
  userId: s.user?._id || s.user || s.userId || null,
  name:   s.user?.name  || s.name  || "Unnamed Student",
  email:  s.user?.email || s.email || "—",
  phone:  s.user?.phone || s.phone || "",
  cls:    s.classId?.name
    ? `${s.classId.name}${s.classId.section?`-${s.classId.section}`:""}`
    : s.cls || "—",
  status: String(s.user?.status || s.status || "active").replace(/^./,c=>c.toUpperCase()),
  gpa:    Number(s.gpa||0),
});

const CLASSES = ["Nursery","LKG","UKG","1","2","3","4","5","6","7","8","9","10"];

const blankAdd = {
  name:"", email:"", phone:"", address:"", cls:"", section:"", classId:"", roll:"",
  gpa:"", gender:"Male", status:"active", password:"Student@123"
};

// GPA display: an unset GPA (0) shows a neutral "—" instead of a red warning.
const gpaText  = gpa => (Number(gpa) > 0 ? gpa : "—");
const gpaColor = gpa =>
  gpa >= 3 ? C.teal : gpa >= 2 ? C.orange : gpa > 0 ? "#dc2626" : C.muted;

function Field({ label, value, onChange, type="text" }) {
  return (
    <div style={{ marginBottom:14 }}>
      <label style={{ fontSize:13, fontWeight:600, display:"block", marginBottom:6 }}>{label}</label>
      <input type={type} value={value||""}
        onChange={e=>onChange(e.target.value)}
        style={{ width:"100%", padding:"10px 14px", borderRadius:10,
          border:"1.5px solid "+C.border, fontSize:13, outline:"none", boxSizing:"border-box" }}
        onFocus={e=>e.target.style.borderColor=C.accent}
        onBlur={e=>e.target.style.borderColor=C.border} />
    </div>
  );
}

function SelectField({ label, value, onChange, options }) {
  return (
    <div style={{ marginBottom:14 }}>
      <label style={{ fontSize:13, fontWeight:600, display:"block", marginBottom:6 }}>{label}</label>
      <select value={value||""} onChange={e=>onChange(e.target.value)}
        style={{ width:"100%", padding:"10px 14px", borderRadius:10,
          border:"1.5px solid "+C.border, fontSize:13, outline:"none",
          background:"#fff", boxSizing:"border-box" }}>
        {options.map(o=><option key={o.value||o} value={o.value||o}>{o.label||o}</option>)}
      </select>
    </div>
  );
}

function ModalBox({ title, onClose, children }) {
  return (
    <Portal>
      <div
        onClick={e=>{if(e.target===e.currentTarget)onClose();}}
        style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.45)",
          display:"grid", placeItems:"center", zIndex:9999, padding:24 }}>
        <div style={{ background:"#fff", borderRadius:16, padding:28, width:"100%",
          maxWidth:540, maxHeight:"90vh", overflowY:"auto" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
            <div style={{ fontWeight:700, fontSize:17 }}>{title}</div>
            <button type="button" onClick={onClose}
              style={{ background:"#f4f6fb", border:"none", borderRadius:8,
                width:32, height:32, cursor:"pointer", display:"grid", placeItems:"center" }}>
              <X size={16}/>
            </button>
          </div>
          {children}
        </div>
      </div>
    </Portal>
  );
}

const StatusPill = ({ status }) => {
  const active = String(status).toLowerCase()==="active";
  return (
    <span style={{
      background: active ? "#d1fae5" : "#fee2e2",
      color:      active ? C.teal    : "#dc2626",
      borderRadius:20, padding:"3px 10px", fontSize:12, fontWeight:600, flexShrink:0 }}>
      {status}
    </span>
  );
};

function AdminStudents() {
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [students, setStudents] = useState([]);
  const [classes, setClasses]   = useState([]);
  const [search, setSearch]     = useState("");
  // ── NEW: class filter ───────────────────────────────────────────────
  const [filterClass, setFilterClass] = useState("");
  // ───────────────────────────────────────────────────────────────────
  const [page, setPage]         = useState(1);
  const [pageMeta, setPageMeta] = useState({ page:1, pages:1, total:0, limit:50 });
  const [showAdd, setShowAdd]   = useState(false);
  const [addForm, setAddForm]   = useState(blankAdd);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState("");

  // View modal state
  const [viewUser, setViewUser] = useState(null);
  const [showViewPass, setShowViewPass] = useState(false);
  const [copiedField, setCopiedField]   = useState("");
  const [isEditingPass, setIsEditingPass] = useState(false);
  const [newQuickPass, setNewQuickPass]   = useState("");
  const [savingQuickPass, setSavingQuickPass] = useState(false);
  const [quickPassMsg, setQuickPassMsg]   = useState("");

  // ── NEW: change-class modal state ───────────────────────────────────
  const [changeClassStudent, setChangeClassStudent] = useState(null);
  const [changeClassId, setChangeClassId]           = useState("");
  const [savingClassChange, setSavingClassChange]   = useState(false);
  const [changeClassError, setChangeClassError]     = useState("");
  // ───────────────────────────────────────────────────────────────────

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

  // ── Load students from API ──────────────────────────────────────────
  const refreshStudents = () => {
    const classQuery = filterClass ? `&classId=${encodeURIComponent(filterClass)}` : "";
    const query = `q=${encodeURIComponent(search.trim())}&page=${page}&limit=50${classQuery}`;
    list("students",query)
      .then(r => {
        setStudents((r.data||r||[]).map(mapStudent));
        if (r.meta) setPageMeta(r.meta);
      })
      .catch(()=>{});
  };

  useEffect(() => {
    const timer = setTimeout(refreshStudents, 250);
    return () => clearTimeout(timer);
  }, [search, page, filterClass]);

  useEffect(() => {
    list("classes", "limit=100").then(response => setClasses(response.data || response || [])).catch(() => {});
  }, []);

  // ── Socket subscription for real-time updates ───────────────────────
  useEffect(()=>{
    refreshStudents();
    const unsubStudents = onResourceChange("students", change => {
      if (change.action === "create") {
        setStudents(prev => {
          const mapped = mapStudent(change.data);
          if (prev.some(s => s.id === mapped.id)) return prev;
          return [mapped, ...prev];
        });
      } else if (change.action === "update") {
        setStudents(prev => {
          const mapped = mapStudent(change.data);
          return prev.map(s => (s.id === mapped.id || s.id === change.id ? { ...s, ...mapped } : s));
        });
      } else if (change.action === "delete") {
        setStudents(prev => prev.filter(s => s.id !== change.id && s.id !== change.data?._id));
      }
    });

    const unsubUsers = onResourceChange("users", change => {
      if (change.action === "update") {
        const u = change.data || {};
        const uId = u._id || change.id;
        setStudents(prev => prev.map(s => {
          if (s.userId === uId || s.user?._id === uId || s.user === uId) {
            const nextStatus = u.status ? String(u.status).replace(/^./, c => c.toUpperCase()) : s.status;
            return { ...s, name: u.name || s.name, email: u.email || s.email, phone: u.phone || s.phone, status: nextStatus };
          }
          return s;
        }));
      } else if (change.action === "delete") {
        const uId = change.id || change.data?._id;
        setStudents(prev => prev.filter(s => s.userId !== uId && s.user?._id !== uId && s.user !== uId));
      }
    });

    return () => { unsubStudents?.(); unsubUsers?.(); };
  },[]);

  // ── NEW: filter includes class ──────────────────────────────────────
  const filtered = students.filter(s => {
    const matchesSearch =
      String(s.name).toLowerCase().includes(search.toLowerCase()) ||
      String(s.roll||"").toLowerCase().includes(search.toLowerCase());
    const studentClassId = s.classId?._id || (typeof s.classId === "string" ? s.classId : "");
    const matchesClass = !filterClass || studentClassId === filterClass;
    return matchesSearch && matchesClass;
  });
  // ───────────────────────────────────────────────────────────────────

  // ── View ────────────────────────────────────────────────────────────
  const handleView = async s => {
    setShowViewPass(false);
    setCopiedField("");
    setIsEditingPass(false);
    setNewQuickPass("");
    setQuickPassMsg("");
    setViewUser({ ...s, loadingDetails: true });
    try {
      const uId = s.userId || s.user?._id || s.user;
      const [userRes, studentRes] = await Promise.all([
        uId ? api.get(`/users/${uId}`).catch(() => null) : null,
        api.get(`/students/${s.id}`).catch(() => null)
      ]);
      const fullUser = userRes?.data || userRes || s.user || {};
      const fullStudent = studentRes?.data || studentRes || s;
      setViewUser({
        ...fullStudent,
        ...fullUser,
        _id: uId || s.id,
        role: "student",
        id: s.id,
        name: fullUser.name || s.name,
        email: fullUser.email || s.email,
        phone: fullUser.phone || s.phone,
        cls: fullStudent.cls || fullStudent.classId?.name || s.cls,
        section: fullStudent.section || fullStudent.classId?.section || s.section,
        passwordDisplay: fullUser.passwordDisplay || s.passwordDisplay,
        status: fullStudent.status || fullUser.status || s.status,
        loadingDetails: false
      });
    } catch {
      setViewUser({ ...s, loadingDetails: false });
    }
  };

  // ── Quick Password Save in View Modal ───────────────────────────────
  const handleSaveQuickPass = async () => {
    const uId = viewUser?.userId || viewUser?._id;
    if (!newQuickPass || newQuickPass.length < 8) {
      setQuickPassMsg("Password must be at least 8 characters");
      return;
    }
    setSavingQuickPass(true);
    setQuickPassMsg("");
    try {
      await api.patch(`/users/${uId}`, { password: newQuickPass });
      setViewUser(prev => ({ ...prev, passwordDisplay: newQuickPass }));
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

  // ── NEW: Change Class handler ───────────────────────────────────────
  const handleChangeClass = async () => {
    if (!changeClassId) { setChangeClassError("Please select a class"); return; }
    const currentId = changeClassStudent.classId?._id ||
      (typeof changeClassStudent.classId === "string" ? changeClassStudent.classId : "");
    if (changeClassId === currentId) {
      setChangeClassError("Student is already in this class"); return;
    }
    setSavingClassChange(true);
    setChangeClassError("");
    try {
      await api.patch(`/students/${changeClassStudent.id}`, { classId: changeClassId });
      const selectedClass = classes.find(c => c._id === changeClassId);
      const newCls = selectedClass
        ? `${selectedClass.name}${selectedClass.section ? `-${selectedClass.section}` : ""}`
        : "";
      setStudents(prev => prev.map(s =>
        s.id === changeClassStudent.id
          ? { ...s, classId: changeClassId, cls: newCls }
          : s
      ));
      setChangeClassStudent(null);
    } catch(e) {
      setChangeClassError(e.message || "Failed to change class");
    } finally {
      setSavingClassChange(false);
    }
  };
  // ───────────────────────────────────────────────────────────────────

  const openChangeClass = s => {
    setChangeClassStudent(s);
    setChangeClassId(s.classId?._id || (typeof s.classId==="string" ? s.classId : "") || "");
    setChangeClassError("");
  };

  // ── Delete ──────────────────────────────────────────────────────────
  const handleDelete = async id => {
    const s = students.find(s=>s.id===id);
    if(!window.confirm(`Delete ${s?.name||"this student"}?`))return;
    try {
      await remove("students",id);
      if(s?.userId) await api.delete(`/users/${s.userId}`).catch(()=>null);
      setStudents(prev=>prev.filter(s=>s.id!==id));
    } catch(e){ setError(e.message||"Delete failed"); }
  };

  // ── Add ─────────────────────────────────────────────────────────────
  const handleAdd = async () => {
    if(saving)return;
    if(!addForm.name||!addForm.email||!addForm.roll||!addForm.classId){
      setError('Name, email, class and Roll No are required'); return;
    }
    if(!addForm.password||addForm.password.length<8){
      setError('Password must be at least 8 characters'); return;
    }
    setSaving(true); setError('');
    let createdUserId = null;
    try {
      const uRes = await api.post('/users',{
        name:addForm.name.trim(), email:addForm.email.trim().toLowerCase(),
        password:addForm.password, role:'student',
        phone:addForm.phone||'', address:addForm.address||'', status:'active'
      });
      const uData = uRes.data || uRes;
      if(!uData || !uData._id) throw new Error('Failed to create user account');
      createdUserId = uData._id;

      let sRes;
      try {
        sRes = await create('students',{
          user:createdUserId,
          classId:addForm.classId||undefined,
          roll:addForm.roll.trim(),
          studentId:addForm.studentId||'',
          cls:addForm.cls||'',
          section:addForm.section||'',
          gender:addForm.gender||'Male',
          fatherName:addForm.fatherName||'',
          motherName:addForm.motherName||'',
          guardianName:addForm.guardianName||'',
          parentPhone:addForm.parentPhone||'',
          address:addForm.address||'',
          village:addForm.village||'',
          gpa:Number(addForm.gpa)||0,
          status:'active'
        });
      } catch(sErr) {
        await api.delete('/users/'+createdUserId).catch(function(){});
        createdUserId = null;
        const msg = (sErr && sErr.message) ? sErr.message : 'Failed to create student. Roll No may already be in use.';
        throw new Error(msg);
      }

      const studentDoc = (sRes && sRes.data) ? sRes.data : sRes;
      if (!studentDoc || !studentDoc._id) {
        if(createdUserId) await api.delete('/users/'+createdUserId).catch(function(){});
        throw new Error('Student record was not saved correctly. Please try again.');
      }

      // Refresh from server to show real populated data
      await refreshStudents();
      setAddForm(Object.assign({}, blankAdd));
      setShowAdd(false);
    } catch(e){
      if(createdUserId) await api.delete('/users/'+createdUserId).catch(function(){});
      setError((e && e.message) ? e.message : 'Add failed');
    } finally { setSaving(false); }
  };

  /* ───────── phone layout: one structured card per student ───────── */

  // Two per row using flex-wrap (not CSS grid) so the global mobile "collapse every
  // grid to one column" rule can't stack them into a single long column.
  const statBlock = (label, value, color) => (
    <div style={{ flex:"1 1 calc(50% - 7px)", minWidth:0 }}>
      <div style={{ fontSize:10, fontWeight:700, color:C.muted, letterSpacing:.5, marginBottom:3 }}>{label}</div>
      <div style={{ fontSize:14, fontWeight:700, color: color || C.text, overflowWrap:"anywhere" }}>{value || "—"}</div>
    </div>
  );

  const renderCards = () => (
    <div style={{ display:"flex", flexDirection:"column", gap:12, width:"100%", minWidth:0 }}>
      {filtered.map((s,i)=>(
        <div key={s.id} style={{ background:ROW_COLORS[i%ROW_COLORS.length], border:"1px solid "+C.border,
          borderRadius:14, padding:12, boxSizing:"border-box", width:"100%", maxWidth:"100%", minWidth:0, overflow:"hidden" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <Avatar name={s.name} size={42}/>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontWeight:700, fontSize:15, overflowWrap:"anywhere" }}>{s.name}</div>
              <div style={{ fontSize:11, color:C.muted, overflowWrap:"anywhere", marginTop:2 }}>{s.email}</div>
            </div>
            <StatusPill status={s.status}/>
          </div>

          <div style={{ display:"flex", flexWrap:"wrap", columnGap:14, rowGap:12,
            margin:"12px 0", padding:"12px 0", borderTop:"1px solid "+C.border, borderBottom:"1px solid "+C.border }}>
            {statBlock("ROLL NO", s.roll)}
            {statBlock("CLASS", s.cls)}
            {statBlock("GENDER", s.gender)}
            {statBlock("GPA", gpaText(s.gpa), gpaColor(s.gpa))}
          </div>

          <div style={{ display:"flex", gap:8 }}>
            <button type="button" onClick={()=>handleView(s)}
              style={{ flex:"1 1 0", minWidth:0, height:38, display:"flex", alignItems:"center", justifyContent:"center", gap:6,
                background:"#f0f9ff", color:"#0ea5e9", border:"none", borderRadius:10,
                fontSize:13, fontWeight:700, cursor:"pointer", whiteSpace:"nowrap" }}>
              <Eye size={15}/> View
            </button>
            <button type="button" onClick={()=>openChangeClass(s)}
              style={{ flex:"1 1 0", minWidth:0, height:38, display:"flex", alignItems:"center", justifyContent:"center", gap:6,
                background:"#fff7ed", color:"#f97316", border:"none", borderRadius:10,
                fontSize:13, fontWeight:700, cursor:"pointer", whiteSpace:"nowrap" }}>
              <BookOpen size={15}/> Change Class
            </button>
          </div>
        </div>
      ))}
      {filtered.length===0&&(
        <div style={{ padding:32, textAlign:"center", color:C.muted, fontSize:13 }}>
          {filterClass ? "No students in this class" : "No students found"}
        </div>
      )}
    </div>
  );

  /* ───────── desktop layout: original table ───────── */
  const renderTable = () => (
    <div style={{ overflowX:"auto" }}>
      <table style={{ width:"100%", borderCollapse:"collapse" }}>
        <thead>
          <tr style={{ background:"#f8fafc" }}>
            {["STUDENT","ROLL NO","CLASS","GENDER","EMAIL","GPA","STATUS","ACTIONS"].map(h=>(
              <th key={h} style={{ padding:"10px 14px", textAlign:"left", fontSize:11, fontWeight:700, color:C.muted }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filtered.map((s,i)=>(
            <tr key={s.id} style={{ background:ROW_COLORS[i%ROW_COLORS.length], borderBottom:"1px solid "+C.border }}>
              <td style={{ padding:"12px 14px" }}>
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <Avatar name={s.name} size={32}/>
                  <div style={{ fontWeight:600, fontSize:13 }}>{s.name}</div>
                </div>
              </td>
              <td style={{ padding:"12px 14px", fontSize:13 }}>{s.roll}</td>
              <td style={{ padding:"12px 14px", fontSize:13 }}>{s.cls}</td>
              <td style={{ padding:"12px 14px", fontSize:13 }}>{s.gender}</td>
              <td style={{ padding:"12px 14px", fontSize:12, color:C.muted }}>{s.email}</td>
              <td style={{ padding:"12px 14px", fontWeight:700,
                color:gpaColor(s.gpa) }}>{gpaText(s.gpa)}</td>
              <td style={{ padding:"12px 14px" }}><StatusPill status={s.status}/></td>
              <td style={{ padding:"12px 14px" }}>
                <div style={{ display:"flex", gap:6 }}>
                  <button type="button" onClick={()=>handleView(s)} title="View Details"
                    style={{ background:"#f0f9ff", color:"#0ea5e9", border:"none",
                      borderRadius:7, width:30, height:30, cursor:"pointer", display:"grid", placeItems:"center" }}>
                    <Eye size={14}/>
                  </button>
                  <button type="button" onClick={()=>openChangeClass(s)} title="Change Class"
                    style={{ background:"#fff7ed", color:"#f97316", border:"none",
                      borderRadius:7, width:30, height:30, cursor:"pointer", display:"grid", placeItems:"center" }}>
                    <BookOpen size={14}/>
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {filtered.length===0&&(
            <tr><td colSpan={8} style={{ padding:32, textAlign:"center", color:C.muted, fontSize:13 }}>
              {filterClass ? "No students in this class" : "No students found"}
            </td></tr>
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <div style={{ padding: isMobile ? 12 : 28, boxSizing:"border-box", width:"100%", maxWidth:"100%", minWidth:0, overflowX:"hidden" }}>
      <div style={{ background:C.white, borderRadius:14, padding: isMobile ? 12 : 22, boxShadow:"0 2px 8px rgba(0,0,0,.06)", boxSizing:"border-box", width:"100%", maxWidth:"100%", minWidth:0, overflow:"hidden" }}>

        {/* ── Header row: search + class filter ── */}
        <div style={{ display:"flex", flexDirection: isMobile ? "column" : "row", gap:10, marginBottom:18 }}>
          <div style={{ position:"relative", flex:1, minWidth:0 }}>
            <span style={{ position:"absolute", left:14, top:"50%", transform:"translateY(-50%)", display:"flex", pointerEvents:"none" }}>
              <Search size={15} color={C.muted}/>
            </span>
            <input value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}}
              placeholder="Search students..."
              style={{ width:"100%", height:42, boxSizing:"border-box", padding:"0 14px 0 38px",
                border:"1.5px solid "+C.border, borderRadius:10, background:"#f4f6fb",
                outline:"none", fontSize:13 }}/>
          </div>
          <select
            value={filterClass}
            onChange={e=>{ setFilterClass(e.target.value); setPage(1); }}
            style={{ height:42, width: isMobile ? "100%" : "auto", padding:"0 12px", borderRadius:10,
              border:"1.5px solid "+C.border, fontSize:13, background:"#fff", boxSizing:"border-box",
              outline:"none", minWidth: isMobile ? 0 : 170, cursor:"pointer", color: filterClass ? C.text : C.muted }}>
            <option value="">All Classes</option>
            {classes.map(c=>(
              <option key={c._id} value={c._id}>
                {c.name}{c.section ? ` - ${c.section}` : ""}
              </option>
            ))}
          </select>
        </div>

        {error && !showAdd && !viewUser && !changeClassStudent && (
          <div style={{ background:"#fee2e2", color:"#dc2626", borderRadius:8,
            padding:"9px 14px", fontSize:13, marginBottom:14 }}>⚠️ {error}</div>
        )}

        {isMobile ? renderCards() : renderTable()}

        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:10, marginTop:16, color:C.muted, fontSize:12 }}>
          <span>{pageMeta.total} students · Page {pageMeta.page} of {Math.max(1,pageMeta.pages)}</span>
          <div style={{ display:"flex", gap:8 }}>
            <button type="button" disabled={page <= 1} onClick={()=>setPage(p=>p-1)}
              style={{ border:"1px solid "+C.border, background:"#fff", borderRadius:8, padding:"7px 12px", cursor:page<=1?"not-allowed":"pointer", opacity:page<=1?.5:1 }}>
              Previous
            </button>
            <button type="button" disabled={page >= pageMeta.pages} onClick={()=>setPage(p=>p+1)}
              style={{ border:"1px solid "+C.border, background:"#fff", borderRadius:8, padding:"7px 12px", cursor:page>=pageMeta.pages?"not-allowed":"pointer", opacity:page>=pageMeta.pages?.5:1 }}>
              Next
            </button>
          </div>
        </div>
      </div>

      {/* ── Add Student Modal ── */}
      {showAdd && (
        <ModalBox title="Add New Student" onClose={()=>{ setShowAdd(false); setError(""); }}>
          <Field label="Full Name *" value={addForm.name} onChange={v=>setAddForm({...addForm,name:v})}/>
          <Field label="Email *" value={addForm.email} onChange={v=>setAddForm({...addForm,email:v})} type="email"/>
          <Field label="Phone" value={addForm.phone} onChange={v=>setAddForm({...addForm,phone:v})} type="tel"/>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:8 }}>
            <SelectField label="Class *" value={addForm.classId}
              onChange={v=>{const selected=classes.find(item=>String(item._id)===String(v));setAddForm({...addForm,classId:v,cls:selected?.name||"",section:selected?.section||""});}}
              options={[{value:"",label:"-- Select Class --"}, ...classes.map(item=>({value:item._id,label:`${item.name}${item.section?` - Section ${item.section}`:""}`}))]}/>
            <Field label="Roll No *" value={addForm.roll} onChange={v=>setAddForm({...addForm,roll:v})}/>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:8 }}>
            <SelectField label="Gender" value={addForm.gender}
              onChange={v=>setAddForm({...addForm,gender:v})}
              options={["Male","Female","Other"]}/>
            <Field label="GPA" value={addForm.gpa} onChange={v=>setAddForm({...addForm,gpa:v})} type="number"/>
          </div>
          <SelectField label="Status" value={addForm.status}
            onChange={v=>setAddForm({...addForm,status:v})}
            options={[{value:"active",label:"Active"},{value:"inactive",label:"Inactive"}]}/>
          <Field label="Address" value={addForm.address} onChange={v=>setAddForm({...addForm,address:v})}/>
          <Field label="Password *" value={addForm.password} onChange={v=>setAddForm({...addForm,password:v})} type="password"/>
          {error && <div style={{ background:"#fee2e2",color:"#dc2626",borderRadius:8,padding:"9px 14px",fontSize:13,marginBottom:14 }}>⚠️ {error}</div>}
          <div style={{ display:"flex", gap:10, marginTop:8 }}>
            <button type="button" onClick={handleAdd} disabled={saving}
              style={{ flex:1, background:C.accent, color:"#fff", border:"none", borderRadius:10,
                padding:"11px 0", fontSize:14, fontWeight:700,
                cursor:saving?"wait":"pointer", opacity:saving?0.75:1 }}>
              {saving?"Saving…":"Add Student"}
            </button>
            <button type="button" onClick={()=>{ setShowAdd(false); setError(""); }}
              style={{ flex:1, background:"#f4f6fb", color:C.text, border:"none", borderRadius:10,
                padding:"11px 0", fontSize:14, fontWeight:600, cursor:"pointer" }}>
              Cancel
            </button>
          </div>
        </ModalBox>
      )}

      {/* ── NEW: Change Class Modal ── */}
      {changeClassStudent && (
        <ModalBox
          title={`Change Class — ${changeClassStudent.name}`}
          onClose={()=>{ setChangeClassStudent(null); setChangeClassError(""); }}>
          <div style={{ background:"#f8fafc", borderRadius:10, padding:"10px 14px",
            fontSize:13, marginBottom:16, display:"flex", justifyContent:"space-between" }}>
            <span style={{ color:C.muted, fontWeight:600 }}>Current class</span>
            <span style={{ fontWeight:700 }}>{changeClassStudent.cls || "—"}</span>
          </div>
          <SelectField label="Move to Class *" value={changeClassId}
            onChange={v=>setChangeClassId(v)}
            options={[
              { value:"", label:"-- Select Class --" },
              ...classes.map(c=>({
                value: c._id,
                label: `${c.name}${c.section ? ` - Section ${c.section}` : ""}`
              }))
            ]}/>
          {changeClassError && (
            <div style={{ background:"#fee2e2", color:"#dc2626", borderRadius:8,
              padding:"9px 14px", fontSize:13, marginBottom:14 }}>⚠️ {changeClassError}</div>
          )}
          <div style={{ display:"flex", gap:10, marginTop:8 }}>
            <button type="button" onClick={handleChangeClass} disabled={savingClassChange}
              style={{ flex:1, background:C.accent, color:"#fff", border:"none", borderRadius:10,
                padding:"11px 0", fontSize:14, fontWeight:700,
                cursor:savingClassChange?"wait":"pointer", opacity:savingClassChange?0.75:1 }}>
              {savingClassChange ? "Saving…" : "Save Class"}
            </button>
            <button type="button" onClick={()=>{ setChangeClassStudent(null); setChangeClassError(""); }}
              style={{ flex:1, background:"#f4f6fb", color:C.text, border:"none", borderRadius:10,
                padding:"11px 0", fontSize:14, fontWeight:600, cursor:"pointer" }}>
              Cancel
            </button>
          </div>
        </ModalBox>
      )}

      {/* ── View Details Modal ── */}
      {viewUser && (
        <Portal>
          <div onClick={e=>{if(e.target===e.currentTarget)setViewUser(null);}}
            style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.5)",
              display:"grid", placeItems:"center", zIndex:9999, padding:16 }}>
            <div style={{ background:"#fff", borderRadius:18, padding:28,
              width:"100%", maxWidth:540, maxHeight:"88vh", overflowY:"auto" }}>
              <div style={{ display:"flex", justifyContent:"space-between",
                alignItems:"center", marginBottom:18 }}>
                <div style={{ fontWeight:800, fontSize:18 }}>Student Details</div>
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
                <div style={{ color:"#fff", fontWeight:800, fontSize:17, marginTop:10 }}>
                  {viewUser.name}
                </div>
                <div style={{ color:"rgba(255,255,255,.85)", fontSize:13, marginTop:3 }}>
                  {viewUser.email}
                </div>
                <span style={{ marginTop:8, background:"rgba(255,255,255,.2)",
                  color:"#fff", borderRadius:20, padding:"3px 14px",
                  fontSize:12, fontWeight:700 }}>
                  Student
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
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, color: C.muted, fontWeight: 600 }}>
                      <Mail size={14} color={C.accent} /> Email / Username
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontWeight: 700, color: C.text }}>{viewUser.email}</span>
                      <button type="button" onClick={() => copyToClipboard(viewUser.email, "email")}
                        title="Copy Email"
                        style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 6, width: 28, height: 28, display: "grid", placeItems: "center", cursor: "pointer", color: copiedField === "email" ? C.teal : C.muted }}>
                        {copiedField === "email" ? <Check size={13} color={C.teal} /> : <Copy size={13} />}
                      </button>
                    </div>
                  </div>

                  {/* Password */}
                  {!isEditingPass ? (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, borderTop: "1px solid #e0e7ff", paddingTop: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, color: C.muted, fontWeight: 600 }}>
                        <LockKeyhole size={14} color={C.accent} /> Password
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {viewUser.passwordDisplay ? (
                          <>
                            <span style={{ fontWeight: 700, fontFamily: showViewPass ? "inherit" : "monospace", fontSize: showViewPass ? 13 : 15, letterSpacing: showViewPass ? 0 : 2, color: C.text }}>
                              {showViewPass ? viewUser.passwordDisplay : "••••••••"}
                            </span>
                            <button type="button" onClick={() => setShowViewPass(!showViewPass)}
                              title={showViewPass ? "Hide Password" : "Show Password"}
                              style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 6, width: 28, height: 28, display: "grid", placeItems: "center", cursor: "pointer", color: C.muted }}>
                              {showViewPass ? <EyeOff size={13} /> : <Eye size={13} />}
                            </button>
                            <button type="button" onClick={() => copyToClipboard(viewUser.passwordDisplay, "password")}
                              title="Copy Password"
                              style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 6, width: 28, height: 28, display: "grid", placeItems: "center", cursor: "pointer", color: copiedField === "password" ? C.teal : C.muted }}>
                              {copiedField === "password" ? <Check size={13} color={C.teal} /> : <Copy size={13} />}
                            </button>
                            <button type="button" onClick={() => { setIsEditingPass(true); setNewQuickPass(""); setQuickPassMsg(""); }}
                              style={{ background: "transparent", border: "none", color: C.accent, fontSize: 11, fontWeight: 700, cursor: "pointer", textDecoration: "underline", marginLeft: 4 }}>
                              Change
                            </button>
                          </>
                        ) : (
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 12, color: C.muted, fontStyle: "italic" }}>Encrypted (Not stored in plain)</span>
                            <button type="button" onClick={() => { setIsEditingPass(true); setNewQuickPass("Student@123"); setQuickPassMsg(""); }}
                              style={{ background: C.accent, color: "#fff", border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                              Set Password
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div style={{ borderTop: "1px solid #e0e7ff", paddingTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>Set New Password:</div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <input
                          type="text"
                          value={newQuickPass}
                          onChange={e => setNewQuickPass(e.target.value)}
                          placeholder="Min 8 characters"
                          style={{ flex: 1, minWidth: 160, height: 34, borderRadius: 8, border: `1.5px solid ${C.border}`, padding: "0 10px", fontSize: 13, outline: "none", boxSizing: "border-box" }}
                        />
                        <button type="button" onClick={() => setNewQuickPass(`Student@${Math.floor(1000 + Math.random() * 9000)}`)}
                          style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 8, padding: "0 10px", fontSize: 11, fontWeight: 700, color: C.muted, cursor: "pointer" }}>
                          🎲 Generate
                        </button>
                        <button type="button" onClick={handleSaveQuickPass} disabled={savingQuickPass}
                          style={{ background: C.accent, color: "#fff", border: "none", borderRadius: 8, padding: "0 14px", fontSize: 12, fontWeight: 700, cursor: savingQuickPass ? "wait" : "pointer" }}>
                          {savingQuickPass ? "Saving…" : "Save"}
                        </button>
                        <button type="button" onClick={() => { setIsEditingPass(false); setQuickPassMsg(""); }}
                          style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 8, padding: "0 10px", fontSize: 12, fontWeight: 600, color: C.text, cursor: "pointer" }}>
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
                  <div style={{ display:"flex", justifyContent:"space-between", fontSize:13 }}>
                    <span style={{ color:C.muted, fontWeight:600 }}>Phone</span>
                    <span style={{ fontWeight:700 }}>{viewUser.phone||"—"}</span>
                  </div>
                  <div style={{ display:"flex", justifyContent:"space-between", fontSize:13 }}>
                    <span style={{ color:C.muted, fontWeight:600 }}>Gender</span>
                    <span style={{ fontWeight:700 }}>{viewUser.gender||"—"}</span>
                  </div>
                  <div style={{ display:"flex", justifyContent:"space-between", fontSize:13 }}>
                    <span style={{ color:C.muted, fontWeight:600 }}>Date of Birth</span>
                    <span style={{ fontWeight:700 }}>{viewUser.dob ? new Date(viewUser.dob).toLocaleDateString() : "—"}</span>
                  </div>
                  <div style={{ display:"flex", justifyContent:"space-between", fontSize:13 }}>
                    <span style={{ color:C.muted, fontWeight:600 }}>Status</span>
                    <span style={{
                      background: String(viewUser.status).toLowerCase()==="active" ? "#d1fae5" : "#fee2e2",
                      color:      String(viewUser.status).toLowerCase()==="active" ? C.teal    : "#dc2626",
                      borderRadius:12, padding:"2px 8px", fontSize:11, fontWeight:700 }}>
                      {viewUser.status||"Active"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Academic Details */}
              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:11, fontWeight:800, color:C.muted, letterSpacing:1, textTransform:"uppercase", marginBottom:6 }}>
                  Academic Details
                </div>
                <div style={{ background:"#f8fafc", borderRadius:10, padding:"10px 14px", display:"flex", flexDirection:"column", gap:8 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", fontSize:13 }}>
                    <span style={{ color:C.muted, fontWeight:600 }}>Roll Number</span>
                    <span style={{ fontWeight:700 }}>{viewUser.roll||"—"}</span>
                  </div>
                  <div style={{ display:"flex", justifyContent:"space-between", fontSize:13 }}>
                    <span style={{ color:C.muted, fontWeight:600 }}>Class / Section</span>
                    <span style={{ fontWeight:700 }}>
                      {viewUser.cls ? `${viewUser.cls}${viewUser.section ? ` (Sec ${viewUser.section})` : ""}` : "—"}
                    </span>
                  </div>
                  {viewUser.studentId && (
                    <div style={{ display:"flex", justifyContent:"space-between", fontSize:13 }}>
                      <span style={{ color:C.muted, fontWeight:600 }}>Student ID</span>
                      <span style={{ fontWeight:700 }}>{viewUser.studentId}</span>
                    </div>
                  )}
                  {viewUser.admissionDate && (
                    <div style={{ display:"flex", justifyContent:"space-between", fontSize:13 }}>
                      <span style={{ color:C.muted, fontWeight:600 }}>Admission Date</span>
                      <span style={{ fontWeight:700 }}>{new Date(viewUser.admissionDate).toLocaleDateString()}</span>
                    </div>
                  )}
                  {viewUser.gpa != null && (
                    <div style={{ display:"flex", justifyContent:"space-between", fontSize:13 }}>
                      <span style={{ color:C.muted, fontWeight:600 }}>GPA</span>
                      <span style={{ fontWeight:700 }}>{gpaText(viewUser.gpa)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Family Details */}
              {(viewUser.fatherName || viewUser.motherName || viewUser.guardianName || viewUser.parentPhone) && (
                <div style={{ marginBottom:14 }}>
                  <div style={{ fontSize:11, fontWeight:800, color:C.muted, letterSpacing:1, textTransform:"uppercase", marginBottom:6 }}>
                    Family Details
                  </div>
                  <div style={{ background:"#f8fafc", borderRadius:10, padding:"10px 14px", display:"flex", flexDirection:"column", gap:8 }}>
                    {viewUser.fatherName && (
                      <div style={{ display:"flex", justifyContent:"space-between", fontSize:13 }}>
                        <span style={{ color:C.muted, fontWeight:600 }}>Father's Name</span>
                        <span style={{ fontWeight:700 }}>{viewUser.fatherName}</span>
                      </div>
                    )}
                    {viewUser.motherName && (
                      <div style={{ display:"flex", justifyContent:"space-between", fontSize:13 }}>
                        <span style={{ color:C.muted, fontWeight:600 }}>Mother's Name</span>
                        <span style={{ fontWeight:700 }}>{viewUser.motherName}</span>
                      </div>
                    )}
                    {viewUser.guardianName && (
                      <div style={{ display:"flex", justifyContent:"space-between", fontSize:13 }}>
                        <span style={{ color:C.muted, fontWeight:600 }}>Guardian</span>
                        <span style={{ fontWeight:700 }}>{viewUser.guardianName}</span>
                      </div>
                    )}
                    {viewUser.parentPhone && (
                      <div style={{ display:"flex", justifyContent:"space-between", fontSize:13 }}>
                        <span style={{ color:C.muted, fontWeight:600 }}>Parent Phone</span>
                        <span style={{ fontWeight:700 }}>{viewUser.parentPhone}</span>
                      </div>
                    )}
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
                    {viewUser.address && (
                      <div style={{ display:"flex", justifyContent:"space-between", fontSize:13 }}>
                        <span style={{ color:C.muted, fontWeight:600 }}>Address</span>
                        <span style={{ fontWeight:700 }}>{viewUser.address}</span>
                      </div>
                    )}
                    {viewUser.village && (
                      <div style={{ display:"flex", justifyContent:"space-between", fontSize:13 }}>
                        <span style={{ color:C.muted, fontWeight:600 }}>Village</span>
                        <span style={{ fontWeight:700 }}>{viewUser.village}</span>
                      </div>
                    )}
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

export { AdminStudents };