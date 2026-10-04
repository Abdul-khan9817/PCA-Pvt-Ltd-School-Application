import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, ChevronDown, Menu, LogOut, UserCircle } from "../../shared/ui";
import { C } from "../../shared/runtime";
import { Avatar } from "../common/Avatar";
import { NotificationPanel } from "./NotificationPanel";


function Topbar({ title, subtitle, userData, setPage, onLogout, onMenu, isMobile=false }) {
  const [t, setT] = useState(new Date());
  const [dropOpen, setDropOpen] = useState(false);
  const dropRef = useRef(null);
  useEffect(()=>{ const i=setInterval(()=>setT(new Date()),1000); return ()=>clearInterval(i); },[]);
  useEffect(()=>{
    const h=e=>{ if(dropRef.current&&!dropRef.current.contains(e.target)) setDropOpen(false); };
    document.addEventListener("mousedown",h);
    return ()=>document.removeEventListener("mousedown",h);
  },[]);
  const fmt=d=>d.toLocaleTimeString("en-US",{ hour:"2-digit", minute:"2-digit", second:"2-digit" });
  const fmtD=d=>d.toLocaleDateString("en-US",{ weekday:"short", year:"numeric", month:"short", day:"numeric" });
  const avatarSrc = userData.avatar ? ((userData.avatar.startsWith("http")?userData.avatar:(import.meta.env.VITE_API_URL||"http://localhost:5000/api").replace(/\/api\/?$/,"")+userData.avatar)) : "";
  const menuItems=[
    { icon:UserCircle, label:"My Profile", color:C.accent, action:()=>{ setPage("profile"); setDropOpen(false); } },
    { divider:true },
    { icon:LogOut, label:"Logout", color:C.red, action:()=>{ onLogout?.(); setDropOpen(false); } },
  ];
  return (
    // minHeight (not a fixed height) — on narrow screens the bar may need more than 64px,
    // so it grows. Mobile spacing rules live in responsive.css (.edumanage-topbar-*).
    <div className="edumanage-topbar" style={{ background:C.navy, padding: isMobile ? "10px 14px" : "0 28px",
      minHeight:64, display:"flex", alignItems:"center", justifyContent:"space-between",
      flexShrink:0, flexWrap:"nowrap", position:"relative", zIndex:200 }}>
      <div className="edumanage-topbar-left" style={{display:"flex",alignItems:"center",gap:isMobile?8:10,minWidth:0,flex:"1 1 auto",overflow:"hidden"}}>
        {isMobile&&<button type="button" className="edumanage-topbar-menu-btn" aria-label="Open navigation" onClick={onMenu} style={{width:38,height:38,border:0,borderRadius:9,background:"rgba(255,255,255,.1)",color:"#fff",display:"grid",placeItems:"center",cursor:"pointer",flexShrink:0}}><Menu size={19}/></button>}
        <div className="edumanage-topbar-title" style={{minWidth:0,overflow:"hidden"}}>
        <div className="edumanage-topbar-title-text" style={{ color:"#fff", fontWeight:700, fontSize:isMobile?15:18,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>{title}</div>
        {subtitle && (
          <div className="edumanage-topbar-subtitle" style={{ color:"rgba(255,255,255,.45)", fontSize:12,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>{subtitle}</div>
        )}
        </div>
      </div>
      <div className="edumanage-topbar-right" style={{ display:"flex", alignItems:"center", gap:isMobile?8:20, flexShrink:0, minWidth:0 }}>
        <div className="edumanage-topbar-tools" style={{ flexShrink:0, display:"flex", alignItems:"center", gap:isMobile?8:20 }}>
          <NotificationPanel userData={userData} />
          <div className="edumanage-topbar-clock" style={{ order:-1, textAlign:"right", flexShrink:0, display:"block", visibility:"visible", opacity:1, minWidth: isMobile ? 66 : 90 }}>
            <div style={{ color:"#fff", fontSize:isMobile?11:13, fontWeight:600, whiteSpace:"nowrap", fontVariantNumeric:"tabular-nums" }}>{fmt(t)}</div>
            <div style={{ color:"rgba(255,255,255,.45)", fontSize:isMobile?9:11, whiteSpace:"nowrap" }}>{fmtD(t)}</div>
          </div>
        </div>
        <div ref={dropRef} style={{ position:"relative", flexShrink:0 }}>
          <button type="button" className="edumanage-topbar-account" onClick={()=>setDropOpen(v=>!v)}
            aria-haspopup="menu" aria-expanded={dropOpen} aria-label={`Account menu for ${userData.name}`}
            style={{ display:"flex", flexDirection:"row", alignItems:"center", gap:isMobile?8:10, cursor:"pointer",
              userSelect:"none", padding: isMobile ? "4px" : "5px 10px", borderRadius:10, border:"none",
              background:dropOpen?"rgba(255,255,255,.12)":"transparent", transition:"background .15s" }}>
            {isMobile ? (
              <>
                {/* Avatar is vertically centered with the bell; the name hangs below it,
                    starting at the avatar's left edge and running to the right */}
                <div style={{ position:"relative", width:32, height:32, flexShrink:0 }}>
                  <Avatar name={userData.name} size={32} src={avatarSrc} />
                  <div style={{ position:"absolute", top:"calc(100% + 2px)", left:0,
                    maxWidth:70, color:"#fff", fontSize:9, fontWeight:600, lineHeight:1.2, textAlign:"left",
                    whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                    {userData.name}
                  </div>
                </div>
                <div style={{ color:"rgba(255,255,255,.7)", fontSize:11, fontWeight:600, whiteSpace:"nowrap", textTransform:"capitalize" }}>{userData.role}</div>
              </>
            ) : (
              <>
                <Avatar name={userData.name} size={34} src={avatarSrc} />
                <div className="edumanage-topbar-account-text">
                    <div style={{ color:"#fff", fontSize:13, fontWeight:600, whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>{userData.name}</div>
                    <div style={{ color:"rgba(255,255,255,.45)", fontSize:11, whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>{userData.role}</div>
                  </div>
                <motion.div className="edumanage-topbar-chevron" animate={{ rotate:dropOpen?180:0 }} transition={{ duration:0.2 }}>
                    <ChevronDown size={14} color="rgba(255,255,255,.5)" />
                </motion.div>
              </>
            )}
          </button>
          <AnimatePresence>
            {dropOpen&&(
              <motion.div initial={{ opacity:0, y:-8, scale:0.95 }} animate={{ opacity:1, y:0, scale:1 }}
                exit={{ opacity:0, y:-8, scale:0.95 }} transition={{ duration:0.15 }}
                style={{ position:"absolute", top:"calc(100% + 10px)", right:0,
                  width: isMobile ? "min(220px, 90vw)" : 220,
                  maxWidth:"calc(100vw - 16px)",
                  background:C.white, borderRadius:14, boxShadow:"0 12px 40px rgba(0,0,0,.18)",
                  overflow:"hidden", zIndex:999 }}>
                <div style={{ padding:"14px 16px",
                  background:"linear-gradient(135deg,#4f6ef7,#7c3aed)",
                  display:"flex", alignItems:"center", gap:12 }}>
                  <Avatar name={userData.name} size={40} src={avatarSrc} />
                  <div style={{minWidth:0,overflow:"hidden"}}>
                    <div style={{ color:"#fff", fontWeight:700, fontSize:13, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{userData.name}</div>
                    <div style={{ color:"rgba(255,255,255,.7)", fontSize:11, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{userData.email}</div>
                    <span style={{ display:"inline-block", marginTop:4,
                      background:"rgba(255,255,255,.2)", color:"#fff",
                      borderRadius:10, padding:"1px 8px", fontSize:10, fontWeight:600 }}>
                      {userData.role}
                    </span>
                  </div>
                </div>
                <div style={{ padding:"6px 0" }}>
                  {menuItems.map((item,idx)=>item.divider?(
                    <div key={idx} style={{ height:1, background:C.border, margin:"4px 0" }} />
                  ):(
                    <motion.button type="button" key={idx} whileHover={{ background:"#f4f6fb" }}
                      onClick={item.action}
                      style={{ width:"100%", display:"flex", alignItems:"center", gap:10,
                        padding:"10px 16px", background:"transparent", border:"none", cursor:"pointer", textAlign:"left" }}>
                      <div style={{ width:30, height:30, borderRadius:8,
                        background:item.color+"18", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                        <item.icon size={15} color={item.color} />
                      </div>
                      <span style={{ fontSize:13, fontWeight:500, color:C.text }}>{item.label}</span>
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

export { Topbar };