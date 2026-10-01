import { useEffect, useState } from "react";
import { C } from "../../shared/runtime";
import { api } from "../../services/apiClient";
import { list } from "../../services/resource.service";
import { onResourceChange } from "../../services/socket.service";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { idOf, classLabel } from "../../utils/formatters";

const ALL_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const dayThemes = {
  Monday: { header: "#2563eb", bg: "#dbeafe", accent: "#1e3a8a" },
  Tuesday: { header: "#db2777", bg: "#fce7f3", accent: "#831843" },
  Wednesday: { header: "#059669", bg: "#d1fae5", accent: "#065f46" },
  Thursday: { header: "#d97706", bg: "#fef3c7", accent: "#92400e" },
  Friday: { header: "#4f46e5", bg: "#e0e7ff", accent: "#312e81" },
  Saturday: { header: "#0d9488", bg: "#ccfbf1", accent: "#134e4a" },
};

const timeThemes = [
  { bg: "#e0f2fe", text: "#0369a1" },
  { bg: "#fce7f3", text: "#be185d" },
  { bg: "#d1fae5", text: "#047857" },
  { bg: "#fef9c3", text: "#a16207" },
  { bg: "#ede9fe", text: "#6d28d9" },
  { bg: "#ffe4e6", text: "#be123c" },
  { bg: "#e0e7ff", text: "#4338ca" },
];

const NON_TEACHING = ["Break", "Lunch Break"];

const timeKey = item => `${item.startTime || ""}${item.endTime ? `-${item.endTime}` : ""}`;
const subjectLabel = item => item.subjectId?.name || item.type || "Subject";
const teacherName = item => item?.teacher?.name || item?.teacher?.user?.name || "";

const nowHHMM = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

