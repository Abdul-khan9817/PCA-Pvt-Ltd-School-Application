import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "../../shared/ui";
import { C } from "../../shared/runtime";

const FEE_TYPES = ["Tuition", "Admission", "Exam", "Transport", "Annual", "Library", "Sports", "Other"];

export function FeeTypeFilterDropdown({ selectedTypes, setSelectedTypes }) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);
  useEffect(() => {
    const close = event => { if (wrapperRef.current && !wrapperRef.current.contains(event.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("touchstart", close, { passive: true });
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("touchstart", close); };
  }, []);
  const toggle = type => setSelectedTypes(selectedTypes.includes(type) ? selectedTypes.filter(item => item !== type) : [...selectedTypes, type]);
  const all = selectedTypes.length === FEE_TYPES.length;
  const label = !selectedTypes.length || all ? "Type: All" : selectedTypes.length === 1 ? `Type: ${selectedTypes[0]}` : `Type: ${selectedTypes.length} Selected`;
  return <div ref={wrapperRef} className="fee-type-wrap" style={{ position: "relative" }}>
    <button type="button" className="fee-type-btn" onClick={() => setOpen(value => !value)} style={{ padding: "8px 12px", borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13, background: "#fff", color: C.text, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
      <span style={{ fontWeight: selectedTypes.length && !all ? 700 : 400 }}>{label}</span><ChevronDown size={14} color={C.muted} style={{ transform: open ? "rotate(180deg)" : "none" }} />
    </button>
    {open && <div className="fee-type-menu" style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, width: 210, maxWidth: "calc(100vw - 24px)", background: "#fff", borderRadius: 10, border: `1px solid ${C.border}`, boxShadow: "0 10px 25px rgba(0,0,0,.15)", zIndex: 1000, padding: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 6px 8px", borderBottom: `1px solid ${C.border}`, fontSize: 12, fontWeight: 700, color: C.muted }}>
        <label><input type="checkbox" checked={all} onChange={() => setSelectedTypes(all ? [] : [...FEE_TYPES])} /> Select All</label>
        {!!selectedTypes.length && <button type="button" onClick={() => setSelectedTypes([])} style={{ border: 0, background: "transparent", color: C.accent, cursor: "pointer", fontSize: 11 }}>Clear</button>}
      </div>
      <div style={{ maxHeight: 200, overflowY: "auto", paddingTop: 4 }}>{FEE_TYPES.map(type => {
        const checked = selectedTypes.includes(type);
        return <label key={type} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", fontSize: 12.5, cursor: "pointer", borderRadius: 6, color: C.text, fontWeight: checked ? 700 : 400, background: checked ? "#eef2ff" : "transparent" }}>
          <input type="checkbox" checked={checked} onChange={() => toggle(type)} />{type}
        </label>;
      })}</div>
    </div>}
  </div>;
}