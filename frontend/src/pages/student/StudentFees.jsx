import { useState, useEffect } from "react";
import { C, ROW_COLORS } from "../../shared/runtime";
import { list } from "../../services/resource.service";
import { onResourceChange } from "../../services/socket.service";
import { Download } from "../../shared/ui";
import { downloadFeeReceipt } from "../../utils/documents";
import useIsMobile from "../../hooks/useIsMobile";

const MOBILE_BREAKPOINT = 640;

function StudentFees({ userData }) {
  const [feesData, setFeesData] = useState([]);
  const [rawFees, setRawFees] = useState([]);
  const isMobile = useIsMobile(MOBILE_BREAKPOINT);

  const mapFee = f => ({
    id: f._id || f.id,
    type: f.type || "Tuition Fee",
    month: f.month || "Current",
    amount: f.amount || 0,
    // Fee documents store the collected amount in `paid`
    paid: Number(f.paid ?? f.paidAmount) || (f.status === "Paid" ? f.amount : 0),
    dueDate: f.dueDate ? new Date(f.dueDate).toLocaleDateString() : "—",
    status: f.status || "Pending"
  });

  const loadFees = () => {
    list("fees", "limit=100")
      .then(r => {
        const list = r?.data || r || [];
        setRawFees(list);
        setFeesData(list.map(mapFee));
      })
      .catch(() => {});
  };

  useEffect(() => {
    loadFees();
    const unsubFees = onResourceChange("fees", () => loadFees());
    return () => unsubFees?.();
  }, []);

  // Builds the { student, month, items } payload downloadFeeReceipt expects.
  const buildReceiptPayload = (records, periodLabel) => {
    const st = records[0]?.student && typeof records[0].student === "object" ? records[0].student : {};
    return {
      student: {
        name: st.user?.name || userData?.name || "Student",
        roll: st.roll || st.studentId || "",
        cls: st.cls ? `${st.cls}${st.section ? `-${st.section}` : ""}` : "",
        fatherName: st.fatherName || st.guardianName || ""
      },
      month: periodLabel,
      items: records.map(f => ({
        _id: f._id, type: f.type, amount: f.amount, paid: f.paid, status: f.status,
        dueDate: f.dueDate, paymentMethod: f.paymentMethod, transactionId: f.transactionId,
        paidAt: f.paidAt, notes: f.notes
      }))
    };
  };

  // Download one combined PDF covering every fee record (all months at once).
  const handleDownloadAll = () => {
    if (rawFees.length === 0) return;
    const months = [...new Set(rawFees.map(f => f.month || "Current"))];
    const periodLabel = months.length === 1 ? months[0] : `${months.length} periods`;
    downloadFeeReceipt(buildReceiptPayload(rawFees, periodLabel));
  };

  const totalAmount = feesData.reduce((s, f) => s + f.amount, 0);
  const totalPaid = feesData.reduce((s, f) => s + f.paid, 0);
  const totalDue = Math.max(0, totalAmount - totalPaid);

  const summaryCards = [
    { label: "Total Amount", value: `₹${totalAmount.toLocaleString()}`, bg: "#f0f4ff", color: C.accent },
    { label: "Total Paid", value: `₹${totalPaid.toLocaleString()}`, bg: "#d1fae5", color: C.teal },
    { label: "Amount Due", value: `₹${totalDue.toLocaleString()}`, bg: "#fee2e2", color: C.red },
  ];

  // Desktop / tablet: the original table.
  const renderTable = () => (
    <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <table className="rtable" style={{ width:"100%", borderCollapse:"collapse" }}>
        <thead><tr style={{ background:"#f8fafc" }}>
          {["FEE TYPE","MONTH / PERIOD","AMOUNT","DUE DATE","STATUS"].map(h=>(
            <th key={h} style={{ padding:"10px 14px", textAlign:"left", fontSize:11, fontWeight:700, color:C.muted }}>{h}</th>
          ))}
        </tr></thead>
        <tbody>
          {feesData.map((f,i)=>(
            <tr key={f.id || i} style={{ background:ROW_COLORS[i%ROW_COLORS.length], borderBottom:"1px solid "+C.border }}>
              <td className="rtable-full" style={{ padding:"12px 14px", fontWeight:600, fontSize:13 }}>{f.type}</td>
              <td data-label="Month" style={{ padding:"12px 14px", fontSize:13, fontWeight:600, color:C.accent }}>{f.month}</td>
              <td data-label="Amount" style={{ padding:"12px 14px", fontSize:13, fontWeight:600 }}>₹{f.amount.toLocaleString()}</td>
              <td data-label="Due Date" style={{ padding:"12px 14px", fontSize:13 }}>{f.dueDate}</td>
              <td data-label="Status" style={{ padding:"12px 14px" }}>
                <span style={{ background:f.status==="Paid"?"#d1fae5":"#fee2e2", color:f.status==="Paid"?C.teal:C.red,
                  borderRadius:20, padding:"3px 10px", fontSize:11, fontWeight:600 }}>{f.status}</span>
              </td>
            </tr>
          ))}
          {feesData.length === 0 && (
            <tr>
              <td colSpan={5} style={{ padding:30, textAlign:"center", color:C.muted, fontSize:13 }}>
                No fee records found
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  // Mobile: one stacked card per fee record — no horizontal scrolling, no
  // squeezed columns. Same fields, just arranged as label/value pairs.
  const renderCards = () => (
    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
      {feesData.length === 0 ? (
        <div style={{ padding:30, textAlign:"center", color:C.muted, fontSize:13 }}>
          No fee records found
        </div>
      ) : (
        feesData.map((f,i) => (
          <div key={f.id || i} style={{
            background: ROW_COLORS[i % ROW_COLORS.length],
            border: `1px solid ${C.border}`,
            borderRadius: 12,
            padding: 14,
          }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
              <div style={{ fontWeight:700, fontSize:14 }}>{f.type}</div>
              <span style={{ background:f.status==="Paid"?"#d1fae5":"#fee2e2", color:f.status==="Paid"?C.teal:C.red,
                borderRadius:20, padding:"3px 10px", fontSize:11, fontWeight:600, flexShrink:0 }}>{f.status}</span>
            </div>

            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, fontSize:12 }}>
              <div>
                <div style={{ color:C.muted, fontSize:10, marginBottom:2 }}>MONTH / PERIOD</div>
                <div style={{ fontWeight:600, color:C.accent }}>{f.month}</div>
              </div>
              <div>
                <div style={{ color:C.muted, fontSize:10, marginBottom:2 }}>AMOUNT</div>
                <div style={{ fontWeight:600 }}>₹{f.amount.toLocaleString()}</div>
              </div>
              <div style={{ gridColumn:"span 2" }}>
                <div style={{ color:C.muted, fontSize:10, marginBottom:2 }}>DUE DATE</div>
                <div>{f.dueDate}</div>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );

  return (
    <div style={{ padding: isMobile ? 16 : 28 }}>
      <div style={{ background:C.white, borderRadius:14, padding: isMobile ? 16 : 22, boxShadow:"0 2px 8px rgba(0,0,0,.06)" }}>
        <div style={{
          display:"grid",
          gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr",
          gap:16, marginBottom:24
        }}>
          {summaryCards.map(item=>(
            <div key={item.label} style={{ background:item.bg, borderRadius:12, padding:16, textAlign:"center" }}>
              <div style={{ color:item.color, fontWeight:700, fontSize:20 }}>{item.value}</div>
              <div style={{ color:C.muted, fontSize:11, marginTop:6 }}>{item.label}</div>
            </div>
          ))}
        </div>

        {feesData.length > 0 && (
          <div style={{ display:"flex", justifyContent: isMobile ? "stretch" : "flex-end", marginBottom:12 }}>
            <button type="button" onClick={handleDownloadAll}
              title="Download one PDF covering every fee record"
              style={{
                display:"flex", alignItems:"center", justifyContent:"center", gap:6,
                background:"#eef2ff", color:C.accent, border:"none", borderRadius:8,
                padding:"9px 14px", cursor:"pointer", fontSize:13, fontWeight:600,
                width: isMobile ? "100%" : "auto",
              }}>
              <Download size={14} /> Download All
            </button>
          </div>
        )}

        {isMobile ? renderCards() : renderTable()}
      </div>
    </div>
  );
}

export { StudentFees };