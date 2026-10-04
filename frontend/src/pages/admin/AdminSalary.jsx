import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, LayoutDashboard, GraduationCap, Users, BookOpen, ClipboardCheck, ListChecks, Megaphone, Calendar, DollarSign, UserCircle, LogOut, Bell, Search, ChevronDown, TrendingUp, Star, AlertTriangle, Eye, Trash2, Edit, Plus, X, Check, Clock, BarChart2, Award, Briefcase, Mail, Phone, Shield, CheckSquare, Settings2, Home, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "../../shared/ui";
import { C, ROW_COLORS } from "../../shared/runtime";
import { Avatar } from "../../components/common/Avatar";
import { CancelBtn } from "../../components/common/CancelBtn";
import { FormField } from "../../components/common/FormField";
import { Modal } from "../../components/common/Modal";
import { SaveBtn } from "../../components/common/SaveBtn";
import { list, create, update, remove } from "../../services/resource.service";
import { onResourceChange } from "../../services/socket.service";
import { api } from "../../services/apiClient";
import { Download } from "../../shared/ui";
import { downloadPayslip } from "../../utils/documents";
import { monthKey, monthSortValue, latestByKey } from "../../utils/history";
import { me } from "../../services/auth.service";
import useCanHover from "../../hooks/useCanHover";
import { MONTH_NAMES } from "../../utils/months";

/**
 * True only on devices with a real hovering pointer (mouse / trackpad).
 * On phones :hover "sticks" after a touch, so hover-scale animations made
 * cards/buttons jump while scrolling. Hover animations run only when this is true.
 */
/* ───────────── salary helpers ───────────── */
// Absent deduction = (basic + allowances) ÷ DAYS_IN_MONTH × absent days.  Change 30 here if your school uses another divisor.
const DAYS_IN_MONTH = 30;

