import { useState, useEffect } from "react";
import { motion, AnimatePresence, ChevronDown, X } from "../../shared/ui";
import { C, ROW_COLORS, initials, avatarColor, calcGrade, gradeCol } from "../../shared/runtime";
import { Portal } from "../../components/common/Portal";
import { api } from "../../services/apiClient";
import { onResourceChange } from "../../services/socket.service";
import useIsMobile from "../../hooks/useIsMobile";
import { classLabel as formatClassLabel } from "../../utils/formatters";
import { TERMS_LIST, getMaxMarks } from "../../config/gradeConfig";

/** Average as % across subjects (each may have different max marks for the term) */
const getAvgPercent = (grades, subjects, term) => {
  const vals = (subjects || [])
    .map((subj) => {
      const subId = String(subj._id);
      const raw = grades?.[subId];
      if (raw === undefined || raw === null || raw === "") return null;
      const score = Number(raw);
      if (!Number.isFinite(score)) return null;
      const max = getMaxMarks(subj, term);
      return max > 0 ? (score / max) * 100 : null;
    })
    .filter((v) => v !== null);
  if (!vals.length) return null;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
};

const classLabel = cls => formatClassLabel(cls) || "Unassigned";

function GradeManagement({ role }) {
  const isMobile = useIsMobile();
  const [studentsData, setStudentsData] = useState({});
  const [subjectsByClass, setSubjectsByClass] = useState({});
  const [selectedTerm, setSelectedTerm] = useState("First Term");
  const [loading, setLoading] = useState(true);
  const classOptions = Object.keys(studentsData);
  const [selectedClass, setSelectedClass] = useState("");
  const [classOpen, setClassOpen] = useState(false);
  const [recordsModal, setRecordsModal] = useState(null);
  const [saved, setSaved] = useState({});
  const [error, setError] = useState("");
  const [history, setHistory] = useState({});
  const [snapshots, setSnapshots] = useState({});
  // All-term grades modal (double-click on student row)
  const [allTermsModal, setAllTermsModal] = useState(null);   // student object
  const [allTermsGrades, setAllTermsGrades] = useState({});   // { "First Term": { subjectId: marks } }
  const [allTermsLoading, setAllTermsLoading] = useState(false);
  const students = (selectedClass && studentsData[selectedClass]) || [];
  const currentSubjects = subjectsByClass[selectedClass] || [];

  // Close the all-terms card on Escape
  useEffect(() => {
    if (!allTermsModal) return;
    const onKey = (e) => { if (e.key === "Escape") setAllTermsModal(null); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [allTermsModal]);

  const loadGradesData = (termToLoad = selectedTerm) => {
    const termParam = termToLoad ? `&term=${encodeURIComponent(termToLoad)}` : "";
    setLoading(true);
    setError("");

    Promise.all([
      api.get(`/students?limit=2000`),
      api.get(`/classes?limit=500`),
      api.get(`/subjects?limit=500`),
      api.get(`/grades?limit=5000${termParam}`),
    ])
      .then(([stuRes, clsRes, subRes, grRes]) => {
        const dbStudents = stuRes.data || stuRes || [];
        const dbClasses = clsRes.data || clsRes || [];
        const dbSubjects = subRes.data || subRes || [];
        const dbGrades = grRes.data || grRes || [];
        const accessWarning = grRes.meta?.warning || stuRes.meta?.warning || "";

        const classById = Object.fromEntries(
          dbClasses.map((c) => [String(c._id), c])
        );
        const subjectById = Object.fromEntries(
          dbSubjects.map((s) => [String(s._id), s])
        );

        const updated = {};
        const subjMap = {};
        const studentMap = {};

        // Build roster from real students (scoped by backend for teachers)
        dbStudents.forEach((st, idx) => {
          const stuId = String(st._id);
          const clsId = String(st.classId?._id || st.classId || "");
          const cls = classById[clsId] || st.classId;
          const clsName = classLabel(cls);

          studentMap[stuId] = {
            id: idx + 1,
            dbId: stuId,
            name: st.user?.name || st.name || "Student",
            roll: st.roll || "",
            classId: clsId,
            className: clsName,
            grades: {},
            gradeDocIds: {},
            gradeHistory: {},
          };

          if (!updated[clsName]) updated[clsName] = [];
          updated[clsName].push(studentMap[stuId]);

          if (!subjMap[clsName]) subjMap[clsName] = {};
          dbSubjects.forEach((sub) => {
            const belongs = (sub.classIds || []).some(
              (c) => String(c?._id || c) === clsId
            );
            if (belongs) subjMap[clsName][String(sub._id)] = sub;
          });
        });

        // Merge grade records keyed by subject _id (same as admin)
        dbGrades.forEach((g) => {
          const st = g.student;
          if (!st) return;
          const stuId = String(st._id || st);
          const subId = String(g.subjectId?._id || g.subjectId || "");
          if (!subId) return;

          let entry = studentMap[stuId];
          if (!entry) {
            const classId = String(g.classId?._id || g.classId || "");
            const className = g.classId?.name
              ? classLabel(g.classId)
              : classLabel(classById[classId]);
            entry = {
              id: Object.keys(studentMap).length + 1,
              dbId: stuId,
              name: st.user?.name || st.name || "Student",
              roll: st.roll || "",
              classId,
              className,
              grades: {},
              gradeDocIds: {},
              gradeHistory: {},
            };
            studentMap[stuId] = entry;
            if (!updated[className]) updated[className] = [];
            updated[className].push(entry);
            if (!subjMap[className]) subjMap[className] = {};
          }

          entry.grades[subId] = g.marks ?? "";
          entry.gradeDocIds[subId] = g._id;
          entry.gradeHistory[subId] = g.history || [];

          if (subjectById[subId]) {
            if (!subjMap[entry.className]) subjMap[entry.className] = {};
            subjMap[entry.className][subId] = subjectById[subId];
          } else if (g.subjectId?.name) {
            if (!subjMap[entry.className]) subjMap[entry.className] = {};
            subjMap[entry.className][subId] = g.subjectId;
          }
        });

        const subjMapArrays = {};
        Object.entries(subjMap).forEach(([cls, map]) => {
          subjMapArrays[cls] = Object.values(map);
        });

        // Ensure every class key exists even if no subjects yet
        Object.keys(updated).forEach((cls) => {
          if (!subjMapArrays[cls]) subjMapArrays[cls] = [];
        });

        setStudentsData(updated);
        setSubjectsByClass(subjMapArrays);
        const keys = Object.keys(updated);
        setSelectedClass((prev) => (keys.includes(prev) ? prev : keys[0] || ""));
        setError(accessWarning || "");
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message || "Failed to load grades");
        setLoading(false);
      });
  };

  useEffect(() => {
    loadGradesData(selectedTerm);
    const unsubGrades = onResourceChange("grades", () => loadGradesData(selectedTerm));
    const unsubStudents = onResourceChange("students", () => loadGradesData(selectedTerm));
    const unsubSubjects = onResourceChange("subjects", () => loadGradesData(selectedTerm));
    const unsubClasses = onResourceChange("classes", () => loadGradesData(selectedTerm));
    return () => {
      unsubGrades?.();
      unsubStudents?.();
      unsubSubjects?.();
      unsubClasses?.();
    };
  }, [selectedTerm]);

  const handleGradeChange = (id, subjId, val) => {
    const subjectObj = currentSubjects.find((s) => String(s._id) === String(subjId));
    const max = getMaxMarks(subjectObj, selectedTerm);
    const num = val === "" ? "" : Math.min(max, Math.max(0, Number(val) || 0));
    setSnapshots((prev) => {
      const existing = prev[selectedClass]?.[id]?.[subjId];
      if (existing !== undefined) return prev;
      const originalVal = studentsData[selectedClass].find((s) => s.id === id)?.grades[subjId];
      return {
        ...prev,
        [selectedClass]: {
          ...(prev[selectedClass] || {}),
          [id]: {
            ...(prev[selectedClass]?.[id] || {}),
            [subjId]: originalVal,
          },
        },
      };
    });
    setStudentsData((prev) => ({
      ...prev,
      [selectedClass]: prev[selectedClass].map((s) =>
        s.id === id ? { ...s, grades: { ...s.grades, [subjId]: num } } : s
      ),
    }));
  };

  // Open all-term grades modal on double-click
  const openAllTerms = async (student) => {
    setAllTermsModal(student);
    setAllTermsGrades({});
    setAllTermsLoading(true);
    try {
      const res = await api.get(`/grades?student=${student.dbId}&limit=1000`);
      const rawGrades = res.data || res || [];
      // Build: { "First Term": { subjectId: marks }, ... }
      const byTerm = {};
      rawGrades.forEach(g => {
        const term = g.term || g.exam || "";
        const subId = String(g.subjectId?._id || g.subjectId || "");
        if (!term || !subId) return;
        if (!byTerm[term]) byTerm[term] = {};
        byTerm[term][subId] = g.marks ?? "";
      });
      setAllTermsGrades(byTerm);
    } catch {
      setAllTermsGrades({});
    } finally {
      setAllTermsLoading(false);
    }
  };

  const handleUpdate = async (student) => {
    try {
      if (!student.dbId) throw new Error("Student record missing");

      const savedGrades = await Promise.all(
        currentSubjects.map(async (subj) => {
          const subId = String(subj._id);
          const raw = student.grades[subId];
          if (raw === undefined || raw === "") return null;

          const payload = {
            student: student.dbId,
            classId: student.classId,
            subjectId: subId,
            exam: selectedTerm,
            term: selectedTerm,
            marks: Number(raw),
            maxMarks: getMaxMarks(subj, selectedTerm),
          };

          const docId = student.gradeDocIds?.[subId];
          if (docId) {
            return api.patch(`/grades/${docId}`, payload);
          }
          return api.post("/grades", payload);
        })
      );

      const gradeHistory = { ...student.gradeHistory };
      const gradeDocIds = { ...student.gradeDocIds };
      savedGrades.forEach((result, index) => {
        const subject = currentSubjects[index];
        if (!result || !subject) return;
        const data = result.data || result;
        const subId = String(subject._id);
        if (data?.history) gradeHistory[subId] = data.history;
        if (data?._id) gradeDocIds[subId] = data._id;
      });

      setStudentsData((prev) => ({
        ...prev,
        [selectedClass]: prev[selectedClass].map((item) =>
          item.id === student.id ? { ...item, gradeHistory, gradeDocIds } : item
        ),
      }));
      setRecordsModal((prev) =>
        prev?.id === student.id ? { ...student, gradeHistory, gradeDocIds } : prev
      );

      const now = new Date();
      const timeStr = now.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
      const changer = role === "admin" ? "Admin" : "Teacher";

      setHistory((prev) => {
        const classHist = prev[selectedClass] || {};
        const stuHist = classHist[student.id] || {};
        const newStuHist = { ...stuHist };

        currentSubjects.forEach((subj) => {
          const subId = String(subj._id);
          const currentVal = student.grades[subId];
          const prevValue = snapshots[selectedClass]?.[student.id]?.[subId] ?? null;
          const oldEntries = stuHist[subId] || [];

          if (prevValue === null || prevValue !== currentVal) {
            newStuHist[subId] = [
              { value: currentVal, changedBy: changer, changedAt: timeStr, previous: prevValue },
              ...oldEntries,
            ].slice(0, 5);
          }
        });

        return { ...prev, [selectedClass]: { ...classHist, [student.id]: newStuHist } };
      });

      setSnapshots((prev) => ({
        ...prev,
        [selectedClass]: {
          ...(prev[selectedClass] || {}),
          [student.id]: {},
        },
      }));

      setSaved((prev) => ({ ...prev, [student.id]: true }));
      setError("");
      setTimeout(() => setSaved((prev) => ({ ...prev, [student.id]: false })), 2000);
    } catch (e) {
      console.error("Grade update failed", e);
      setError(e.message || "Unable to save grades.");
      setSaved((prev) => ({ ...prev, [student.id]: false }));
    }
  };

  return (
    <div className="grade-page" style={{ ...(role === "admin" ? {} : { padding: 28 }) }}>
      {error && (
        <div
          style={{
            color: C.red,
            background: "#fee2e2",
            border: "1px solid #fecaca",
            borderRadius: 10,
            padding: "10px 14px",
            fontSize: 13,
            marginBottom: 12,
          }}
        >
          {error}
        </div>
      )}

      <div
        className="grade-toolbar"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 14,
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div className="grade-toolbar-controls" style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 260, flexWrap: "wrap" }}>
          <div className="grade-class-picker" style={{ position: "relative", minWidth: 240, maxWidth: 360 }}>
            <div
              onClick={() => setClassOpen((o) => !o)}
              style={{
                background: C.white,
                borderRadius: 12,
                padding: "12px 18px",
                border: "2px solid " + C.orange,
                cursor: "pointer",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                boxShadow: classOpen ? "0 0 0 4px rgba(180,83,9,.15)" : "0 2px 8px rgba(0,0,0,.06)",
                transition: "box-shadow .15s",
                userSelect: "none",
              }}
            >
              <span style={{ fontWeight: 600, fontSize: 14, color: C.text }}>
                {selectedClass || "Select a class"}
              </span>
              <motion.div animate={{ rotate: classOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
                <ChevronDown size={18} color={C.orange} />
              </motion.div>
            </div>
            <AnimatePresence>
              {classOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  style={{
                    position: "absolute",
                    top: "calc(100% + 6px)",
                    left: 0,
                    right: 0,
                    background: C.white,
                    borderRadius: 12,
                    border: "1.5px solid " + C.border,
                    boxShadow: "0 8px 24px rgba(0,0,0,.12)",
                    zIndex: 50,
                    overflow: "hidden",
                    maxHeight: 280,
                    overflowY: "auto",
                  }}
                >
                  {classOptions.length === 0 && (
                    <div style={{ padding: "14px 20px", fontSize: 13, color: C.muted }}>
                      No classes with students yet
                    </div>
                  )}
                  {classOptions.map((cls) => (
                    <div
                      key={cls}
                      onClick={() => {
                        setSelectedClass(cls);
                        setClassOpen(false);
                      }}
                      style={{
                        padding: "12px 20px",
                        cursor: "pointer",
                        fontSize: 14,
                        fontWeight: 500,
                        background: cls === selectedClass ? "#fff7ec" : C.white,
                        color: cls === selectedClass ? "#B45309" : C.text,
                        transition: "background .15s",
                      }}
                    >
                      {cls}
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="grade-terms" style={{ display: "flex", alignItems: "center", gap: 6, background: "#f1f5f9", borderRadius: 12, padding: 4 }}>
            {TERMS_LIST.map((t) => {
              const isSelected = selectedTerm === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setSelectedTerm(t)}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 8,
                    border: "none",
                    fontSize: 12.5,
                    fontWeight: 700,
                    cursor: "pointer",
                    background: isSelected ? C.orange : "transparent",
                    color: isSelected ? "#fff" : C.muted,
                    boxShadow: isSelected ? "0 2px 6px rgba(180,83,9,0.3)" : "none",
                    transition: "all .15s",
                  }}
                >
                  {t}
                </button>
              );
            })}
          </div>
        </div>

      </div>

      <div style={{ fontSize: 13, color: C.muted, marginBottom: 20, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span>
          <strong style={{ color: C.text }}>{students.length} students</strong> ·{" "}
          <strong style={{ color: C.text }}>{currentSubjects.length} subjects</strong>
        </span>
        <span
          style={{
            background: "#fef3c7",
            color: "#b45309",
            padding: "2px 10px",
            borderRadius: 12,
            fontSize: 11.5,
            fontWeight: 700,
          }}
        >
          {selectedTerm}
        </span>
        {currentSubjects.length === 0 && !loading && (
          <span style={{ marginLeft: 8, color: C.orange, fontWeight: 600 }}>
            — no subjects assigned to this class yet. Go to Admin → Subjects and tick this class for the relevant subjects.
          </span>
        )}
      </div>

      {loading ? (
        <div
          style={{
            background: C.white,
            borderRadius: 14,
            boxShadow: "0 2px 8px rgba(0,0,0,.06)",
            padding: 60,
            textAlign: "center",
            color: C.muted,
            fontSize: 13,
          }}
        >
          Loading grades…
        </div>
      ) : (
        <div
          style={{
            background: C.white,
            borderRadius: 14,
            boxShadow: "0 2px 8px rgba(0,0,0,.06)",
            overflow: "auto",
            maxHeight: 560,
          }}
        >
          {isMobile ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: 12 }}>
              {students.length === 0 && (
                <div style={{ padding: 40, textAlign: "center", color: C.muted, fontSize: 13 }}>
                  No students in this class
                </div>
              )}
              {students.map((student, i) => {
                const avg = getAvgPercent(student.grades, currentSubjects, selectedTerm);
                const grade = avg == null ? "—" : calcGrade(avg);
                const gc = gradeCol(grade);
                const isSaved = saved[student.id];
                return (
                  <div
                    key={student.id}
                    style={{
                      background: ROW_COLORS[i % ROW_COLORS.length],
                      border: "1px solid " + C.border,
                      borderRadius: 12,
                      padding: 14,
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                    }}
                  >
                    {/* Student */}
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div
                        style={{
                          width: 34, height: 34, borderRadius: "50%",
                          background: avatarColor ? avatarColor(student.name) : "#6657e8",
                          color: "#fff", fontSize: 12, fontWeight: 700,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        {initials ? initials(student.name) : student.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{student.name}</div>
                        <div style={{ fontSize: 11, color: C.muted, fontWeight: 500 }}>{student.roll}</div>
                      </div>
                    </div>

                    {/* Subjects: each on its own stacked row */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {currentSubjects.map((subj) => {
                        const subId = String(subj._id);
                        return (
                          <div key={subId} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: C.muted }}>
                              {(subj.name || "Subject").toUpperCase()}{" "}
                              <span style={{ fontWeight: 500, fontSize: 10 }}>/{getMaxMarks(subj, selectedTerm)}</span>
                            </div>
                            <input
                              type="number"
                              min={0}
                              max={getMaxMarks(subj, selectedTerm)}
                              value={student.grades[subId] ?? ""}
                              onChange={(e) => handleGradeChange(student.id, subId, e.target.value)}
                              style={{
                                width: 72, padding: "7px 8px", borderRadius: 8,
                                border: "1.5px solid " + C.border, fontSize: 13, fontWeight: 500,
                                outline: "none", textAlign: "center", background: C.white, color: C.text,
                              }}
                            />
                          </div>
                        );
                      })}
                    </div>

                    {/* Average / Grade */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
                      borderTop: "1px solid " + C.border, paddingTop: 10 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: C.muted }}>
                        AVERAGE: {avg == null ? "—" : `${avg}%`}
                      </div>
                      <span style={{ background: gc + "22", color: gc, borderRadius: 6, padding: "3px 10px", fontSize: 13, fontWeight: 700 }}>
                        {grade}
                      </span>
                    </div>

                    {/* Actions: stacked full-width */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <motion.button
                        type="button"
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setRecordsModal(student)}
                        style={{
                          width: "100%", background: "#f0f4ff", color: C.accent,
                          border: "1.5px solid #c7d7fd", borderRadius: 8, fontSize: 13,
                          fontWeight: 600, cursor: "pointer", padding: "9px 12px",
                        }}
                      >
                        Records
                      </motion.button>
                      <motion.button
                        type="button"
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleUpdate(student)}
                        style={{
                          width: "100%", background: isSaved ? C.teal : "#F5A623", color: "#fff",
                          border: "none", borderRadius: 8, padding: "10px 12px", fontSize: 13,
                          fontWeight: 600, cursor: "pointer",
                        }}
                      >
                        {isSaved ? "✓ Saved" : "Update"}
                      </motion.button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1000 }}>
            <thead>
              <tr style={{ background: "#f8fafc", position: "sticky", top: 0, zIndex: 2 }}>
                <th
                  style={{
                    padding: "14px 16px",
                    textAlign: "left",
                    fontSize: 11,
                    fontWeight: 700,
                    color: C.muted,
                    whiteSpace: "nowrap",
                    background: "#f8fafc",
                  }}
                >
                  STUDENT
                </th>
                {currentSubjects.map((s) => (
                  <th
                    key={s._id}
                    style={{
                      padding: "14px 10px",
                      textAlign: "left",
                      fontSize: 11,
                      fontWeight: 700,
                      color: C.muted,
                      background: "#f8fafc",
                    }}
                  >
                    {(s.name || "Subject").toUpperCase()}{" "}
                    <span style={{ fontWeight: 500, fontSize: 9, color: C.muted }}>
                      /{getMaxMarks(s, selectedTerm)}
                    </span>
                  </th>
                ))}
                <th
                  style={{
                    padding: "14px 10px",
                    textAlign: "left",
                    fontSize: 11,
                    fontWeight: 700,
                    color: C.muted,
                    background: "#f8fafc",
                  }}
                >
                  AVERAGE
                </th>
                <th
                  style={{
                    padding: "14px 10px",
                    textAlign: "left",
                    fontSize: 11,
                    fontWeight: 700,
                    color: C.muted,
                    background: "#f8fafc",
                  }}
                >
                  GRADE
                </th>
                <th
                  style={{
                    padding: "14px 16px",
                    textAlign: "left",
                    fontSize: 11,
                    fontWeight: 700,
                    color: C.muted,
                    background: "#f8fafc",
                  }}
                >
                  ACTIONS
                </th>
              </tr>
            </thead>
            <tbody>
              {students.length === 0 && (
                <tr>
                  <td
                    colSpan={currentSubjects.length + 4}
                    style={{ padding: 40, textAlign: "center", color: C.muted, fontSize: 13 }}
                  >
                    No students in this class
                  </td>
                </tr>
              )}
              {students.map((student, i) => {
                const avg = getAvgPercent(student.grades, currentSubjects, selectedTerm);
                const grade = avg == null ? "—" : calcGrade(avg);
                const gc = gradeCol(grade);
                const isSaved = saved[student.id];
                return (
                   <tr
                    key={student.id}
                    title="Double-click to view all term grades"
                    style={{
                      background: ROW_COLORS[i % ROW_COLORS.length],
                      borderBottom: "1px solid " + C.border,
                      transition: "filter .12s",
                      cursor: "pointer",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.filter = "brightness(0.97)")}
                    onMouseLeave={(e) => (e.currentTarget.style.filter = "none")}
                    onDoubleClick={(e) => {
                      if (e.target.closest("input, button, select, textarea")) return;
                      window.getSelection?.()?.removeAllRanges();
                      openAllTerms(student);
                    }}
                  >
                    <td style={{ padding: "14px 16px", whiteSpace: "nowrap", fontWeight: 600, fontSize: 13 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div
                          style={{
                            width: 30,
                            height: 30,
                            borderRadius: "50%",
                            background: avatarColor ? avatarColor(student.name) : "#6657e8",
                            color: "#fff",
                            fontSize: 11,
                            fontWeight: 700,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          {initials ? initials(student.name) : student.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div>{student.name}</div>
                          <div style={{ fontSize: 11, color: C.muted, fontWeight: 500 }}>{student.roll}</div>
                        </div>
                      </div>
                    </td>
                    {currentSubjects.map((subj) => {
                      const subId = String(subj._id);
                      return (
                        <td key={subId} style={{ padding: "10px 6px" }}>
                          <input
                            type="number"
                            min={0}
                            max={getMaxMarks(subj, selectedTerm)}
                            value={student.grades[subId] ?? ""}
                            onChange={(e) => handleGradeChange(student.id, subId, e.target.value)}
                            onFocus={(e) => {
                              e.target.style.borderColor = "#F5A623";
                              e.target.style.boxShadow = "0 0 0 3px rgba(245,166,35,.15)";
                            }}
                            onBlur={(e) => {
                              e.target.style.borderColor = C.border;
                              e.target.style.boxShadow = "none";
                            }}
                            style={{
                              width: 64,
                              padding: "7px 8px",
                              borderRadius: 8,
                              border: "1.5px solid " + C.border,
                              fontSize: 13,
                              fontWeight: 500,
                              outline: "none",
                              textAlign: "center",
                              transition: "box-shadow .12s",
                              background: C.white,
                              color: C.text,
                            }}
                          />
                        </td>
                      );
                    })}
                    <td style={{ padding: "14px 10px", fontWeight: 700, fontSize: 13, color: C.muted }}>
                      {avg == null ? "—" : `${avg}%`}
                    </td>
                    <td style={{ padding: "14px 10px" }}>
                      <span
                        style={{
                          background: gc + "22",
                          color: gc,
                          borderRadius: 6,
                          padding: "3px 10px",
                          fontSize: 13,
                          fontWeight: 700,
                        }}
                      >
                        {grade}
                      </span>
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <motion.button
                          type="button"
                          whileHover={{ scale: 1.04 }}
                          onClick={() => setRecordsModal(student)}
                          style={{
                            background: "#f0f4ff",
                            color: C.accent,
                            border: "1.5px solid #c7d7fd",
                            borderRadius: 8,
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: "pointer",
                            padding: "5px 12px",
                          }}
                        >
                          Records
                        </motion.button>
                        <motion.button
                          type="button"
                          whileHover={{ scale: 1.05 }}
                          onClick={() => handleUpdate(student)}
                          style={{
                            background: isSaved ? C.teal : "#F5A623",
                            color: "#fff",
                            border: "none",
                            borderRadius: 8,
                            padding: "6px 14px",
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: "pointer",
                            transition: "background .2s",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {isSaved ? "✓ Saved" : "Update"}
                        </motion.button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          )}
        </div>
      )}

      <AnimatePresence>
        {recordsModal && (
          <Portal>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,.55)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 99999,
                padding: "24px 16px",
              }}
              onClick={() => setRecordsModal(null)}
            >
              <motion.div
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.9 }}
                onClick={(e) => e.stopPropagation()}
                style={{
                  background: C.white,
                  borderRadius: 18,
                  padding: 0,
                  width: 620,
                  maxWidth: "95vw",
                  maxHeight: "85vh",
                  overflowY: "auto",
                  boxShadow: "0 24px 70px rgba(0,0,0,.35)",
                }}
              >
              <div
                style={{
                  background: "linear-gradient(135deg,#1e2a4a,#2d3f6e)",
                  borderRadius: "18px 18px 0 0",
                  padding: "20px 24px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ color: "#fff", fontWeight: 700, fontSize: 17 }}>{recordsModal.name}</div>
                    <div style={{ color: "rgba(255,255,255,.55)", fontSize: 12, marginTop: 2 }}>
                      {recordsModal.roll} · {selectedClass} · Grade Record History
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRecordsModal(null)}
                    style={{
                      background: "rgba(255,255,255,.15)",
                      border: "none",
                      borderRadius: 8,
                      width: 32,
                      height: 32,
                      cursor: "pointer",
                      color: "#fff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <X size={16} />
                  </button>
                </div>

                <div style={{ display: "flex", gap: 12, marginTop: 14 }}>
                  {[
                    [
                      "Average",
                      (() => {
                        const a = getAvgPercent(recordsModal.grades, currentSubjects, selectedTerm);
                        return a == null ? "—" : `${a}%`;
                      })(),
                      C.teal,
                    ],
                    [
                      "Grade",
                      (() => {
                        const a = getAvgPercent(recordsModal.grades, currentSubjects, selectedTerm);
                        return a == null ? "—" : calcGrade(a);
                      })(),
                      C.accent,
                    ],
                    ["Subjects", currentSubjects.length, C.orange],
                  ].map(([l, v]) => (
                    <div
                      key={l}
                      style={{
                        background: "rgba(255,255,255,.12)",
                        borderRadius: 10,
                        padding: "8px 16px",
                        textAlign: "center",
                      }}
                    >
                      <div style={{ color: "#fff", fontWeight: 800, fontSize: 18 }}>{v}</div>
                      <div style={{ color: "rgba(255,255,255,.6)", fontSize: 11 }}>{l}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ padding: "16px 24px" }}>
                {currentSubjects.map((subj, si) => {
                  const subId = String(subj._id);
                  const max = getMaxMarks(subj, selectedTerm);
                  const score = recordsModal.grades[subId];
                  const percent = max ? (Number(score || 0) / max) * 100 : 0;
                  const barColor = percent >= 75 ? C.teal : percent >= 55 ? C.accent : C.orange;
                  const subjHist = recordsModal.gradeHistory?.[subId] || [];

                  return (
                    <div
                      key={subId}
                      style={{
                        marginBottom: 18,
                        background: "#f9fafb",
                        borderRadius: 12,
                        padding: "14px 16px",
                        border: "1px solid " + C.border,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: 8,
                        }}
                      >
                        <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{subj.name}</span>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{ fontSize: 15, fontWeight: 800, color: barColor }}>
                            {score === "" || score === undefined ? "—" : score}/{max}
                          </span>
                          <span
                            style={{
                              background: barColor + "22",
                              color: barColor,
                              borderRadius: 6,
                              padding: "2px 8px",
                              fontSize: 12,
                              fontWeight: 700,
                            }}
                          >
                            {score === "" || score === undefined ? "—" : calcGrade(percent)}
                          </span>
                        </div>
                      </div>

                      <div
                        style={{
                          height: 7,
                          borderRadius: 4,
                          background: "#e5e7eb",
                          overflow: "hidden",
                          marginBottom: 10,
                        }}
                      >
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${percent}%` }}
                          transition={{ delay: si * 0.04, duration: 0.5 }}
                          style={{ height: "100%", borderRadius: 4, background: barColor }}
                        />
                      </div>

                      {subjHist.length === 0 ? (
                        <div style={{ fontSize: 11, color: C.muted, fontStyle: "italic" }}>
                          No saved changes recorded yet.
                        </div>
                      ) : (
                        <div>
                          <div
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              color: C.muted,
                              letterSpacing: 0.5,
                              marginBottom: 6,
                            }}
                          >
                            CHANGE HISTORY
                          </div>
                          {subjHist.map((entry, idx) => (
                            <div
                              key={idx}
                              style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 6 }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  flexDirection: "column",
                                  alignItems: "center",
                                  paddingTop: 3,
                                }}
                              >
                                <div
                                  style={{
                                    width: 8,
                                    height: 8,
                                    borderRadius: "50%",
                                    background: idx === 0 ? C.accent : "#d1d5db",
                                    flexShrink: 0,
                                  }}
                                />
                                {idx < subjHist.length - 1 && (
                                  <div style={{ width: 1, height: 20, background: "#e5e7eb", marginTop: 2 }} />
                                )}
                              </div>
                              <div
                                style={{
                                  flex: 1,
                                  background: idx === 0 ? "#eef2ff" : "#f4f6fb",
                                  borderRadius: 8,
                                  padding: "7px 10px",
                                  border: idx === 0 ? "1px solid #c7d7fd" : "1px solid " + C.border,
                                }}
                              >
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                    <span
                                      style={{
                                        fontSize: 13,
                                        fontWeight: 700,
                                        color: idx === 0 ? C.accent : C.text,
                                      }}
                                    >
                                      {entry.marks}/{max}
                                    </span>
                                    {entry.previousMarks !== null && entry.previousMarks !== undefined && (
                                      <span style={{ fontSize: 11, color: C.muted }}>
                                        (was {entry.previousMarks})
                                        <span
                                          style={{
                                            marginLeft: 4,
                                            color: entry.marks > entry.previousMarks ? C.teal : C.red,
                                            fontWeight: 700,
                                          }}
                                        >
                                          {entry.marks > entry.previousMarks
                                            ? `▲ +${entry.marks - entry.previousMarks}`
                                            : `▼ ${entry.marks - entry.previousMarks}`}
                                        </span>
                                      </span>
                                    )}
                                    {idx === 0 && (
                                      <span
                                        style={{
                                          background: C.accent,
                                          color: "#fff",
                                          borderRadius: 4,
                                          padding: "1px 6px",
                                          fontSize: 9,
                                          fontWeight: 700,
                                        }}
                                      >
                                        LATEST
                                      </span>
                                    )}
                                  </div>
                                  <span style={{ fontSize: 10, color: C.muted }}>
                                    {new Date(entry.changedAt).toLocaleString()}
                                  </span>
                                </div>
                                <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                                  by{" "}
                                  <span style={{ fontWeight: 600, color: C.text }}>
                                    {entry.changedBy?.name || "Unknown user"}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        </Portal>
        )}
      </AnimatePresence>

      {/* ── All-Term Grades Modal (double-click) ── */}
      <AnimatePresence>
        {allTermsModal && (
          <Portal>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{
                position: "fixed", inset: 0,
                background: "rgba(0,0,0,.55)",
                display: "flex", alignItems: "center", justifyContent: "center",
                overflowY: "auto", boxSizing: "border-box",
                zIndex: 99999, padding: "24px 16px",
              }}
              onClick={() => setAllTermsModal(null)}
            >
              <motion.div
                initial={{ scale: 0.92, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.92, y: 20 }}
                onClick={e => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                style={{
                  background: "#fff", borderRadius: 20,
                  width: "100%", maxWidth: 860, minWidth: 0, margin: "auto",
                  maxHeight: "calc(100vh - 48px)", overflowY: "auto",
                  boxShadow: "0 24px 80px rgba(0,0,0,.35)",
                }}
              >
              {/* Header */}
              <div style={{
                background: "linear-gradient(135deg,#1e2a4a,#2d3f6e)",
                borderRadius: "20px 20px 0 0", padding: "22px 28px",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ color: "#fff", fontWeight: 800, fontSize: 19 }}>
                      {allTermsModal.name}
                    </div>
                    <div style={{ color: "rgba(255,255,255,.55)", fontSize: 12, marginTop: 3 }}>
                      Roll {allTermsModal.roll} · {allTermsModal.className} · All Term Grades
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAllTermsModal(null)}
                    style={{
                      background: "rgba(255,255,255,.15)", border: "none",
                      borderRadius: 8, width: 34, height: 34, cursor: "pointer",
                      color: "#fff", fontSize: 18, display: "flex",
                      alignItems: "center", justifyContent: "center",
                    }}
                  >
                    <X size={16} />
                  </button>
                </div>
                {/* Term summary badges */}
                {!allTermsLoading && (
                  <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
                    {TERMS_LIST.map(term => {
                      const termGrades = allTermsGrades[term] || {};
                      const termSubjects = currentSubjects;
                      const avg = getAvgPercent(termGrades, termSubjects, term);
                      const grade = avg == null ? "—" : calcGrade(avg);
                      const gc = gradeCol(grade);
                      return (
                        <div key={term} style={{
                          background: "rgba(255,255,255,.12)", borderRadius: 10,
                          padding: "8px 16px", textAlign: "center", minWidth: 90,
                        }}>
                          <div style={{ color: "#fff", fontWeight: 800, fontSize: 17 }}>{grade}</div>
                          <div style={{ color: "rgba(255,255,255,.6)", fontSize: 10, marginTop: 2 }}>{term}</div>
                          <div style={{ color: gc === C.text ? "#aaa" : gc, fontSize: 11, fontWeight: 700 }}>
                            {avg == null ? "—" : `${avg}%`}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Body */}
              <div style={{ padding: "20px 28px 28px" }}>
                {allTermsLoading ? (
                  <div style={{ textAlign: "center", padding: 40, color: C.muted, fontSize: 13 }}>
                    Loading grades…
                  </div>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}>
                      <thead>
                        <tr style={{ background: "#f8fafc" }}>
                          <th style={{
                            padding: "11px 14px", textAlign: "left", fontSize: 11,
                            fontWeight: 700, color: C.muted, whiteSpace: "nowrap",
                            borderBottom: "2px solid " + C.border,
                          }}>SUBJECT</th>
                          {TERMS_LIST.map(term => (
                            <th key={term} style={{
                              padding: "11px 14px", textAlign: "center", fontSize: 11,
                              fontWeight: 700, color: C.muted,
                              borderBottom: "2px solid " + C.border,
                              whiteSpace: "nowrap",
                            }}>{term.toUpperCase()}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {currentSubjects.length === 0 ? (
                          <tr>
                            <td colSpan={5} style={{ padding: 32, textAlign: "center", color: C.muted, fontSize: 13 }}>
                              No subjects assigned to this class
                            </td>
                          </tr>
                        ) : currentSubjects.map((subj, si) => {
                          const subId = String(subj._id);
                          return (
                            <tr key={subId} style={{
                              background: si % 2 === 0 ? "#fff" : "#f9fafb",
                              borderBottom: "1px solid " + C.border,
                            }}>
                              <td style={{ padding: "11px 14px", fontWeight: 600, fontSize: 13 }}>
                                {subj.name}
                              </td>
                              {TERMS_LIST.map(term => {
                                const termGrades = allTermsGrades[term] || {};
                                const marks = termGrades[subId];
                                const max = getMaxMarks(subj, term);
                                const pct = (marks !== "" && marks !== undefined && max > 0)
                                  ? Math.round((Number(marks) / max) * 100) : null;
                                const barColor = pct == null ? C.border
                                  : pct >= 75 ? C.teal : pct >= 55 ? C.accent : C.orange;
                                return (
                                  <td key={term} style={{ padding: "11px 14px", textAlign: "center" }}>
                                    {marks === "" || marks === undefined ? (
                                      <span style={{ color: C.muted, fontSize: 13 }}>—</span>
                                    ) : (
                                      <div>
                                        <span style={{ fontWeight: 700, fontSize: 13, color: barColor }}>
                                          {marks}
                                        </span>
                                        <span style={{ color: C.muted, fontSize: 11 }}>/{max}</span>
                                        <div style={{
                                          marginTop: 3, height: 3, borderRadius: 2,
                                          background: "#e5e7eb", overflow: "hidden",
                                        }}>
                                          <div style={{
                                            width: `${pct}%`, height: "100%",
                                            borderRadius: 2, background: barColor,
                                            transition: "width .4s",
                                          }} />
                                        </div>
                                      </div>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                        {/* Average row */}
                        {currentSubjects.length > 0 && (
                          <tr style={{ background: "#f0f4ff", fontWeight: 700 }}>
                            <td style={{ padding: "12px 14px", fontSize: 13, color: C.accent }}>
                              Average / Grade
                            </td>
                            {TERMS_LIST.map(term => {
                              const termGrades = allTermsGrades[term] || {};
                              const avg = getAvgPercent(termGrades, currentSubjects, term);
                              const grade = avg == null ? "—" : calcGrade(avg);
                              const gc = gradeCol(grade);
                              return (
                                <td key={term} style={{ padding: "12px 14px", textAlign: "center" }}>
                                  {avg == null ? (
                                    <span style={{ color: C.muted }}>—</span>
                                  ) : (
                                    <div>
                                      <span style={{ color: gc, fontSize: 14, fontWeight: 800 }}>{grade}</span>
                                      <span style={{ color: C.muted, fontSize: 11, marginLeft: 4 }}>({avg}%)</span>
                                    </div>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        </Portal>
        )}
      </AnimatePresence>
    </div>
  );
}

export { GradeManagement };