import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, LayoutDashboard, GraduationCap, Users, BookOpen, ClipboardCheck, ListChecks, Megaphone, Calendar, DollarSign, UserCircle, LogOut, Bell, Search, ChevronDown, TrendingUp, Star, AlertTriangle, Eye, Trash2, Edit, Plus, X, Check, Clock, BarChart2, Award, Briefcase, Mail, Phone, Shield, CheckSquare, Settings2, Home, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "../../shared/ui";
import { api } from "../../services/apiClient";
import { C, initials, avatarColors, avatarColor } from "../../shared/runtime";


import { onSocketEvent, onResourceChange } from "../../services/socket.service";

const timeAgo = (date) => {
  const t = new Date(date).getTime();
  if (!t) return "";
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 60) return "Just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hour${h > 1 ? "s" : ""} ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} day${d > 1 ? "s" : ""} ago`;
  return new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
};

const typeStyle = (type) => {
  switch ((type || "").toLowerCase()) {
    case "announcement": return { icon:"📢", color:"#eef2ff", dot:C.accent };
    case "attendance":   return { icon:"✅", color:"#d1fae5", dot:C.teal };
    case "salary":       return { icon:"💰", color:"#fef3c7", dot:C.orange };
    case "fees":
    case "fee":          return { icon:"💳", color:"#fef3c7", dot:C.orange };
    case "grade":
    case "marks":        return { icon:"📝", color:"#ede9fe", dot:C.accent };
    default:             return { icon:"🔔", color:"#f1f5f9", dot:C.accent };
  }
};

const fmtTime = (d) => new Date(d || Date.now()).toLocaleTimeString("en-US", { hour:"2-digit", minute:"2-digit" });

