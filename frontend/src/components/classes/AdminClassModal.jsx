import { X } from "../../shared/ui";
import { Portal } from "../common/Portal";

export function AdminClassModal({ title, onClose, children }) {
  return (
    <Portal>
      <div onClick={event => { if (event.target === event.currentTarget) onClose(); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", display: "grid", placeItems: "center", zIndex: 9999, padding: 24 }}>
        <div style={{ background: "#fff", borderRadius: 16, padding: 28, width: "100%", maxWidth: 520, maxHeight: "85vh", overflowY: "auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 17 }}>{title}</div>
            <button type="button" onClick={onClose} aria-label="Close modal" style={{ background: "#f4f6fb", border: "none", borderRadius: 8, width: 32, height: 32, cursor: "pointer", display: "grid", placeItems: "center" }}><X size={16} /></button>
          </div>
          {children}
        </div>
      </div>
    </Portal>
  );
}
