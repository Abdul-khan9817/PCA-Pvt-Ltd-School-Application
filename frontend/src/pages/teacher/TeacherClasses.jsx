import { useEffect, useState } from "react";
import { C } from "../../shared/runtime";
import { api } from "../../services/apiClient";
import { list } from "../../services/resource.service";
import { onResourceChange } from "../../services/socket.service";

const THEMES = [
  "linear-gradient(135deg,#4f6ef7,#7c3aed)", "linear-gradient(135deg,#11998e,#38ef7d)",
  "linear-gradient(135deg,#f7971e,#ffb300)", "linear-gradient(135deg,#8b5cf6,#ec4899)",
];
const idOf = v => String(v?._id || v?.id || v || "");
const chip = { background:"rgba(255,255,255,.22)", borderRadius:20, padding:"4px 12px", fontSize:12, fontWeight:600 };

function TeacherClasses() {
  const [classes, setClasses] = useState([]);
  const [counts, setCounts] = useState({});

  const load = async () => {
    const [cl, st, sl] = await Promise.all([
      list("classes", "limit=100"),
      api.get("/dashboard/stats").catch(() => null),
      list("students", "limit=5000").catch(() => null),
    ]);
    const rows = cl?.data || cl || [];
    setClasses(rows);

    const fromStats = Object.fromEntries((st?.data?.classStudentCounts || []).map(i => [String(i._id), i.count]));

    const students = (sl?.data || sl || []).filter(s => !s.status || s.status === "active");
    const fromStudents = {};
    students.forEach(s => {
      let key = idOf(s.classId);
      if (!key) {
        const match = rows.find(c => String(c.gradeLevel) === String(s.cls) && String(c.section || "") === String(s.section || ""));
        key = match ? idOf(match) : "";
      }
      if (key) fromStudents[key] = (fromStudents[key] || 0) + 1;
    });

    setCounts({ ...fromStats, ...fromStudents });
  };

  useEffect(() => {
    load().catch(() => {});
    const a = onResourceChange("classes", load), b = onResourceChange("students", load);
    return () => { a?.(); b?.(); };
  }, []);

  return (
    <div style={{ padding: 14 }}>
      <div style={{ background: C.white, borderRadius: 14, padding: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 16 }}>My Classes</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 16 }}>
          {classes.map((c, i) => (
            <div key={idOf(c)} style={{ background: THEMES[i % THEMES.length], color: "#fff", borderRadius: 16, padding: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 800 }}>{c.name}</div>
                  <div style={{ fontSize: 13, opacity: .9 }}>Section {c.section} · Grade {c.gradeLevel}</div>
                </div>
                <div style={{ ...chip, textAlign: "center", borderRadius: 14, minWidth: 64 }}>
                  <div style={{ fontSize: 22, fontWeight: 800 }}>{counts[idOf(c)] ?? 0}</div>
                  <div style={{ fontSize: 10 }}>Students</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                {c.room && <span style={chip}>{c.room}</span>}
                {c.academicYear && <span style={chip}>{c.academicYear}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export { TeacherClasses };