function NotificationPanel({ userData }) {
  const [open, setOpen]     = useState(false);
  const [tab, setTab]       = useState("notifications"); // "notifications" | "messages"
  const [messages, setMessages]   = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [input, setInput]   = useState("");
  const [chats, setChats]   = useState({});
  const [notifications, setNotifications] = useState([]);
  const [, setTick] = useState(0); // re-render every minute so "x min ago" stays fresh
  const panelRef = useRef(null);
  const popupRef = useRef(null);
  const chatEndRef = useRef(null);

  const chatKey = (m) => m?.fromId || m?.id;

  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    api.get("/notifications")
      .then(r => setNotifications(r.data || []))
      .catch(() => {});

    api.get("/messages/inbox")
      .then(r => {
        const list = (r.data || []).map(m => ({
          id: m._id,
          from: m.from?.name || "User",
          fromId: m.from?._id,
          role: m.from?.role || "",
          avatar: initials(m.from?.name || "U"),
          text: m.text,
          time: fmtTime(m.createdAt),
          unread: false,
        }));
        setMessages(list);
        setChats(prev => {
          const next = { ...prev };
          list.slice().reverse().forEach(m => {
            const k = chatKey(m);
            const arr = next[k] || [];
            if (!arr.some(x => x.id === m.id)) next[k] = [...arr, { ...m, mine:false }];
          });
          return next;
        });
      })
      .catch(() => {});

    const unsubMsg = onSocketEvent("message:new", (newMsg) => {
      const formatted = {
        id: newMsg._id,
        from: newMsg.from?.name || "User",
        fromId: newMsg.from?._id || newMsg.from,
        role: newMsg.from?.role || "",
        avatar: initials(newMsg.from?.name || "U"),
        text: newMsg.text,
        time: fmtTime(newMsg.createdAt),
        unread: true,
      };
      setMessages(prev => [formatted, ...prev.filter(m => m.id !== formatted.id)]);
      const k = chatKey(formatted);
      if (k) {
        setChats(prev => {
          const arr = prev[k] || [];
          if (arr.some(x => x.id === formatted.id)) return prev;
          return { ...prev, [k]: [...arr, { ...formatted, mine:false }] };
        });
      }
    });

    const unsubNotif = onResourceChange("notifications", (change) => {
      if (change.action === "create" && change.data) {
        setNotifications(prev => [change.data, ...prev.filter(n => n._id !== change.data._id)]);
      }
    });

    return () => {
      unsubMsg?.();
      unsubNotif?.();
    };
  }, []);

  const unreadNotifs = notifications.filter(n => !n.read).length;
  const unreadMsgs   = messages.filter(m => m.unread).length;
  const unreadCount  = unreadNotifs + unreadMsgs;

  useEffect(() => {
    const h = e => {
      const insideBell = panelRef.current && panelRef.current.contains(e.target);
      const insidePopup = popupRef.current && popupRef.current.contains(e.target);
      if (!insideBell && !insidePopup) { setOpen(false); setActiveChat(null); }
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  useEffect(() => {
    if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: "smooth" });
  }, [activeChat, chats]);

  const openChat = (msg) => {
    setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, unread: false } : m));
    const k = chatKey(msg);
    setChats(prev => {
      const arr = prev[k] || [];
      if (arr.some(x => x.id === msg.id)) return prev;
      return { ...prev, [k]: [...arr, { ...msg, mine:false }] };
    });
    setActiveChat(msg);
    setTab("messages");
  };

  const sendMessage = async () => {
    if (!input.trim() || !activeChat) return;
    try {
      const r = await api.post("/messages", { to: activeChat.fromId, text: input.trim() });
      const newMsg = { id: r.data._id, from: userData.name, text: input.trim(), time: fmtTime(), mine: true };
      const k = chatKey(activeChat);
      setChats(prev => ({ ...prev, [k]: [...(prev[k] || []), newMsg] }));
      setInput("");
    } catch (e) { console.error(e); }
  };

  const handleKey = e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } };

  const markRead = async (n) => {
    if (n.read) return;
    setNotifications(prev => prev.map(x => x._id === n._id ? { ...x, read:true } : x));
    try { await api.patch(`/notifications/${n._id}/read`, {}); }
    catch (e) { setNotifications(prev => prev.map(x => x._id === n._id ? { ...x, read:false } : x)); }
  };

  const markAllRead = async () => {
    const unread = notifications.filter(n => !n.read);
    setNotifications(prev => prev.map(n => ({ ...n, read:true })));
    await Promise.all(unread.map(n => api.patch(`/notifications/${n._id}/read`, {}).catch(() => null)));
  };

  const emptyBox = (icon, text) => (
    <div style={{ padding:"40px 20px", textAlign:"center", color:C.muted }}>
      <div style={{ fontSize:30, marginBottom:8 }}>{icon}</div>
      <div style={{ fontSize:13 }}>{text}</div>
    </div>
  );

  return (
    <div ref={panelRef} style={{ position:"relative" }}>
      {/* Bell button */}
      <motion.button type="button" whileHover={{ scale:1.05 }} whileTap={{ scale:0.95 }}
        onClick={() => { setOpen(o => !o); setActiveChat(null); }}
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
        style={{ background:"rgba(255,255,255,.1)", border:"none", borderRadius:10,
          width:36, height:36, display:"flex", alignItems:"center", justifyContent:"center",
          cursor:"pointer", position:"relative" }}>
        <Bell size={16} color="rgba(255,255,255,.8)" />
        {unreadCount > 0 && (
          <motion.span initial={{ scale:0 }} animate={{ scale:1 }}
            style={{ position:"absolute", top:4, right:4, width:16, height:16, borderRadius:"50%",
              background:C.red, border:"2px solid "+C.navy,
              fontSize:9, fontWeight:700, color:"#fff",
              display:"flex", alignItems:"center", justifyContent:"center" }}>
            {unreadCount > 9 ? "9+" : unreadCount}
          </motion.span>
        )}
      </motion.button>

      {/* Panel — rendered on document.body so it opens centered on the page */}
      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div ref={popupRef}
              initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} transition={{ duration:0.18 }}
              onClick={e => { if (e.target === e.currentTarget) { setOpen(false); setActiveChat(null); } }}
              style={{ position:"fixed", top:0, left:0, right:0, bottom:0, zIndex:9999,
                background:"rgba(15,23,42,.45)", display:"flex", alignItems:"center",
                justifyContent:"center", padding:12, boxSizing:"border-box" }}>
              <motion.div initial={{ opacity:0, y:-10, scale:0.96 }} animate={{ opacity:1, y:0, scale:1 }}
                exit={{ opacity:0, y:-10, scale:0.96 }} transition={{ duration:0.18 }}
                style={{ width:"min(380px, 100%)", maxHeight:"100%", overflowY:"auto",
                  background:C.white, borderRadius:16, boxShadow:"0 16px 48px rgba(0,0,0,.18)" }}>

                {/* Header */}
                <div style={{ background:"linear-gradient(135deg,#1e2a4a,#2d3f6e)", padding:"16px 20px" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
                    <div style={{ color:"#fff", fontWeight:700, fontSize:15 }}>
                      {activeChat ? (
                        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                          <motion.button type="button" whileHover={{ scale:1.1 }} onClick={() => setActiveChat(null)}
                            style={{ background:"rgba(255,255,255,.15)", border:"none", borderRadius:8,
                              width:28, height:28, cursor:"pointer", color:"#fff", fontSize:14,
                              display:"flex", alignItems:"center", justifyContent:"center" }}>
                            ←
                          </motion.button>
                          {activeChat.from}
                        </div>
                      ) : tab === "notifications" ? "Notifications" : "Messages"}
                    </div>
                    <button type="button" onClick={() => { setOpen(false); setActiveChat(null); }}
                      style={{ background:"rgba(255,255,255,.15)", border:"none", borderRadius:8,
                        width:28, height:28, cursor:"pointer", color:"#fff", fontSize:14,
                        display:"flex", alignItems:"center", justifyContent:"center" }}>
                      ✕
                    </button>
                  </div>

                  {/* Tabs */}
                  {!activeChat && (
                    <div style={{ display:"flex", gap:6 }}>
                      {[["notifications","🔔 Notifications", unreadNotifs],["messages","💬 Messages", unreadMsgs]].map(([key,label,count])=>(
                        <motion.button type="button" key={key} whileHover={{ scale:1.03 }} onClick={() => setTab(key)}
                          style={{ flex:1, padding:"7px 10px", borderRadius:8, border:"none", cursor:"pointer",
                            fontWeight:600, fontSize:12,
                            background:tab===key?"rgba(255,255,255,.25)":"rgba(255,255,255,.08)",
                            color:"#fff" }}>
                          {label}
                          {count>0 && (
                            <span style={{ marginLeft:6, background:C.red, borderRadius:10,
                              padding:"1px 6px", fontSize:10 }}>
                              {count}
                            </span>
                          )}
                        </motion.button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Notifications list (real data only) */}
                {!activeChat && tab === "notifications" && (
                  <div style={{ maxHeight:360, overflowY:"auto" }}>
                    {notifications.length === 0 && emptyBox("🔔", "No notifications yet")}
                    {notifications.map((n,i) => {
                      const st = typeStyle(n.type);
                      const body = n.message || n.text || n.title || "";
                      return (
                        <motion.div key={n._id || i} onClick={() => markRead(n)} whileHover={{ background:"#f8fafc" }}
                          style={{ display:"flex", gap:12, padding:"14px 18px",
                            borderBottom:i<notifications.length-1?"1px solid "+C.border:"none",
                            cursor:"pointer", background:n.read?C.white:"#fafbff" }}>
                          <div style={{ width:38, height:38, borderRadius:10, background:st.color, flexShrink:0,
                            display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>
                            {st.icon}
                          </div>
                          <div style={{ flex:1, minWidth:0 }}>
                            {n.title && n.message && (
                              <div style={{ fontSize:13, color:C.text, fontWeight:700, lineHeight:1.4 }}>{n.title}</div>
                            )}
                            <div style={{ fontSize:13, color:C.text, fontWeight:n.title&&n.message?400:500, lineHeight:1.4 }}>
                              {n.title && n.message ? n.message : body}
                            </div>
                            <div style={{ fontSize:11, color:C.muted, marginTop:4 }}>{timeAgo(n.createdAt)}</div>
                          </div>
                          {!n.read && (
                            <div style={{ width:8, height:8, borderRadius:"50%", background:st.dot, flexShrink:0, marginTop:4 }} />
                          )}
                        </motion.div>
                      );
                    })}
                  </div>
                )}

                {/* Messages list */}
                {!activeChat && tab === "messages" && (
                  <div style={{ maxHeight:360, overflowY:"auto" }}>
                    {messages.length === 0 && emptyBox("💬", "No messages yet")}
                    {messages.map((msg,i) => (
                      <motion.div key={msg.id} whileHover={{ background:"#f8fafc" }}
                        onClick={() => openChat(msg)}
                        style={{ display:"flex", gap:12, padding:"14px 18px",
                          borderBottom:i<messages.length-1?"1px solid "+C.border:"none",
                          cursor:"pointer", background:msg.unread?"#fafbff":C.white }}>
                        <div style={{ width:40, height:40, borderRadius:"50%", background:avatarColor(msg.from),
                          display:"flex", alignItems:"center", justifyContent:"center",
                          color:"#fff", fontSize:13, fontWeight:700, flexShrink:0 }}>
                          {initials(msg.from)}
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                            <span style={{ fontSize:13, fontWeight:msg.unread?700:600, color:C.text }}>{msg.from}</span>
                            <span style={{ fontSize:10, color:C.muted }}>{msg.time}</span>
                          </div>
                          <div style={{ fontSize:11, color:C.muted, marginTop:2,
                            whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                            {msg.text}
                          </div>
                        </div>
                        {msg.unread && (
                          <div style={{ width:8, height:8, borderRadius:"50%", background:C.accent, flexShrink:0, marginTop:6 }} />
                        )}
                      </motion.div>
                    ))}
                  </div>
                )}

                {/* Chat window */}
                {activeChat && (
                  <div style={{ display:"flex", flexDirection:"column", height:380 }}>
                    <div style={{ flex:1, overflowY:"auto", padding:"14px 16px", display:"flex", flexDirection:"column", gap:10 }}>
                      {(chats[chatKey(activeChat)]||[]).map((msg, i) => (
                        <div key={msg.id || i} style={{ display:"flex", justifyContent:msg.mine?"flex-end":"flex-start" }}>
                          {!msg.mine && (
                            <div style={{ width:28, height:28, borderRadius:"50%", background:avatarColor(msg.from),
                              display:"flex", alignItems:"center", justifyContent:"center",
                              color:"#fff", fontSize:10, fontWeight:700, flexShrink:0, marginRight:8, alignSelf:"flex-end" }}>
                              {initials(msg.from)}
                            </div>
                          )}
                          <div style={{ maxWidth:"72%" }}>
                            <div style={{
                              background:msg.mine?"linear-gradient(135deg,#4f6ef7,#7c3aed)":"#f0f2f8",
                              color:msg.mine?"#fff":C.text,
                              borderRadius:msg.mine?"16px 16px 4px 16px":"16px 16px 16px 4px",
                              padding:"9px 13px", fontSize:13, lineHeight:1.4
                            }}>
                              {msg.text}
                            </div>
                            <div style={{ fontSize:10, color:C.muted, marginTop:3,
                              textAlign:msg.mine?"right":"left" }}>
                              {msg.time}
                            </div>
                          </div>
                        </div>
                      ))}
                      <div ref={chatEndRef} />
                    </div>

                    <div style={{ padding:"10px 14px", borderTop:"1px solid "+C.border,
                      display:"flex", gap:8, alignItems:"center" }}>
                      <input
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={handleKey}
                        placeholder={`Message ${activeChat.from}…`}
                        style={{ flex:1, padding:"9px 14px", borderRadius:20,
                          border:"1.5px solid "+C.border, fontSize:13, outline:"none",
                          background:"#f8fafc" }}
                      />
                      <motion.button type="button" whileHover={{ scale:1.05 }} whileTap={{ scale:0.95 }}
                        onClick={sendMessage}
                        disabled={!input.trim()}
                        style={{ width:36, height:36, borderRadius:"50%", border:"none",
                          background:input.trim()?C.accent:"#e5e7eb",
                          color:"#fff", cursor:input.trim()?"pointer":"default",
                          display:"flex", alignItems:"center", justifyContent:"center",
                          fontSize:16, transition:"background .15s" }}>
                        ➤
                      </motion.button>
                    </div>
                  </div>
                )}

                {/* Footer */}
                {!activeChat && tab === "notifications" && unreadNotifs > 0 && (
                  <div style={{ padding:"10px 18px", borderTop:"1px solid "+C.border,
                    background:"#fafafa", textAlign:"center" }}>
                    <span onClick={markAllRead} style={{ fontSize:12, color:C.accent, cursor:"pointer", fontWeight:600 }}>
                      Mark all as read
                    </span>
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}

export { NotificationPanel };