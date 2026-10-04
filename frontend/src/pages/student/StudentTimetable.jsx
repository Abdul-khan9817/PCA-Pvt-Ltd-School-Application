import { useEffect, useState } from "react";
import { C } from "../../shared/runtime";
import { api } from "../../services/apiClient";
import { onResourceChange } from "../../services/socket.service";

const ALL_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// Below this width the wide grid is replaced by a one-day-at-a-time view
// (phones and tablets). Above it the full weekly grid fits without scrolling.
const GRID_BREAKPOINT = 1024;

// Distinct theme per day: header color, cell background, accent text
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

const teacherName = item => item?.teacher?.name || item?.teacher?.user?.name || "";
const timeKey = item => `${item.startTime || ""}${item.endTime ? `-${item.endTime}` : ""}`;
const subjectLabel = item => item.subjectId?.name || item.type || "Subject";

function useIsGridSize(breakpoint = GRID_BREAKPOINT) {
  const query = `(min-width: ${breakpoint + 1}px)`;
  const [matches, setMatches] = useState(
    () => typeof window !== "undefined" && window.matchMedia(query).matches
  );

  useEffect(() => {
    const mq = window.matchMedia(query);
    const handler = e => setMatches(e.matches);
    setMatches(mq.matches);
    if (mq.addEventListener) {
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }
    mq.addListener(handler);
    return () => mq.removeListener(handler);
  }, [query]);

  return matches;
}

// "08:30" style strings compare correctly as text.
const nowHHMM = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

