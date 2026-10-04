import { useState } from "react";
import { C } from "../../shared/runtime";
import { useMediaQuery } from "../../hooks/useMediaQuery";

// Drop-in replacement for <select>. options = [{ value, label }]
// Phone/tablet: custom dropdown that stays inside the card.
// Desktop: normal native select.
export function MobileSelect({ value, onChange, options, placeholder = "Select", style }) {
  const [open, setOpen] = useState(false);
  const isSmall = useMediaQuery("(max-width: 1024px)");
  const current = options.find(o => String(o.value) === String(value));

  if (!isSmall) {
    return (
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          width: "100%", boxSizing: "border-box", padding: "9px 12px", borderRadius: 8,
          border: `1px solid ${C.border}`, background: C.white, color: C.text, fontSize: 13, ...style
        }}
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    );
  }

  return (
    <div style={{ position: "relative", ...style }}>
      {open && <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 9 }} />}
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
        onKeyDown={e => e.key === "Escape" && setOpen(false)}
        style={{
          width: "100%", boxSizing: "border-box", padding: "9px 12px", borderRadius: 8, cursor: "pointer",
          border: `1px solid ${C.border}`, background: C.white, color: C.text, fontSize: 13,
          textAlign: "left", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8
        }}
      >
        <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {current?.label ?? placeholder}
        </span>
        <span style={{ fontSize: 10, color: C.muted, transform: open ? "rotate(180deg)" : "none" }}>▼</span>
      </button>

      {open && (
        <div
          role="listbox"
          style={{
            position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 10, boxSizing: "border-box",
            maxHeight: 240, overflowY: "auto", background: C.white, border: `1px solid ${C.border}`,
            borderRadius: 8, boxShadow: "0 8px 20px rgba(15,23,42,.15)"
          }}
        >
          {options.map(o => {
            const on = String(o.value) === String(value);
            return (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={on}
                onClick={() => { onChange(o.value); setOpen(false); }}
                style={{
                  display: "block", width: "100%", boxSizing: "border-box", padding: "10px 12px", border: "none",
                  cursor: "pointer", textAlign: "left", background: on ? "#eff6ff" : C.white,
                  color: on ? "#1d4ed8" : C.text, fontSize: 13, fontWeight: on ? 700 : 500
                }}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}