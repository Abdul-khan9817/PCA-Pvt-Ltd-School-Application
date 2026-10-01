import { useState, useEffect } from "react";
import {
  BarChart2,
  Star,
  AlertTriangle,
  Calendar,
  AnimatePresence,
} from "../../shared/ui";
import { C, ROW_COLORS } from "../../shared/runtime";
import { StatCard } from "../../components/common/StatCard";
import { MonthPicker } from "../../components/common/MonthPicker";
import { api } from "../../services/apiClient";
import { onResourceChange } from "../../services/socket.service";

function AdminAttendance() {
  const [attendance, setAttendance] = useState([]);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [dateRange, setDateRange] = useState(null);

  const fetchAttendance = (fromDate = null, toDate = null) => {
    const params = new URLSearchParams();
    if (fromDate) params.append('from', fromDate);
    if (toDate) params.append('to', toDate);

    Promise.all([
      api.get("/students?limit=100"),
      api.get(`/attendance?${params.toString()}`)
    ]).then(([studentsRes, attRes]) => {
      const students = studentsRes.data || [];
      const records = attRes.data || [];
      const studentStats = students.map(s => {
        const sAtt = records.filter(r => (r.student?._id || r.student) === s._id);
        const present = sAtt.filter(r => r.status === "Present").length;
        const absent = sAtt.filter(r => r.status === "Absent").length;
        const late = sAtt.filter(r => r.status === "Late").length;
        const total = sAtt.length;
        const pct = total > 0 ? Math.round((present / total) * 100) : 0;

        let cls = "—";
        if (s.classId && s.classId.name) {
          cls = s.classId.name;
          if (s.classId.section) {
            cls = cls + "-" + s.classId.section;
          }
        }

        return {
          id: s._id,
          name: s.user?.name || "Student",
          roll: s.roll || "—",
          cls: cls,
          total: total,
          present: present,
          absent: absent,
          late: late,
          pct: pct
        };
      });
      setAttendance(studentStats);
    }).catch(() => {});
  };

  useEffect(() => {
    fetchAttendance();
    const unsubAtt = onResourceChange("attendance", () => {
      const from = dateRange?.fromDate;
      const to = dateRange?.toDate;
      fetchAttendance(from, to);
    });
    const unsubStudents = onResourceChange("students", () => {
      const from = dateRange?.fromDate;
      const to = dateRange?.toDate;
      fetchAttendance(from, to);
    });
    return () => {
      unsubAtt?.();
      unsubStudents?.();
    };
  }, [dateRange]);

  const avgPct = attendance.length
    ? Math.round(attendance.reduce((a, b) => a + b.pct, 0) / attendance.length)
    : 0;
  const perfectCount = attendance.filter(s => s.pct >= 95).length;
  const lowCount = attendance.filter(s => s.pct < 75).length;

  return (
    <div style={{ padding: 28, display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
        <StatCard stat={{
          label: "Average Attendance",
          value: avgPct + "%",
          icon: "BarChart2",
          color: "rgb(109, 78, 246)",
          gradient: "linear-gradient(135deg, rgb(59, 174, 198), rgb(32, 142, 176))"
        }} />
        <StatCard stat={{
          label: "Perfect Attendance (≥95%)",
          value: perfectCount,
          icon: "Star",
          color: "rgb(20, 184, 166)",
          gradient: "linear-gradient(135deg, rgb(16, 185, 129), rgb(5, 150, 105))"
        }} />
        <StatCard stat={{
          label: "Low Attendance (<75%)",
          value: lowCount,
          icon: "AlertTriangle",
          color: "rgb(239, 68, 68)",
          gradient: "linear-gradient(135deg, rgb(239, 101, 71), rgb(220, 38, 38))"
        }} />
      </div>

      <div style={{ background: C.white, borderRadius: 14, padding: 22, boxShadow: "0 2px 8px rgba(0,0,0,.06)" }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Student Attendance Records</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {dateRange && (
              <div style={{ fontSize: 13, color: C.muted }}>
                <span style={{ fontWeight: 600, color: C.dark }}>{dateRange.label}</span>
              </div>
            )}
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setShowMonthPicker(!showMonthPicker)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  background: C.accent,
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  padding: '8px 14px',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}>
                <Calendar size={16} /> Filter by Month
              </button>
              <AnimatePresence>
                {showMonthPicker && (
                  <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 8, zIndex: 1000 }}>
                    <MonthPicker
                      onSelect={(range) => setDateRange(range)}
                      onClose={() => setShowMonthPicker(false)}
                    />
                  </div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <table className="rtable" style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f8fafc" }}>
              {["STUDENT", "CLASS", "TOTAL DAYS", "PRESENT", "ABSENT", "LATE", "PERCENTAGE"].map(h => (
                <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: C.muted }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {attendance.map((s, i) => (
              <tr key={s.roll} style={{ background: ROW_COLORS[i % ROW_COLORS.length], borderBottom: "1px solid " + C.border }}>
                <td className="rtable-full" style={{ padding: "12px 14px" }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{s.name}</div>
                  <div style={{ fontSize: 11, color: C.muted }}>{s.roll}</div>
                </td>
                <td data-label="Class" style={{ padding: "12px 14px", fontSize: 13 }}>{s.cls}</td>
                <td data-label="Total Days" style={{ padding: "12px 14px", fontSize: 13 }}>{s.total}</td>
                <td data-label="Present" style={{ padding: "12px 14px" }}>
                  <span style={{ background: "#d1fae5", color: C.teal, borderRadius: 20, padding: "2px 10px", fontSize: 12, fontWeight: 700 }}>{s.present}</span>
                </td>
                <td data-label="Absent" style={{ padding: "12px 14px" }}>
                  <span style={{ background: "#fee2e2", color: C.red, borderRadius: 20, padding: "2px 10px", fontSize: 12, fontWeight: 700 }}>{s.absent}</span>
                </td>
                <td data-label="Late" style={{ padding: "12px 14px" }}>
                  <span style={{ background: "#fef3c7", color: C.orange, borderRadius: 20, padding: "2px 10px", fontSize: 12, fontWeight: 700 }}>{s.late}</span>
                </td>
                <td data-label="Percentage" style={{ padding: "12px 14px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ flex: 1, height: 6, borderRadius: 3, background: "#e5e7eb" }}>
                      <div style={{ width: s.pct + "%", height: "100%", borderRadius: 3, background: s.pct >= 90 ? C.teal : s.pct >= 75 ? C.orange : C.red }} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700 }}>{s.pct}%</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}

export { AdminAttendance };
