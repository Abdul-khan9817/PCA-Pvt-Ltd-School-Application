import { useState, useEffect } from "react";
import { motion, AnimatePresence, Eye, EyeOff, LockKeyhole, Plus, X, Check, Search, Mail, Copy, BookOpen, Award, Briefcase, Phone, Shield } from "../../shared/ui";
import { C, ROW_COLORS } from "../../shared/runtime";
import { Avatar } from "../../components/common/Avatar";
import { FormField } from "../../components/common/FormField";
import { Modal } from "../../components/common/Modal";
import { SaveBtn } from "../../components/common/SaveBtn";
import { CancelBtn } from "../../components/common/CancelBtn";
import { Portal } from "../../components/common/Portal";
import { list, remove } from "../../services/resource.service";
import { api } from "../../services/apiClient";
import { onResourceChange } from "../../services/socket.service";

function AdminTeachers() {
  const [teachers, setTeachers] = useState([]);
  const [search, setSearch]     = useState("");
  const [activeTab, setActiveTab] = useState("All");
  const [showAdd, setShowAdd]   = useState(false);
  const [addForm, setAddForm]   = useState({ name:"", email:"", phone:"", department:"", qualification:"", experience:"" });
  const [error, setError]       = useState("");

  // View modal state
  const [viewUser, setViewUser] = useState(null);
  const [showViewPass, setShowViewPass] = useState(false);
  const [copiedField, setCopiedField]   = useState("");
  const [isEditingPass, setIsEditingPass] = useState(false);
  const [newQuickPass, setNewQuickPass]   = useState("");
  const [savingQuickPass, setSavingQuickPass] = useState(false);
  const [quickPassMsg, setQuickPassMsg]   = useState("");

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

  const DESIG_STYLE = {
    "Principal":       { bg:"#fef9c3", color:"#b45309", icon:"👑" },
    "Vice Principal":  { bg:"#fce7f3", color:"#be185d", icon:"⭐" },
    "Department Head": { bg:"#ede9fe", color:"#7c3aed", icon:"🎓" },
    "Subject Teacher": { bg:"#dbeafe", color:"#1d4ed8", icon:"👤" },
    "Class Teacher":   { bg:"#d1fae5", color:"#065f46", icon:"🖥" },
  };

  const TABS = [
    { label:"All", filter:null },
    { label:"Principal", filter:"Principal", icon:"👑" },
    { label:"Vice Principal", filter:"Vice Principal", icon:"⭐" },
    { label:"Department Head", filter:"Department Head", icon:"🎓" },
    { label:"Class Teacher", filter:"Class Teacher", icon:"🖥" },
  ];

  const mapTeacher = x => ({
    id: x._id || x.id,
    userId: x.user?._id || x.user || null,
    name: x.user?.name || x.name || "Unnamed",
    email: x.user?.email || x.email || "—",
    phone: x.user?.phone || x.phone || "—",
    designation: x.designation || "Subject Teacher",
    dept: x.department || "—",
    qualification: x.qualification || "—",
    experience: x.experience || "—",
    status: String(x.user?.status || x.status || "active").replace(/^./,c=>c.toUpperCase())
  });

  const loadTeachers = () => {
    list("staff","limit=100")
      .then(r=>setTeachers((r.data||r||[]).map(mapTeacher)))
      .catch(()=>{});
  };

  useEffect(()=>{
    loadTeachers();
    const unsubStaff = onResourceChange("staff", change => {
      if (change.action === "create") {
        setTeachers(prev => {
          const mapped = mapTeacher(change.data);
          if (prev.some(t => t.id === mapped.id)) return prev;
          return [...prev, mapped];
        });
      } else if (change.action === "update") {
        setTeachers(prev => prev.map(t => (t.id === (change.data?._id || change.id) ? { ...t, ...mapTeacher(change.data) } : t)));
      } else if (change.action === "delete") {
        setTeachers(prev => prev.filter(t => t.id !== change.id && t.id !== change.data?._id));
      }
    });

    const unsubUsers = onResourceChange("users", change => {
      if (change.action === "update") {
        const u = change.data || {};
        const uId = u._id || change.id;
        setTeachers(prev => prev.map(t => {
          if (t.userId === uId || t.user?._id === uId || t.user === uId) {
            const nextStatus = u.status ? String(u.status).replace(/^./, c => c.toUpperCase()) : t.status;
            return { ...t, name: u.name || t.name, email: u.email || t.email, phone: u.phone || t.phone, status: nextStatus };
          }
          return t;
        }));
      } else if (change.action === "delete") {
        const uId = change.id || change.data?._id;
        setTeachers(prev => prev.filter(t => t.userId !== uId && t.user?._id !== uId && t.user !== uId));
      }
    });

    return () => { unsubStaff?.(); unsubUsers?.(); };
  },[]);

  // ── View ────────────────────────────────────────────────────────────
  const handleView = async t => {
    setShowViewPass(false);
    setCopiedField("");
    setIsEditingPass(false);
    setNewQuickPass("");
    setQuickPassMsg("");
    setViewUser({ ...t, loadingDetails: true });
    try {
      const uId = t.userId || t.user?._id || t.user;
      const [userRes, staffRes] = await Promise.all([
        uId ? api.get(`/users/${uId}`).catch(() => null) : null,
        api.get(`/staff/${t.id}`).catch(() => null)
      ]);
      const fullUser = userRes?.data || userRes || t.user || {};
      const fullStaff = staffRes?.data || staffRes || t;
      setViewUser({
        ...fullStaff,
        ...fullUser,
        _id: uId || t.id,
        id: t.id,
        name: fullUser.name || t.name,
        email: fullUser.email || t.email,
        phone: fullUser.phone || t.phone,
        passwordDisplay: fullUser.passwordDisplay || t.passwordDisplay,
        designation: fullStaff.designation || t.designation || "Subject Teacher",
        department: fullStaff.department || t.dept || "—",
        qualification: fullStaff.qualification || t.qualification || "—",
        experience: fullStaff.experience || t.experience || "—",
        status: fullStaff.status || fullUser.status || t.status,
        loadingDetails: false
      });
    } catch {
      setViewUser({ ...t, loadingDetails: false });
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

  const handleDelete = async id => {
    const teacher = teachers.find(x=>x.id===id);
    if(!window.confirm(`Delete ${teacher?.name||"this staff member"}?`)) return;
    try {
      await remove("staff",id);
      if(teacher?.userId) await api.delete(`/users/${teacher.userId}`).catch(()=>null);
      setTeachers(prev=>prev.filter(x=>x.id!==id));
    } catch(e){ setError(e.message); }
  };

  const handleAdd = async () => {
    if(!addForm.name||!addForm.email){ setError("Name and email are required"); return; }
    try {
      const r = await api.post("/users/staff-account",{ name:addForm.name, email:addForm.email, phone:addForm.phone, department:addForm.department, qualification:addForm.qualification, experience:addForm.experience });
      const staff=r.data;
      setTeachers(prev=>{
        const mapped=mapTeacher(staff);
        return prev.some(item=>item.id===mapped.id) ? prev : [...prev,mapped];
      });
      setAddForm({ name:"", email:"", phone:"", department:"", qualification:"", experience:"" });
      setShowAdd(false);
      setError("");
    } catch(e){
      setError(e.message);
    }
  };

  const filtered = teachers.filter(t=>{
    const mt = activeTab==="All" || t.designation===activeTab;
    const ms = t.name.toLowerCase().includes(search.toLowerCase()) || t.dept.toLowerCase().includes(search.toLowerCase());
    return mt && ms;
  });

  return (
    <div style={{ padding:28 }}>
      {error && !showAdd && !viewUser && <div style={{ color:C.red, fontSize:13, marginBottom:12 }}>⚠️ {error}</div>}

      {/* Tabs */}
      <div style={{ display:"flex", gap:10, marginBottom:20, flexWrap:"wrap" }}>
        {TABS.map(tab=>(
          <motion.button type="button" key={tab.label} whileHover={{ scale:1.03 }} onClick={()=>setActiveTab(tab.label)}
            style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 16px", borderRadius:20,
              border:"none", cursor:"pointer", fontWeight:600, fontSize:13,
              background:activeTab===tab.label?C.accent:C.white,
              color:activeTab===tab.label?"#fff":C.text,
              boxShadow:activeTab===tab.label?"0 4px 14px rgba(79,110,247,.35)":"0 2px 6px rgba(0,0,0,.07)" }}>
            {tab.icon&&<span>{tab.icon}</span>} {tab.label}
            <span style={{ background:activeTab===tab.label?"rgba(255,255,255,.25)":"#f0f0f0",
              color:activeTab===tab.label?"#fff":C.muted,
              borderRadius:20, padding:"1px 8px", fontSize:11, fontWeight:700 }}>
              {tab.filter?teachers.filter(t=>t.designation===tab.filter).length:teachers.length}
            </span>
          </motion.button>
        ))}
      </div>

      <div style={{ background:C.white, borderRadius:14, padding:22, boxShadow:"0 2px 8px rgba(0,0,0,.06)" }}>
        {/* Search bar */}
        <div style={{ display:"flex", gap:12, marginBottom:20, alignItems:"center" }}>
          <div style={{ flex:1, display:"flex", alignItems:"center", gap:8, background:"#f4f6fb", borderRadius:10, padding:"8px 14px" }}>
            <Search size={15} color={C.muted} />
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search staff..."
              style={{ border:"none", background:"transparent", outline:"none", fontSize:13, width:"100%" }} />
          </div>
          <span style={{ fontSize:13, color:C.muted, display:"flex", alignItems:"center", whiteSpace:"nowrap" }}>{filtered.length} members</span>
        </div>

        {/* Table */}
        <div style={{ overflowX:"auto" }}>
          <table className="rtable" style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead><tr style={{ background:"#f8fafc" }}>
              {["STAFF MEMBER","DESIGNATION","SUBJECT / DEPT","EMAIL","PHONE","EXPERIENCE","STATUS","ACTIONS"].map(h=>(
                <th key={h} style={{ padding:"10px 14px", textAlign:"left", fontSize:11, fontWeight:700, color:C.muted }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {filtered.map((t,i)=>{
                const ds=DESIG_STYLE[t.designation]||{ bg:"#f0f4ff", color:C.accent, icon:"👤" };
                return (
                  <tr key={t.id} style={{ background:ROW_COLORS[i%ROW_COLORS.length], borderBottom:"1px solid "+C.border }}>
                    <td className="rtable-full" style={{ padding:"12px 14px" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                        <Avatar name={t.name} size={36} />
                        <div>
                          <div style={{ fontWeight:600, fontSize:13 }}>{t.name}</div>
                          <div style={{ fontSize:11, color:C.muted }}>{t.qualification}</div>
                        </div>
                      </div>
                    </td>
                    <td data-label="Designation" style={{ padding:"12px 14px" }}>
                      <span style={{ background:ds.bg, color:ds.color, borderRadius:20,
                        padding:"4px 10px", fontSize:12, fontWeight:600, display:"inline-flex", alignItems:"center", gap:4 }}>
                        {ds.icon} {t.designation}
                      </span>
                    </td>
                    <td data-label="Dept" style={{ padding:"12px 14px", fontSize:13 }}>{t.dept}</td>
                    <td data-label="Email" style={{ padding:"12px 14px", fontSize:12, color:C.muted }}>{t.email}</td>
                    <td data-label="Phone" style={{ padding:"12px 14px", fontSize:13 }}>{t.phone}</td>
                    <td data-label="Experience" style={{ padding:"12px 14px", fontSize:13 }}>{t.experience}</td>
                    <td data-label="Status" style={{ padding:"12px 14px" }}>
                      <span style={{
                        background: String(t.status).toLowerCase()==="active" ? "#d1fae5" : "#fee2e2",
                        color:      String(t.status).toLowerCase()==="active" ? C.teal    : "#dc2626",
                        borderRadius:20, padding:"3px 10px", fontSize:12, fontWeight:600 }}>
                        {t.status}
                      </span>
                    </td>
                    <td className="rtable-actions" style={{ padding:"12px 14px" }}>
                      <div style={{ display:"flex", gap:6 }}>
                        {/* View button only (Edit removed) */}
                        <button type="button" onClick={()=>handleView(t)} title="View Details"
                          style={{ background:"#f0f9ff", color:"#0ea5e9", border:"none", borderRadius:7, width:30, height:30, cursor:"pointer", display:"grid", placeItems:"center" }}>
                          <Eye size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length===0&&(
                <tr><td colSpan={8} style={{ padding:32, textAlign:"center", color:C.muted, fontSize:13 }}>No staff found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── View Details Modal (Same as User Account) ── */}
      {viewUser && (
        <Portal>
          <div onClick={e=>{if(e.target===e.currentTarget)setViewUser(null);}}
            style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.5)",
              display:"grid", placeItems:"center", zIndex:9999, padding:16 }}>
            <div style={{ background:"#fff", borderRadius:18, padding:28,
              width:"100%", maxWidth:540, maxHeight:"88vh", overflowY:"auto" }}>
              <div style={{ display:"flex", justifyContent:"space-between",
                alignItems:"center", marginBottom:18 }}>
                <div style={{ fontWeight:800, fontSize:18 }}>Staff Details</div>
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
                  {viewUser.designation || "Staff Member"}
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
                            <button type="button" onClick={() => { setIsEditingPass(true); setNewQuickPass("Welcome@123"); setQuickPassMsg(""); }}
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
                        <button type="button" onClick={() => setNewQuickPass(`Welcome@${Math.floor(1000 + Math.random() * 9000)}`)}
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

              {/* Professional Details */}
              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:11, fontWeight:800, color:C.muted, letterSpacing:1, textTransform:"uppercase", marginBottom:6 }}>
                  Professional Details
                </div>
                <div style={{ background:"#f8fafc", borderRadius:10, padding:"10px 14px", display:"flex", flexDirection:"column", gap:8 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", fontSize:13 }}>
                    <span style={{ color:C.muted, fontWeight:600 }}>Designation</span>
                    <span style={{ fontWeight:700 }}>{viewUser.designation||"Subject Teacher"}</span>
                  </div>
                  {viewUser.department && (
                    <div style={{ display:"flex", justifyContent:"space-between", fontSize:13 }}>
                      <span style={{ color:C.muted, fontWeight:600 }}>Department</span>
                      <span style={{ fontWeight:700 }}>{viewUser.department}</span>
                    </div>
                  )}
                  {viewUser.subject && (
                    <div style={{ display:"flex", justifyContent:"space-between", fontSize:13 }}>
                      <span style={{ color:C.muted, fontWeight:600 }}>Subject</span>
                      <span style={{ fontWeight:700 }}>{viewUser.subject}</span>
                    </div>
                  )}
                  {viewUser.cls && (
                    <div style={{ display:"flex", justifyContent:"space-between", fontSize:13 }}>
                      <span style={{ color:C.muted, fontWeight:600 }}>Class</span>
                      <span style={{ fontWeight:700 }}>{viewUser.cls}{viewUser.section ? `-${viewUser.section}` : ""}</span>
                    </div>
                  )}
                  {viewUser.qualification && (
                    <div style={{ display:"flex", justifyContent:"space-between", fontSize:13 }}>
                      <span style={{ color:C.muted, fontWeight:600 }}>Qualification</span>
                      <span style={{ fontWeight:700 }}>{viewUser.qualification}</span>
                    </div>
                  )}
                  {viewUser.experience && (
                    <div style={{ display:"flex", justifyContent:"space-between", fontSize:13 }}>
                      <span style={{ color:C.muted, fontWeight:600 }}>Experience</span>
                      <span style={{ fontWeight:700 }}>{viewUser.experience}</span>
                    </div>
                  )}
                  {viewUser.joiningDate && (
                    <div style={{ display:"flex", justifyContent:"space-between", fontSize:13 }}>
                      <span style={{ color:C.muted, fontWeight:600 }}>Joining Date</span>
                      <span style={{ fontWeight:700 }}>{new Date(viewUser.joiningDate).toLocaleDateString()}</span>
                    </div>
                  )}
                  {viewUser.staffId && (
                    <div style={{ display:"flex", justifyContent:"space-between", fontSize:13 }}>
                      <span style={{ color:C.muted, fontWeight:600 }}>Staff ID</span>
                      <span style={{ fontWeight:700 }}>{viewUser.staffId}</span>
                    </div>
                  )}
                </div>
              </div>

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

      {/* ── Add Staff Modal ── */}
      <AnimatePresence>
        {showAdd && (
          <Modal title="Add New Staff Member" onClose={()=>{ setShowAdd(false); setError(""); }}>
            {[['Full Name','name'],['Email','email'],['Phone','phone'],['Department','department'],['Qualification','qualification'],['Experience (years)','experience']].map(([l,k])=>(
              <FormField key={k} label={l} value={addForm[k]||''} onChange={v=>setAddForm({...addForm,[k]:v})}/>
            ))}
            <div style={{ fontSize:12, color:C.muted, marginBottom:12 }}>
              Default password: <strong>Welcome@123</strong> (staff can change after first login)
            </div>
            {error && <div style={{ color:C.red, fontSize:13, marginBottom:12 }}>⚠️ {error}</div>}
            <div style={{ display:'flex', gap:12 }}>
              <SaveBtn onClick={handleAdd} label="Add Staff"/>
              <CancelBtn onClick={()=>{ setShowAdd(false); setError(""); }}/>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}

export { AdminTeachers };
