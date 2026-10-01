import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, LayoutDashboard, GraduationCap, Users, BookOpen, ClipboardCheck, ListChecks, Megaphone, Calendar, DollarSign, UserCircle, LogOut, Bell, Search, ChevronDown, TrendingUp, Star, AlertTriangle, Eye, Trash2, Edit, Plus, X, Check, Clock, BarChart2, Award, Briefcase, Mail, Phone, Shield, CheckSquare, Settings2, Home, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "../../shared/ui";
import { C } from "../../shared/runtime";
import { CancelBtn } from "../../components/common/CancelBtn";
import { FormField } from "../../components/common/FormField";
import { Modal } from "../../components/common/Modal";
import { SaveBtn } from "../../components/common/SaveBtn";
import { list, create, update, remove } from "../../services/resource.service";
import { me } from "../../services/auth.service";
import { onResourceChange } from "../../services/socket.service";

function Announcements({ role }) {
  const notices=[];
  const [showAdd, setShowAdd] = useState(false);
  const [selected,setSelected]=useState(null);
  const [editing,setEditing]=useState(null);
  const [items,setItems]=useState(notices);
  const [form,setForm]=useState({title:"",content:"",priority:"Medium"});
  const [error,setError]=useState("");

  const mapNotice = x => ({
    id: x._id || x.id,
    title: x.title,
    content: x.content,
    date: x.publishedAt ? new Date(x.publishedAt).toLocaleDateString() : new Date().toLocaleDateString(),
    priority: x.priority || "Medium"
  });

  const loadAnnouncements = () => {
    list("announcements","limit=100")
      .then(r=>setItems((r.data||r||[]).map(mapNotice)))
      .catch(()=>{});
  };

  useEffect(()=>{
    loadAnnouncements();
    const unsub = onResourceChange("announcements", change => {
      if (change.action === "create") {
        setItems(prev => {
          const mapped = mapNotice(change.data);
          if (prev.some(x => x.id === mapped.id)) return prev;
          return [mapped, ...prev];
        });
      } else if (change.action === "update") {
        setItems(prev => prev.map(x => (x.id === (change.data?._id || change.id) ? { ...x, ...mapNotice(change.data) } : x)));
      } else if (change.action === "delete") {
        setItems(prev => prev.filter(x => x.id !== change.id && x.id !== change.data?._id));
      }
    });
    return () => unsub?.();
  },[]);
  return (
    <div style={{ padding:28 }}>{error&&<div style={{color:C.red,fontSize:13,marginBottom:12}}>{error}</div>}
      <div style={{ background:C.white, borderRadius:14, padding:22, boxShadow:"0 2px 8px rgba(0,0,0,.06)" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
          <div style={{ fontWeight:700, fontSize:16 }}>{role==="admin"?"All Announcements":"My Announcements"}</div>
          {role==="admin"&&(
            <motion.button type="button" whileHover={{ scale:1.05 }} onClick={()=>{setEditing(null);setForm({title:"",content:"",priority:"Medium"});setError("");setShowAdd(true)}}
              style={{ display:"flex", alignItems:"center", gap:6, background:C.accent, color:"#fff",
                border:"none", borderRadius:10, padding:"9px 16px", cursor:"pointer", fontSize:13, fontWeight:600 }}>
              <Plus size={15} /> New Announcement
            </motion.button>
          )}
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          {items.map(n=>(
            <motion.div key={n.id} whileHover={{ scale:1.01 }}
              onClick={()=>setSelected(n)}
              style={{ background:"#f9fafb", borderRadius:12, padding:"16px 20px", border:"1px solid "+C.border, cursor:"pointer" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:600, fontSize:14, marginBottom:6 }}>{n.title}</div>
                  {n.content&&<div style={{ fontSize:12, color:C.muted, marginBottom:8 }}>{n.content}</div>}
                  <div style={{ fontSize:11, color:C.muted }}>{n.date}</div>
                </div>
                <span style={{ background:n.priority==="High"?"#fee2e2":n.priority==="Medium"?"#fef3c7":"#e0e7ff",
                  color:n.priority==="High"?C.red:n.priority==="Medium"?C.orange:C.accent,
                  borderRadius:20, padding:"3px 10px", fontSize:11, fontWeight:600, whiteSpace:"nowrap" }}>
                  {n.priority}
                </span>
              </div>
              {role==="admin"&&n.id&&<div style={{display:"flex",gap:8,marginTop:12}} onClick={e=>e.stopPropagation()}>
                <button type="button" onClick={()=>{setEditing(n);setForm({title:n.title,content:n.content||"",priority:n.priority});}} style={{border:0,borderRadius:8,padding:"6px 10px",background:"#eef2ff",color:C.accent,cursor:"pointer",fontSize:12,fontWeight:700}}>Edit</button>
                <button type="button" onClick={async()=>{if(!window.confirm("Delete this announcement?"))return;try{await remove("announcements",n.id);setItems(prev=>prev.filter(x=>x.id!==n.id));}catch(e){setError(e.message);}}} style={{border:0,borderRadius:8,padding:"6px 10px",background:"#fee2e2",color:C.red,cursor:"pointer",fontSize:12,fontWeight:700}}>Delete</button>
              </div>}
            </motion.div>
          ))}
        </div>
      </div>
      <AnimatePresence>
        {(showAdd||editing)&&(
          <Modal title={editing?"Edit Announcement":"New Announcement"} onClose={()=>{setShowAdd(false);setEditing(null);}}>
            <FormField label="Title" value={form.title} onChange={v=>setForm({...form,title:v})} />
            <div style={{ marginBottom:16 }}>
              <label style={{ fontSize:13, fontWeight:600, display:"block", marginBottom:6 }}>Content</label>
              <textarea value={form.content} onChange={e=>setForm({...form,content:e.target.value})} rows={4} placeholder="Enter content..."
                style={{ width:"100%", padding:"10px 14px", borderRadius:10, border:"1.5px solid "+C.border,
                  fontSize:13, outline:"none", boxSizing:"border-box", fontFamily:"inherit", resize:"none" }} />
            </div>
            <div style={{ marginBottom:20 }}>
              <label style={{ fontSize:13, fontWeight:600, display:"block", marginBottom:6 }}>Priority</label>
              <select value={form.priority} onChange={e=>setForm({...form,priority:e.target.value})} style={{ width:"100%", padding:"10px 14px", borderRadius:10, border:"1.5px solid "+C.border,
                fontSize:13, outline:"none", background:C.white, boxSizing:"border-box" }}>
                <option>High</option><option>Medium</option><option>Low</option>
              </select>
            </div>
            <div style={{ display:"flex", gap:12 }}>
              <SaveBtn onClick={async()=>{if(!form.title){setError("Title is required");return;}try{if(editing){const r=await update("announcements",editing.id,{title:form.title,content:form.content,priority:form.priority});const d=r.data;setItems(prev=>prev.map(x=>x.id===editing.id?{...x,title:d.title,content:d.content,priority:d.priority}:x));setEditing(null);}else{const u=await me();const r=await create("announcements",{title:form.title,content:form.content,priority:form.priority,audience:["admin","principal","vice_principal","teacher","student","parent"],publishedBy:u._id});setItems(prev=>[{id:r.data._id,title:r.data.title,content:r.data.content,date:new Date().toLocaleDateString(),priority:r.data.priority},...prev]);}setForm({title:"",content:"",priority:"Medium"});setShowAdd(false);setError("");}catch(e){setError(e.message);}}} label={editing?"Save Changes":"Publish"} />
              <CancelBtn onClick={()=>{setShowAdd(false);setEditing(null);setForm({title:"",content:"",priority:"Medium"});}} />
            </div>
          </Modal>
        )}
        {selected&&(<Modal title="Announcement" onClose={()=>setSelected(null)}>
          <div style={{fontSize:20,fontWeight:800,color:C.text,marginBottom:8}}>{selected.title}</div>
          <div style={{fontSize:12,color:C.muted,marginBottom:16}}>{selected.date} · {selected.priority}</div>
          <div style={{fontSize:14,lineHeight:1.7,color:C.text,whiteSpace:'pre-wrap'}}>{selected.content||'No additional details.'}</div>
          <div style={{display:'flex',justifyContent:'flex-end',marginTop:20}}><CancelBtn onClick={()=>setSelected(null)} label="Close"/></div>
        </Modal>)}
      </AnimatePresence>
    </div>
  );
}

export { Announcements };
