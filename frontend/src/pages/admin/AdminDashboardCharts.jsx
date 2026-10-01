import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "../../shared/ui";

import { C, GRADE_CHART_COLORS } from "../../shared/runtime";

const RED = "rgb(239, 68, 68)";

function AdminDashboardCharts({ enrollmentData, totalStudents, unassignedCount, visibleGPAData, gradedStudentsCount, gpaPie, gradeTotal }) {
  return (
    <div className="ad-charts">
      <div className="ad-card">
        <div className="ad-card-head">
          <div>
            <div className="ad-title">Enrollment by Grade</div>
            <div className="ad-sub" style={{ color: C.muted }}>Students per grade level</div>
          </div>
          <span className="ad-chip" style={{ background: "#eef2ff", color: "rgb(109, 78, 246)" }}>{totalStudents} total</span>
        </div>
        <div className="ad-bar-wrap">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={enrollmentData} margin={{ top: 5, right: 10, left: -18, bottom: 18 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#edf0f6" />
              <XAxis dataKey="grade" tick={{ fontSize: 10, fill: C.muted }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={4} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: C.muted }} axisLine={false} tickLine={false} />
              <Tooltip cursor={{ fill: "#f8faff" }} />
              <Bar dataKey="students" radius={[6, 6, 0, 0]} maxBarSize={24}>
                {enrollmentData.map((_, index) => <Cell key={index} fill={GRADE_CHART_COLORS[index % GRADE_CHART_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        {unassignedCount > 0 && <div style={{ fontSize: 11, color: RED, padding: "0 20px 14px" }}>{unassignedCount} student(s) have no class assigned</div>}
      </div>

      <div className="ad-card">
        <div className="ad-card-head">
          <div>
            <div className="ad-title">Academic Performance</div>
            <div className="ad-sub" style={{ color: C.muted }}>GPA distribution</div>
          </div>
          <span className="ad-chip" style={{ background: "#ecfdf5", color: "rgb(16, 185, 129)" }}>{gradedStudentsCount ? `${gradedStudentsCount} on track` : "No grades"}</span>
        </div>
        <div className="ad-perf">
          <div className="ad-donut">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={visibleGPAData} cx="50%" cy="50%" innerRadius={47} outerRadius={68} dataKey="displayValue" startAngle={90} endAngle={-270} paddingAngle={3} stroke="#ffffff" strokeWidth={2} cornerRadius={3}>
                  {visibleGPAData.map((item, index) => <Cell key={`gpa-${index}`} fill={item.color} stroke="#ffffff" strokeWidth={2} />)}
                </Pie>
                <Tooltip formatter={(value, name, entry) => [`${entry?.payload?.value ?? 0} Students`, name]} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", textAlign: "center", pointerEvents: "none" }}>
              <div style={{ fontWeight: 800, fontSize: 25, color: C.text, lineHeight: 1 }}>{gradedStudentsCount}</div>
              <div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>students</div>
            </div>
          </div>
          <div className="ad-legend">
            {gpaPie.map((item) => {
              const pct = gradeTotal ? (item.value / gradeTotal) * 100 : 0;
              return (
                <div key={item.name} style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, fontSize: 11, color: C.text, marginBottom: 4 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0, flexWrap: "wrap" }}>
                      <span style={{ width: 10, height: 10, borderRadius: 3, background: item.color, display: "inline-block", flexShrink: 0 }} />
                      <span style={{ fontWeight: 600 }}>{item.name}</span>
                      <small style={{ color: C.muted, fontSize: 10 }}>{item.range}</small>
                    </span>
                    <strong style={{ color: item.color, fontWeight: 800 }}>{item.value}</strong>
                  </div>
                  <div style={{ height: 5, background: "#edf1f5", borderRadius: 5, overflow: "hidden" }}><div style={{ height: "100%", width: `${pct}%`, background: item.color, borderRadius: 5 }} /></div>
                </div>
              );
            })}
            <div style={{ fontSize: 10, color: C.muted, marginTop: 12 }}>{gradeTotal} grades recorded in the database</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export { AdminDashboardCharts };