function StudentTimetable() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedDay, setSelectedDay] = useState("");
  const [dayOpen, setDayOpen] = useState(false);
  const showGrid = useIsGridSize();

  const load = () => {
    setLoading(true);
    api.get("/timetable?limit=500")
      .then(result => setEntries(result.data || []))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    const unsubscribe = onResourceChange("timetable", load);
    return () => unsubscribe?.();
  }, []);

  const days = entries.some(item => item.day === "Saturday")
    ? ALL_DAYS
    : ALL_DAYS.filter(d => d !== "Saturday");

  const today = new Date().toLocaleDateString("en-US", { weekday: "long" });

  // Default to today when it has classes' day column, otherwise the first day with entries.
  useEffect(() => {
    if (selectedDay || !entries.length) return;
    const firstWithEntries = days.find(d => entries.some(e => e.day === d));
    setSelectedDay(days.includes(today) ? today : firstWithEntries || days[0]);
  }, [entries]);

  const times = [...new Set(entries.map(timeKey))].filter(Boolean).sort();
  const cell = (time, day) => entries.filter(item => item.day === day && timeKey(item) === time);

  /* ------------------------- desktop weekly grid ------------------------- */
  const renderGrid = () => (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 4, minWidth: 900, tableLayout: "fixed" }}>
        <thead>
          <tr>
            <th style={{ width: 120, padding: 12, textAlign: "left", fontSize: 11, color: C.white, background: "#334155", borderRadius: 10 }}>TIME</th>
            {days.map(day => (
              <th key={day} style={{
                padding: 12, fontSize: 12, color: C.white, background: dayThemes[day].header, borderRadius: 10,
                outline: day === today ? "2px solid #fbbf24" : "none", outlineOffset: -2
              }}>
                {day.slice(0, 3).toUpperCase()}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {times.map((time, rowIndex) => {
            const timeTheme = timeThemes[rowIndex % timeThemes.length];
            return (
              <tr key={time}>
                <td style={{ padding: 12, fontSize: 13, color: timeTheme.text, whiteSpace: "nowrap", background: timeTheme.bg, borderRadius: 10, fontWeight: 700, boxShadow: "0 1px 3px rgba(15,23,42,.08)" }}>
                  <span style={{ marginRight: 6 }}>🕐</span>{time}
                </td>
                {days.map(day => {
                  const items = cell(time, day);
                  const theme = dayThemes[day];
                  return (
                    <td key={day} style={{
                      padding: 8, verticalAlign: "top", wordBreak: "break-word",
                      background: items.length ? theme.bg : "#f8fafc", borderRadius: 10,
                      borderLeft: items.length ? `3px solid ${theme.header}` : "none"
                    }}>
                      {items.map(item => (
                        <div key={item._id || item.id} style={{ marginBottom: 8, paddingBottom: 8, borderBottom: items.length > 1 ? `1px solid ${theme.header}55` : "none" }}>
                          <div style={{ fontWeight: 700, color: theme.accent, fontSize: 13 }}>{subjectLabel(item)}</div>
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

  /* ---------------------- phone / tablet: one day at a time ---------------------- */
  const renderDayView = () => {
    const day = selectedDay || days[0];
    const theme = dayThemes[day];
    const dayEntries = entries
      .filter(item => item.day === day)
      .sort((a, b) => (a.startTime || "").localeCompare(b.startTime || ""));
    const now = nowHHMM();
    const isToday = day === today;
    const dayText = d => `${d}${d === today ? " (Today)" : ""}`;

    return (
      <div>
        {/* Day dropdown */}
        <div style={{ position: "relative", marginBottom: 14 }}>
          {dayOpen && <div onClick={() => setDayOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 9 }} />}
          <button
            type="button"
            onClick={() => setDayOpen(o => !o)}
            style={{
              width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 8, cursor: "pointer",
              border: `1.5px solid ${theme.header}`, background: theme.header, color: "#fff",
              fontSize: 14, fontWeight: 700, textAlign: "left", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8
            }}
          >
            <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{dayText(day)}</span>
            <span style={{ fontSize: 11, transform: dayOpen ? "rotate(180deg)" : "none" }}>▼</span>
          </button>

          {dayOpen && (
            <div style={{
              position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 10, boxSizing: "border-box",
              background: C.white, border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden",
              boxShadow: "0 8px 20px rgba(15,23,42,.15)"
            }}>
              {days.map(d => {
                const on = d === day;
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => { setSelectedDay(d); setDayOpen(false); }}
                    style={{
                      display: "block", width: "100%", boxSizing: "border-box", padding: "11px 12px", border: "none",
                      borderLeft: `4px solid ${dayThemes[d].header}`, cursor: "pointer", textAlign: "left",
                      background: on ? dayThemes[d].bg : C.white, color: dayThemes[d].accent,
                      fontSize: 14, fontWeight: on ? 700 : 600
                    }}
                  >
                    {dayText(d)}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ fontSize: 13, color: C.muted, marginBottom: 10, fontWeight: 600 }}>
          {day}{isToday ? " · Today" : ""}
        </div>

        {!dayEntries.length ? (
          <div style={{ padding: 30, textAlign: "center", color: C.muted, fontSize: 13, background: "#f8fafc", borderRadius: 12 }}>
            No classes on {day}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {dayEntries.map(item => {
              const isBreak = NON_TEACHING.includes(item.type);
              const live = isToday && item.startTime && item.endTime && now >= item.startTime && now < item.endTime;
              const timeTheme = timeThemes[times.indexOf(timeKey(item)) % timeThemes.length] || timeThemes[0];

              return (
                <div key={item._id || item.id} style={{
                  display: "flex", alignItems: "stretch", gap: 12,
                  background: isBreak ? "#f8fafc" : theme.bg,
                  borderLeft: `4px solid ${isBreak ? "#cbd5e1" : theme.header}`,
                  borderRadius: 12, padding: isBreak ? "8px 12px" : "12px",
                  boxShadow: live ? `0 0 0 2px ${theme.header}` : "0 1px 3px rgba(15,23,42,.06)"
                }}>
                  <div style={{
                    flexShrink: 0, width: 62, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                    background: isBreak ? "#e2e8f0" : timeTheme.bg, color: isBreak ? "#475569" : timeTheme.text,
                    borderRadius: 9, padding: "6px 4px", fontWeight: 700, fontSize: 12, lineHeight: 1.35
                  }}>
                    <span>{item.startTime}</span>
                    <span style={{ fontSize: 9, opacity: 0.6, fontWeight: 600 }}>to</span>
                    <span>{item.endTime}</span>
                  </div>

                  <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 700, fontSize: 15, color: isBreak ? "#475569" : theme.accent, wordBreak: "break-word" }}>
                        {subjectLabel(item)}
                      </span>
                      {live && (
                        <span style={{ background: theme.header, color: "#fff", borderRadius: 20, padding: "1px 8px", fontSize: 10, fontWeight: 700 }}>NOW</span>
                      )}
                    </div>
                    {item.type === "Class" && teacherName(item) && (
                      <div style={{ color: theme.accent, fontSize: 12, marginTop: 4, fontWeight: 600, opacity: 0.85 }}>👤 {teacherName(item)}</div>
                    )}
                    {item.room && !isBreak && (
                      <div style={{ color: "#64748b", fontSize: 12, marginTop: 3 }}>Room: {item.room}</div>
                    )}
                    {item.type && item.type !== "Class" && !isBreak && (
                      <div style={{ color: "#64748b", fontSize: 11, marginTop: 3 }}>{item.type}</div>
                    )}
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
    <div style={{ padding: showGrid ? 28 : 14 }}>
      <div style={{ background: C.white, borderRadius: 14, padding: showGrid ? 22 : 14, boxShadow: "0 2px 8px rgba(0,0,0,.06)" }}>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 16 }}>Weekly Timetable</div>
        {error && <div style={{ color: C.red, marginBottom: 12, fontSize: 13 }}>{error}</div>}
        {loading ? (
          <div style={{ color: C.muted, padding: 24, textAlign: "center" }}>Loading timetable...</div>
        ) : !entries.length ? (
          <div style={{ color: C.muted, padding: 24, textAlign: "center" }}>No timetable entries yet</div>
        ) : showGrid ? renderGrid() : renderDayView()}
      </div>
    </div>
  );
}

export { StudentTimetable };