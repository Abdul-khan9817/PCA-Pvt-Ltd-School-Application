import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, LayoutDashboard, GraduationCap, Users, BookOpen, ClipboardCheck, ListChecks, Megaphone, Calendar, DollarSign, UserCircle, LogOut, Bell, Search, ChevronDown, TrendingUp, Star, AlertTriangle, Eye, Trash2, Edit, Plus, X, Check, Clock, BarChart2, Award, Briefcase, Mail, Phone, Shield, CheckSquare, Settings2, Home, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "../../shared/ui";
import { C } from "../../shared/runtime";
import { StatCard } from "../../components/common/StatCard";
import { api } from "../../services/apiClient";
import { onResourceChange } from "../../services/socket.service";

function TeacherDashboard() {
  const [stats, setStats] = useState([]);
  const [classes, setClasses] = useState([]);
  const [classStudentCounts, setClassStudentCounts] = useState({});

  const loadClasses = () => {
    api.get("/classes?limit=100")
      .then(classesRes => {
        setClasses(classesRes.data || classesRes || []);
      })
      .catch(() => {});
  };

  const fetchStats = () => {
    api.get("/dashboard/stats").then(res => {
      if (res.data) {
        const d = res.data;
        setClassStudentCounts(Object.fromEntries((d.classStudentCounts || []).map(item => [String(item._id), item.count])));
        setStats([
          { label: "My Classes", val: String(d.classes || 0), change: "Active", up: true, color: C.accent, icon: "BookOpen" },
          { label: "Total Students", val: String(d.students || 0), change: "Enrolled", up: true, color: C.teal, icon: "GraduationCap" },
          { label: "Assignments", val: String(d.assignments || 0), change: "Active", up: true, color: C.orange, icon: "CheckSquare" },
          { label: "Avg Attendance", val: `${typeof d.attendance === "object" ? d.attendance.percentage || 0 : d.attendance && d.students ? Math.min(100, Math.round((d.attendance / (d.students * 3)) * 100)) : 0}%`, change: typeof d.attendance === "object" ? (d.attendance.total ? "Recorded" : "No records") : d.attendance ? "Recorded" : "No records", up: true, color: C.purple, icon: "ClipboardCheck" },
        ]);
      }
    }).catch(() => {});
  };

  useEffect(() => {
    fetchStats();
    loadClasses();
    const unsubStudents = onResourceChange("students", () => { fetchStats(); loadClasses(); });
    const unsubClasses = onResourceChange("classes", () => { fetchStats(); loadClasses(); });
    const unsubAtt = onResourceChange("attendance", () => fetchStats());

    return () => {
      unsubStudents?.();
      unsubClasses?.();
      unsubAtt?.();
    };
  }, []);

  const chartData = classes.slice(0, 6).map(cls => ({
    name: cls.section ? `${cls.name}-${cls.section}` : cls.name,
    val: classStudentCounts[String(cls._id || cls.id)] || 0
  }));

  return (
    <div style={{ padding:28, display:"flex", flexDirection:"column", gap:24 }}>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,minmax(0,1fr))", gridAutoRows:"1fr", alignItems:"stretch", gap:16 }}>
        {stats.map(s=><StatCard key={s.label} stat={s} />)}
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20 }}>
        <div style={{ background:C.white, borderRadius:14, padding:22, boxShadow:"0 2px 8px rgba(0,0,0,.06)" }}>
          <div style={{ fontWeight:700, fontSize:16, marginBottom:18 }}>Class Performance</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} barSize={36}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize:11 }} axisLine={false} tickLine={false} />
              <YAxis domain={[0,100]} tick={{ fontSize:11, fill:C.muted }} axisLine={false} tickLine={false} />
              <Tooltip />
              <Bar dataKey="val" radius={[6,6,0,0]} fill={C.accent} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div style={{ background:C.white, borderRadius:14, padding:22, boxShadow:"0 2px 8px rgba(0,0,0,.06)" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
            <div style={{ fontWeight:700, fontSize:16 }}>Today's Schedule</div>
            <span style={{ background:"#eef2ff", color:C.accent, borderRadius:20, padding:"4px 12px", fontSize:12, fontWeight:600 }}>
              {new Date().toLocaleDateString("en-US",{ weekday:"long" })}
            </span>
          </div>
          <div style={{ color:C.muted, fontSize:13, textAlign:"center", padding:"24px 0" }}>
            No schedule data available
          </div>
        </div>
      </div>
    </div>
  );
}

export { TeacherDashboard };
