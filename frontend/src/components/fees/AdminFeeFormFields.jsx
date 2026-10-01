import { C } from "../../shared/runtime";

export const FEE_TYPES = ["Tuition", "Admission", "Exam", "Transport", "Annual", "Library", "Sports", "Other"];
export const PAYMENT_METHODS = ["Cash", "Card", "Bank Transfer", "UPI", "Online Portal", "Cheque"];
export const FEE_TYPE_COLORS = {
  Tuition: { bg: "#eef2ff", text: "#6366f1", border: "#c7d2fe" },
  Admission: { bg: "#fdf4ff", text: "#a21caf", border: "#e879f9" },
  Exam: { bg: "#fff7ed", text: "#ea580c", border: "#fed7aa" },
  Transport: { bg: "#ecfdf5", text: "#059669", border: "#6ee7b7" },
  Annual: { bg: "#eff6ff", text: "#2563eb", border: "#93c5fd" },
  Library: { bg: "#fefce8", text: "#ca8a04", border: "#fde68a" },
  Sports: { bg: "#fdf2f8", text: "#db2777", border: "#f9a8d4" },
  Other: { bg: "#f8fafc", text: "#64748b", border: "#cbd5e1" },
};

const inputStyle = { width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid " + C.border, fontSize: 13, outline: "none", boxSizing: "border-box", minWidth: 0 };
const labelStyle = { display: "block", fontSize: 12, fontWeight: 700, color: C.muted, marginBottom: 4 };

export function FeeFormFields({ data, onChange, students, typeOptions, monthOptions, paidLabel, showBalance = false, studentFallback, getDefaultAmount }) {
  const selected = data.selectedTypes || [];
  const totalAmount = Object.values(data.typeAmounts || {}).reduce((sum, value) => sum + (Number(value) || 0), 0);
  const paidNum = Number(data.paid) || 0;
  const balance = Math.max(0, totalAmount - paidNum);
  const studentKnown = students.some(student => student._id === data.student);

  return (
    <>
      <div>
        <label style={labelStyle}>Select Student *</label>
        <select value={data.student} onChange={event => {
          const studentId = event.target.value;
          if (!getDefaultAmount) return onChange({ student: studentId });
          const amounts = { ...(data.typeAmounts || {}) };
          selected.forEach(type => {
            const current = amounts[type];
            const previousDefault = getDefaultAmount(data.student, type);
            if (current === "" || current === undefined || String(current) === String(previousDefault)) amounts[type] = getDefaultAmount(studentId, type);
          });
          onChange({ student: studentId, typeAmounts: amounts });
        }} required style={inputStyle}>
          <option value="">-- Choose Student --</option>
          {!studentKnown && data.student && studentFallback && <option value={data.student}>{studentFallback}</option>}
          {students.map(student => {
            const name = student.user?.name || student.name || "Student";
            const roll = student.roll || student.studentId || "";
            const className = student.cls ? ` (${student.cls}${student.section ? `-${student.section}` : ""})` : "";
            return <option key={student._id} value={student._id}>{name} {roll ? `[${roll}]` : ""} {className}</option>;
          })}
        </select>
      </div>

      <div>
        <label style={{ ...labelStyle, marginBottom: 6 }}>Fee Types * (Select one or multiple)</label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(112px, 1fr))", gap: 8, background: "#f8fafc", padding: 12, borderRadius: 10, border: "1px solid " + C.border }}>
          {typeOptions.map(type => {
            const checked = selected.includes(type);
            const colors = FEE_TYPE_COLORS[type] || FEE_TYPE_COLORS.Other;
            return <label key={type} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 700, cursor: "pointer", padding: "5px 8px", borderRadius: 7, background: checked ? colors.bg : "transparent", color: checked ? colors.text : C.text, border: checked ? `1px solid ${colors.border}` : "1px solid transparent", minWidth: 0 }}>
              <input type="checkbox" checked={checked} style={{ accentColor: colors.text }} onChange={() => {
                const updated = checked ? selected.filter(item => item !== type) : [...selected, type];
                const amounts = { ...(data.typeAmounts || {}) };
                if (updated.includes(type)) {
                  if (!amounts[type]) amounts[type] = getDefaultAmount ? getDefaultAmount(data.student, type) : "";
                } else delete amounts[type];
                onChange({ selectedTypes: updated, typeAmounts: amounts });
              }} />
              {type}
            </label>;
          })}
        </div>
      </div>

      <div>
        <label style={labelStyle}>Month / Period *</label>
        <select value={data.month} onChange={event => onChange({ month: event.target.value })} style={inputStyle}>
          {monthOptions.map(month => <option key={month} value={month}>{month}</option>)}
        </select>
      </div>

      {selected.length > 0 && <div>
        <label style={{ ...labelStyle, marginBottom: 8 }}>Fee Amount per Type (₹) *</label>
        <div style={{ display: "grid", gridTemplateColumns: selected.length > 2 ? "repeat(auto-fit, minmax(min(100%, 210px), 1fr))" : "1fr", gap: 8 }}>
          {selected.map(type => {
            const colors = FEE_TYPE_COLORS[type] || FEE_TYPE_COLORS.Other;
            return <div key={type} style={{ display: "flex", alignItems: "center", gap: 8, background: colors.bg, border: `1px solid ${colors.border}`, borderRadius: 8, padding: "6px 10px", minWidth: 0 }}>
              <span style={{ minWidth: 70, fontSize: 11.5, fontWeight: 700, color: colors.text }}>{type}</span>
              <input type="number" min="0" placeholder="₹ Amount" value={data.typeAmounts?.[type] || ""} onChange={event => onChange({ typeAmounts: { ...(data.typeAmounts || {}), [type]: event.target.value } })} style={{ flex: 1, padding: "5px 8px", borderRadius: 6, minWidth: 0, border: `1px solid ${colors.border}`, fontSize: 13, outline: "none", background: "#fff", color: C.text }} />
            </div>;
          })}
        </div>
        {(selected.length > 1 || showBalance) && <div style={{ display: "flex", alignItems: "center", justifyContent: showBalance ? "space-between" : "flex-end", gap: 10, flexWrap: "wrap", marginTop: 8, padding: "8px 12px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}><span style={{ fontSize: 12.5, fontWeight: 700, color: "#166534" }}>Total Amount:</span><span style={{ fontSize: 15, fontWeight: 800, color: "#15803d" }}>₹{totalAmount.toLocaleString()}</span></div>
          {showBalance && <div style={{ display: "flex", alignItems: "center", gap: 10 }}><span style={{ fontSize: 12.5, fontWeight: 700, color: "#166534" }}>Balance Due:</span><span style={{ fontSize: 15, fontWeight: 800, color: balance > 0 ? "#dc2626" : "#15803d" }}>₹{balance.toLocaleString()}</span></div>}
        </div>}
      </div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
        <div style={{ minWidth: 0 }}><label style={labelStyle}>{paidLabel}</label><input type="number" min="0" placeholder="0" value={data.paid} onChange={event => onChange({ paid: event.target.value })} style={inputStyle} /></div>
        <div style={{ minWidth: 0 }}><label style={labelStyle}>Due Date</label><input type="date" value={data.dueDate} onChange={event => onChange({ dueDate: event.target.value })} style={inputStyle} /></div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
        <div style={{ minWidth: 0 }}><label style={labelStyle}>Payment Method</label><select value={data.paymentMethod} onChange={event => onChange({ paymentMethod: event.target.value })} style={inputStyle}>{PAYMENT_METHODS.map(method => <option key={method} value={method}>{method}</option>)}</select></div>
        <div style={{ minWidth: 0 }}><label style={labelStyle}>Transaction ID / Ref</label><input type="text" placeholder="Optional TXN ID" value={data.transactionId} onChange={event => onChange({ transactionId: event.target.value })} style={inputStyle} /></div>
      </div>
      <div><label style={labelStyle}>Notes / Remarks</label><input type="text" placeholder="Optional notes..." value={data.notes} onChange={event => onChange({ notes: event.target.value })} style={inputStyle} /></div>
    </>
  );
}
