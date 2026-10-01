import { Edit, Trash2, DoorOpen, Users, School } from "../../shared/ui";
import { C } from "../../shared/runtime";

const accents = ["#4f6ef7", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6"];

export function AdminClassCards({ classes, onEdit, onDelete }) {
  return <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 18 }}>
    {classes.map((item, index) => {
      const id = item._id || item.id;
      const accent = accents[index % accents.length];
      return <article key={id} style={{ background: "linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)", borderRadius: 16, padding: 22, boxShadow: "0 8px 22px rgba(30,42,74,.09)", border: "1px solid #dbe4ff", borderTop: `4px solid ${accent}` }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#172554" }}>{item.name}{item.section && <span style={{ marginLeft: 8, background: accent, color: "#fff", fontSize: 12, fontWeight: 700, padding: "2px 8px", borderRadius: 6 }}>Sec {item.section}</span>}</div>
          <div style={{ display: "flex", gap: 6 }}>
            <button type="button" aria-label={`Edit ${item.name}`} onClick={() => onEdit(item)} style={{ background: "#f0f4ff", border: "none", borderRadius: 8, width: 32, height: 32, cursor: "pointer" }}><Edit size={14} color={C.accent} /></button>
            <button type="button" aria-label={`Delete ${item.name}`} onClick={() => onDelete(id)} style={{ background: "#fee2e2", border: "none", borderRadius: 8, width: 32, height: 32, cursor: "pointer" }}><Trash2 size={14} color={C.red} /></button>
          </div>
        </header>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div style={{ background: "#eef6ff", padding: "10px 12px", borderRadius: 10, border: "1px solid #dbeafe" }}><div style={{ fontSize: 11, color: "#2563eb", fontWeight: 700, display: "flex", gap: 4 }}><DoorOpen size={12} />Room</div><div style={{ fontWeight: 600, fontSize: 13, color: C.text, marginTop: 3 }}>{item.room || "-"}</div></div>
          <div style={{ background: "#ecfdf5", padding: "10px 12px", borderRadius: 10, border: "1px solid #d1fae5" }}><div style={{ fontSize: 11, color: "#047857", fontWeight: 700, display: "flex", gap: 4 }}><Users size={12} />Capacity</div><div style={{ fontWeight: 600, fontSize: 13, color: C.text, marginTop: 3 }}>{item.capacity || "-"} students</div></div>
        </div>
      </article>;
    })}
  </div>;
}

export function EmptyClassState({ search, onCreate }) {
  return <div style={{ textAlign: "center", padding: "70px 20px" }}><School size={30} color={C.accent} /><div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginTop: 16 }}>No Classes Found</div><div style={{ fontSize: 13, color: C.muted, marginTop: 4, marginBottom: 20 }}>{search ? "No classes match your search query." : "Get started by creating your first class and section."}</div><button type="button" onClick={onCreate} style={{ background: C.accent, color: "#fff", border: "none", borderRadius: 10, padding: "10px 20px", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>+ Create Class</button></div>;
}