const currentMonthLabel = () => { const d = new Date(); return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`; };

const calcSalary = (f) => {
  const basic = Number(f.basic) || 0;
  const allowances = Number(f.allowances) || 0;
  const other = Number(f.otherDeductions) || 0;
  const absentDays = Number(f.absentDays) || 0;
  const advance = Number(f.advance) || 0;
  const gross = basic + allowances;
  const perDay = gross / DAYS_IN_MONTH;
  const absentDeduction = Math.round(perDay * absentDays);
  const totalDeductions = other + absentDeduction + advance;
  return {
    basic, allowances, other, absentDays, advance, gross,
    perDay: Math.round(perDay), absentDeduction, totalDeductions,
    net: Math.max(0, gross - totalDeductions),
    short: gross - totalDeductions < 0,
  };
};

// Previous + current year, January → December (plus the record's own month if it is somewhere else)
const monthOptionsFor = (current) => {
  const y = new Date().getFullYear();
  const list = [];
  [y - 1, y].forEach((yr) => MONTH_NAMES.forEach((m) => list.push(`${m} ${yr}`)));
  if (current && !list.some((m) => monthKey(m) === monthKey(current))) list.unshift(String(current));
  return list;
};

const salaryInput = { width:"100%", padding:"10px 12px", borderRadius:10, border:"1.5px solid "+C.border, fontSize:13, outline:"none", boxSizing:"border-box" };
const salaryLabel = { fontSize:12, fontWeight:600, display:"block", marginBottom:6 };

function MonthSelect({ value, onChange, label = "Month *" }) {
  const options = monthOptionsFor(value);
  const selected = options.find((m) => monthKey(m) === monthKey(value)) || value || "";
  return (
    <div style={{ marginBottom:16 }}>
      <label style={{ fontSize:13, fontWeight:600, display:"block", marginBottom:6 }}>{label}</label>
      <select value={selected} onChange={(e) => onChange(e.target.value)}
        style={{ width:"100%", padding:"10px 14px", borderRadius:10, border:"1.5px solid "+C.border, fontSize:13, outline:"none", background:C.white, boxSizing:"border-box" }}>
        <option value="">-- Select month --</option>
        {options.map((m) => <option key={m} value={m}>{m}</option>)}
      </select>
    </div>
  );
}

/** Salary inputs + live breakdown. form: { basic, allowances, otherDeductions, absentDays, advance } */
function SalaryFields({ form, setForm }) {
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const c = calcSalary(form);
  const show = c.gross > 0 || c.totalDeductions > 0;
  const row = (label, value, color, sign = "") => (
    <div style={{ display:"flex", justifyContent:"space-between", gap:10, fontSize:12.5, padding:"3px 0" }}>
      <span style={{ color:C.muted }}>{label}</span>
      <span style={{ fontWeight:700, color: color || C.text }}>{sign}₹{Number(value).toLocaleString()}</span>
    </div>
  );
  return (
    <>
      <div className="sal-grid3">
        {[["Basic (₹)","basic"],["Allowances (₹)","allowances"],["Other Deductions (₹)","otherDeductions"]].map(([l,k])=>(
          <div key={k}>
            <label style={salaryLabel}>{l}</label>
            <input type="number" min="0" value={form[k] ?? ""} onChange={set(k)} placeholder="0" style={salaryInput} />
          </div>
        ))}
      </div>
      <div className="sal-grid2">
        <div>
          <label style={salaryLabel}>Absent Days</label>
          <input type="number" min="0" max="31" step="0.5" value={form.absentDays ?? ""} onChange={set("absentDays")} placeholder="0" style={salaryInput} />
        </div>
        <div>
          <label style={salaryLabel}>Advance Taken (₹)</label>
          <input type="number" min="0" value={form.advance ?? ""} onChange={set("advance")} placeholder="0" style={salaryInput} />
        </div>
      </div>
      {show && (
        <div style={{ background:"#eef2ff", borderRadius:10, padding:"12px 16px", marginBottom:16 }}>
          {row("Gross salary (basic + allowances)", c.gross)}
          {c.absentDays > 0 && row(`Absent ${c.absentDays} day${c.absentDays === 1 ? "" : "s"} × ₹${c.perDay.toLocaleString()}/day`, c.absentDeduction, C.red, "− ")}
          {c.advance > 0 && row("Advance", c.advance, C.red, "− ")}
          {c.other > 0 && row("Other deductions", c.other, C.red, "− ")}
          <div style={{ borderTop:"1px solid #c7d2fe", marginTop:6, paddingTop:8, display:"flex", justifyContent:"space-between", alignItems:"center", gap:10, flexWrap:"wrap" }}>
            <span style={{ fontSize:13, color:C.muted }}>Net Salary</span>
            <span style={{ fontSize:20, fontWeight:800, color:C.accent }}>₹{c.net.toLocaleString()}</span>
          </div>
          {c.short && <div style={{ color:C.red, fontSize:11.5, marginTop:6, fontWeight:600 }}>Deductions are more than the salary — net is set to ₹0.</div>}
        </div>
      )}
    </>
  );
}

const EMPTY_PAY = () => ({ staffId:"", name:"", designation:"Teacher", basic:"", allowances:"", otherDeductions:"", absentDays:"", advance:"", month:"", status:"Pending", fromMonth:"" });

function AdminSalary() {
  const canHover = useCanHover();
  const hv = (s) => (canHover ? { whileHover: { scale: s } } : {});

  // Vice principal: sees ONLY their own salary, read-only. Use the exact role string your backend returns.
  const [user, setUser] = useState(null);
  useEffect(() => { me().then(u => setUser(u?.data || u)).catch(() => {}); }, []);
  const role = String(user?.role || "").toLowerCase().replace(/\s+/g, "_");
  const isVP = role === "vice_principal";
  const myEmail = (user?.email || "").toLowerCase();

  const [tab, setTab]           = useState("Payroll");
  const [payrolls, setPayrolls] = useState([]);
  const [filterRole, setFilterRole] = useState("All");
  const [showAdd,  setShowAdd]  = useState(false);
  const [viewModal,setViewModal]= useState(null);
  const [historyView,setHistoryView]= useState(null); // { key, name } → all months of one staff member
  const [editModal,setEditModal]= useState(null);
  const [editForm, setEditForm] = useState(null);
  const [payingId, setPayingId] = useState(null); // confirm pay modal
  const [leaveApps, setLeaveApps] = useState([]);
  const [newPay, setNewPay] = useState(EMPTY_PAY());
  const [staffOptions,setStaffOptions]=useState([]);
  const [error,setError]=useState("");

  const loadSalaryData = () => {
    if (!user) return; // wait for the logged-in user so a VP never briefly sees everyone
    Promise.all([list("payroll","limit=1000"),list("leaves","limit=100"),api.get("/payroll/staff-options")]).then(([p,l,st])=>{
      const pList = p?.data || p || [];
      const lList = l?.data || l || [];
      const sList = st?.data || st || [];
      setPayrolls(
        pList
          .map(x=>({id:x._id,name:x.staff?.user?.name||"Unknown",designation:x.staff?.designation||"Staff",month:x.month,basic:x.basic||0,allowances:x.allowances||0,deductions:x.deductions||0,net:x.net||0,status:x.status,paidOn:x.paidOn?new Date(x.paidOn).toLocaleDateString():"—",paidOnRaw:x.paidOn||"",staffId:x.staff?._id,createdAt:x.createdAt,email:x.staff?.user?.email||"",phone:x.staff?.user?.phone||"",paymentMethod:x.paymentMethod||"",transactionId:x.transactionId||"",absentDays:Number(x.absentDays)||0,advance:Number(x.advance)||0,otherDeductions:(x.otherDeductions===undefined||x.otherDeductions===null)?undefined:Number(x.otherDeductions)||0}))
          .filter(p => !isVP || (myEmail && (p.email || "").toLowerCase() === myEmail))
      );
      setLeaveApps(isVP ? [] : lList.map(x=>({id:x._id,name:x.user?.name||"Staff",type:x.type,from:x.from?new Date(x.from).toISOString().slice(0,10):"",to:x.to?new Date(x.to).toISOString().slice(0,10):"",days:x.days||1,status:x.status})));
      setStaffOptions(isVP ? [] : sList);
    }).catch(()=>{});
  };

  useEffect(()=>{
    loadSalaryData();
    const unsubPay = onResourceChange("payroll", () => loadSalaryData());
    const unsubLeaves = onResourceChange("leaves", () => loadSalaryData());
    const unsubStaff = onResourceChange("staff", () => loadSalaryData());
    return () => {
      unsubPay?.();
      unsubLeaves?.();
      unsubStaff?.();
    };
  },[user?.email, user?.role]);

  const filtered = payrolls.filter(p => {
    if (filterRole==="Teachers")      return p.designation.includes("Teacher");
    if (filterRole==="Principal")     return p.designation==="Principal";
    if (filterRole==="Vice Principal")return p.designation==="Vice Principal";
    return true;
  });
  // The table shows ONE row per staff member — their most recent month.
  // Double-click a row (or click "N months") to see every month.
  const staffKey = p => String(p.staffId || p.name);
  const sortVal  = p => monthSortValue(p.month, p.createdAt);
  const monthsByStaff = payrolls.reduce((m,p)=>m.set(staffKey(p),(m.get(staffKey(p))||0)+1),new Map());
  const latestRows = [...latestByKey(filtered, staffKey, sortVal).values()];
  const historyRows = historyView ? payrolls.filter(p=>staffKey(p)===historyView.key).sort((a,b)=>sortVal(b)-sortVal(a)) : [];
  const openHistory = p => setHistoryView({ key:staffKey(p), name:p.name });

  const totalPaid    = payrolls.filter(p=>p.status==="Paid").reduce((s,p)=>s+p.net,0);
  const totalPending = payrolls.filter(p=>p.status==="Pending").reduce((s,p)=>s+p.net,0);

  /* ── Download payslip as PDF ── */
  const handleDownloadPayslip = p => downloadPayslip({
    employee: { name:p.name, designation:p.designation, email:p.email, phone:p.phone },
    month:p.month, basic:p.basic, allowances:p.allowances, deductions:p.deductions, net:p.net,
    status:p.status, paidOn:p.paidOnRaw||p.paidOn, paymentMethod:p.paymentMethod, transactionId:p.transactionId
  });

  const handleDeletePayroll = async p => { try{ await remove("payroll",p.id); setPayrolls(prev=>prev.filter(x=>x.id!==p.id)); }catch(e){ setError(e.message); } };

  /* ── Add payroll ── */
  // Picking a staff member loads their last saved salary, so it does not have to be typed again every month.
  const loadAttendanceDays = async (staffId, month) => {
    if (!staffId || !month) return;
    try {
      const result = await api.get(`/staff-attendance/summary?month=${encodeURIComponent(monthKey(month))}&staff=${staffId}`);
      const summary = result.data?.[0];
      setNewPay(prev => ({ ...prev, absentDays: String(summary?.deductionDays || 0) }));
    } catch {
      setNewPay(prev => ({ ...prev, absentDays: "0" }));
    }
  };

  const pickStaff = (id) => {
    const staff = staffOptions.find(x=>String(x._id)===String(id));
    const last = payrolls.filter(p=>String(p.staffId)===String(id)).sort((x,y)=>sortVal(y)-sortVal(x))[0];
    setNewPay(prev=>({ ...prev, staffId:id, name:staff?.user?.name||"", designation:staff?.designation||"",
      basic: last ? String(last.basic) : "", allowances: last ? String(last.allowances) : "",
      otherDeductions: last && last.otherDeductions!==undefined ? String(last.otherDeductions) : "",
      absentDays:"0", advance:"", fromMonth: last ? last.month : "" }));
    loadAttendanceDays(id, newPay.month);
  };

  const handleAdd = async () => {
    if (isVP) return;
    if (!newPay.staffId || !newPay.month) { setError("Select a staff member and a month"); return; }
    const staff=staffOptions.find(x=>String(x._id)===String(newPay.staffId));
    if(!staff){setError("Staff member not found. Create the staff account first.");return;}
    if(payrolls.some(x=>String(x.staffId)===String(staff._id)&&monthKey(x.month)===monthKey(newPay.month))){setError(`Payroll for ${newPay.month.trim()} already exists for ${staff.user?.name||"this staff member"}. Edit the existing record instead.`);return;}
    const c = calcSalary(newPay);
    try{
      const r=await create("payroll",{staff:staff._id,month:newPay.month,basic:c.basic,allowances:c.allowances,deductions:c.totalDeductions,net:c.net,absentDays:c.absentDays,advance:c.advance,otherDeductions:c.other,status:"Pending"});
      setPayrolls(prev=>[...prev,{id:r.data._id,name:staff.user?.name||"Unknown",designation:staff.designation||newPay.designation,month:newPay.month,basic:c.basic,allowances:c.allowances,deductions:c.totalDeductions,net:c.net,absentDays:c.absentDays,advance:c.advance,otherDeductions:c.other,status:"Pending",staffId:staff._id,email:staff.user?.email||"",phone:staff.user?.phone||"",paidOn:"—",createdAt:new Date().toISOString()}]);
      setNewPay(EMPTY_PAY());setShowAdd(false);setError("");
    }catch(e){setError(e.message);}
  };

  /* ── Edit payroll ── */
  const openEdit = (p) => {
    if (isVP) return;
    setError("");
    // records saved before absent/advance existed: the whole deduction shows as "Other deductions"
    const other = p.otherDeductions !== undefined ? p.otherDeductions : p.deductions;
    setEditForm({ ...p, otherDeductions:String(other ?? 0), absentDays:String(p.absentDays||0), advance:String(p.advance||0) });
    setEditModal(p.id);
  };
  const handleSaveEdit = async () => {
    if (isVP) return;
    const cur=payrolls.find(x=>x.id===editModal);
    if(payrolls.some(x=>x.id!==editModal&&String(x.staffId)===String(cur?.staffId)&&monthKey(x.month)===monthKey(editForm.month))){ setError(`Payroll for ${String(editForm.month).trim()} already exists for ${cur?.name||"this staff member"}.`); return; }
    const c = calcSalary(editForm);
    try {
      const r=await update("payroll",editModal,{month:editForm.month,basic:c.basic,allowances:c.allowances,deductions:c.totalDeductions,net:c.net,absentDays:c.absentDays,advance:c.advance,otherDeductions:c.other,status:editForm.status});
      setPayrolls(prev=>prev.map(p=>p.id===editModal?{...p,month:editForm.month,designation:editForm.designation,basic:c.basic,allowances:c.allowances,deductions:c.totalDeductions,net:c.net,absentDays:c.absentDays,advance:c.advance,otherDeductions:c.other,status:r.data.status}:p));
      setEditModal(null);setError("");
    } catch(e){setError(e.message);}
  };

  /* ── Pay salary (mark as Paid) ── */
  const confirmPay = (p) => { if (!isVP) setPayingId(p.id); };
  const handlePay  = async () => { if (isVP) return; try { const nowIso=new Date().toISOString(); await update("payroll",payingId,{status:"Paid",paidOn:nowIso}); setPayrolls(prev=>prev.map(p=>p.id===payingId?{...p,status:"Paid",paidOn:new Date().toLocaleDateString(),paidOnRaw:nowIso}:p)); setPayingId(null); } catch(e){setError(e.message);} };

  /* ── Leave actions ── */
  const handleLeave = async (id, action) => { if (isVP) return; try { const status=action==="approve"?"Approved":"Rejected"; await update("leaves",id,{status}); setLeaveApps(prev=>prev.map(l=>l.id===id?{...l,status}:l)); } catch(e){setError(e.message);} };

  return (
    <div className="sal-page" style={{ padding:28 }}>
      <style>{`
.sal-page { min-width: 0; max-width: 100%; box-sizing: border-box; overflow-x: clip; }
.sal-tabs { display: flex; gap: 10px; margin-bottom: 24px; flex-wrap: wrap; }
.sal-stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; margin-bottom: 24px; }
.sal-stats.sal-stats-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.sal-stats > * { min-width: 0; box-sizing: border-box; }
.sal-filters { display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap; align-items: center; }
.sal-add-wrap { margin-left: auto; }
.sal-grid3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-bottom: 16px; }
.sal-grid3 > * { min-width: 0; }
.sal-grid2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-bottom: 16px; }
.sal-grid2 > * { min-width: 0; }
.sal-hist-stats { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 16px; }
.sal-hist-stats > * { flex: 1 1 120px; min-width: 0; }

