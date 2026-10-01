import { motion } from "../../shared/ui";
import { C } from "../../shared/runtime";

function FormField({ label, value, onChange, type="text", placeholder, required = false }) {
  return (
    <div style={{ marginBottom:16 }}>
      <label style={{ fontSize:13, fontWeight:600, display:"block", marginBottom:6 }}>{label}{required && <span style={{ color:C.red }}> *</span>}</label>
      <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder ?? `Enter ${label.replace(" *", "").toLowerCase()}`}
        style={{ width:"100%", padding:"10px 14px", borderRadius:10, border:"1.5px solid "+C.border, fontSize:13, outline:"none", boxSizing:"border-box" }} />
    </div>
  );
}

export { FormField };
