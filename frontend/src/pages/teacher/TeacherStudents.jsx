import { useEffect, useState } from "react";
import { Search } from "../../shared/ui";
import { C, ROW_COLORS } from "../../shared/runtime";
import { Avatar } from "../../components/common/Avatar";
import { list } from "../../services/resource.service";
import { onResourceChange } from "../../services/socket.service";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { idOf, classLabel } from "../../utils/formatters";

const mapStudent = s => ({
  id: s._id || s.id,
  name: s.user?.name || s.name || "Unnamed Student",
  email: s.user?.email || s.email || "—",
  phone: s.user?.phone || s.phone || "",
  roll: s.roll || "—",
  gender: s.gender || "—",
  classId: String(idOf(s.classId) || ""),
  cls: s.classId?.name ? classLabel(s.classId) : s.cls || "—",
  status: String(s.user?.status || s.status || "active").replace(/^./, c => c.toUpperCase()),
});

const StatusPill = ({ status }) => {
  const active = String(status).toLowerCase() === "active";
  return (
    <span style={{ background: active ? "#d1fae5" : "#fee2e2", color: active ? C.teal : "#dc2626", borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 600 }}>
      {status}
    </span>
  );
};

// Read-only list of the students in the teacher's classes.
function TeacherStudents() {
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [search, setSearch] = useState("");
  const [filterClass, setFilterClass] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const isMobile = useMediaQuery("(max-width: 768px)");

  useEffect(() => {
    list("classes", "limit=200").then(r => setClasses(r.data || r || [])).catch(() => {});
  }, []);

  const refresh = () => {
    const classQuery = filterClass ? `&classId=${encodeURIComponent(filterClass)}` : "";
    list("students", `q=${encodeURIComponent(search.trim())}&limit=200${classQuery}`)
      .then(r => { setStudents((r.data || r || []).map(mapStudent)); setError(""); })
      .catch(err => setError(err.message || "Unable to load students"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const timer = setTimeout(refresh, 250);
    return () => clearTimeout(timer);
  }, [search, filterClass]);

  useEffect(() => {
    const unsub = onResourceChange("students", refresh);
    return () => unsub?.();
  }, [search, filterClass]);

  // Safety net: only show students of the classes this teacher can see.
  const myClassIds = new Set(classes.map(c => String(idOf(c))));
  const visible = students.filter(s => {
    if (myClassIds.size && s.classId && !myClassIds.has(s.classId)) return false;
    const q = search.trim().toLowerCase();
    return !q || s.name.toLowerCase().includes(q) || String(s.roll).toLowerCase().includes(q);
  });

  const toolbar = (
    <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 220px", display: "flex", alignItems: "center", gap: 8, background: "#f4f6fb", borderRadius: 10, padding: "8px 14px", minWidth: 0 }}>
        <Search size={15} color={C.muted} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or roll no..."
          style={{ border: "none", background: "transparent", outline: "none", fontSize: 13, width: "100%", minWidth: 0 }} />
      </div>
      <select value={filterClass} onChange={e => setFilterClass(e.target.value)}
        style={{ flex: isMobile ? "1 1 100%" : "0 0 auto", height: 40, padding: "0 12px", borderRadius: 10, border: "1.5px solid " + C.border, fontSize: 13, background: "#fff", outline: "none", minWidth: 170, cursor: "pointer" }}>
        <option value="">All My Classes</option>
        {classes.map(c => <option key={idOf(c)} value={idOf(c)}>{classLabel(c)}</option>)}
      </select>
    </div>
  );

  const renderTable = () => (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "#f8fafc" }}>
            {["STUDENT", "ROLL NO", "CLASS", "GENDER", "PHONE", "STATUS"].map(h => (
              <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: C.muted }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visible.map((s, i) => (
            <tr key={s.id} style={{ background: ROW_COLORS[i % ROW_COLORS.length], borderBottom: "1px solid " + C.border }}>
              <td style={{ padding: "12px 14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Avatar name={s.name} size={32} />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{s.name}</div>
                    <div style={{ fontSize: 11, color: C.muted }}>{s.email}</div>
                  </div>
                </div>
              </td>
              <td style={{ padding: "12px 14px", fontSize: 13 }}>{s.roll}</td>
              <td style={{ padding: "12px 14px", fontSize: 13 }}>{s.cls}</td>
              <td style={{ padding: "12px 14px", fontSize: 13 }}>{s.gender}</td>
              <td style={{ padding: "12px 14px", fontSize: 13 }}>{s.phone || "—"}</td>
              <td style={{ padding: "12px 14px" }}><StatusPill status={s.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderCards = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {visible.map((s, i) => (
        <div key={s.id} style={{ background: ROW_COLORS[i % ROW_COLORS.length], border: "1px solid " + C.border, borderRadius: 12, padding: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <Avatar name={s.name} size={38} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 14, wordBreak: "break-word" }}>{s.name}</div>
              <div style={{ fontSize: 11, color: C.muted, wordBreak: "break-all" }}>{s.email}</div>
            </div>
            <StatusPill status={s.status} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 12 }}>
            <div><div style={{ color: C.muted, fontSize: 10 }}>ROLL NO</div><div style={{ fontWeight: 600 }}>{s.roll}</div></div>
            <div><div style={{ color: C.muted, fontSize: 10 }}>CLASS</div><div style={{ fontWeight: 600 }}>{s.cls}</div></div>
            <div><div style={{ color: C.muted, fontSize: 10 }}>GENDER</div><div style={{ fontWeight: 600 }}>{s.gender}</div></div>
            <div><div style={{ color: C.muted, fontSize: 10 }}>PHONE</div><div style={{ fontWeight: 600 }}>{s.phone || "—"}</div></div>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div style={{ padding: isMobile ? 14 : 28 }}>
      <div style={{ background: C.white, borderRadius: 14, padding: isMobile ? 14 : 22, boxShadow: "0 2px 8px rgba(0,0,0,.06)" }}>
        {toolbar}
        {error && <div style={{ background: "#fee2e2", color: "#dc2626", borderRadius: 8, padding: "9px 14px", fontSize: 13, marginBottom: 14 }}>⚠️ {error}</div>}
        {loading ? (
          <div style={{ padding: 30, textAlign: "center", color: C.muted, fontSize: 13 }}>Loading students...</div>
        ) : !visible.length ? (
          <div style={{ padding: 30, textAlign: "center", color: C.muted, fontSize: 13 }}>{filterClass ? "No students in this class" : "No students found"}</div>
        ) : (
          <>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 10 }}>{visible.length} student{visible.length === 1 ? "" : "s"}</div>
            {isMobile ? renderCards() : renderTable()}
          </>
        )}
      </div>
    </div>
  );
}

export { TeacherStudents };