import { C } from "../../shared/runtime";

const ALL_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const pillButtonStyle = {
  border: `1px solid ${C.border}`,
  background: C.white,
  borderRadius: 6,
  padding: "4px 10px",
  fontSize: 11,
  fontWeight: 700,
  color: C.muted,
  cursor: "pointer",
};

export function DayCheckboxes({ selected, onChange }) {
  const toggle = day => onChange(
    selected.includes(day) ? selected.filter(item => item !== day) : [...selected, day]
  );
  const weekdays = ALL_DAYS.filter(day => day !== "Saturday");

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
        {ALL_DAYS.map(day => {
          const on = selected.includes(day);
          return (
            <label key={day} style={{
              display: "flex", alignItems: "center", gap: 5, padding: "6px 10px",
              borderRadius: 8, border: `1.5px solid ${on ? C.accent : C.border}`,
              background: on ? "#eef2ff" : C.white, cursor: "pointer", fontSize: 12,
              fontWeight: 700, color: on ? C.accent : C.text,
            }}>
              <input type="checkbox" checked={on} onChange={() => toggle(day)} style={{ margin: 0 }} />
              {day.slice(0, 3)}
            </label>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" onClick={() => onChange(weekdays)} style={pillButtonStyle}>Weekdays (Mon–Fri)</button>
        <button type="button" onClick={() => onChange(ALL_DAYS)} style={pillButtonStyle}>Every day incl. Sat</button>
        <button type="button" onClick={() => onChange([])} style={pillButtonStyle}>Clear</button>
      </div>
    </div>
  );
}