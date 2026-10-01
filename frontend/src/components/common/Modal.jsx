import { useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, X } from "../../shared/ui";
import { C } from "../../shared/runtime";
function Modal({ title, onClose, children, width = 500, zIndex = 9999 }) {
  useEffect(() => {
    const onKeyDown = (event) => { if (event.key === "Escape") onClose?.(); };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);
  return createPortal(
    <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
      style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.45)", display:"flex",
        alignItems:"center", justifyContent:"center", zIndex }}
      onClick={onClose}>
      <motion.div className="edumanage-modal-card" initial={{ scale:0.9 }} animate={{ scale:1 }} exit={{ scale:0.9 }}
        onClick={e=>e.stopPropagation()}
        style={{ background:C.white, borderRadius:18, padding:32, width, maxWidth:"94vw",
          maxHeight:"88vh", overflowY:"auto", boxShadow:"0 20px 60px rgba(0,0,0,.2)" }}>
        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:20 }}>
          <div style={{ fontSize:18, fontWeight:700 }}>{title}</div>
          <button type="button" onClick={onClose} style={{ background:"#f4f6fb", border:"none", borderRadius:8,
            width:32, height:32, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}>
            <X size={16} />
          </button>
        </div>
        {children}
      </motion.div>
    </motion.div>,
    document.body
  );
}
export { Modal };
