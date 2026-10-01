import { useState, useEffect } from "react";
import { C, ROW_COLORS } from "../../shared/runtime";
import { Calendar, AnimatePresence } from "../../shared/ui";
import { MonthPicker } from "../../components/common/MonthPicker";
import { api } from "../../services/apiClient";
import { onResourceChange } from "../../services/socket.service";

function StudentAttendance() {
  const [attData, setAttData] = useState([]);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [dateRange, setDateRange] = useState(null);

  const mapAttendance = a => ({
    id: a._id || a.id,
    date: a.date ? new Date(a.date).toLocaleDateString() : new Date().toLocaleDateString(),
    status: a.status || "Present"
  });

  const loadAttendance = (fromDate = null, toDate = null) => {
    const params = new URLSearchParams();
    if (fromDate) params.append('from', fromDate);
    if (toDate) params.append('to', toDate);
    
    api.get(`/attendance?limit=100&${params.toString()}`).then(res => {
      const list = res.data || res || [];
      setAttData(list.map(mapAttendance));
    }).catch(() => {});
  };

  useEffect(() => {
    loadAttendance();
    const unsub = onResourceChange("attendance", () => {
      const from = dateRange?.fromDate;
      const to = dateRange?.toDate;
      loadAttendance(from, to);
    });
    return () => unsub?.();
  }, [dateRange]);

  const presentCount = attData.filter(a => a.status === "Present").length;
  const percentage = attData.length ? ((presentCount / attData.length) * 100).toFixed(0) : "0";

  return (
    <div style={{ padding:28 }}>
      <div style={{ background:C.white, borderRadius:14, padding:22, boxShadow:"0 2px 8px rgba(0,0,0,.06)" }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize:28, fontWeight:800, color:C.accent }}>{percentage}%</div>
            <div style={{ fontSize:13, color:C.muted, marginTop:4 }}>Attendance Rate ({presentCount}/{attData.length} recorded days)</div>
          </div>
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
        <div style={{ display:"flex", height:8, borderRadius:4, background:"#e5e7eb", marginBottom:20, overflow:"hidden" }}>
          <div style={{ width:`${percentage}%`, background:Number(percentage)>=75?C.teal:C.orange }} />
        </div>
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <table className="rtable" style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead><tr style={{ background:"#f8fafc" }}>
            <th style={{ padding:"10px 14px", textAlign:"left", fontSize:11, fontWeight:700, color:C.muted }}>DATE</th>
            <th style={{ padding:"10px 14px", textAlign:"left", fontSize:11, fontWeight:700, color:C.muted }}>STATUS</th>
          </tr></thead>
          <tbody>
            {attData.map((a,i)=>(
              <tr key={a.id || i} style={{ background:ROW_COLORS[i%ROW_COLORS.length], borderBottom:"1px solid "+C.border }}>
                <td data-label="Date" style={{ padding:"12px 14px", fontSize:13 }}>{a.date}</td>
                <td data-label="Status" style={{ padding:"12px 14px" }}>
                  <span style={{ background:a.status==="Present"?"#d1fae5":"#fee2e2", color:a.status==="Present"?C.teal:C.red,
                    borderRadius:20, padding:"3px 10px", fontSize:11, fontWeight:600 }}>{a.status}</span>
                </td>
              </tr>
            ))}
            {!attData.length && <tr><td colSpan={2} style={{ padding:24, textAlign:"center", color:C.muted }}>No attendance records yet</td></tr>}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}

export { StudentAttendance };
