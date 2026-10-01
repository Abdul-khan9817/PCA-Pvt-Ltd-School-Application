import { C } from "../../shared/runtime";
import { FEE_TYPES, FEE_TYPE_COLORS } from "./AdminFeeFormFields";

const inputStyle = { width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid " + C.border, fontSize: 13, outline: "none", boxSizing: "border-box", minWidth: 0 };
const labelStyle = { display: "block", fontSize: 12, fontWeight: 700, color: C.muted, marginBottom: 4 };

export function ClassFeeFields({ data, onChange, classOptions, monthOptions, getDefaultAmount }) {
  const selected = data.selectedTypes || [];
  const updateClass = event => {
    const cls = event.target.value;
    if (!getDefaultAmount) return onChange({ cls });
    const amounts = { ...(data.typeAmounts || {}) };
    selected.forEach(type => {
      const current = amounts[type];
      const previousDefault = getDefaultAmount(data.cls, type);
      if (current === "" || current === undefined || String(current) === String(previousDefault)) amounts[type] = getDefaultAmount(cls, type);
    });
    onChange({ cls, typeAmounts: amounts });
  };

  return <>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
      <div style={{ minWidth: 0 }}><label style={labelStyle}>Class *</label><select value={data.cls} onChange={updateClass} style={inputStyle}><option value="">-- Choose Class --</option>{classOptions.map(value => <option key={value} value={value}>{value}</option>)}</select></div>
      <div style={{ minWidth: 0 }}><label style={labelStyle}>Month / Period *</label><select value={data.month} onChange={event => onChange({ month: event.target.value })} style={inputStyle}>{monthOptions.map(month => <option key={month} value={month}>{month}</option>)}</select></div>
    </div>
    <div>
      <label style={{ ...labelStyle, marginBottom: 6 }}>Fee Types * (amount is per student)</label>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 8, background: "#f8fafc", padding: 12, borderRadius: 10, border: "1px solid " + C.border }}>
        {FEE_TYPES.map(type => {
          const checked = selected.includes(type);
          const colors = FEE_TYPE_COLORS[type] || FEE_TYPE_COLORS.Other;
          return <label key={type} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 700, cursor: "pointer", padding: "5px 8px", borderRadius: 7, background: checked ? colors.bg : "transparent", color: checked ? colors.text : C.text, border: checked ? `1px solid ${colors.border}` : "1px solid transparent", minWidth: 0 }}><input type="checkbox" checked={checked} style={{ accentColor: colors.text }} onChange={() => { const updated = checked ? selected.filter(item => item !== type) : [...selected, type]; const amounts = { ...(data.typeAmounts || {}) }; if (updated.includes(type)) { if (!amounts[type]) amounts[type] = getDefaultAmount ? getDefaultAmount(data.cls, type) : ""; } else delete amounts[type]; onChange({ selectedTypes: updated, typeAmounts: amounts }); }} />{type}</label>;
        })}
      </div>
    </div>
    {selected.length > 0 && <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 190px), 1fr))", gap: 8 }}>{selected.map(type => { const colors = FEE_TYPE_COLORS[type] || FEE_TYPE_COLORS.Other; return <div key={type} style={{ display: "flex", alignItems: "center", gap: 8, background: colors.bg, border: `1px solid ${colors.border}`, borderRadius: 8, padding: "6px 10px", minWidth: 0 }}><span style={{ minWidth: 64, fontSize: 11.5, fontWeight: 700, color: colors.text }}>{type}</span><input type="number" min="0" placeholder="₹ Amount" value={data.typeAmounts?.[type] || ""} onChange={event => onChange({ typeAmounts: { ...(data.typeAmounts || {}), [type]: event.target.value } })} style={{ flex: 1, minWidth: 0, padding: "5px 8px", borderRadius: 6, border: `1px solid ${colors.border}`, fontSize: 13, outline: "none", background: "#fff", color: C.text }} /></div>; })}</div>}
    <div><label style={labelStyle}>Due Date</label><input type="date" value={data.dueDate} onChange={event => onChange({ dueDate: event.target.value })} style={inputStyle} /></div>
  </>;
}
