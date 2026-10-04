import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, LayoutDashboard, GraduationCap, Users, BookOpen, ClipboardCheck, ListChecks, Megaphone, Calendar, DollarSign, UserCircle, LogOut, Bell, Search, ChevronDown, TrendingUp, Star, AlertTriangle, Eye, Trash2, Edit, Plus, X, Check, Clock, BarChart2, Award, Briefcase, Mail, Phone, Shield, CheckSquare, Settings2, Home, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "../../shared/ui";
import { C, ROW_COLORS } from "../../shared/runtime";
import { Avatar } from "../../components/common/Avatar";
import { CancelBtn } from "../../components/common/CancelBtn";
import { FormField } from "../../components/common/FormField";
import { Modal } from "../../components/common/Modal";
import { SaveBtn } from "../../components/common/SaveBtn";
import { StatCard } from "../../components/common/StatCard";
import { list, create } from "../../services/resource.service";
import { me } from "../../services/auth.service";
import { onResourceChange } from "../../services/socket.service";
import { api } from "../../services/apiClient";
import { Download } from "../../shared/ui";
import { downloadPayslip } from "../../utils/documents";

function TeacherSalary({ userData }) {
  const [tab, setTab] = useState("Payroll");
  const [attendanceDate, setAttendanceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [attendanceDays, setAttendanceDays] = useState([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceError, setAttendanceError] = useState("");
  const [payrolls, setPayrolls] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [viewSlip, setViewSlip] = useState(null);
  const [showLeave, setShowLeave] = useState(false);
  const [leaveForm, setLeaveForm] = useState({ type:"Sick Leave", from:"", to:"", reason:"" });
  const [error,setError]=useState("");

  const loadSalaryAndLeaves = () => {
    Promise.all([list("payroll"), me()]).then(([p]) => {
      const pList = p?.data || p || [];
      setPayrolls(pList.map(x => ({
        id: x._id,
        month: x.month,
        basic: x.basic || 0,
        allowances: x.allowances || 0,
        deductions: x.deductions || 0,
        net: x.net || 0,
        status: x.status,
        paidOn: x.paidOn ? new Date(x.paidOn).toLocaleDateString() : "—",
        designation: x.staff?.designation || "",
        email: x.staff?.user?.email || "",
        phone: x.staff?.user?.phone || "",
        paymentMethod: x.paymentMethod || "",
        transactionId: x.transactionId || ""
      })));
    }).catch(()=>{});

    list("leaves").then(r => {
      const lList = r?.data || r || [];
      setLeaves(lList.map(x => ({
        id: x._id,
        type: x.type,
        from: x.from ? new Date(x.from).toISOString().slice(0,10) : "",
        to: x.to ? new Date(x.to).toISOString().slice(0,10) : "",
        days: x.days || 1,
        reason: x.reason || "",
        status: x.status
      })));
    }).catch(()=>{});
  };

  const handleDownloadPayslip = p => downloadPayslip({
    employee: { name:userData?.name || "Staff", designation:p.designation || "Staff", email:p.email || userData?.email, phone:p.phone || userData?.phone },
    month:p.month, basic:p.basic, allowances:p.allowances, deductions:p.deductions, net:p.net,
    status:p.status, paidOn:p.paidOn, paymentMethod:p.paymentMethod, transactionId:p.transactionId
  });

  const loadMyAttendance = async month => {
    setAttendanceLoading(true);
    setAttendanceError("");
    try {
      const result = await api.get(`/staff-attendance/my?month=${encodeURIComponent(month)}`);
      setAttendanceDays(result.data?.days || []);
    } catch (e) {
      setAttendanceDays([]);
      setAttendanceError(e.message || "Unable to load attendance");
    } finally {
      setAttendanceLoading(false);
    }
  };

  useEffect(()=>{
    loadSalaryAndLeaves();
    const unsubPay = onResourceChange("payroll", () => loadSalaryAndLeaves());
    const unsubLeaves = onResourceChange("leaves", () => loadSalaryAndLeaves());
    return () => {
      unsubPay?.();
      unsubLeaves?.();
    };
  },[]);
  useEffect(() => {
    if (tab === "My Attendance") loadMyAttendance(attendanceDate.slice(0, 7));
  }, [tab, attendanceDate]);
  const totalEarned=payrolls.filter(p=>p.status==="Paid").reduce((s,p)=>s+p.net,0);
  const attendanceCounts = attendanceDays.reduce((counts, day) => ({ ...counts, [day.status]: (counts[day.status] || 0) + 1 }), {});
  const handleApplyLeave=async()=>{
    if(!leaveForm.from||!leaveForm.to||!leaveForm.reason){setError("Fill all fields");return;}
    const days=Math.max(1,Math.round((new Date(leaveForm.to)-new Date(leaveForm.from))/(1000*60*60*24))+1);
    try{const u=await me();const r=await create("leaves",{user:u._id,type:leaveForm.type,from:leaveForm.from,to:leaveForm.to,days,reason:leaveForm.reason,status:"Pending"});setLeaves(prev=>[...prev,{id:r.data._id,...leaveForm,days,status:"Pending"}]);setLeaveForm({type:"Sick Leave",from:"",to:"",reason:""});setShowLeave(false);setError("");}catch(e){setError(e.message);}
  };
  return (
    <div style={{ padding:28 }}>{error&&<div style={{color:C.red,fontSize:13,marginBottom:12}}>{error}</div>}
      <div style={{ display:"flex", gap:10, marginBottom:24 }}>
        {["Payroll","My Attendance","Leave Applications"].map(t=>(
          <motion.button type="button" key={t} whileHover={{ scale:1.03 }} onClick={()=>setTab(t)}
            style={{ padding:"9px 22px", borderRadius:20, border:"none", cursor:"pointer", fontWeight:600, fontSize:13,
              background:tab===t?C.accent:C.white, color:tab===t?"#fff":C.muted,
              boxShadow:tab===t?"0 4px 14px rgba(79,110,247,.35)":"0 2px 6px rgba(0,0,0,.07)" }}>{t}
          </motion.button>
        ))}
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:16, marginBottom:24 }}>
        <StatCard stat={{ label:"Total Earned (YTD)", value:`₹${(totalEarned/1000).toFixed(0)}K`, icon:DollarSign, color:C.accent, bg:"#eef2ff" }} />
        <StatCard stat={{ label:"Last Month Salary", value:`₹${payrolls.find(p=>p.status==="Paid")?.net.toLocaleString()||"—"}`, icon:Check, color:C.teal, bg:"#d1fae5" }} />
        <StatCard stat={{ label:"Pending Months", value:payrolls.filter(p=>p.status==="Pending").length, icon:Clock, color:C.orange, bg:"#fef3c7" }} />
      </div>
      {tab==="Payroll"&&(
        <div style={{ background:C.white, borderRadius:14, padding:22, boxShadow:"0 2px 8px rgba(0,0,0,.06)" }}>
          <div style={{ fontWeight:700, fontSize:16, marginBottom:18 }}>My Salary History</div>
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table className="rtable" style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead><tr style={{ background:"#f8fafc" }}>
              {["MONTH","BASIC","ALLOWANCES","DEDUCTIONS","NET SALARY","PAID ON","STATUS","PAYSLIP"].map(h=>(
                <th key={h} style={{ padding:"10px 14px", textAlign:"left", fontSize:11, fontWeight:700, color:C.muted }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {payrolls.map((p,i)=>(
                <tr key={p.id} style={{ background:ROW_COLORS[i%ROW_COLORS.length], borderBottom:"1px solid "+C.border }}>
                  <td className="rtable-full" style={{ padding:"12px 14px", fontWeight:600, fontSize:13 }}>{p.month}</td>
                  <td data-label="Basic" style={{ padding:"12px 14px", fontSize:13 }}>₹{p.basic.toLocaleString()}</td>
                  <td data-label="Allowances" style={{ padding:"12px 14px", fontSize:13, color:C.teal }}>+₹{p.allowances.toLocaleString()}</td>
                  <td data-label="Deductions" style={{ padding:"12px 14px", fontSize:13, color:C.red }}>-₹{p.deductions.toLocaleString()}</td>
                  <td data-label="Net Salary" style={{ padding:"12px 14px", fontWeight:700, fontSize:13, color:C.accent }}>₹{p.net.toLocaleString()}</td>
                  <td data-label="Paid On" style={{ padding:"12px 14px", fontSize:12, color:C.muted }}>{p.paidOn}</td>
                  <td data-label="Status" style={{ padding:"12px 14px" }}>
                    <span style={{ background:p.status==="Paid"?"#d1fae5":"#fef3c7", color:p.status==="Paid"?C.teal:C.orange,
                      borderRadius:20, padding:"4px 12px", fontSize:11, fontWeight:600 }}>{p.status}</span>
                  </td>
                  <td className="rtable-actions" style={{ padding:"12px 14px" }}>
                    {p.status==="Paid"&&(
                      <div className="teacher-salary-actions" style={{ display:"flex", gap:6 }}>
                        <motion.button type="button" className="teacher-salary-btn teacher-salary-btn-view" whileHover={{ scale:1.05 }} onClick={()=>setViewSlip(p)}
                          style={{ background:"#f0f4ff", color:C.accent, border:"none", borderRadius:8,
                            padding:"5px 12px", cursor:"pointer", fontSize:12, fontWeight:600, display:"flex", alignItems:"center", gap:4 }}>
                          <Eye size={12} /> View
                        </motion.button>
                        <motion.button type="button" className="teacher-salary-btn teacher-salary-btn-pdf" whileHover={{ scale:1.05 }} onClick={()=>handleDownloadPayslip(p)}
                          title="Download payslip as PDF"
                          style={{ background:"#ecfdf5", color:"#059669", border:"none", borderRadius:8,
                            padding:"5px 12px", cursor:"pointer", fontSize:12, fontWeight:600, display:"flex", alignItems:"center", gap:4 }}>
                          <Download size={12} /> PDF
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
      {tab==="My Attendance"&&(
        <div style={{ background:C.white, borderRadius:14, padding:22, boxShadow:"0 2px 8px rgba(0,0,0,.06)" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:12, flexWrap:"wrap", marginBottom:18 }}>
            <div><div style={{ fontWeight:700, fontSize:16 }}>My Attendance</div><div style={{ color:C.muted, fontSize:12, marginTop:4 }}>View your attendance marked by the administrator.</div></div>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}><Calendar size={16} color={C.accent} /><input type="date" value={attendanceDate} onChange={e=>setAttendanceDate(e.target.value)} style={{ padding:"8px 10px", borderRadius:8, border:"1px solid "+C.border, color:C.text }} /></div>
          </div>
          {attendanceError&&<div style={{ color:C.red, background:"#fef2f2", padding:"10px 12px", borderRadius:8, fontSize:13, marginBottom:14 }}>{attendanceError}</div>}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10, marginBottom:18 }}>
            {[['Present',C.teal,'#d1fae5'],['Absent',C.red,'#fee2e2'],['Leave',C.orange,'#fef3c7']].map(([status,color,background])=><div key={status} style={{ background, borderRadius:10, padding:"12px 14px" }}><div style={{ color, fontSize:12, fontWeight:700 }}>{status}</div><div style={{ color:C.text, fontSize:20, fontWeight:800, marginTop:3 }}>{attendanceCounts[status] || 0}</div></div>)}
          </div>
          {attendanceLoading ? <div style={{ padding:30, textAlign:"center", color:C.muted }}>Loading attendance...</div> : !attendanceDays.length ? <div style={{ padding:30, textAlign:"center", color:C.muted }}>No attendance records for this month.</div> : <div style={{ overflowX:"auto" }}>
            <table className="rtable" style={{ width:"100%", borderCollapse:"collapse" }}><thead><tr style={{ background:"#f8fafc" }}>{["DATE","STATUS","NOTE"].map(h=><th key={h} style={{ padding:"10px 14px", textAlign:"left", fontSize:11, fontWeight:700, color:C.muted }}>{h}</th>)}</tr></thead><tbody>{attendanceDays.map((day,index)=><tr key={day.date} style={{ background:ROW_COLORS[index%ROW_COLORS.length], borderBottom:"1px solid "+C.border }}><td className="rtable-full" style={{ padding:"12px 14px", fontWeight:600, fontSize:13 }}>{day.date}</td><td data-label="Status" style={{ padding:"12px 14px" }}><span style={{ background:day.status==="Present"?"#d1fae5":day.status==="Absent"?"#fee2e2":"#fef3c7", color:day.status==="Present"?C.teal:day.status==="Absent"?C.red:C.orange, borderRadius:20, padding:"4px 12px", fontSize:11, fontWeight:700 }}>{day.status}</span></td><td data-label="Note" style={{ padding:"12px 14px", color:C.muted, fontSize:12 }}>{day.note || "—"}</td></tr>)}</tbody></table>
          </div>}
        </div>
      )}
      {tab==="Leave Applications"&&(
        <div style={{ background:C.white, borderRadius:14, padding:22, boxShadow:"0 2px 8px rgba(0,0,0,.06)" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
            <div style={{ fontWeight:700, fontSize:16 }}>My Leave Applications</div>
            <motion.button type="button" whileHover={{ scale:1.05 }} onClick={()=>setShowLeave(true)}
              style={{ display:"flex", alignItems:"center", gap:6, background:C.accent, color:"#fff",
                border:"none", borderRadius:10, padding:"9px 18px", cursor:"pointer", fontSize:13, fontWeight:600 }}>
              <Plus size={15} /> Apply Leave
            </motion.button>
          </div>
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table className="rtable" style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead><tr style={{ background:"#f8fafc" }}>
              {["LEAVE TYPE","FROM","TO","DAYS","REASON","STATUS"].map(h=>(
                <th key={h} style={{ padding:"10px 14px", textAlign:"left", fontSize:11, fontWeight:700, color:C.muted }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {leaves.map((l,i)=>(
                <tr key={l.id} style={{ background:ROW_COLORS[i%ROW_COLORS.length], borderBottom:"1px solid "+C.border }}>
                  <td className="rtable-full" style={{ padding:"12px 14px", fontWeight:600, fontSize:13 }}>{l.type}</td>
                  <td data-label="From" style={{ padding:"12px 14px", fontSize:13 }}>{l.from}</td>
                  <td data-label="To" style={{ padding:"12px 14px", fontSize:13 }}>{l.to}</td>
                  <td data-label="Days" style={{ padding:"12px 14px", fontWeight:600 }}>{l.days} day{l.days>1?"s":""}</td>
                  <td data-label="Reason" style={{ padding:"12px 14px", fontSize:12, color:C.muted }}>{l.reason}</td>
                  <td data-label="Status" style={{ padding:"12px 14px" }}>
                    <span style={{ background:l.status==="Approved"?"#d1fae5":l.status==="Rejected"?"#fee2e2":"#fef3c7",
                      color:l.status==="Approved"?C.teal:l.status==="Rejected"?C.red:C.orange,
                      borderRadius:20, padding:"4px 12px", fontSize:11, fontWeight:600 }}>{l.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}
      <AnimatePresence>
        {viewSlip&&(
          <Modal title="Payslip" onClose={()=>setViewSlip(null)}>
            <div style={{ background:"linear-gradient(135deg,#4f6ef7,#7c3aed)", borderRadius:12, padding:"16px 20px", marginBottom:20, display:"flex", alignItems:"center", gap:14 }}>
              <Avatar name={userData?.name || "Staff"} size={48} />
              <div>
                <div style={{ color:"#fff", fontWeight:700, fontSize:16 }}>{userData?.name || "Staff"}</div>
                <div style={{ color:"rgba(255,255,255,.7)", fontSize:12 }}>{viewSlip.designation || "Staff"}</div>
                <div style={{ color:"rgba(255,255,255,.6)", fontSize:11, marginTop:2 }}>{viewSlip.month}</div>
              </div>
            </div>
            {[["Basic Salary",`₹${viewSlip.basic.toLocaleString()}`,C.text],["Allowances",`+ ₹${viewSlip.allowances.toLocaleString()}`,C.teal],["Deductions",`- ₹${viewSlip.deductions.toLocaleString()}`,C.red]].map(([l,v,c])=>(
              <div key={l} style={{ display:"flex", justifyContent:"space-between", padding:"10px 0", borderBottom:"1px solid "+C.border }}>
                <span style={{ fontSize:13, color:C.muted }}>{l}</span>
                <span style={{ fontSize:13, fontWeight:600, color:c }}>{v}</span>
              </div>
            ))}
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"14px 0" }}>
              <span style={{ fontSize:15, fontWeight:700 }}>Net Salary</span>
              <span style={{ fontSize:22, fontWeight:800, color:C.accent }}>₹{viewSlip.net.toLocaleString()}</span>
            </div>
            <div style={{ display:"flex", justifyContent:"center", marginTop:4 }}>
              <motion.button type="button" whileHover={{ scale:1.03 }} whileTap={{ scale:0.97 }}
                onClick={()=>handleDownloadPayslip(viewSlip)}
                style={{ display:"flex", alignItems:"center", gap:8, background:C.accent, color:"#fff",
                  border:"none", borderRadius:10, padding:"10px 22px", cursor:"pointer", fontSize:13, fontWeight:700 }}>
                <Download size={15} /> Download PDF
              </motion.button>
            </div>
          </Modal>
        )}
        {showLeave&&(
          <Modal title="Apply for Leave" onClose={()=>setShowLeave(false)}>
            <div style={{ marginBottom:16 }}>
              <label style={{ fontSize:13, fontWeight:600, display:"block", marginBottom:6 }}>Leave Type</label>
              <select value={leaveForm.type} onChange={e=>setLeaveForm({...leaveForm,type:e.target.value})}
                style={{ width:"100%", padding:"10px 14px", borderRadius:10, border:"1.5px solid "+C.border, fontSize:13, outline:"none", background:C.white, boxSizing:"border-box" }}>
                <option>Sick Leave</option><option>Casual Leave</option><option>Earned Leave</option>
              </select>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:16 }}>
              {[["From Date","from"],["To Date","to"]].map(([l,k])=>(
                <div key={k}>
                  <label style={{ fontSize:13, fontWeight:600, display:"block", marginBottom:6 }}>{l}</label>
                  <input type="date" value={leaveForm[k]} onChange={e=>setLeaveForm({...leaveForm,[k]:e.target.value})}
                    style={{ width:"100%", padding:"10px 12px", borderRadius:10, border:"1.5px solid "+C.border, fontSize:13, outline:"none", boxSizing:"border-box" }} />
                </div>
              ))}
            </div>
            <FormField label="Reason" value={leaveForm.reason} onChange={v=>setLeaveForm({...leaveForm,reason:v})} />
            <div style={{ display:"flex", gap:12 }}>
              <SaveBtn onClick={handleApplyLeave} label="Submit" />
              <CancelBtn onClick={()=>setShowLeave(false)} />
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}

export { TeacherSalary };