/* Stat cards — 3 in one row on desktop, ONE PER ROW on mobile (see max-width: 768px) */
.sal-stat { position: relative; overflow: hidden; border-radius: 18px; padding: 26px 28px; color: #fff;
  display: flex; align-items: center; gap: 18px; min-width: 0; box-sizing: border-box; }
.sal-stat::after { content: ""; position: absolute; top: -40px; right: -30px; width: 130px; height: 130px;
  border-radius: 50%; background: rgba(255,255,255,.1); pointer-events: none; }
.sal-stat-icon { width: 52px; height: 52px; border-radius: 14px; background: rgba(255,255,255,.2);
  display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.sal-stat-icon svg { width: 24px; height: 24px; }
.sal-stat-text { min-width: 0; position: relative; z-index: 1; }
.sal-stat-value { font-size: 32px; font-weight: 800; line-height: 1.1; }
.sal-stat-label { font-size: 16px; font-weight: 600; overflow-wrap: anywhere; }

/* Touch devices: never scale / lift cards (stuck :hover made them jump while scrolling) */
@media (hover: none), (pointer: coarse) {
  .sal-stats > *, .sal-stats > *:hover, .sal-stats > *:active { transform: none !important; scale: none !important; }
}

/* Wide min-widths only on desktop — on phones the tables stack into cards */
@media (min-width: 769px) {
  .sal-table { min-width: 900px; }
  .sal-history-table { min-width: 760px; }
  .sal-leave-table { min-width: 700px; }
}

@media (max-width: 900px) {
  .sal-stat { padding: 16px; gap: 12px; }
  .sal-stat-icon { width: 42px; height: 42px; border-radius: 12px; }
  .sal-stat-icon svg { width: 20px; height: 20px; }
  .sal-stat-value { font-size: 26px; }
  .sal-stat-label { font-size: 13px; }
}

@media (max-width: 768px) {
  .sal-page { padding: 14px !important; }
  .sal-card { padding: 14px !important; border-radius: 12px !important; }
  .sal-tabs { margin-bottom: 14px; }
  .sal-tabs > button { flex: 1 1 0; padding: 9px 12px !important; }

  /* Summary cards: ONE per row (also for the vice-principal's 2-card view) */
  .sal-stats, .sal-stats.sal-stats-2 { grid-template-columns: minmax(0, 1fr); gap: 10px; margin-bottom: 14px; }
  .sal-stat { padding: 16px 18px; gap: 14px; border-radius: 16px; }
  .sal-stat-icon { width: 44px; height: 44px; border-radius: 12px; }
  .sal-stat-icon svg { width: 22px; height: 22px; }
  .sal-stat-value { font-size: 28px; }
  .sal-stat-label { font-size: 14px; }

  .sal-add-wrap { margin-left: 0; width: 100%; }
  .sal-add-wrap > button { width: 100%; justify-content: center; }

  /* Record cards */
  .sal-cards td { padding-top: 5px !important; padding-bottom: 5px !important; font-size: 12px !important; }
  .sal-cards td.rtable-actions { display: block !important; padding: 10px 12px !important; }
  .sal-cards td.rtable-actions > div { display: grid !important; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px !important; width: 100%; }
  .sal-cards td.rtable-actions button { width: 100% !important; min-width: 0 !important; height: 38px; margin: 0 !important; padding: 0 !important; display: flex !important; align-items: center; justify-content: center; gap: 6px; }
  .sal-cards td.rtable-actions button.sal-pay-btn { grid-column: 1 / -1; order: -1; font-size: 13px !important; }
  .sal-cards td.rtable-actions > div.sal-leave-actions { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: 480px) {
  .sal-grid3 { grid-template-columns: 1fr; }
  .sal-grid2 { grid-template-columns: 1fr; }
}
`}</style>
      {error&&!showAdd&&!editModal&&<div style={{color:C.red,fontSize:13,marginBottom:12}}>{error}</div>}

      {/* Tab switcher — vice principal has no tabs (own payroll only) */}
      {!isVP && (
        <div className="sal-tabs">
          {["Payroll","Leave Applications"].map(t=>(
            <motion.button type="button" key={t} {...hv(1.03)} onClick={()=>setTab(t)}
              style={{ padding:"9px 22px", borderRadius:20, border:"none", cursor:"pointer", fontWeight:600, fontSize:13,
                background:tab===t?C.accent:C.white, color:tab===t?"#fff":C.muted,
                boxShadow:tab===t?"0 4px 14px rgba(79,110,247,.35)":"0 2px 6px rgba(0,0,0,.07)" }}>
              {t}
            </motion.button>
          ))}
        </div>
      )}

      {/* Summary cards — 3 per row on desktop, one per row on mobile */}
      <div className={`sal-stats${isVP ? " sal-stats-2" : ""}`}>
        {[
          { label:"Total Paid",     value:`₹${(totalPaid/1000).toFixed(0)}K`,    icon:Check,       gradient:"linear-gradient(135deg, rgb(39, 174, 179), rgb(13, 148, 136))" },
          { label:"Pending",        value:`₹${(totalPending/1000).toFixed(0)}K`, icon:Clock,       gradient:"linear-gradient(135deg, rgb(249, 115, 22), rgb(234, 88, 12))" },
          ...(isVP ? [] : [{ label:"Pending Leaves", value:leaveApps.filter(l=>l.status==="Pending").length, icon:CheckSquare, gradient:"linear-gradient(135deg, rgb(14, 165, 233), rgb(8, 145, 178))" }]),
        ].map(s => (
          <div key={s.label} className="sal-stat" style={{ background:s.gradient }}>
            <div className="sal-stat-icon"><s.icon /></div>
            <div className="sal-stat-text">
              <div className="sal-stat-value">{s.value}</div>
              <div className="sal-stat-label">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ─── PAYROLL TAB ─── */}
      {(isVP || tab==="Payroll") && (
        <div className="sal-card" style={{ background:C.white, borderRadius:14, padding:22, boxShadow:"0 2px 8px rgba(0,0,0,.06)", minWidth:0 }}>
          {/* Filter + Add (admin only) */}
          {!isVP ? (
            <div className="sal-filters">
              {["All","Teachers","Principal","Vice Principal"].map(r=>(
                <motion.button type="button" key={r} {...hv(1.03)} onClick={()=>setFilterRole(r)}
                  style={{ padding:"7px 16px", borderRadius:20, border:"none", cursor:"pointer",
                    fontWeight:600, fontSize:13,
                    background:filterRole===r?C.accent:"#f4f6fb",
                    color:filterRole===r?"#fff":C.muted }}>
                  {r}
                </motion.button>
              ))}
              <div className="sal-add-wrap">
                <motion.button type="button" {...hv(1.05)} onClick={()=>{setError("");setNewPay(prev=>({...prev,month:prev.month||currentMonthLabel()}));setShowAdd(true);}}
                  style={{ display:"flex", alignItems:"center", gap:6, background:C.accent, color:"#fff",
                    border:"none", borderRadius:10, padding:"9px 18px", cursor:"pointer", fontSize:13, fontWeight:600 }}>
                  <Plus size={15} /> Add Payroll
                </motion.button>
              </div>
            </div>
          ) : (
            <div style={{ fontWeight:700, fontSize:16, marginBottom:14 }}>My Salary</div>
          )}

          <div style={{ fontSize:12, color:C.muted, marginBottom:10 }}>
            {isVP
              ? "Your latest month · double-click the row to see all months"
              : "Showing each staff member's latest month · double-click a row to see all months"}
          </div>

          {/* Table */}
          <div style={{ overflowX:"auto" }}>
            <table className="rtable sal-cards sal-table" style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead><tr style={{ background:"#f8fafc" }}>
                {["STAFF","DESIGNATION","MONTH","BASIC","ALLOWANCES","DEDUCTIONS","NET","STATUS","ACTIONS"].map(h=>(
                  <th key={h} style={{ padding:"10px 14px", textAlign:"left", fontSize:11, fontWeight:700, color:C.muted, whiteSpace:"nowrap" }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {latestRows.length===0 ? (
                  <tr><td colSpan={9} style={{ padding:32, textAlign:"center", color:C.muted }}>No payroll records found.</td></tr>
                ) : latestRows.map((p,i)=>(
                  <tr key={p.id} onDoubleClick={()=>openHistory(p)} title="Double-click to see all months"
                    style={{ background:ROW_COLORS[i%ROW_COLORS.length], borderBottom:"1px solid "+C.border, cursor:"pointer" }}>
                    <td className="rtable-full" style={{ padding:"12px 14px" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                        <Avatar name={p.name} size={32} />
                        <div style={{ fontWeight:600, fontSize:13 }}>{p.name}</div>
                      </div>
                    </td>
                    <td data-label="Designation" style={{ padding:"12px 14px", fontSize:12, color:C.muted }}>{p.designation}</td>
                    <td data-label="Month" style={{ padding:"12px 14px", fontSize:12 }}>{p.month}</td>
                    <td data-label="Basic" style={{ padding:"12px 14px", fontSize:13 }}>₹{Number(p.basic).toLocaleString()}</td>
                    <td data-label="Allowances" style={{ padding:"12px 14px", fontSize:13, color:C.teal }}>+₹{Number(p.allowances).toLocaleString()}</td>
                    <td data-label="Deductions" style={{ padding:"12px 14px", fontSize:13, color:C.red }}>
                      -₹{Number(p.deductions).toLocaleString()}
                    </td>
                    <td data-label="Net" style={{ padding:"12px 14px", fontWeight:700, fontSize:13 }}>₹{Number(p.net).toLocaleString()}</td>

                    {/* Status badge */}
                    <td data-label="Status" style={{ padding:"12px 14px" }}>
                      <span style={{
                        background:p.status==="Paid"?"#d1fae5":"#fef3c7",
                        color:p.status==="Paid"?C.teal:C.orange,
                        borderRadius:20, padding:"4px 12px", fontSize:11, fontWeight:600
                      }}>
                        {p.status}
                      </span>
                    </td>

                    {/* Actions: View | Download | Edit | Pay | Delete  (VP: View + Download only) */}
                    <td className="rtable-actions" style={{ padding:"12px 14px" }} onDoubleClick={e=>e.stopPropagation()}>
                      <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                        {/* View payslip */}
                        <motion.button type="button" {...hv(1.1)} title="View Payslip"
                          onClick={()=>setViewModal(p)}
                          style={{ background:"#f1f5f9", border:"none", borderRadius:6, width:28, height:28, cursor:"pointer", color:C.muted,
                            display:"flex", alignItems:"center", justifyContent:"center" }}>
                          <Eye size={15} />
                        </motion.button>

                        {/* Download payslip PDF */}
                        <motion.button type="button" {...hv(1.1)} title="Download Payslip (PDF)"
                          onClick={()=>handleDownloadPayslip(p)}
                          style={{ background:"#ecfdf5", border:"none", borderRadius:6,
                            width:28, height:28, cursor:"pointer", color:"#059669",
                            display:"flex", alignItems:"center", justifyContent:"center" }}>
                          <Download size={13} />
                        </motion.button>

                        {!isVP && (
                          <>
                            {/* Edit */}
                            <motion.button type="button" {...hv(1.1)} title="Edit"
                              onClick={()=>openEdit(p)}
                              style={{ background:"#f0f4ff", border:"none", borderRadius:6,
                                width:28, height:28, cursor:"pointer", color:C.accent,
                                display:"flex", alignItems:"center", justifyContent:"center" }}>
                              <Edit size={13} />
                            </motion.button>

                            {/* Pay salary button — only shown if Pending */}
                            {p.status==="Pending" && (
                              <motion.button type="button" className="sal-pay-btn" {...hv(1.05)} title="Pay Salary"
                                onClick={()=>confirmPay(p)}
                                style={{ background:C.teal, color:"#fff", border:"none", borderRadius:8,
                                  padding:"5px 10px", cursor:"pointer", fontSize:11, fontWeight:700,
                                  display:"flex", alignItems:"center", gap:4 }}>
                                <DollarSign size={12} /> Pay
                              </motion.button>
                            )}

                            {/* Delete */}
                            <motion.button type="button" {...hv(1.1)} title="Delete"
                              onClick={async()=>{try{await remove("payroll",p.id);setPayrolls(prev=>prev.filter(x=>x.id!==p.id));}catch(e){setError(e.message);}}}
                              style={{ background:C.red, border:"none", borderRadius:6, width:28, height:28,
                                cursor:"pointer", color:"#fff", display:"flex", alignItems:"center", justifyContent:"center" }}>
                              <Trash2 size={13} />
                            </motion.button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── LEAVE APPLICATIONS TAB (admin only) ─── */}
      {!isVP && tab==="Leave Applications" && (
        <div className="sal-card" style={{ background:C.white, borderRadius:14, padding:22, boxShadow:"0 2px 8px rgba(0,0,0,.06)", minWidth:0 }}>
         <div style={{ fontWeight:700, fontSize:16, marginBottom:18 }}>Leave Applications</div>
         <div style={{ overflowX:"auto" }}>
         <table className="rtable sal-cards sal-leave-table" style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead><tr style={{ background:"#f8fafc" }}>
              {["STAFF","LEAVE TYPE","FROM","TO","DAYS","STATUS","ACTIONS"].map(h=>(
                <th key={h} style={{ padding:"10px 14px", textAlign:"left", fontSize:11, fontWeight:700, color:C.muted }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {leaveApps.map((l,i)=>(
                <tr key={l.id} style={{ background:ROW_COLORS[i%ROW_COLORS.length], borderBottom:"1px solid "+C.border }}>
                  <td className="rtable-full" style={{ padding:"12px 14px" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                      <Avatar name={l.name} size={32} />
                      <div style={{ fontWeight:600, fontSize:13 }}>{l.name}</div>
                    </div>
                  </td>
                  <td data-label="Type" style={{ padding:"12px 14px", fontSize:13 }}>{l.type}</td>
                  <td data-label="From" style={{ padding:"12px 14px", fontSize:13 }}>{l.from}</td>
                  <td data-label="To" style={{ padding:"12px 14px", fontSize:13 }}>{l.to}</td>
                  <td data-label="Days" style={{ padding:"12px 14px", fontWeight:600 }}>{l.days} days</td>
                  <td data-label="Status" style={{ padding:"12px 14px" }}>
                    <span style={{ background:l.status==="Approved"?"#d1fae5":l.status==="Rejected"?"#fee2e2":"#fef3c7",
                      color:l.status==="Approved"?C.teal:l.status==="Rejected"?C.red:C.orange,
                      borderRadius:20, padding:"4px 12px", fontSize:11, fontWeight:600 }}>
                      {l.status}
                    </span>
                  </td>
                  <td className="rtable-actions" style={{ padding:"12px 14px" }}>
                    {l.status==="Pending" && (
                      <div className="sal-leave-actions" style={{ display:"flex", gap:8 }}>
                        <motion.button type="button" {...hv(1.05)} onClick={()=>handleLeave(l.id,"approve")}
                          style={{ background:"#d1fae5", color:C.teal, border:"none", borderRadius:8, padding:"5px 12px", cursor:"pointer", fontSize:12, fontWeight:600 }}>
                          Approve
                        </motion.button>
                        <motion.button type="button" {...hv(1.05)} onClick={()=>handleLeave(l.id,"reject")}
                          style={{ background:"#fee2e2", color:C.red, border:"none", borderRadius:8, padding:"5px 12px", cursor:"pointer", fontSize:12, fontWeight:600 }}>
                          Reject
                        </motion.button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* ─── MODALS ─── */}
      <AnimatePresence>

        {/* ADD PAYROLL */}
        {!isVP && showAdd && (
          <Modal title="Add Payroll" onClose={()=>{setShowAdd(false);setError("");}}>
            {error && <div style={{ background:"#fee2e2", color:"#dc2626", borderRadius:8, padding:"9px 14px", fontSize:13, marginBottom:16 }}>⚠️ {error}</div>}
            <div style={{ marginBottom:16 }}>
              <label style={{ fontSize:13, fontWeight:600, display:"block", marginBottom:6 }}>Staff Name *</label>
              <select value={newPay.staffId} onChange={e=>pickStaff(e.target.value)}
                style={{ width:"100%", padding:"10px 14px", borderRadius:10, border:"1.5px solid "+C.border, fontSize:13, outline:"none", background:C.white, boxSizing:"border-box" }}>
                <option value="">-- Select existing staff member --</option>
                {staffOptions.map(staff=>{
                  const staffId=String(staff._id), name=staff.user?.name||"Unnamed Staff";
                  return <option key={staffId} value={staffId}>{name}</option>;
                })}
              </select>
              {!staffOptions.length && <div style={{ color:C.muted, fontSize:11, marginTop:5 }}>No staff records found. Add staff first.</div>}
              {newPay.fromMonth && <div style={{ color:C.teal, fontSize:11.5, marginTop:6, fontWeight:600 }}>Salary loaded from {newPay.fromMonth} — change it only if the salary has changed.</div>}
            </div>
            <div style={{ marginBottom:16 }}>
              <label style={{ fontSize:13, fontWeight:600, display:"block", marginBottom:6 }}>Designation</label>
              <select value={newPay.designation} onChange={e=>setNewPay({...newPay,designation:e.target.value})}
                style={{ width:"100%", padding:"10px 14px", borderRadius:10, border:"1.5px solid "+C.border, fontSize:13, outline:"none", background:C.white, boxSizing:"border-box" }}>
                <option>Principal</option><option>Vice Principal</option><option>Department Head</option>
                <option>Teacher</option>
              </select>
            </div>
            <MonthSelect value={newPay.month} onChange={v=>{setNewPay(prev=>({...prev,month:v}));loadAttendanceDays(newPay.staffId,v);}} />
            <SalaryFields form={newPay} setForm={setNewPay} />
            <div style={{ display:"flex", gap:12, flexWrap:"wrap" }}>
              <SaveBtn onClick={handleAdd} label="Add Payroll" />
              <CancelBtn onClick={()=>{setShowAdd(false);setError("");}} />
            </div>
          </Modal>
        )}

        {/* EDIT PAYROLL */}
        {!isVP && editModal && editForm && (
          <Modal title="Edit Payroll" onClose={()=>{setEditModal(null);setError("");}}>
            {error && <div style={{ background:"#fee2e2", color:"#dc2626", borderRadius:8, padding:"9px 14px", fontSize:13, marginBottom:16 }}>⚠️ {error}</div>}
            <FormField label="Staff Name" value={editForm.name} onChange={v=>setEditForm({...editForm,name:v})} />
            <div style={{ marginBottom:16 }}>
              <label style={{ fontSize:13, fontWeight:600, display:"block", marginBottom:6 }}>Designation</label>
              <select value={editForm.designation} onChange={e=>setEditForm({...editForm,designation:e.target.value})}
                style={{ width:"100%", padding:"10px 14px", borderRadius:10, border:"1.5px solid "+C.border, fontSize:13, outline:"none", background:C.white, boxSizing:"border-box" }}>
                <option>Principal</option><option>Vice Principal</option><option>Department Head</option>
                <option>Teacher</option>
              </select>
            </div>
            <MonthSelect label="Month" value={editForm.month} onChange={v=>setEditForm({...editForm,month:v})} />
            <SalaryFields form={editForm} setForm={setEditForm} />
            <div style={{ marginBottom:16 }}>
              <label style={{ fontSize:13, fontWeight:600, display:"block", marginBottom:6 }}>Status</label>
              <select value={editForm.status} onChange={e=>setEditForm({...editForm,status:e.target.value})}
                style={{ width:"100%", padding:"10px 14px", borderRadius:10, border:"1.5px solid "+C.border, fontSize:13, outline:"none", background:C.white, boxSizing:"border-box" }}>
                <option>Pending</option><option>Paid</option>
              </select>
            </div>
            <div style={{ display:"flex", gap:12, flexWrap:"wrap" }}>
              <SaveBtn onClick={handleSaveEdit} label="Save Changes" />
              <CancelBtn onClick={()=>{setEditModal(null);setError("");}} />
            </div>
          </Modal>
        )}

        {/* CONFIRM PAY */}
        {!isVP && payingId && (
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
            style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.45)", display:"flex",
              alignItems:"center", justifyContent:"center", zIndex:999, padding:16, boxSizing:"border-box" }}
            onClick={()=>setPayingId(null)}>
            <motion.div initial={{ scale:0.9 }} animate={{ scale:1 }} exit={{ scale:0.9 }}
              onClick={e=>e.stopPropagation()}
              style={{ background:C.white, borderRadius:18, padding:"28px 22px", width:"100%", maxWidth:420, maxHeight:"100%", overflowY:"auto", boxSizing:"border-box",
                boxShadow:"0 20px 60px rgba(0,0,0,.2)", textAlign:"center" }}>
              {/* Icon */}
              <div style={{ width:64, height:64, borderRadius:"50%", background:"#d1fae5",
                display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 16px", fontSize:28 }}>
                💰
              </div>
              <div style={{ fontSize:18, fontWeight:700, marginBottom:8 }}>Confirm Payment</div>
              <div style={{ fontSize:13, color:C.muted, marginBottom:6 }}>
                You are about to pay salary to
              </div>
              {(() => {
                const p = payrolls.find(x=>x.id===payingId);
                return p ? (
                  <>
                    <div style={{ fontSize:16, fontWeight:700, color:C.text, marginBottom:4, overflowWrap:"anywhere" }}>{p.name}</div>
                    <div style={{ fontSize:13, color:C.muted, marginBottom:20 }}>{p.month}</div>
                    <div style={{ background:"#eef2ff", borderRadius:12, padding:"14px 20px", marginBottom:24,
                      display:"flex", justifyContent:"space-between", alignItems:"center", gap:10, flexWrap:"wrap" }}>
                      <span style={{ fontSize:13, color:C.muted }}>Amount</span>
                      <span style={{ fontSize:22, fontWeight:800, color:C.accent }}>₹{Number(p.net).toLocaleString()}</span>
                    </div>
                  </>
                ) : null;
              })()}
              <div style={{ display:"flex", gap:12 }}>
                <motion.button type="button" {...hv(1.03)} onClick={handlePay}
                  style={{ flex:1, background:C.teal, color:"#fff", border:"none", borderRadius:10,
                    padding:"12px", fontSize:14, fontWeight:700, cursor:"pointer" }}>
                  ✓ Confirm Pay
                </motion.button>
                <motion.button type="button" {...hv(1.03)} onClick={()=>setPayingId(null)}
                  style={{ flex:1, background:"#f4f6fb", color:C.text, border:"none", borderRadius:10,
                    padding:"12px", fontSize:14, fontWeight:700, cursor:"pointer" }}>
                  Cancel
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* SALARY HISTORY — every month for one staff member */}
        {historyView && (
          <Modal title={`Salary History — ${historyView.name}`} width={900} zIndex={9990} onClose={()=>setHistoryView(null)}>
            <div className="sal-hist-stats">
              {[["Months",historyRows.length,C.accent,"#eef2ff"],
                ["Paid",`₹${historyRows.filter(p=>p.status==="Paid").reduce((t,p)=>t+Number(p.net||0),0).toLocaleString()}`,C.teal,"#d1fae5"],
                ["Pending",`₹${historyRows.filter(p=>p.status!=="Paid").reduce((t,p)=>t+Number(p.net||0),0).toLocaleString()}`,C.orange,"#fef3c7"]].map(([l,v,c,bg])=>(
                <div key={l} style={{ background:bg, borderRadius:10, padding:"8px 16px" }}>
                  <div style={{ fontSize:11, color:C.muted, fontWeight:600 }}>{l}</div>
                  <div style={{ fontSize:16, fontWeight:800, color:c, overflowWrap:"anywhere" }}>{v}</div>
                </div>
              ))}
            </div>
            <div style={{ overflowX:"auto" }}>
              <table className="rtable sal-cards sal-history-table" style={{ width:"100%", borderCollapse:"collapse" }}>
                <thead><tr style={{ background:"#f8fafc" }}>
                  {["MONTH","BASIC","ALLOWANCES","DEDUCTIONS","NET","STATUS","PAID ON","ACTIONS"].map(h=>(
                    <th key={h} style={{ padding:"9px 12px", textAlign:"left", fontSize:11, fontWeight:700, color:C.muted, whiteSpace:"nowrap" }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {historyRows.length===0 ? (
                    <tr><td colSpan={8} style={{ padding:24, textAlign:"center", color:C.muted, fontSize:13 }}>No payroll records.</td></tr>
                  ) : historyRows.map((p,i)=>(
                    <tr key={p.id} style={{ background:ROW_COLORS[i%ROW_COLORS.length], borderBottom:"1px solid "+C.border }}>
                      <td className="rtable-full" style={{ padding:"10px 12px", fontSize:13, fontWeight:700, color:C.accent, whiteSpace:"nowrap" }}>{p.month}</td>
                      <td data-label="Basic" style={{ padding:"10px 12px", fontSize:13 }}>₹{Number(p.basic).toLocaleString()}</td>
                      <td data-label="Allowances" style={{ padding:"10px 12px", fontSize:13, color:C.teal }}>+₹{Number(p.allowances).toLocaleString()}</td>
                      <td data-label="Deductions" style={{ padding:"10px 12px", fontSize:13, color:C.red }}>-₹{Number(p.deductions).toLocaleString()}</td>
                      <td data-label="Net" style={{ padding:"10px 12px", fontSize:13, fontWeight:700 }}>₹{Number(p.net).toLocaleString()}</td>
                      <td data-label="Status" style={{ padding:"10px 12px" }}>
                        <span style={{ background:p.status==="Paid"?"#d1fae5":"#fef3c7", color:p.status==="Paid"?C.teal:C.orange, borderRadius:20, padding:"3px 10px", fontSize:11, fontWeight:600 }}>{p.status}</span>
                      </td>
                      <td data-label="Paid On" style={{ padding:"10px 12px", fontSize:12, color:C.muted, whiteSpace:"nowrap" }}>{p.paidOn}</td>
                      <td className="rtable-actions" style={{ padding:"10px 12px" }}>
                        <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                          <button type="button" title="View Payslip" onClick={()=>setViewModal(p)}
                            style={{ background:"#f1f5f9", border:"none", borderRadius:6, width:28, height:28, cursor:"pointer", color:C.muted, display:"flex", alignItems:"center", justifyContent:"center" }}><Eye size={15} /></button>
                          <button type="button" title="Download Payslip (PDF)" onClick={()=>handleDownloadPayslip(p)}
                            style={{ background:"#ecfdf5", border:"none", borderRadius:6, width:28, height:28, cursor:"pointer", color:"#059669", display:"flex", alignItems:"center", justifyContent:"center" }}><Download size={13} /></button>
                          {!isVP && (
                            <>
                              <button type="button" title="Edit" onClick={()=>openEdit(p)}
                                style={{ background:"#f0f4ff", border:"none", borderRadius:6, width:28, height:28, cursor:"pointer", color:C.accent, display:"flex", alignItems:"center", justifyContent:"center" }}><Edit size={13} /></button>
                              {p.status==="Pending" && (
                                <button type="button" className="sal-pay-btn" title="Pay Salary" onClick={()=>confirmPay(p)}
                                  style={{ background:C.teal, color:"#fff", border:"none", borderRadius:8, padding:"5px 10px", cursor:"pointer", fontSize:11, fontWeight:700, display:"flex", alignItems:"center", gap:4 }}><DollarSign size={12} /> Pay</button>
                              )}
                              <button type="button" title="Delete" onClick={()=>{ if(window.confirm(`Delete the ${p.month} payroll for ${p.name}?`)) handleDeletePayroll(p); }}
                                style={{ background:C.red, border:"none", borderRadius:6, width:28, height:28, cursor:"pointer", color:"#fff", display:"flex", alignItems:"center", justifyContent:"center" }}><Trash2 size={13} /></button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Modal>
        )}

        {/* VIEW PAYSLIP */}
        {viewModal && (
          <Modal title="Payslip Details" onClose={()=>setViewModal(null)}>
            <div style={{ background:"linear-gradient(135deg,#4f6ef7,#7c3aed)", borderRadius:12, padding:"16px 20px", marginBottom:20, display:"flex", alignItems:"center", gap:14 }}>
              <Avatar name={viewModal.name} size={48} />
              <div style={{ minWidth:0 }}>
                <div style={{ color:"#fff", fontWeight:700, fontSize:16, overflowWrap:"anywhere" }}>{viewModal.name}</div>
                <div style={{ color:"rgba(255,255,255,.7)", fontSize:12 }}>{viewModal.designation}</div>
                <div style={{ color:"rgba(255,255,255,.6)", fontSize:11, marginTop:2 }}>{viewModal.month}</div>
              </div>
            </div>
            {[
              ["Basic Salary",  `₹${Number(viewModal.basic).toLocaleString()}`,       C.text ],
              ["Allowances",    `+ ₹${Number(viewModal.allowances).toLocaleString()}`, C.teal ],
              ...(viewModal.absentDays>0 ? [[`Absent (${viewModal.absentDays} day${viewModal.absentDays===1?"":"s"})`, `- ₹${calcSalary({basic:viewModal.basic,allowances:viewModal.allowances,absentDays:viewModal.absentDays}).absentDeduction.toLocaleString()}`, C.red]] : []),
              ...(viewModal.advance>0 ? [["Advance", `- ₹${Number(viewModal.advance).toLocaleString()}`, C.red]] : []),
              ["Total Deductions", `- ₹${Number(viewModal.deductions).toLocaleString()}`, C.red  ],
            ].map(([l,v,c])=>(
              <div key={l} style={{ display:"flex", justifyContent:"space-between", gap:10, padding:"10px 0", borderBottom:"1px solid "+C.border }}>
                <span style={{ fontSize:13, color:C.muted }}>{l}</span>
                <span style={{ fontSize:13, fontWeight:600, color:c }}>{v}</span>
              </div>
            ))}
            <div style={{ display:"flex", justifyContent:"space-between", gap:10, padding:"14px 0 4px" }}>
              <span style={{ fontSize:15, fontWeight:700 }}>Net Salary</span>
              <span style={{ fontSize:20, fontWeight:800, color:C.accent }}>₹{Number(viewModal.net).toLocaleString()}</span>
            </div>
            <div style={{ display:"flex", justifyContent:"center", marginTop:12 }}>
              <span style={{ background:viewModal.status==="Paid"?"#d1fae5":"#fef3c7",
                color:viewModal.status==="Paid"?C.teal:C.orange,
                borderRadius:20, padding:"5px 18px", fontSize:13, fontWeight:600 }}>
                {viewModal.status}
              </span>
            </div>
            <div style={{ display:"flex", justifyContent:"center", marginTop:16 }}>
              <motion.button type="button" {...hv(1.03)} whileTap={{ scale:0.97 }}
                onClick={()=>handleDownloadPayslip(viewModal)}
                style={{ display:"flex", alignItems:"center", gap:8, background:C.accent, color:"#fff",
                  border:"none", borderRadius:10, padding:"10px 22px", cursor:"pointer", fontSize:13, fontWeight:700 }}>
                <Download size={15} /> Download PDF
              </motion.button>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}

export { AdminSalary };