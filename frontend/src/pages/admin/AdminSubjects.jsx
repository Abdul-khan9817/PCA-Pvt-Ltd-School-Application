import { useState, useEffect } from "react";

import {
  motion,
  AnimatePresence,
  BookOpen,
  Edit,
  Trash2,
  Plus,
  Check,
  Award,
  ClipboardCheck,
  BarChart2,
} from "../../shared/ui";

import {
  C,
} from "../../shared/runtime";

import { CancelBtn } from "../../components/common/CancelBtn";
import { FormField } from "../../components/common/FormField";
import { Modal } from "../../components/common/Modal";
import { SaveBtn } from "../../components/common/SaveBtn";
import { MultiSelectDropdown } from "../../components/common/MultiSelectDropdown";
import { useMediaQuery } from "../../hooks/useMediaQuery";

import {
  list,
  create,
  update,
  remove,
} from "../../services/resource.service";

import { onResourceChange } from "../../services/socket.service";


const TERM_OPTIONS = [
  10, 20, 30, 40, 50, 60, 70, 80, 90, 100,
];

/* =============================================================
   DASHBOARD-CARD GRADIENT PALETTE
============================================================= */

const TERM_STYLES = {
  first: {
    label: "First Term",
    icon: ClipboardCheck,
    gradient: "linear-gradient(135deg, rgb(124,58,237), rgb(88,28,199))",
  },
  second: {
    label: "Second Term",
    icon: BarChart2,
    gradient: "linear-gradient(135deg, rgb(20,184,166), rgb(13,148,136))",
  },
  third: {
    label: "Third Term",
    icon: ClipboardCheck,
    gradient: "linear-gradient(135deg, rgb(34,197,94), rgb(16,163,74))",
  },
  final: {
    label: "Final",
    icon: Award,
    gradient: "linear-gradient(135deg, rgb(249,158,11), rgb(217,119,6))",
  },
};

const TERM_KEYS = [
  ["first", "firstTerm"],
  ["second", "secondTerm"],
  ["third", "thirdTerm"],
  ["final", "final"],
];

// Neutral columns that aren't a "term"
const NEUTRAL = {
  subject: "rgb(30,41,59)",
  actions: "rgb(241,245,249)",
};

// Neutral, structured zebra striping
const ROW_BG = ["#ffffff", "#f8fafc"];


