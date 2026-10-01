import { useState, useEffect } from "react";
import { motion, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from "../../shared/ui";
import { C, ROW_COLORS, SUBJECTS_LIST, calcGrade } from "../../shared/runtime";
import { api } from "../../services/apiClient";
import { onResourceChange } from "../../services/socket.service";

function StudentMarks() {
  const [term, setTerm] = useState("Overall");
  const [gradesList, setGradesList] = useState([]);

  const loadGrades = () => {
    const query = term === "Overall"
      ? "?limit=500"
      : `?term=${encodeURIComponent(term)}&limit=500`;
    api.get(`/grades${query}`).then(res => {
      const list = res.data || res || [];
      setGradesList(list);
      if (res.meta?.warning) {
        console.warn(res.meta.warning);
      }
    }).catch(() => setGradesList([]));
  };

  useEffect(() => {
    loadGrades();
    const unsub = onResourceChange("grades", () => loadGrades());
    return () => unsub?.();
  }, [term]);

  // Map grades by subject (if Overall, average per subject across terms; if single term, show that term's grades)
  const mappedGrades = (() => {
    const toPercent = (g) => {
      const marks = Number(g.marks || 0);
      const max = Number(g.maxMarks || 100) || 100;
      return max > 0 ? Math.round((marks / max) * 100) : 0;
    };

    if (term !== "Overall") {
      return gradesList.map(g => {
        const pct = toPercent(g);
        return {
          subject: g.subjectId?.name || g.subject || "Subject",
          term: g.term || "Term",
          marks: pct,
          grade: g.grade || calcGrade(pct),
          remarks: g.remarks || (pct >= 80 ? "Excellent" : pct >= 60 ? "Good" : "Needs Improvement")
        };
      });
    }

    // Overall: Group by subject and average percentage across terms
    const subjectMap = {};
    gradesList.forEach(g => {
      const subName = g.subjectId?.name || g.subject || "Subject";
      if (!subjectMap[subName]) {
        subjectMap[subName] = { pctList: [], terms: [] };
      }
      if (g.marks !== undefined && g.marks !== null) {
        subjectMap[subName].pctList.push(toPercent(g));
        if (g.term) subjectMap[subName].terms.push(g.term);
      }
    });

    return Object.entries(subjectMap).map(([subName, info]) => {
      const avgPct = info.pctList.length
        ? Math.round(info.pctList.reduce((a, b) => a + b, 0) / info.pctList.length)
        : 0;
      return {
        subject: subName,
        term: info.terms.join(", ") || "All Terms",
        marks: avgPct,
        grade: calcGrade(avgPct),
        remarks: avgPct >= 80 ? "Excellent" : avgPct >= 60 ? "Good" : "Needs Improvement"
      };
    });
  })();

  const data = mappedGrades;
  const avg = data.length ? Math.round(data.reduce((s,d)=>s+d.marks,0)/data.length) : 0;
  const best = data.length ? [...data].sort((a,b)=>b.marks-a.marks)[0] : null;
  const worst = data.length ? [...data].sort((a,b)=>a.marks-b.marks)[0] : null;
  const overallGrade = !data.length ? "—" : avg>=85?"A+":avg>=75?"A":avg>=65?"B+":avg>=55?"B":avg>=45?"C":"D";

  const SUMMARY_CARDS=[
    { value:`${avg}%`, label:"Term Average", sub:data.length ? `Grade ${overallGrade}` : "No Grades", bg:"linear-gradient(135deg,#14b8a6,#0d9488)", icon:"📋" },
    { value:data.length ? "#1" : "—", label:"Class Rank", sub:data.length ? "Tracked" : "No Rank", bg:"linear-gradient(135deg,#f97316,#ea580c)", icon:"🏆" },
    { value:best ? best.subject : "—", label:"Best Subject", sub:best ? `${best.marks}%` : "—", bg:"linear-gradient(135deg,#10b981,#059669)", icon:"⭐" },
    { value:data.length, label:"Subjects Tracked", sub:term, bg:"linear-gradient(135deg,#06b6d4,#0891b2)", icon:"📘" },
  ];
  const TERM_ICONS = { "First Term": "📗", "Second Term": "📘", "Third Term": "📙", "Final": "📕", "Overall": "📊" };
  const BAR_COLORS=["#f59e0b","#8b5cf6","#f59e0b","#ef4444","#f59e0b","#f59e0b"];

  return (
    <div style={{ padding:28, display:"flex", flexDirection:"column", gap:20 }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, background:C.white, borderRadius:14, padding:"14px 20px", boxShadow:"0 2px 8px rgba(0,0,0,.06)", flexWrap:"wrap" }}>
        <span style={{ fontSize:13, color:C.muted, fontWeight:600, marginRight:4 }}>Select Term:</span>
        {["First Term","Second Term","Third Term","Final","Overall"].map(t=>(
          <motion.button type="button" key={t} whileHover={{ scale:1.04 }} onClick={()=>setTerm(t)}
            style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 18px", borderRadius:20,
              border:"1.5px solid "+(term===t?C.teal:C.border), cursor:"pointer", fontWeight:600, fontSize:13,
              background:term===t?C.teal:C.white, color:term===t?"#fff":C.text, transition:"all .15s" }}>
            <span>{TERM_ICONS[t] || "📄"}</span> {t}
          </motion.button>
        ))}
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:16 }}>
        {SUMMARY_CARDS.map((card,i)=>(
          <motion.div key={i} whileHover={{ y:-4 }}
            style={{ background:card.bg, borderRadius:16, padding:"22px 20px", color:"#fff", cursor:"default" }}>
            <div style={{ display:"flex", alignItems:"flex-start", gap:14 }}>
              <div style={{ width:44, height:44, borderRadius:12, background:"rgba(255,255,255,.2)",
                display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, flexShrink:0 }}>
                {card.icon}
              </div>
              <div style={{ minWidth:0 }}>
                <div style={{ fontSize:26, fontWeight:800, lineHeight:1.1, wordBreak:"break-word" }}>{card.value}</div>
                <div style={{ fontSize:13, opacity:.85, marginTop:3 }}>{card.label}</div>
                <div style={{ fontSize:11, opacity:.7, marginTop:2 }}>{card.sub}</div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20 }}>
        <div style={{ background:C.white, borderRadius:14, padding:22, boxShadow:"0 2px 8px rgba(0,0,0,.06)" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:4 }}>
            <div>
              <div style={{ fontWeight:700, fontSize:16 }}>Performance Analytics</div>
              <div style={{ fontSize:12, color:C.muted }}>{term}</div>
            </div>
            <span style={{ background:"#eef2ff", color:C.accent, borderRadius:20, padding:"4px 12px", fontSize:12, fontWeight:600 }}>Avg {avg}%</span>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data} barSize={28}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="subject" tick={{ fontSize:11 }} axisLine={false} tickLine={false} />
              <YAxis domain={[0,100]} tick={{ fontSize:11, fill:C.muted }} axisLine={false} tickLine={false} />
              <Tooltip formatter={val=>[`${val}%`,"Score"]} />
              <Bar dataKey="marks" radius={[6,6,0,0]}>
                {data.map((_,idx)=>(
                  <Cell key={idx} fill={BAR_COLORS[idx%BAR_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div style={{ background:C.white, borderRadius:14, padding:22, boxShadow:"0 2px 8px rgba(0,0,0,.06)" }}>
          <div style={{ fontWeight:700, fontSize:16, marginBottom:16 }}>Subject Breakdown</div>
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table className="rtable" style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead>
              <tr style={{ background:"#f8fafc" }}>
                {["SUBJECT","SCORE","GRADE","REMARKS"].map(h=>(
                  <th key={h} style={{ padding:"8px 12px", textAlign:"left", fontSize:11, fontWeight:700, color:C.muted }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((d,i)=>(
                <tr key={i} style={{ background:ROW_COLORS[i%ROW_COLORS.length], borderBottom:"1px solid "+C.border }}>
                  <td className="rtable-full" style={{ padding:"10px 12px", fontWeight:600, fontSize:13 }}>{d.subject}</td>
                  <td data-label="Score" style={{ padding:"10px 12px", fontSize:13, fontWeight:700 }}>{d.marks}%</td>
                  <td data-label="Grade" style={{ padding:"10px 12px" }}>
                    <span style={{ background:"#ede9fe", color:C.purple, borderRadius:12, padding:"2px 8px", fontSize:11, fontWeight:700 }}>{d.grade}</span>
                  </td>
                  <td data-label="Remarks" style={{ padding:"10px 12px", fontSize:12, color:C.muted }}>{d.remarks}</td>
                </tr>
              ))}
              {!data.length && <tr><td colSpan={4} style={{ padding:24, textAlign:"center", color:C.muted }}>No grades recorded for this term</td></tr>}
            </tbody>
          </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export { StudentMarks };
