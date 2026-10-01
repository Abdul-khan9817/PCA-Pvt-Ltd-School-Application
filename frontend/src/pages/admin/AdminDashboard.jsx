import { lazy, Suspense, useState, useEffect } from "react";

import { C } from "../../shared/runtime";
import { StatCard } from "../../components/common/StatCard";
import { api } from "../../services/apiClient";
import { onResourceChange } from "../../services/socket.service";

const AdminDashboardCharts = lazy(() => import("./AdminDashboardCharts").then((module) => ({ default: module.AdminDashboardCharts })));

// Compact fee format for the top stat card: ₹2.50Cr / ₹20.8L / ₹45K / ₹500
const formatFee = (amount) => {
  const n = Number(amount) || 0;
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(0)}K`;
  return `₹${n}`;
};

// Exact amount for the fee card so Collected + Pending always equals Total: ₹14,300
const formatINR = (amount) => `₹${(Number(amount) || 0).toLocaleString("en-IN")}`;

const PURPLE = "rgb(109, 78, 246)";
const GREEN = "rgb(16, 185, 129)";
const AMBER = "rgb(245, 158, 11)";
const RED = "rgb(239, 68, 68)";

const STAT_META = [
  { label: "Total Students", icon: "GraduationCap", color: PURPLE, to: "rgb(79, 55, 190)" },
  { label: "Teaching Staff", icon: "Users", color: "rgb(20, 184, 166)", to: "rgb(13, 148, 136)" },
  { label: "Active Classes", icon: "BookOpen", color: GREEN, to: "rgb(5, 150, 105)" },
  { label: "Pending Fees", icon: "DollarSign", color: RED, to: "rgb(220, 38, 38)" },
  { label: "Avg Attendance", icon: "ClipboardCheck", color: AMBER, to: "rgb(217, 119, 6)" },
];

const buildStats = (values, onPendingClick) =>
  STAT_META.map((m, i) => ({
    label: m.label,
    icon: m.icon,
    color: m.color,
    gradient: `linear-gradient(135deg, ${m.color}, ${m.to})`,
    value: values[i][0],
    change: "", // sub text removed
    ...(m.label === "Pending Fees" && onPendingClick ? { onClick: onPendingClick } : {}),
  }));

const LOADING_VALUES = [
  ["0", "Loading..."],
  ["0", "Loading..."],
  ["0", "Loading..."],
  ["₹0", "Loading..."],
  ["0%", "Loading..."],
];

const GRADES = ["Nursery", "LKG", "UKG", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];

const STATUS_STYLE = {
  Paid: { bg: "#d1fae5", fg: "#059669" },
  Overdue: { bg: "#fee2e2", fg: "#dc2626" },
  Partial: { bg: "#fef3c7", fg: "#d97706" },
  Pending: { bg: "#fef3c7", fg: "#d97706" },
};

// All responsive rules live here so every breakpoint is in one place.
const RESPONSIVE_CSS = `
.ad-root { padding: clamp(12px, 3vw, 28px); display: flex; flex-direction: column; gap: clamp(14px, 2vw, 20px); width: 100%; max-width: 100%; box-sizing: border-box; overflow-x: hidden; }
.ad-root *, .ad-root *::before, .ad-root *::after { box-sizing: border-box; }
.ad-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 14px; }
.ad-charts { display: grid; grid-template-columns: minmax(0, 1.12fr) minmax(0, .88fr); gap: 18px; align-items: stretch; }
.ad-bottom { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, .8fr); gap: 18px; align-items: stretch; }
.ad-card { background: #fff; border-radius: 16px; border: 1px solid #edf0f6; box-shadow: 0 3px 12px rgba(15,23,42,.05); min-width: 0; overflow: hidden; }
.ad-card-head { padding: 16px 20px; border-bottom: 1px solid #edf0f6; display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; }
.ad-card-body { padding: clamp(14px, 2.5vw, 24px); }
.ad-title { font-weight: 800; font-size: clamp(14px, 1.6vw, 17px); }
.ad-sub { font-size: 12px; margin-top: 4px; }
.ad-chip { border-radius: 20px; padding: 5px 10px; font-size: 11px; font-weight: 800; white-space: nowrap; }
.ad-bar-wrap { padding: 18px 14px 10px; height: 330px; }
.ad-perf { padding: 20px 18px; display: flex; align-items: center; gap: 18px; }
.ad-donut { position: relative; width: 150px; height: 150px; flex-shrink: 0; }
.ad-legend { flex: 1; min-width: 0; }

/* Fee card header: title can shrink, button never wraps */
.ad-fee-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; margin-bottom: 16px; }
.ad-fee-head-text { min-width: 0; flex: 1 1 auto; }
.ad-manage { flex-shrink: 0; border: none; border-radius: 20px; padding: 7px 14px; font-size: 12px; font-weight: 800; cursor: pointer; white-space: nowrap; background: #eef2ff; color: ${PURPLE}; }
.ad-manage:focus-visible { outline: 2px solid ${PURPLE}; outline-offset: 2px; }

/* Fee progress */
.ad-progress-box { background: #f8fafc; border-radius: 12px; padding: 14px; margin-bottom: 14px; border: 1px solid #edf0f6; }
.ad-progress-line { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; font-size: 12px; font-weight: 700; margin-bottom: 8px; }
.ad-progress-line > span { min-width: 0; }
.ad-progress-amount { white-space: nowrap; }

/* Summary tiles */
.ad-pills { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin-bottom: 16px; }
.ad-pill { border-radius: 10px; padding: 10px 6px; text-align: center; min-width: 0; }
.ad-pill-label { font-size: 11px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ad-pill-value { font-size: 15px; font-weight: 800; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* Recent fee rows: line 1 = name + amount, line 2 = fee type + status */
.ad-row { padding: 10px 12px; border-radius: 8px; background: #f8fafc; display: flex; flex-direction: column; gap: 4px; font-size: 12px; }
.ad-row-top, .ad-row-bottom { display: flex; align-items: center; justify-content: space-between; gap: 10px; min-width: 0; }
.ad-row-name { min-width: 0; flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ad-row-amount { font-weight: 700; white-space: nowrap; flex-shrink: 0; }
.ad-row-type { min-width: 0; flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ad-badge { border-radius: 12px; padding: 2px 8px; font-size: 10px; font-weight: 700; white-space: nowrap; flex-shrink: 0; }

.ad-notice { padding: 14px 0; border-bottom: 1px solid #edf0f6; display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
.ad-notice:last-child { border-bottom: none; }
.ad-notice-text { min-width: 0; flex: 1; overflow-wrap: anywhere; }

@media (max-width: 1024px) {
  .ad-charts, .ad-bottom { grid-template-columns: minmax(0, 1fr); }
}
@media (max-width: 640px) {
  .ad-stats { grid-template-columns: minmax(0, 1fr); gap: 10px; }
  .ad-bar-wrap { height: 280px; padding: 14px 6px 6px; }
  .ad-card-head { padding: 14px; }
  .ad-perf { flex-direction: column; align-items: stretch; padding: 16px 14px; gap: 16px; }
  .ad-donut { margin: 0 auto; }
  .ad-pills { grid-template-columns: minmax(0, 1fr); gap: 8px; }
  .ad-pill { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 14px; text-align: left; }
  .ad-pill-label { font-size: 12px; }
  .ad-pill-value { font-size: 16px; margin-top: 0; }
}
@media (max-width: 360px) {
  .ad-progress-line { flex-direction: column; gap: 2px; }
}
`;

function AdminDashboard({ setPage, userData }) {
  const goFees = () => setPage?.("fees");

  const [stats, setStats] = useState(buildStats(LOADING_VALUES));
  const [notices, setNotices] = useState([]);
  const [gradeDistribution, setGradeDistribution] = useState([]);
  const [enrollmentByGrade, setEnrollmentByGrade] = useState([]);
  const [gradedStudentsCount, setGradedStudentsCount] = useState(0);
  const [feeSummary, setFeeSummary] = useState({ total: 0, paid: 0, pending: 0, overdue: 0 });
  const [recentFees, setRecentFees] = useState([]);
  const [chartsReady, setChartsReady] = useState(false);

  const fetchStats = () => {
    api
      .get("/dashboard/stats")
      .then((res) => {
        const d = res.data;
        if (!d) return;

        const total = Number(d.fees?.total || 0);
        const paid = Number(d.fees?.paid || 0);
        const pending = Math.max(0, total - paid);

        // Overdue comes from the stats endpoint (full dataset), not the 5-row preview.
        setFeeSummary({
          total,
          paid,
          pending,
          overdue: Number(d.fees?.overdueCount ?? d.fees?.overdue ?? 0),
        });

        setStats(
          buildStats(
            [
              [d.students != null ? String(d.students) : "0", "Active enrollment"],
              [d.staff != null ? String(d.staff) : "0", "Active staff"],
              [d.classes != null ? String(d.classes) : "0", "Nursery to Grade 12"],
              [formatFee(pending), "Outstanding amount"],
              [
                `${d.attendance?.percentage || 0}%`,
                d.attendance?.total
                  ? `${d.attendance.present}/${d.attendance.total} records`
                  : "No records",
              ],
            ],
            goFees
          )
        );

        setGradeDistribution(d.gradeDistribution || []);
        setEnrollmentByGrade(d.enrollmentByGrade || []);
        setGradedStudentsCount(d.gradedStudentsCount || 0);
      })
      .catch((error) => console.error("Dashboard stats error:", error));

  };

  const fetchDashboardDetails = () => {
    api.get("/announcements?limit=5").then((res) => {
      const list = Array.isArray(res.data) ? res.data : [];
      setNotices(list.map((x) => ({ id: x._id, title: x.title, content: x.content, priority: x.priority || "Medium" })));
    }).catch(() => {});

    api.get("/fees?limit=5").then((res) => {
      const list = res.data?.data || res.data || [];
      setRecentFees(Array.isArray(list) ? list : []);
    }).catch(() => {});
  };

  useEffect(() => {
    fetchStats();
    const idle = window.requestIdleCallback || ((callback) => window.setTimeout(callback, 800));
    const idleId = idle(() => {
      setChartsReady(true);
      fetchDashboardDetails();
    });
    const unsubs = ["staff", "announcements", "attendance", "fees"].map((r) =>
      onResourceChange(r, fetchStats)
    );
    return () => {
      if (window.cancelIdleCallback && typeof idleId === "number") window.cancelIdleCallback(idleId);
      else window.clearTimeout(idleId);
      unsubs.forEach((u) => u?.());
    };
  }, []);

  // ---------- Academic performance ----------
  const gradeCount = (grade) =>
    gradeDistribution.find((item) => String(item._id).trim() === grade)?.count || 0;

  const GPA_PIE = [
    { name: "Excellent", range: "≥85%", value: gradeCount("A+") + gradeCount("A"), color: GREEN },
    { name: "Good", range: "70–84%", value: gradeCount("B+") + gradeCount("B"), color: "rgb(99, 102, 241)" },
    { name: "Average", range: "50–69%", value: gradeCount("C"), color: AMBER },
    { name: "At Risk", range: "<50%", value: gradeCount("D"), color: RED },
  ];

  const gradeTotal = GPA_PIE.reduce((sum, item) => sum + Number(item.value || 0), 0);

  // Empty buckets get a small visible slice so all 4 colors always show.
  // Tooltips still display the real count.
  const visibleGPAData = GPA_PIE.map((item) => ({
    ...item,
    displayValue: Number(item.value) > 0 ? Number(item.value) : Math.max(gradeTotal * 0.06, 4),
  }));

  // ---------- Enrollment ----------
  const enrollmentData = GRADES.map((grade) => ({
    grade,
    students: enrollmentByGrade.find((item) => String(item._id) === grade)?.count || 0,
  }));

  const unassignedCount =
    enrollmentByGrade.find((item) => item._id === "Unassigned")?.count || 0;

  const totalStudents = stats.find((s) => s.label === "Total Students")?.value || "0";

  // Never show 0% when something has actually been collected.
  const rawPct = feeSummary.total > 0 ? (feeSummary.paid / feeSummary.total) * 100 : 0;
  const collectionPct = Math.min(100, feeSummary.paid > 0 ? Math.max(1, Math.round(rawPct)) : 0);

  const hasOverdue = Number(feeSummary.overdue) > 0;
  const pills = [
    { label: "Collected", value: formatINR(feeSummary.paid), bg: "#ecfdf5", color: GREEN },
    { label: "Pending", value: formatINR(feeSummary.pending), bg: "#fef3c7", color: AMBER },
    {
      label: "Overdue",
      value: feeSummary.overdue || 0,
      // Red only when there is something to chase; a zero is good news.
      bg: hasOverdue ? "#fee2e2" : "#ecfdf5",
      color: hasOverdue ? RED : GREEN,
    },
  ];

  return (
    <div className="ad-root">
      <style>{RESPONSIVE_CSS}</style>

      {/* STAT CARDS */}
      <div className="ad-stats">
        {stats.map((s) => (
          <StatCard key={s.label} stat={s} />
        ))}
      </div>

      {/* CHARTS */}
      {chartsReady ? (
        <Suspense fallback={<div className="ad-charts" style={{ minHeight: 330 }} />}>
          <AdminDashboardCharts
            enrollmentData={enrollmentData}
            totalStudents={totalStudents}
            unassignedCount={unassignedCount}
            visibleGPAData={visibleGPAData}
            gradedStudentsCount={gradedStudentsCount}
            gpaPie={GPA_PIE}
            gradeTotal={gradeTotal}
          />
        </Suspense>
      ) : null}

      {false && <div className="ad-charts">
        {/* Enrollment by grade */}
        <div className="ad-card">
          <div className="ad-card-head">
            <div>
              <div className="ad-title">Enrollment by Grade</div>
              <div className="ad-sub" style={{ color: C.muted }}>Students per grade level</div>
            </div>
            <span className="ad-chip" style={{ background: "#eef2ff", color: PURPLE }}>
              {totalStudents} total
            </span>
          </div>

          <div className="ad-bar-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={enrollmentData} margin={{ top: 5, right: 10, left: -18, bottom: 18 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#edf0f6" />
                <XAxis
                  dataKey="grade"
                  tick={{ fontSize: 10, fill: C.muted }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                  minTickGap={4}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 10, fill: C.muted }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip cursor={{ fill: "#f8faff" }} />
                <Bar dataKey="students" radius={[6, 6, 0, 0]} maxBarSize={24}>
                  {enrollmentData.map((_, i) => (
                    <Cell key={i} fill={GRADE_CHART_COLORS[i % GRADE_CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {unassignedCount > 0 && (
            <div style={{ fontSize: 11, color: RED, padding: "0 20px 14px" }}>
              ⚠ {unassignedCount} student(s) have no class assigned
            </div>
          )}
        </div>

        {/* Academic performance */}
        <div className="ad-card">
          <div className="ad-card-head">
            <div>
              <div className="ad-title">Academic Performance</div>
              <div className="ad-sub" style={{ color: C.muted }}>GPA distribution</div>
            </div>
            <span className="ad-chip" style={{ background: "#ecfdf5", color: GREEN }}>
              {gradedStudentsCount ? `${gradedStudentsCount} on track` : "No grades"}
            </span>
          </div>

          <div className="ad-perf">
            <div className="ad-donut">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={visibleGPAData}
                    cx="50%"
                    cy="50%"
                    innerRadius={47}
                    outerRadius={68}
                    dataKey="displayValue"
                    startAngle={90}
                    endAngle={-270}
                    paddingAngle={3}
                    stroke="#ffffff"
                    strokeWidth={2}
                    cornerRadius={3}
                  >
                    {visibleGPAData.map((item, i) => (
                      <Cell key={`gpa-${i}`} fill={item.color} stroke="#ffffff" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name, entry) => [`${entry?.payload?.value ?? 0} Students`, name]}
                    contentStyle={{
                      borderRadius: 10,
                      border: "none",
                      boxShadow: "0 5px 20px rgba(0,0,0,.12)",
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>

              <div
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                  textAlign: "center",
                  pointerEvents: "none",
                }}
              >
                <div style={{ fontWeight: 800, fontSize: 25, color: C.text, lineHeight: 1 }}>
                  {gradedStudentsCount}
                </div>
                <div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>students</div>
              </div>
            </div>

            <div className="ad-legend">
              {GPA_PIE.map((item) => {
                const pct = gradeTotal ? (item.value / gradeTotal) * 100 : 0;
                return (
                  <div key={item.name} style={{ marginBottom: 10 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 8,
                        fontSize: 11,
                        color: C.text,
                        marginBottom: 4,
                      }}
                    >
                      <span style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0, flexWrap: "wrap" }}>
                        <span
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: 3,
                            background: item.color,
                            display: "inline-block",
                            flexShrink: 0,
                          }}
                        />
                        <span style={{ fontWeight: 600 }}>{item.name}</span>
                        <small style={{ color: C.muted, fontSize: 10 }}>{item.range}</small>
                      </span>
                      <strong style={{ color: item.color, fontWeight: 800 }}>{item.value}</strong>
                    </div>
                    <div style={{ height: 5, background: "#edf1f5", borderRadius: 5, overflow: "hidden" }}>
                      <div
                        style={{
                          height: "100%",
                          width: `${pct}%`,
                          background: item.color,
                          borderRadius: 5,
                          transition: "width .5s ease",
                        }}
                      />
                    </div>
                  </div>
                );
              })}

              <div style={{ fontSize: 10, color: C.muted, marginTop: 12 }}>
                {gradeTotal} grades recorded in the database
              </div>
            </div>
          </div>
        </div>
      </div>}

      {/* FEES + NOTICES */}
      <div className="ad-bottom">
        <div className="ad-card">
          <div className="ad-card-body">
            <div className="ad-fee-head">
              <div className="ad-fee-head-text">
                <div className="ad-title" style={{ color: C.text }}>Fee Collection &amp; Overview</div>
                <div className="ad-sub" style={{ color: C.muted }}>
                  Collection rate and latest fee records
                </div>
              </div>
              <button type="button" className="ad-manage" onClick={goFees}>
                Manage Fees →
              </button>
            </div>

            {/* Progress */}
            <div className="ad-progress-box">
              <div className="ad-progress-line">
                <span style={{ color: C.text }}>
                  Collected: <strong style={{ color: GREEN }}>{collectionPct}%</strong>
                </span>
                <span className="ad-progress-amount" style={{ color: C.muted }}>
                  {formatINR(feeSummary.paid)} of {formatINR(feeSummary.total)}
                </span>
              </div>
              <div style={{ height: 8, background: "#e2e8f0", borderRadius: 6, overflow: "hidden" }}>
                <div
                  style={{
                    height: "100%",
                    width: `${collectionPct}%`,
                    background: "linear-gradient(90deg, #10b981, #059669)",
                    borderRadius: 6,
                    transition: "width .5s ease",
                  }}
                />
              </div>
            </div>

            {/* Summary tiles: always one compact row */}
            <div className="ad-pills">
              {pills.map((p) => (
                <div key={p.label} className="ad-pill" style={{ background: p.bg }}>
                  <div className="ad-pill-label" style={{ color: C.muted }}>{p.label}</div>
                  <div className="ad-pill-value" style={{ color: p.color }}>{p.value}</div>
                </div>
              ))}
            </div>

            <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, marginBottom: 8 }}>
              Recent fee records
            </div>

            {recentFees.length === 0 ? (
              <div
                style={{
                  color: C.muted,
                  fontSize: 12,
                  textAlign: "center",
                  padding: "16px 0",
                  background: "#f8fafc",
                  borderRadius: 8,
                }}
              >
                No fee records yet. Assign fees from Manage Fees.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {recentFees.map((f, i) => {
                  const st = typeof f.student === "object" ? f.student : null;
                  const name = st?.user?.name || st?.name || "Student";
                  const roll = st?.roll || st?.studentId || "";
                  const status = f.status || "Pending";
                  const style = STATUS_STYLE[status] || STATUS_STYLE.Pending;

                  return (
                    <div key={f._id || i} className="ad-row">
                      <div className="ad-row-top">
                        <div className="ad-row-name">
                          <span style={{ fontWeight: 700, color: C.text }}>{name}</span>
                          {roll && <span style={{ color: C.muted, fontSize: 11 }}> [{roll}]</span>}
                        </div>
                        <span className="ad-row-amount" style={{ color: C.text }}>
                          {formatINR(f.amount)}
                        </span>
                      </div>
                      <div className="ad-row-bottom">
                        <span className="ad-row-type" style={{ color: C.muted, fontSize: 11 }}>
                          {f.type || "Tuition"} ({f.month || "Current"})
                        </span>
                        <span className="ad-badge" style={{ background: style.bg, color: style.fg }}>
                          {status}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Notices */}
        <div className="ad-card">
          <div className="ad-card-body">
            <div style={{ marginBottom: 12 }}>
              <div className="ad-title">Recent Notices</div>
              <div className="ad-sub" style={{ color: C.muted }}>Latest school announcements</div>
            </div>

            {notices.length === 0 ? (
              <div style={{ color: C.muted, fontSize: 13, textAlign: "center", padding: "16px 0" }}>
                No announcements yet
              </div>
            ) : (
              notices.map((n) => (
                <div key={n.id} className="ad-notice">
                  <div className="ad-notice-text">
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{n.title}</div>
                    <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>{n.content}</div>
                  </div>
                  <span
                    style={{
                      background: n.priority === "High" ? "#fee2e2" : "#fef3c7",
                      color: n.priority === "High" ? RED : AMBER,
                      borderRadius: 20,
                      padding: "3px 10px",
                      fontSize: 11,
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    {n.priority}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export { AdminDashboard };