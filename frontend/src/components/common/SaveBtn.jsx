import { motion } from "../../shared/ui";
import { C } from "../../shared/runtime";

function SaveBtn({ onClick, label="Save Changes", disabled=false, type="button" }) {
  return (
    <motion.button type={type} disabled={disabled} whileHover={disabled?undefined:{ scale:1.02 }} whileTap={disabled?undefined:{ scale:0.98 }} onClick={onClick}
      style={{ flex:1, width:"100%", background:C.accent, color:"#fff", border:"none",
        borderRadius:10, padding:"12px", fontSize:14, fontWeight:700, cursor:disabled?"not-allowed":"pointer", opacity:disabled?.65:1 }}>
      {label}
    </motion.button>
  );
}

export { SaveBtn };
