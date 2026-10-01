import { useState, useEffect } from "react";
import { motion, AnimatePresence, Clock } from "../../shared/ui";
import { Modal } from "../../components/common/Modal";
import { C } from "../../shared/runtime";
import { api } from "../../services/apiClient";
import { onResourceChange } from "../../services/socket.service";

function StudentAssignments() {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchAssignments = () => {
    setLoading(true);
    api.get("/assignments")
      .then(res => {
        const d = res.data?.data || res.data || [];
        setAssignments(Array.isArray(d) ? d : []);
      })
      .catch(() => {
        setAssignments([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchAssignments();
    const unsub = onResourceChange("assignments", () => fetchAssignments());
    return () => unsub?.();
  }, []);

  const markComplete = (assignmentId) => {
    setSubmitting(true);
    api.post(`/assignments/${assignmentId}/submit`, { content: "Submitted by student" })
      .then(() => {
        fetchAssignments();
        setSelected(null);
      })
      .catch(err => {
        alert(err.response?.data?.message || "Failed to mark assignment as complete");
      })
      .finally(() => setSubmitting(false));
  };

  return (
    <div style={{ padding: 28 }}>
      <div style={{ background: C.white, borderRadius: 14, padding: 22, boxShadow: "0 2px 8px rgba(0,0,0,.06)" }}>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 18 }}>My Assignments</div>

        {loading ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: C.muted, fontSize: 13 }}>
            Loading assignments…
          </div>
        ) : assignments.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: C.muted, fontSize: 13 }}>
            No assignments recorded yet
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
            {assignments.map(a => {
              const subjectName = a.subjectId?.name || a.subject || "Subject";
              const statusStr = a.status || (a.submission ? "Completed" : "Pending");
              const isDone = statusStr === "Completed" || statusStr === "Graded";
              const isInProgress = statusStr === "In Progress";
              const dueDateStr = a.dueDate ? new Date(a.dueDate).toLocaleDateString() : "No deadline";

              return (
                <motion.div
                  key={a._id || a.id}
                  whileHover={{ scale: 1.02 }}
                  onClick={() => setSelected(a)}
                  style={{
                    background: isDone ? "#f0fdf4" : isInProgress ? "#fef3c7" : "#f0f4ff",
                    borderRadius: 12,
                    padding: 16,
                    border: "2px solid",
                    borderColor: isDone ? C.teal : isInProgress ? C.orange : C.accent,
                    cursor: "pointer"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                    <div>
                      <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>{subjectName}</div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{a.title}</div>
                    </div>
                    <span
                      style={{
                        background: C.white,
                        color: isDone ? C.teal : isInProgress ? C.orange : C.accent,
                        borderRadius: 20,
                        padding: "3px 8px",
                        fontSize: 10,
                        fontWeight: 600
                      }}
                    >
                      {statusStr}
                    </span>
                  </div>
                  {a.description && (
                    <div style={{ fontSize: 12, color: C.muted, marginBottom: 8, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                      {a.description}
                    </div>
                  )}
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 12 }}>
                    <Clock size={12} color={C.muted} />
                    <span style={{ fontSize: 11, color: C.muted }}>Due: {dueDateStr}</span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      <AnimatePresence>
        {selected && (
          <Modal title={selected.title} onClose={() => setSelected(null)}>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 10 }}>
              {selected.subjectId?.name || selected.subject || "Subject"} · Due {selected.dueDate ? new Date(selected.dueDate).toLocaleDateString() : "No deadline"}
            </div>
            {selected.description && (
              <div style={{ fontSize: 13, color: "#374151", marginBottom: 14, lineHeight: 1.5 }}>
                {selected.description}
              </div>
            )}
            <div style={{ fontSize: 14, lineHeight: 1.6 }}>
              Assignment status: <strong>{selected.status || (selected.submission ? "Completed" : "Pending")}</strong>
            </div>
            {selected.submission?.marks !== undefined && (
              <div style={{ fontSize: 13, marginTop: 8, color: C.teal, fontWeight: 600 }}>
                Marks: {selected.submission.marks} / {selected.maxMarks || 100}
              </div>
            )}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
              <button
                type="button"
                onClick={() => setSelected(null)}
                style={{
                  border: "1px solid " + C.border,
                  background: C.white,
                  borderRadius: 9,
                  padding: "9px 14px",
                  cursor: "pointer",
                  fontWeight: 600
                }}
              >
                Close
              </button>
              {selected.status !== "Completed" && selected.status !== "Graded" && !selected.submission && (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => markComplete(selected._id || selected.id)}
                  style={{
                    border: 0,
                    background: C.teal,
                    color: "#fff",
                    borderRadius: 9,
                    padding: "9px 14px",
                    cursor: "pointer",
                    fontWeight: 700,
                    opacity: submitting ? 0.7 : 1
                  }}
                >
                  {submitting ? "Submitting…" : "Mark completed"}
                </button>
              )}
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}

export { StudentAssignments };
