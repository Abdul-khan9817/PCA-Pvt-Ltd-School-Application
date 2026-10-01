import { motion } from "../../shared/ui";
import { C } from "../../shared/runtime";

function CancelBtn({ onClick, disabled=false, label="Cancel" }) {
  return (
    <motion.button type="button" disabled={disabled} whileHover={disabled?undefined:{ scale:1.02 }} whileTap={disabled?undefined:{ scale:0.98 }} onClick={onClick}
      style={{ flex:1, background:"#f4f6fb", color:C.text, border:"none",
        borderRadius:10, padding:"12px", fontSize:14, fontWeight:700, cursor:disabled?"not-allowed":"pointer", opacity:disabled?.65:1 }}>
      {label}
    </motion.button>
  );
}

export { CancelBtn };