// Timetable of the teacher's assigned class(es). Periods the logged-in teacher
// teaches are tagged "You". A class with no timetable shows an empty message.
function TeacherTimetable({ userData }) {
  const [allEntries, setAllEntries] = useState([]);
  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedDay, setSelectedDay] = useState("");
  const isSmall = useMediaQuery("(max-width: 1024px)");

  const myId = String(userData?._id || userData?.id || "");
  const myName = String(userData?.name || "").trim().toLowerCase();

  const isMine = item => {
    const t = item.teacher;
    if (!t) return false;
    const ids = [idOf(t), idOf(t.user)].filter(Boolean).map(String);
    if (myId && ids.includes(myId)) return true;
    return Boolean(myName) && teacherName(item).trim().toLowerCase() === myName;
  };

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get("/timetable?limit=1000"),
      list("classes", "limit=200").catch(() => ({ data: [] })),
    ])
      .then(([tt, cl]) => {
        setAllEntries(tt.data || []);
        setClasses(cl.data || cl || []);
        setError("");
      })
      .catch(err => setError(err.message || "Unable to load timetable"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    const unsubscribe = onResourceChange("timetable", load);
    return () => unsubscribe?.();
  }, []);

  useEffect(() => {
    if (!classId && classes.length) setClassId(String(idOf(classes[0])));
  }, [classes, classId]);

  const entries = allEntries.filter(item => classId && String(idOf(item.classId)) === String(classId));
  const selectedClass = classes.find(c => String(idOf(c)) === String(classId));

  const days = entries.some(e => e.day === "Saturday") ? ALL_DAYS : ALL_DAYS.filter(d => d !== "Saturday");
  const today = new Date().toLocaleDateString("en-US", { weekday: "long" });

  // Re-pick the default day whenever the class (or its entries) changes.
  useEffect(() => {
    if (!entries.length) { setSelectedDay(""); return; }
    if (selectedDay && days.includes(selectedDay) && entries.some(e => e.day === selectedDay)) return;
    const first = days.find(d => entries.some(e => e.day === d));
    setSelectedDay(days.includes(today) && entries.some(e => e.day === today) ? today : first || days[0]);
  }, [classId, allEntries]);

  const times = [...new Set(entries.map(timeKey))].filter(Boolean).sort();
  const cell = (time, day) => entries.filter(i => i.day === day && timeKey(i) === time);

  const YouTag = () => (
    <span style={{ background: "#111827", color: "#fff", borderRadius: 20, padding: "1px 7px", fontSize: 9, fontWeight: 700, marginLeft: 6 }}>YOU</span>
  );

  /* ---------------- desktop weekly grid ---------------- */
  const renderGrid = () => (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 4, minWidth: 900, tableLayout: "fixed" }}>
        <thead>
          <tr>
            <th style={{ width: 120, padding: 12, textAlign: "left", fontSize: 11, color: C.white, background: "#334155", borderRadius: 10 }}>TIME</th>
            {days.map(day => (
              <th key={day} style={{ padding: 12, fontSize: 12, color: C.white, background: dayThemes[day].header, borderRadius: 10, outline: day === today ? "2px solid #fbbf24" : "none", outlineOffset: -2 }}>
                {day.slice(0, 3).toUpperCase()}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {times.map((time, rowIndex) => {
            const tt = timeThemes[rowIndex % timeThemes.length];
            return (
              <tr key={time}>
                <td style={{ padding: 12, fontSize: 13, color: tt.text, whiteSpace: "nowrap", background: tt.bg, borderRadius: 10, fontWeight: 700 }}>
                  <span style={{ marginRight: 6 }}>🕐</span>{time}
                </td>
                {days.map(day => {
                  const items = cell(time, day);
                  const theme = dayThemes[day];
                  return (
                    <td key={day} style={{ padding: 8, verticalAlign: "top", wordBreak: "break-word", background: items.length ? theme.bg : "#f8fafc", borderRadius: 10, borderLeft: items.length ? `3px solid ${theme.header}` : "none" }}>
                      {items.map(item => (
                        <div key={item._id || item.id} style={{ marginBottom: 8, paddingBottom: 8, borderBottom: items.length > 1 ? `1px solid ${theme.header}55` : "none" }}>
                          <div style={{ fontWeight: 700, color: theme.accent, fontSize: 13 }}>
                            {subjectLabel(item)}{isMine(item) && <YouTag />}
                          </div>
                          {item.type === "Class" && teacherName(item) && (
                            <div style={{ color: theme.accent, fontSize: 11, marginTop: 4, fontWeight: 600, opacity: 0.85 }}>👤 {teacherName(item)}</div>
                          )}
                          {item.room && <div style={{ color: "#64748b", fontSize: 11, marginTop: 3 }}>{item.room}</div>}
                        </div>
                      ))}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  /* ---------------- phone / tablet: one day at a time ---------------- */
  const renderDay = () => {
    const day = selectedDay || days[0];
    const theme = dayThemes[day];
    const dayEntries = entries.filter(i => i.day === day).sort((a, b) => (a.startTime || "").localeCompare(b.startTime || ""));
    const now = nowHHMM();
    const isToday = day === today;

    return (
      <div>
        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 6, marginBottom: 14, WebkitOverflowScrolling: "touch" }}>
          {days.map(d => {
            const t = dayThemes[d];
            const on = d === day;
            const count = entries.filter(e => e.day === d).length;
            return (
              <button key={d} type="button" onClick={() => setSelectedDay(d)} style={{
                flex: "1 0 auto", minWidth: 58, padding: "9px 12px", borderRadius: 12, cursor: "pointer",
                border: `1.5px solid ${on ? t.header : C.border}`, background: on ? t.header : C.white,
                color: on ? "#fff" : C.text, fontWeight: 700, fontSize: 13, position: "relative", lineHeight: 1.2
              }}>
                {d.slice(0, 3)}
                <div style={{ fontSize: 10, fontWeight: 500, opacity: 0.8 }}>{count} {count === 1 ? "class" : "classes"}</div>
                {d === today && <span style={{ position: "absolute", top: 5, right: 6, width: 7, height: 7, borderRadius: "50%", background: on ? "#fde68a" : "#f59e0b" }} />}
              </button>
            );
          })}
        </div>

        <div style={{ fontSize: 13, color: C.muted, marginBottom: 10, fontWeight: 600 }}>{day}{isToday ? " · Today" : ""}</div>

        {!dayEntries.length ? (
          <div style={{ padding: 30, textAlign: "center", color: C.muted, fontSize: 13, background: "#f8fafc", borderRadius: 12 }}>No classes on {day}</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {dayEntries.map(item => {
              const isBreak = NON_TEACHING.includes(item.type);
              const live = isToday && item.startTime && item.endTime && now >= item.startTime && now < item.endTime;
              const tt = timeThemes[times.indexOf(timeKey(item)) % timeThemes.length] || timeThemes[0];
              return (
                <div key={item._id || item.id} style={{
                  display: "flex", alignItems: "stretch", gap: 12,
                  background: isBreak ? "#f8fafc" : theme.bg, borderLeft: `4px solid ${isBreak ? "#cbd5e1" : theme.header}`,
                  borderRadius: 12, padding: isBreak ? "8px 12px" : "12px",
                  boxShadow: live ? `0 0 0 2px ${theme.header}` : "0 1px 3px rgba(15,23,42,.06)"
                }}>
                  <div style={{ flexShrink: 0, width: 62, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: isBreak ? "#e2e8f0" : tt.bg, color: isBreak ? "#475569" : tt.text, borderRadius: 9, padding: "6px 4px", fontWeight: 700, fontSize: 12, lineHeight: 1.35 }}>
                    <span>{item.startTime}</span>
                    <span style={{ fontSize: 9, opacity: 0.6, fontWeight: 600 }}>to</span>
                    <span>{item.endTime}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 700, fontSize: 15, color: isBreak ? "#475569" : theme.accent, wordBreak: "break-word" }}>{subjectLabel(item)}</span>
                      {isMine(item) && <YouTag />}
                      {live && <span style={{ background: theme.header, color: "#fff", borderRadius: 20, padding: "1px 8px", fontSize: 10, fontWeight: 700 }}>NOW</span>}
                    </div>
                    {item.type === "Class" && teacherName(item) && (
                      <div style={{ color: theme.accent, fontSize: 12, marginTop: 4, fontWeight: 600, opacity: 0.85 }}>👤 {teacherName(item)}</div>
                    )}
                    {item.room && !isBreak && <div style={{ color: "#64748b", fontSize: 12, marginTop: 3 }}>Room: {item.room}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ padding: isSmall ? 14 : 28 }}>
      <div style={{ background: C.white, borderRadius: 14, padding: isSmall ? 14 : 22, boxShadow: "0 2px 8px rgba(0,0,0,.06)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 16, flex: "1 1 auto" }}>Class Timetable</div>
          {classes.length > 0 && (
            <select value={classId} onChange={e => setClassId(e.target.value)}
              style={{ padding: "9px 12px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.white, fontSize: 13, minWidth: 150, flex: isSmall ? "1 1 100%" : "0 0 auto" }}>
              {classes.map(c => <option key={idOf(c)} value={idOf(c)}>{classLabel(c)}</option>)}
            </select>
          )}
        </div>

        {error && <div style={{ color: C.red, marginBottom: 12, fontSize: 13 }}>{error}</div>}

        {loading ? (
          <div style={{ color: C.muted, padding: 24, textAlign: "center" }}>Loading timetable...</div>
        ) : !classes.length ? (
          <div style={{ color: C.muted, padding: 24, textAlign: "center" }}>No class is assigned to you yet</div>
        ) : !entries.length ? (
          <div style={{ color: C.muted, padding: 30, textAlign: "center", border: `1px dashed ${C.border}`, borderRadius: 10, fontSize: 13 }}>
            No timetable has been created for {classLabel(selectedClass) || "this class"} yet
          </div>
        ) : isSmall ? renderDay() : renderGrid()}
      </div>
    </div>
  );
}

export { TeacherTimetable };