function AdminSubjects() {

  const isMobile = useMediaQuery("(max-width: 768px)");

  const [subjects, setSubjects] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({
    name: "",
    classIds: [],
    teacherIds: [],
    firstTerm: 0,
    secondTerm: 0,
    thirdTerm: 0,
    final: 0,
  });
  const [classes, setClasses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");


  /* =========================================================
     MAP SUBJECT DATA
  ========================================================= */
  const mapSubject = (x) => ({
    ...x,
    id: x._id || x.id,
    name: x.name || "Subject",
    classIds: x.classIds || [],
    teacherIds: (x.teacherIds || []).map((t) => t?._id || t),
    firstTerm: Number(x.firstTerm || 0),
    secondTerm: Number(x.secondTerm || 0),
    thirdTerm: Number(x.thirdTerm || 0),
    final: Number(x.final || 0),
  });

  const teacherOptions = teachers.map((t) => {
    const id = String(t.user?._id || t.user || t._id || t.id);
    const name = t.user?.name || t.name || t.fullName || "Teacher";
    const dept = t.department || t.designation || "";
    return { id, label: name, meta: dept };
  }).filter((t, i, arr) => t.id && arr.findIndex((x) => x.id === t.id) === i);


  /* =========================================================
     LOAD SUBJECTS + CLASSES + TEACHERS
  ========================================================= */

  const loadSubjects = () => {
    Promise.all([
      list("subjects", "limit=100"),
      list("classes", "limit=100"),
      list("staff", "limit=200"),
    ])
      .then(([subjectResult, classResult, staffResult]) => {
        setSubjects(
          (subjectResult.data || subjectResult || []).map(mapSubject)
        );
        setClasses(classResult.data || classResult || []);
        setTeachers(staffResult.data || staffResult || []);
      })
      .catch((err) => {
        console.error(err);
      });
  };


  /* =========================================================
     INITIAL LOAD + REALTIME
  ========================================================= */

  useEffect(() => {
    loadSubjects();

    const unsub = onResourceChange("subjects", (change) => {
      if (change.action === "create") {
        setSubjects((prev) => {
          const mapped = mapSubject(change.data);
          if (prev.some((s) => s.id === mapped.id)) return prev;
          return [...prev, mapped];
        });
      } else if (change.action === "update") {
        setSubjects((prev) =>
          prev.map((s) =>
            s.id === (change.data?._id || change.id)
              ? { ...s, ...mapSubject(change.data) }
              : s
          )
        );
      } else if (change.action === "delete") {
        setSubjects((prev) =>
          prev.filter((s) => s.id !== change.id && s.id !== change.data?._id)
        );
      }
    });

    return () => unsub?.();
  }, []);


  /* =========================================================
     CLASS HELPERS
  ========================================================= */

  const idsOf = (value) => (value || []).map((item) => item?._id || item);

  const toggleId = (list, id) =>
    list.includes(id) ? list.filter((x) => x !== id) : [...list, id];


  /* =========================================================
     SAVE EDIT
  ========================================================= */

  const handleSaveEdit = async () => {
    if (!editForm.name?.trim()) {
      setError("Subject name is required");
      return;
    }

    try {
      setSaving(true);
      setError("");

      const payload = {
        name: editForm.name.trim(),
        classIds: idsOf(editForm.classIds),
        teacherIds: (editForm.teacherIds || []).map((id) => String(id)),
        firstTerm: Number(editForm.firstTerm || 0),
        secondTerm: Number(editForm.secondTerm || 0),
        thirdTerm: Number(editForm.thirdTerm || 0),
        final: Number(editForm.final || 0),
      };

      const response = await update("subjects", editingId, payload);
      const updated = mapSubject(response.data || response);

      setSubjects((prev) =>
        prev.map((subject) => (subject.id === editingId ? updated : subject))
      );

      setEditingId(null);
      setEditForm({});
      setError("");
    } catch (err) {
      setError(err.message || "Failed to update subject");
    } finally {
      setSaving(false);
    }
  };


  /* =========================================================
     DELETE
  ========================================================= */

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this subject?")) return;

    try {
      await remove("subjects", id);
      setSubjects((prev) => prev.filter((x) => x.id !== id));
    } catch (err) {
      setError(err.message || "Failed to delete subject");
    }
  };


  /* =========================================================
     ADD SUBJECT
  ========================================================= */

  const handleAdd = async () => {
    const name = addForm.name?.trim();

    if (saving) return;

    if (!name) {
      setError("Subject name is required");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const payload = {
        name,
        classIds: addForm.classIds,
        teacherIds: (addForm.teacherIds || []).map((id) => String(id)),
        firstTerm: Number(addForm.firstTerm || 0),
        secondTerm: Number(addForm.secondTerm || 0),
        thirdTerm: Number(addForm.thirdTerm || 0),
        final: Number(addForm.final || 0),
      };

      const response = await create("subjects", payload);
      const created = mapSubject(response.data || response);

      setSubjects((prev) => [
        created,
        ...prev.filter((subject) => subject.id !== created.id),
      ]);

      setAddForm({
        name: "",
        classIds: [],
        teacherIds: [],
        firstTerm: 0,
        secondTerm: 0,
        thirdTerm: 0,
        final: 0,
      });

      setShowAdd(false);
      loadSubjects();
    } catch (err) {
      setError(err.message || "Failed to add subject");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (s) => {
    setError("");
    setEditingId(s.id);
    setEditForm({
      ...s,
      classIds: idsOf(s.classIds),
      teacherIds: idsOf(s.teacherIds),
      firstTerm: Number(s.firstTerm || 0),
      secondTerm: Number(s.secondTerm || 0),
      thirdTerm: Number(s.thirdTerm || 0),
      final: Number(s.final || 0),
    });
  };


  /* =========================================================
     SELECT ALL CLASSES
  ========================================================= */

  const classCheckboxGrid = (selectedIds, onToggle) => {
    const classIds = classes.map((item) => item._id || item.id);

    const allSelected =
      classes.length > 0 &&
      classIds.every((id) => selectedIds.includes(id));

    const handleSelectAll = () => {
      if (allSelected) {
        selectedIds.forEach((id) => onToggle(id));
      } else {
        classIds.forEach((id) => {
          if (!selectedIds.includes(id)) onToggle(id);
        });
      }
    };

    return (
      <div style={{ marginBottom: 16 }}>
        <label
          style={{
            display: "block",
            fontSize: 12,
            fontWeight: 700,
            marginBottom: 8,
          }}
        >
          Classes
        </label>

        {classes.length === 0 ? (
          <div
            style={{
              fontSize: 12,
              color: C.muted,
              fontStyle: "italic",
            }}
          >
            No classes found. Create classes first.
          </div>
        ) : (
          <>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 9,
                fontSize: 13,
                fontWeight: 800,
                cursor: "pointer",
                marginBottom: 12,
                padding: "11px 13px",
                background: "rgb(79,70,229)",
                border: "1px solid rgb(79,70,229)",
                borderRadius: 10,
                color: "rgb(255,255,255)",
              }}
            >
              <input
                type="checkbox"
                checked={allSelected}
                onChange={handleSelectAll}
                style={{
                  width: 17,
                  height: 17,
                  accentColor: "rgb(255,255,255)",
                  cursor: "pointer",
                }}
              />
              <Check size={15} color="rgb(255,255,255)" />
              Select All Classes
            </label>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: "9px 14px",
              }}
            >
              {classes.map((item) => {
                const classId = item._id || item.id;

                return (
                  <label
                    key={classId}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      fontSize: 13,
                      cursor: "pointer",
                      color: "#374151",
                      userSelect: "none",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(classId)}
                      onChange={() => onToggle(classId)}
                      style={{
                        width: 16,
                        height: 16,
                        accentColor: C.accent,
                        cursor: "pointer",
                      }}
                    />
                    {item.name}
                  </label>
                );
              })}
            </div>
          </>
        )}

        {selectedIds.length > 0 && (
          <div style={{ fontSize: 11, color: C.muted, marginTop: 10 }}>
            {selectedIds.length} class{selectedIds.length > 1 ? "es" : ""}{" "}
            selected
          </div>
        )}
      </div>
    );
  };


  /* =========================================================
     TERM SELECT CARD (used inside Add/Edit modals)
  ========================================================= */

  const termSelectCard = (key, value, onChange) => {
    const style = TERM_STYLES[key];
    const Icon = style.icon;

    return (
      <div
        key={key}
        style={{
          position: "relative",
          flex: "0 0 calc(50% - 5px)",
          width: "calc(50% - 5px)",
          maxWidth: "calc(50% - 5px)",
          minWidth: 0,
          boxSizing: "border-box",
          borderRadius: 14,
          padding: 13,
          background: style.gradient,
          boxShadow: "0 6px 14px rgba(0,0,0,.14)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -20,
            right: -20,
            width: 70,
            height: 70,
            borderRadius: "50%",
            background: "rgba(255,255,255,.10)",
          }}
        />

        <div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 10,
          }}
        >
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 9,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(255,255,255,.22)",
              flexShrink: 0,
            }}
          >
            <Icon size={16} color="rgb(255,255,255)" />
          </div>

          <span
            style={{
              fontSize: 13,
              fontWeight: 800,
              color: "rgb(255,255,255)",
              minWidth: 0,
            }}
          >
            {style.label}
          </span>
        </div>

        <select
          value={value || 0}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{
            position: "relative",
            width: "100%",
            height: 40,
            border: "none",
            borderRadius: 8,
            padding: "0 10px",
            background: "rgb(255,255,255)",
            color: "rgb(17,24,39)",
            fontSize: 14,
            fontWeight: 700,
            outline: "none",
            cursor: "pointer",
          }}
        >
          <option value={0}>Select Marks</option>
          {TERM_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>
    );
  };


  /* =========================================================
     TERM DISPLAY CARD (desktop table cell)
  ========================================================= */

  const termDisplayCard = (key, value) => {
    const style = TERM_STYLES[key];
    const Icon = style.icon;

    return (
      <div
        style={{
          position: "relative",
          minWidth: 125,
          flex: 1,
          padding: "12px 12px",
          borderRadius: 14,
          background: style.gradient,
          boxShadow: "0 6px 14px rgba(0,0,0,.14)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -18,
            right: -18,
            width: 60,
            height: 60,
            borderRadius: "50%",
            background: "rgba(255,255,255,.10)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -22,
            right: 6,
            width: 34,
            height: 34,
            borderRadius: "50%",
            background: "rgba(255,255,255,.08)",
          }}
        />

        <div
          style={{
            position: "relative",
            width: 28,
            height: 28,
            borderRadius: 8,
            background: "rgba(255,255,255,.22)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 8,
          }}
        >
          <Icon size={15} color="rgb(255,255,255)" />
        </div>

        <div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "baseline",
            gap: 4,
          }}
        >
          <span
            style={{
              fontSize: 22,
              fontWeight: 900,
              color: "rgb(255,255,255)",
            }}
          >
            {value || 0}
          </span>
          <span
            style={{
              fontSize: 11,
              color: "rgba(255,255,255,.85)",
              fontWeight: 700,
            }}
          >
            marks
          </span>
        </div>
      </div>
    );
  };


  /* =========================================================
     TERM TILE (phone card: equal 2x2 tiles)
  ========================================================= */

  const termTile = (key, value) => {
    const style = TERM_STYLES[key];
    const Icon = style.icon;

    return (
      <div
        key={key}
        style={{
          position: "relative",
          flex: "0 0 calc(50% - 4px)",
          width: "calc(50% - 4px)",
          maxWidth: "calc(50% - 4px)",
          minWidth: 0,
          borderRadius: 12,
          padding: 10,
          background: style.gradient,
          boxShadow: "0 4px 10px rgba(0,0,0,.12)",
          overflow: "hidden",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -16,
            right: -16,
            width: 52,
            height: 52,
            borderRadius: "50%",
            background: "rgba(255,255,255,.12)",
          }}
        />

        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 6 }}>
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: 7,
              background: "rgba(255,255,255,.22)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Icon size={13} color="rgb(255,255,255)" />
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,.92)", minWidth: 0 }}>
            {style.label}
          </span>
        </div>

        <div style={{ position: "relative", display: "flex", alignItems: "baseline", gap: 4, marginTop: 8 }}>
          <span style={{ fontSize: 22, fontWeight: 900, color: "rgb(255,255,255)", lineHeight: 1 }}>
            {value || 0}
          </span>
          <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,.85)" }}>marks</span>
        </div>
      </div>
    );
  };


  /* =========================================================
     PHONE LAYOUT: one structured card per subject
  ========================================================= */

  const iconBtn = (bg, border) => ({
    background: bg,
    border: `1px solid ${border}`,
    borderRadius: 9,
    width: 34,
    height: 34,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    flexShrink: 0,
    padding: 0,
  });

  const renderCards = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%", minWidth: 0 }}>
      {subjects.length === 0 ? (
        <div style={{ padding: 40, textAlign: "center", color: C.muted, fontSize: 13 }}>
          <BookOpen size={32} style={{ marginBottom: 8, opacity: 0.4 }} />
          <div>No subjects found.</div>
        </div>
      ) : (
        subjects.map((s) => (
          <div
            key={s.id}
            style={{
              background: "#fff",
              border: "1px solid #e2e8f0",
              borderRadius: 14,
              padding: 12,
              boxSizing: "border-box",
              width: "100%",
              maxWidth: "100%",
              minWidth: 0,
              overflow: "hidden",
              boxShadow: "0 3px 8px rgba(0,0,0,.04)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  background: "linear-gradient(135deg, rgb(79,70,229), rgb(124,58,237))",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <BookOpen size={17} color="#fff" />
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 15, color: "rgb(17,24,39)", overflowWrap: "anywhere" }}>
                  {s.name}
                </div>
                <div style={{ fontSize: 11, color: "rgb(100,116,139)", marginTop: 2 }}>Subject</div>
              </div>

              <button
                type="button"
                title="Edit"
                onClick={() => startEdit(s)}
                style={iconBtn("linear-gradient(135deg, #eef2ff, #e0e7ff)", "#c7d2fe")}
              >
                <Edit size={15} color={C.accent} />
              </button>

              <button
                type="button"
                title="Delete"
                onClick={() => handleDelete(s.id)}
                style={iconBtn("linear-gradient(135deg, #fff1f2, #fee2e2)", "#fecdd3")}
              >
                <Trash2 size={15} color={C.red} />
              </button>
            </div>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              {TERM_KEYS.map(([key, field]) => termTile(key, s[field]))}
            </div>
          </div>
        ))
      )}
    </div>
  );


  /* =========================================================
     DESKTOP LAYOUT: original table
  ========================================================= */

  const headerCell = (label, background, color, align, extra = {}) => (
    <th style={{ padding: "0 6px 8px", ...extra }}>
      <div
        style={{
          background,
          color,
          borderRadius: 10,
          padding: "10px 14px",
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: 0.4,
          textAlign: align,
        }}
      >
        {label}
      </div>
    </th>
  );

  const renderTable = () => (
    <div style={{ overflowX: "auto" }}>
      <table
        className="rtable"
        style={{
          width: "100%",
          borderCollapse: "separate",
          borderSpacing: "0 8px",
          minWidth: 1000,
        }}
      >
        <thead>
          <tr>
            <th style={{ padding: "0 6px 8px", width: 45 }}>
              <div style={{ textAlign: "center", fontSize: 11, fontWeight: 800, color: "rgb(100,116,139)" }}>
                #
              </div>
            </th>
            {headerCell("SUBJECT", NEUTRAL.subject, "rgb(255,255,255)", "left", { minWidth: 170 })}
            {headerCell("FIRST TERM", TERM_STYLES.first.gradient, "rgb(255,255,255)", "center")}
            {headerCell("SECOND TERM", TERM_STYLES.second.gradient, "rgb(255,255,255)", "center")}
            {headerCell("THIRD TERM", TERM_STYLES.third.gradient, "rgb(255,255,255)", "center")}
            {headerCell("FINAL", TERM_STYLES.final.gradient, "rgb(255,255,255)", "center")}
            {headerCell("ACTIONS", NEUTRAL.actions, "rgb(71,85,105)", "left")}
          </tr>
        </thead>

        <tbody>
          {subjects.length === 0 ? (
            <tr>
              <td colSpan={7} style={{ padding: 45, textAlign: "center", color: C.muted, fontSize: 13 }}>
                <BookOpen size={32} style={{ marginBottom: 8, opacity: 0.4 }} />
                <div>No subjects found.</div>
              </td>
            </tr>
          ) : (
            subjects.map((s, i) => (
              <tr key={s.id} style={{ background: ROW_BG[i % ROW_BG.length] }}>
                <td
                  className="rtable-full-hide-mobile"
                  style={{ padding: "12px 14px", fontSize: 13, color: C.muted, verticalAlign: "middle" }}
                >
                  {i + 1}
                </td>

                <td className="rtable-full" style={{ padding: "10px 12px" }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      background: "linear-gradient(135deg, #f8fafc, #eef2ff)",
                      border: "1px solid #e2e8f0",
                      borderRadius: 11,
                      padding: "11px 12px",
                      boxShadow: "0 3px 8px rgba(0,0,0,.04)",
                    }}
                  >
                    <div
                      style={{
                        width: 35,
                        height: 35,
                        borderRadius: 9,
                        background: "linear-gradient(135deg, rgb(79,70,229), rgb(124,58,237))",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <BookOpen size={16} color="#fff" />
                    </div>

                    <div>
                      <div style={{ fontWeight: 800, fontSize: 14, color: "rgb(17,24,39)" }}>{s.name}</div>
                      <div style={{ fontSize: 11, color: "rgb(100,116,139)", marginTop: 2 }}>Subject</div>
                    </div>
                  </div>
                </td>

                <td data-label="First Term" style={{ padding: "10px 7px" }}>{termDisplayCard("first", s.firstTerm)}</td>
                <td data-label="Second Term" style={{ padding: "10px 7px" }}>{termDisplayCard("second", s.secondTerm)}</td>
                <td data-label="Third Term" style={{ padding: "10px 7px" }}>{termDisplayCard("third", s.thirdTerm)}</td>
                <td data-label="Final" style={{ padding: "10px 7px" }}>{termDisplayCard("final", s.final)}</td>

                <td className="rtable-actions" style={{ padding: "10px 12px" }}>
                  <div style={{ display: "flex", gap: 8 }}>
                    <motion.button
                      type="button"
                      whileHover={{ scale: 1.07 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => startEdit(s)}
                      style={iconBtn("linear-gradient(135deg, #eef2ff, #e0e7ff)", "#c7d2fe")}
                    >
                      <Edit size={15} color={C.accent} />
                    </motion.button>

                    <motion.button
                      type="button"
                      whileHover={{ scale: 1.07 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleDelete(s.id)}
                      style={iconBtn("linear-gradient(135deg, #fff1f2, #fee2e2)", "#fecdd3")}
                    >
                      <Trash2 size={15} color={C.red} />
                    </motion.button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );


  return (
    <div
      style={{
        padding: isMobile ? 12 : 28,
        boxSizing: "border-box",
        width: "100%",
        maxWidth: "100%",
        minWidth: 0,
        overflowX: isMobile ? "hidden" : undefined,
      }}
    >

      {/* MAIN CARD */}

      <div
        style={{
          background: C.white,
          borderRadius: 16,
          padding: isMobile ? 14 : 22,
          boxShadow: "0 4px 16px rgba(0,0,0,.07)",
          border: "1px solid rgba(0,0,0,.04)",
          boxSizing: "border-box",
          width: "100%",
          maxWidth: "100%",
          minWidth: 0,
          overflow: isMobile ? "hidden" : undefined,
        }}
      >

        {error && (
          <div
            style={{
              color: C.red,
              fontSize: 13,
              marginBottom: 12,
              background: "#fff1f2",
              border: "1px solid #fecdd3",
              padding: "10px 12px",
              borderRadius: 9,
            }}
          >
            {error}
          </div>
        )}

        {/* HEADER */}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
            marginBottom: 20,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 11,
                background: "linear-gradient(135deg, #eef2ff, #ede9fe)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <BookOpen size={20} color={C.accent} />
            </div>

            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: "#111827" }}>
                Subjects
              </div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                Manage subjects and term marks
              </div>
            </div>
          </div>

          <motion.button
            type="button"
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => {
              setError("");
              setShowAdd(true);
            }}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 7,
              width: isMobile ? "100%" : "auto",
              background: "linear-gradient(135deg, rgb(79,70,229), rgb(124,58,237))",
              color: "#fff",
              border: "none",
              borderRadius: 10,
              padding: "10px 17px",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 700,
              boxShadow: "0 5px 12px rgba(79,70,229,.25)",
            }}
          >
            <Plus size={15} />
            Add Subject
          </motion.button>
        </div>

        {isMobile ? renderCards() : renderTable()}
      </div>

      {/* MODALS */}

      <AnimatePresence>

        {editingId && (
          <Modal
            title="Edit Subject"
            onClose={() => !saving && setEditingId(null)}
          >
            <FormField
              label="Subject Name"
              value={editForm.name || ""}
              onChange={(value) =>
                setEditForm({ ...editForm, name: value })
              }
            />

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 10,
                marginBottom: 16,
              }}
            >
              {termSelectCard("first", editForm.firstTerm, (value) =>
                setEditForm({ ...editForm, firstTerm: value })
              )}
              {termSelectCard("second", editForm.secondTerm, (value) =>
                setEditForm({ ...editForm, secondTerm: value })
              )}
              {termSelectCard("third", editForm.thirdTerm, (value) =>
                setEditForm({ ...editForm, thirdTerm: value })
              )}
              {termSelectCard("final", editForm.final, (value) =>
                setEditForm({ ...editForm, final: value })
              )}
            </div>

            {classCheckboxGrid(idsOf(editForm.classIds), (id) =>
              setEditForm((form) => ({
                ...form,
                classIds: toggleId(idsOf(form.classIds), id),
              }))
            )}

            <div style={{ marginBottom: 16 }}>
              <MultiSelectDropdown
                label="Assigned Teachers"
                options={teacherOptions}
                selectedIds={(editForm.teacherIds || []).map(String)}
                onChange={(ids) =>
                  setEditForm((form) => ({ ...form, teacherIds: ids }))
                }
                placeholder="Select teachers who teach this subject..."
                emptyText="No teachers found. Add staff first."
              />
            </div>

            {error && (
              <div
                style={{
                  color: C.red,
                  background: "#fff1f2",
                  border: "1px solid #fecdd3",
                  borderRadius: 8,
                  padding: "9px 12px",
                  marginBottom: 12,
                  fontSize: 13,
                }}
              >
                {error}
              </div>
            )}

            <div style={{ display: "flex", gap: 12 }}>
              <SaveBtn onClick={handleSaveEdit} disabled={saving} />
              <CancelBtn
                onClick={() => !saving && setEditingId(null)}
              />
            </div>
          </Modal>
        )}

        {showAdd && (
          <Modal
            title="Add New Subject"
            onClose={() => !saving && setShowAdd(false)}
          >
            <form
              onSubmit={(event) => {
                event.preventDefault();
                handleAdd();
              }}
            >
              <FormField
                label="Subject Name"
                value={addForm.name}
                onChange={(value) =>
                  setAddForm({ ...addForm, name: value })
                }
              />

              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 10,
                  marginBottom: 16,
                }}
              >
                {termSelectCard("first", addForm.firstTerm, (value) =>
                  setAddForm({ ...addForm, firstTerm: value })
                )}
                {termSelectCard("second", addForm.secondTerm, (value) =>
                  setAddForm({ ...addForm, secondTerm: value })
                )}
                {termSelectCard("third", addForm.thirdTerm, (value) =>
                  setAddForm({ ...addForm, thirdTerm: value })
                )}
                {termSelectCard("final", addForm.final, (value) =>
                  setAddForm({ ...addForm, final: value })
                )}
              </div>

              {classCheckboxGrid(addForm.classIds, (id) =>
                setAddForm((form) => ({
                  ...form,
                  classIds: toggleId(form.classIds, id),
                }))
              )}

              <div style={{ marginBottom: 16 }}>
                <MultiSelectDropdown
                  label="Assigned Teachers"
                  options={teacherOptions}
                  selectedIds={(addForm.teacherIds || []).map(String)}
                  onChange={(ids) =>
                    setAddForm((form) => ({ ...form, teacherIds: ids }))
                  }
                  placeholder="Select teachers who teach this subject..."
                  emptyText="No teachers found. Add staff first."
                />
              </div>

              {error && (
                <div
                  role="alert"
                  style={{
                    color: C.red,
                    background: "#fff1f2",
                    border: "1px solid #fecdd3",
                    borderRadius: 8,
                    padding: "9px 12px",
                    marginBottom: 12,
                    fontSize: 13,
                  }}
                >
                  {error}
                </div>
              )}

              <div style={{ display: "flex", gap: 12 }}>
                <SaveBtn
                  type="submit"
                  label={saving ? "Saving..." : "Save Subject"}
                  disabled={saving}
                />
                <CancelBtn
                  onClick={() => !saving && setShowAdd(false)}
                />
              </div>
            </form>
          </Modal>
        )}

      </AnimatePresence>

    </div>
  );
}

export { AdminSubjects };