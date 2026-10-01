import { useState, useEffect } from "react";
import { C } from "../../shared/runtime";
import { StatCard } from "../../components/common/StatCard";
import { api } from "../../services/apiClient";
import { onResourceChange } from "../../services/socket.service";

function StudentDashboard() {
  const [stats, setStats]     = useState([]);
  const [marks, setMarks]     = useState([]);
  const [fees,  setFees]      = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = () => {
    setLoading(true);
    api.get("/dashboard/stats")
      .then(res => {
        const d = res.data || {};

        // Build stat cards from real data
        const attendance = d.attendance || { present:0, total:0, percentage:0 };
        const grades     = Array.isArray(d.grades) ? d.grades : [];
        const feesData   = Array.isArray(d.fees)   ? d.fees   : [];
        const studentRaw = d.student || {};

        // Attendance percentage (rough: count / 30 working days)
        const attPct = Number(attendance.percentage || 0);

        // Helper to extract subject name reliably
        const getSubjectName = g => g.subjectId?.name || (typeof g.subjectId === 'string' && !g.subjectId.match(/^[0-9a-fA-F]{24}$/) ? g.subjectId : null) || g.subject || g.subjectName || null;

        // Distinct subjects count & average marks calculation
        const distinctSubjects = [...new Set(grades.map(getSubjectName).filter(Boolean))];
        const validGrades = grades.filter(g => (g.marks !== undefined && g.marks !== null) || (g.score !== undefined && g.score !== null));
        const gradeScores = validGrades.map(g => Number(g.marks ?? g.score ?? 0));
        const avgScore = gradeScores.length
          ? Math.round(gradeScores.reduce((a,b)=>a+b,0) / gradeScores.length)
          : (studentRaw.gpa ? Math.round(Number(studentRaw.gpa) * 25) : 0);

        const className = studentRaw.classId
          ? (typeof studentRaw.classId === 'object'
              ? (studentRaw.classId.name || studentRaw.classId.className || studentRaw.classId.gradeLevel || "—")
              : String(studentRaw.classId))
          : (studentRaw.cls || studentRaw.class || "—");

        // Pending fees: the "Fees Due" card should show the total amount owed,
        // not how many fee records happen to be pending.
        const isPending = f => f.status !== "paid" && f.status !== "Paid";
        const pendingFees = feesData.filter(isPending);
        const pendingTotal = pendingFees.reduce((sum, f) => sum + Number(f.amount || 0), 0);

        setStats([
          {
            label: "Attendance",
            value: `${attPct}%`,
            val: `${attPct}%`,
            change: attendance.total ? `${attendance.present}/${attendance.total} days` : "No records",
            up: attPct >= 75,
            color: attPct >= 75 ? C.teal : C.orange,
            icon: "ClipboardCheck"
          },
          {
            label: "Avg Score",
            value: `${avgScore}%`,
            val: `${avgScore}%`,
            change: distinctSubjects.length ? `${distinctSubjects.length} subjects` : (grades.length ? `${grades.length} records` : "No grades"),
            up: avgScore >= 60,
            color: avgScore >= 75 ? C.teal : avgScore >= 50 ? C.orange : "#dc2626",
            icon: "TrendingUp"
          },
          {
            label: "Fees Due",
            value: `₹${pendingTotal}`,
            val: `₹${pendingTotal}`,
            change: pendingFees.length ? `${pendingFees.length} pending` : (feesData.length ? "All paid" : "No records"),
            up: false,
            color: C.accent,
            icon: "DollarSign"
          },
          {
            label: "Class",
            value: className,
            val: className,
            change: studentRaw.roll ? `Roll: ${studentRaw.roll}` : "Enrolled",
            up: true,
            color: C.purple,
            icon: "BookOpen"
          },
        ]);

        // Map grades to marks display
        setMarks(grades.map(g => ({
          subject: getSubjectName(g) || "Subject",
          exam:    g.examType || g.type || g.exam || g.term || "Exam",
          score:   Number(g.marks ?? g.score ?? 0),
          grade:   g.grade || scoreToGrade(Number(g.marks ?? g.score ?? 0)),
        })).slice(0, 8));

        // Map fees for display.
        setFees(feesData.slice(0, 6).map(f => ({
          id:     f._id || f.id,
          type:   f.type || f.feeType || "Fee",
          amount: f.amount || 0,
          status: f.status === "paid" || f.status === "Paid" ? "Paid" : "Pending",
        })));
      })
      .catch(() => {
        // Keep empty state on error
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
    // Refresh when admin updates student/grades/fees data
    const unsubStudents = onResourceChange("students",   () => fetchData());
    const unsubGrades   = onResourceChange("grades",     () => fetchData());
    const unsubFees     = onResourceChange("fees",       () => fetchData());
    const unsubAtt      = onResourceChange("attendance", () => fetchData());
    return () => {
      unsubStudents?.();
      unsubGrades?.();
      unsubFees?.();
      unsubAtt?.();
    };
  }, []);

  if (loading) {
    return (
      <div style={{ padding:28, display:"flex", alignItems:"center", justifyContent:"center", minHeight:200 }}>
        <div style={{ color:C.muted, fontSize:14 }}>Loading your dashboard…</div>
      </div>
    );
  }

  return (
    <div style={{ padding:28, display:"flex", flexDirection:"column", gap:24 }}>

      {/* Stat cards */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:16 }}>
        {stats.length > 0
          ? stats.map(s => <StatCard key={s.label} stat={s} />)
          : (
            <div style={{ gridColumn:"span 4", background:C.white, borderRadius:14, padding:24,
              textAlign:"center", color:C.muted, fontSize:13 }}>
              No data yet — your admin will set up your profile.
            </div>
          )
        }
      </div>

      {/* Marks + Fees */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20 }}>

        {/* My Marks */}
        <div style={{ background:C.white, borderRadius:14, padding:22, boxShadow:"0 2px 8px rgba(0,0,0,.06)" }}>
          <div style={{ fontWeight:700, fontSize:16, marginBottom:16 }}>My Marks</div>
          {marks.length === 0 ? (
            <div style={{ color:C.muted, fontSize:13, textAlign:"center", padding:"20px 0" }}>
              No marks recorded yet
            </div>
          ) : (
            marks.map((m,i) => (
              <div key={i} style={{ padding:"12px 0", borderBottom: i < marks.length-1 ? "1px solid "+C.border : "none",
                display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div>
                  <div style={{ fontWeight:600, fontSize:13 }}>{m.subject}</div>
                  <div style={{ fontSize:11, color:C.muted }}>{m.exam}</div>
                </div>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontWeight:700, fontSize:13 }}>{m.score}/100</div>
                  <span style={{
                    background: m.score>=85?"#d1fae5":m.score>=60?"#fef3c7":"#fee2e2",
                    color:      m.score>=85?C.teal:m.score>=60?C.orange:"#dc2626",
                    borderRadius:20, padding:"2px 8px", fontSize:11, fontWeight:600
                  }}>{m.grade}</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* My Fees */}
        <div style={{ background:C.white, borderRadius:14, padding:22, boxShadow:"0 2px 8px rgba(0,0,0,.06)" }}>
          <div style={{ fontWeight:700, fontSize:16, marginBottom:16 }}>My Fees</div>

          {fees.length === 0 ? (
            <div style={{ color:C.muted, fontSize:13, textAlign:"center", padding:"20px 0" }}>
              No fee records yet
            </div>
          ) : (
            fees.map((f,i) => (
              <div key={f.id || i} style={{ padding:"12px 0", borderBottom: i < fees.length-1 ? "1px solid "+C.border : "none",
                display:"flex", justifyContent:"space-between", alignItems:"center", gap:10 }}>
                <div>
                  <div style={{ fontWeight:600, fontSize:13 }}>{f.type}</div>
                  <div style={{ fontSize:11, color:C.muted }}>₹{f.amount}</div>
                </div>

                <span style={{
                  background: f.status==="Paid"?"#d1fae5":"#fee2e2",
                  color:      f.status==="Paid"?C.teal:"#dc2626",
                  borderRadius:20, padding:"3px 10px", fontSize:11, fontWeight:600
                }}>{f.status}</span>
              </div>
            ))
          )}
        </div>

      </div>
    </div>
  );
}

function scoreToGrade(score) {
  if (score >= 90) return "A+";
  if (score >= 80) return "A";
  if (score >= 70) return "B+";
  if (score >= 60) return "B";
  if (score >= 50) return "C";
  return "F";
}

export { StudentDashboard };