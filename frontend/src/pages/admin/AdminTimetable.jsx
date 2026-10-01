import { useEffect, useState } from "react";
import { Plus, Edit, Trash2, X } from "../../shared/ui";
import { C } from "../../shared/runtime";
import { list, create, update, remove } from "../../services/resource.service";
import { onResourceChange } from "../../services/socket.service";
import { Portal } from "../../components/common/Portal";
import { idOf, classLabel } from "../../utils/formatters";
import useIsMobile from "../../hooks/useIsMobile";
import { DayCheckboxes } from "../../components/timetable/DayCheckboxes";

// Admin decides which days the school runs classes — the grid always has a Saturday
// column too (it just stays empty if unused), and the Add-entry form lets admin tick
// any combination of days rather than being locked to a fixed Mon–Fri range.
const ALL_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// Distinct theme per day: header color, cell background, accent text
const dayThemes = {
  Monday: { header: "#2563eb", bg: "#dbeafe", accent: "#1e3a8a" },
  Tuesday: { header: "#db2777", bg: "#fce7f3", accent: "#831843" },
  Wednesday: { header: "#059669", bg: "#d1fae5", accent: "#065f46" },
  Thursday: { header: "#d97706", bg: "#fef3c7", accent: "#92400e" },
  Friday: { header: "#4f46e5", bg: "#e0e7ff", accent: "#312e81" },
  Saturday: { header: "#0d9488", bg: "#ccfbf1", accent: "#134e4a" },
};

const timeThemes = [
  { bg: "#e0f2fe", text: "#0369a1" },
  { bg: "#fce7f3", text: "#be185d" },
  { bg: "#d1fae5", text: "#047857" },
  { bg: "#fef9c3", text: "#a16207" },
  { bg: "#ede9fe", text: "#6d28d9" },
  { bg: "#ffe4e6", text: "#be123c" },
  { bg: "#e0e7ff", text: "#4338ca" },
];

// `days` holds the set of checked days for this entry. Both Add and Edit use the
// exact same multi-select day picker — Add creates one row per checked day;
// Edit updates the original row to stay on one of the checked days and creates
// new rows for any *additional* days ticked.
const blankEntry = {
  classId: "",
  days: ["Monday"],
  startTime: "08:00",
  endTime: "08:45",
  subjectId: "",
  teacher: "",
  room: "",
  type: "Class",
};

// Non-teaching slots don't have a subject/teacher/room, so those fields are
// hidden for them.
const NON_TEACHING_TYPES = ["Lunch Break", "Break"];
const needsSubjectFields = type => !NON_TEACHING_TYPES.includes(type);

/* ----------------------------- helpers ----------------------------- */

const entryKey = item => `${item.startTime || ""}-${item.endTime || ""}`;

const timeLabel = item => `${item.startTime || ""} - ${item.endTime || ""}`;

const teacherName = item => item?.teacher?.name || item?.teacher?.user?.name || "";

/* ------------------------- small form pieces ------------------------ */

function Field({ label, children }) {
  return (
    <label
      style={{
        display: "block",
        marginBottom: 14,
        fontSize: 13,
        fontWeight: 600,
      }}
    >
      <span style={{ display: "block", marginBottom: 6 }}>{label}</span>
      {children}
    </label>
  );
}

function Input({ value, onChange, type = "text", disabled, children }) {
  const style = {
    width: "100%",
    boxSizing: "border-box",
    padding: "10px 12px",
    border: `1px solid ${C.border}`,
    borderRadius: 8,
    fontSize: 13,
    background: disabled ? "#f1f5f9" : C.white,
  };

  return children ? (
    <select
      value={value || ""}
      onChange={e => onChange(e.target.value)}
      disabled={disabled}
      style={style}
    >
      {children}
    </select>
  ) : (
    <input
      type={type}
      value={value || ""}
      onChange={e => onChange(e.target.value)}
      disabled={disabled}
      style={style}
    />
  );
}

/* ---------------------------- entry modal --------------------------- */

function EntryModal({
  entry,
  editId = "",
  classes,
  subjects,
  teachers,
  onClose,
  onSaved,
}) {
  const [form, setForm] = useState(entry || blankEntry);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (key, value) => setForm(current => ({ ...current, [key]: value }));

  const originalDay = entry?.day || "";

  const showSubjectFields = needsSubjectFields(form.type);

  const subjectsForClass = form.classId
    ? subjects.filter(
        item =>
          Array.isArray(item.classIds) &&
          item.classIds.some(c => idOf(c) === idOf(form.classId))
      )
    : [];

  const setType = type => {
    setForm(current =>
      needsSubjectFields(type)
        ? { ...current, type }
        : { ...current, type, subjectId: "", teacher: "", room: "" }
    );
  };

  const setClassId = classId => {
    setForm(current => {
      const stillValid = subjects.some(
        item =>
          idOf(item) === idOf(current.subjectId) &&
          Array.isArray(item.classIds) &&
          item.classIds.some(c => idOf(c) === idOf(classId))
      );

      return stillValid
        ? { ...current, classId }
        : { ...current, classId, subjectId: "" };
    });
  };

  const save = async event => {
    event.preventDefault();

    const selectedDays = form.days || [];

    if (
      !form.classId ||
      !selectedDays.length ||
      !form.startTime ||
      !form.endTime ||
      (showSubjectFields && !form.subjectId)
    ) {
      setError(
        showSubjectFields
          ? "Class, at least one day, subject, and both times are required."
          : "Class, at least one day, and both times are required."
      );
      return;
    }

    if (form.endTime <= form.startTime) {
      setError("End time must be after start time.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const basePayload = {
        ...form,
        classId: idOf(form.classId),
        subjectId: showSubjectFields ? idOf(form.subjectId) : undefined,
        teacher:
          showSubjectFields && form.teacher ? idOf(form.teacher) : undefined,
        room: showSubjectFields ? form.room : undefined,
      };

      delete basePayload._id;
      delete basePayload.id;
      delete basePayload.createdAt;
      delete basePayload.updatedAt;
      delete basePayload.__v;
      delete basePayload.days;
      delete basePayload.day;

      if (editId) {
        const updateDay = selectedDays.includes(originalDay)
          ? originalDay
          : selectedDays[0];

        const extraDays = selectedDays.filter(day => day !== updateDay);

        await update("timetable", editId, { ...basePayload, day: updateDay });

        if (extraDays.length) {
          const results = await Promise.allSettled(
            extraDays.map(day => create("timetable", { ...basePayload, day }))
          );

          const failed = results.filter(r => r.status === "rejected");

          if (failed.length) {
            setError(
              `Updated ${updateDay}. Also added ${
                extraDays.length - failed.length
              } of ${extraDays.length} more day(s). ${
                failed[0].reason?.message || ""
              }`.trim()
            );

            setSaving(false);
            onSaved();
            return;
          }
        }

        onSaved();
      } else {
        const results = await Promise.allSettled(
          selectedDays.map(day => create("timetable", { ...basePayload, day }))
        );

        const failed = results.filter(r => r.status === "rejected");

        if (failed.length === results.length) {
          throw new Error(
            failed[0].reason?.message || "Unable to save timetable entry"
          );
        }

        if (failed.length) {
          setError(
            `Saved for ${results.length - failed.length} of ${
              results.length
            } day(s). ${failed[0].reason?.message || ""}`.trim()
          );

          setSaving(false);
          return;
        }

        onSaved();
      }
    } catch (saveError) {
      setError(saveError.message || "Unable to save timetable entry");
      setSaving(false);
      return;
    } finally {
      setSaving(false);
    }
  };

  return (
    <Portal>
      <div
        onClick={event => event.target === event.currentTarget && onClose()}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(15,23,42,.45)",
          display: "grid",
          placeItems: "center",
          zIndex: 9999,
          padding: 20,
        }}
      >
        <form
          onSubmit={save}
          style={{
            background: C.white,
            borderRadius: 14,
            width: "min(520px, 100%)",
            maxHeight: "90vh",
            overflowY: "auto",
            padding: 24,
            boxShadow: "0 20px 50px rgba(15,23,42,.2)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 20,
            }}
          >
            <strong style={{ fontSize: 18 }}>
              {editId ? "Edit timetable entry" : "Add timetable entry"}
            </strong>

            <button
              type="button"
              onClick={onClose}
              style={{
                border: 0,
                background: "#f1f5f9",
                borderRadius: 8,
                width: 32,
                height: 32,
                cursor: "pointer",
              }}
            >
              <X size={16} />
            </button>
          </div>

          <Field label="Class">
            <Input value={form.classId} onChange={setClassId}>
              <option value="">Select class</option>

              {classes.map(item => (
                <option key={item._id} value={item._id}>
                  {classLabel(item)}
                </option>
              ))}
            </Input>
          </Field>

          <Field label="Day(s) — same subject & time repeats on every day you check">
            <DayCheckboxes
              selected={form.days || []}
              onChange={value => set("days", value)}
            />
          </Field>

          <Field label="Type">
            <Input value={form.type} onChange={setType}>
              {["Class", "Lunch Break", "Break", "Activity", "Exam"].map(type => (
                <option key={type}>{type}</option>
              ))}
            </Input>
          </Field>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
            }}
          >
            <Field label="Start time">
              <Input
                type="time"
                value={form.startTime}
                onChange={value => set("startTime", value)}
              />
            </Field>

            <Field label="End time">
              <Input
                type="time"
                value={form.endTime}
                onChange={value => set("endTime", value)}
              />
            </Field>
          </div>

          {showSubjectFields && (
            <>
              <Field label="Subject">
                <Input
                  value={form.subjectId}
                  onChange={value => set("subjectId", value)}
                  disabled={!form.classId}
                >
                  <option value="">
                    {form.classId
                      ? subjectsForClass.length
                        ? "Select subject"
                        : "No subjects assigned to this class"
                      : "Select a class first"}
                  </option>

                  {subjectsForClass.map(item => (
                    <option key={item._id} value={item._id}>
                      {item.name}
                      {item.code ? ` (${item.code})` : ""}
                    </option>
                  ))}
                </Input>
              </Field>

              <Field label="Teacher (optional)">
                <Input
                  value={form.teacher}
                  onChange={value => set("teacher", value)}
                >
                  <option value="">Unassigned</option>

                  {teachers.map(item => (
                    <option
                      key={idOf(item.user) || item._id}
                      value={idOf(item.user) || item._id}
                    >
                      {item.user?.name || item.name || item.employeeId}
                    </option>
                  ))}
                </Input>
              </Field>

              <Field label="Room (optional)">
                <Input value={form.room} onChange={value => set("room", value)} />
              </Field>
            </>
          )}

          {error && (
            <div style={{ color: C.red, fontSize: 13, marginBottom: 14 }}>
              {error}
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "10px 14px",
                border: `1px solid ${C.border}`,
                borderRadius: 8,
                background: C.white,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              style={{
                padding: "10px 16px",
                border: 0,
                borderRadius: 8,
                color: C.white,
                background: C.accent,
                cursor: "pointer",
                fontWeight: 700,
              }}
            >
              {saving ? "Saving..." : editId ? "Save changes" : "Add slot"}
            </button>
          </div>
        </form>
      </div>
    </Portal>
  );
}

/* ------------------------ shared entry content ----------------------- */

const iconButtonStyle = {
  width: 30,
  height: 30,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  border: 0,
  borderRadius: 7,
  background: "rgba(255,255,255,.75)",
  cursor: "pointer",
  padding: 0,
};

const ellipsis = {
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

// One timetable entry (subject / teacher / class·room / edit+delete).
// Used by BOTH the desktop grid and the mobile vertical list so they never drift apart.
// `wrap` lets text wrap on mobile instead of being cut off with "...".
function EntryContent({
  item,
  theme,
  showDivider,
  wrap,
  subjectName,
  classText,
  onEdit,
  onDelete,
}) {
  const textFlow = wrap ? { wordBreak: "break-word" } : ellipsis;

  return (
    <div
      style={{
        minHeight: 66,
        position: "relative",
        width: "100%",
        paddingBottom: 8,
        marginBottom: 8,
        borderBottom: showDivider ? `1px solid ${theme.header}55` : "none",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          fontWeight: 700,
          color: theme.accent,
          fontSize: 13,
          paddingRight: 68,
          ...textFlow,
        }}
      >
        {subjectName(item)}
      </div>

      {item.type === "Class" && (
        <div
          style={{
            color: theme.accent,
            fontSize: 11,
            marginTop: 4,
            fontWeight: 600,
            opacity: 0.85,
            ...textFlow,
          }}
        >
          {teacherName(item) ? `👤 ${teacherName(item)}` : "Unassigned"}
        </div>
      )}

      <div
        style={{
          color: "#64748b",
          fontSize: 11,
          marginTop: 3,
          ...textFlow,
        }}
      >
        {classText(item)}
        {item.room ? ` · ${item.room}` : ""}
      </div>

      <div
        style={{
          position: "absolute",
          top: -3,
          right: 0,
          display: "flex",
          gap: 2,
        }}
      >
        <button
          type="button"
          title="Edit"
          onClick={() => onEdit(item)}
          style={iconButtonStyle}
        >
          <Edit size={14} />
        </button>

        <button
          type="button"
          title="Delete"
          onClick={() => onDelete(item)}
          style={{ ...iconButtonStyle, color: C.red }}
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

/* ------------------------------ page ------------------------------- */

export function AdminTimetable() {
  const [entries, setEntries] = useState([]);
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [classId, setClassId] = useState("");
  const [activeDay, setActiveDay] = useState("");
  const [modalEntry, setModalEntry] = useState(null);
  const [editId, setEditId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const isMobile = useIsMobile();

  const load = () => {
    setLoading(true);

    Promise.all([
      list("timetable", "limit=5000"),
      list("classes", "limit=5000"),
      list("subjects", "limit=5000"),
      list("staff", "limit=5000"),
    ])
      .then(([timetable, classResult, subjectResult, staffResult]) => {
        setEntries(timetable.data || []);
        setClasses(classResult.data || []);
        setSubjects(subjectResult.data || []);
        setTeachers(staffResult.data || []);
        setError("");
      })
      .catch(loadError =>
        setError(loadError.message || "Unable to load timetable data")
      )
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    return onResourceChange("timetable", load);
  }, []);

  useEffect(() => {
    if (!classId && classes.length) {
      setClassId(classes[0]._id);
    }
  }, [classId, classes]);

  const visible = entries.filter(item => {
    if (!classId) return false;

    const itemClassId = String(item.classId?._id || item.classId || "");

    return itemClassId === String(classId);
  });

  const times = [...new Set(visible.map(entryKey))].sort();

  const visibleDays = visible.some(item => item.day === "Saturday")
    ? ALL_DAYS
    : ALL_DAYS.filter(d => d !== "Saturday");

  const itemsAt = (time, day) =>
    visible.filter(item => entryKey(item) === time && item.day === day);

  const subjectName = item =>
    item?.subjectId?.name ||
    subjects.find(subject => idOf(subject) === idOf(item?.subjectId))?.name ||
    item?.type ||
    "Entry";

  const classText = item => {
    if (item.classId?.name) return classLabel(item.classId);

    const found = classes.find(current => idOf(current) === idOf(item.classId));

    return found ? classLabel(found) : "";
  };

  const removeEntry = async item => {
    if (!window.confirm("Delete this timetable entry?")) return;

    try {
      await remove("timetable", item._id || item.id);
      load();
    } catch (removeError) {
      setError(removeError.message || "Unable to delete entry");
    }
  };

  const closeModal = () => {
    setModalEntry(null);
    setEditId("");
  };

  const openEdit = item => {
    const id = String(item?._id || item?.id || "");

    setEditId(id);

    setModalEntry({
      ...item,
      classId: idOf(item.classId),
      subjectId: idOf(item.subjectId),
      teacher: idOf(item.teacher),
      days: [item.day],
    });
  };

  const openAdd = () => {
    if (!classes.length) {
      setError(
        "Please create at least one class before adding timetable entries. Go to Manage Classes."
      );
      return;
    }

    setEditId("");

    setModalEntry({
      ...blankEntry,
      classId: classId || classes[0]?._id || "",
    });
  };

  const entryProps = {
    subjectName,
    classText,
    onEdit: openEdit,
    onDelete: removeEntry,
  };

  /*
   * DESKTOP / TABLET: wide grid.
   *   TIME | MON | TUE | WED | THU | FRI (| SAT)
   * Scrolls sideways only if the screen is narrower than the grid.
   */
  const renderGrid = () => {
    const TIME_COLUMN_WIDTH = 150;
    const DAY_COLUMN_WIDTH = 220;

    const totalTableWidth =
      TIME_COLUMN_WIDTH +
      visibleDays.length * DAY_COLUMN_WIDTH +
      (visibleDays.length + 1) * 4;

    return (
      <div
        className="edumanage-timetable-scroll"
        style={{
          width: "100%",
          maxWidth: "100%",
          minWidth: 0,
          overflowX: "auto",
          overflowY: "hidden",
          WebkitOverflowScrolling: "touch",
          boxSizing: "border-box",
          padding: "0 0 10px 0",
          direction: "ltr",
        }}
      >
        <div
          style={{
            width: `${totalTableWidth}px`,
            minWidth: `${totalTableWidth}px`,
            flexShrink: 0,
            boxSizing: "border-box",
          }}
        >
          <table
            style={{
              width: `${totalTableWidth}px`,
              borderCollapse: "separate",
              borderSpacing: 4,
              tableLayout: "fixed",
              margin: 0,
              padding: 0,
              boxSizing: "border-box",
            }}
          >
            <colgroup>
              <col style={{ width: `${TIME_COLUMN_WIDTH}px` }} />
              {visibleDays.map(day => (
                <col key={day} style={{ width: `${DAY_COLUMN_WIDTH}px` }} />
              ))}
            </colgroup>

            <thead>
              <tr>
                <th
                  style={{
                    padding: "13px 14px",
                    color: C.white,
                    background: "#334155",
                    borderRadius: 10,
                    textAlign: "left",
                    fontSize: 16,
                    fontWeight: 800,
                    whiteSpace: "nowrap",
                    boxSizing: "border-box",
                  }}
                >
                  TIME
                </th>

                {visibleDays.map(day => (
                  <th
                    key={day}
                    style={{
                      padding: "13px 14px",
                      color: C.white,
                      background: dayThemes[day].header,
                      borderRadius: 10,
                      textAlign: "center",
                      fontSize: 16,
                      fontWeight: 800,
                      whiteSpace: "nowrap",
                      boxSizing: "border-box",
                    }}
                  >
                    {day.slice(0, 3).toUpperCase()}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {times.map((time, rowIndex) => {
                const timeTheme = timeThemes[rowIndex % timeThemes.length];
                const timeEntry = visible.find(item => entryKey(item) === time);

                return (
                  <tr key={time}>
                    <td
                      style={{
                        height: 106,
                        padding: 12,
                        background: timeTheme.bg,
                        borderRadius: 10,
                        color: timeTheme.text,
                        fontSize: 13,
                        fontWeight: 700,
                        whiteSpace: "nowrap",
                        verticalAlign: "middle",
                        boxSizing: "border-box",
                        overflow: "hidden",
                        boxShadow: "0 1px 3px rgba(15,23,42,.08)",
                      }}
                    >
                      <span style={{ marginRight: 6 }}>🕐</span>
                      {timeLabel(timeEntry)}
                    </td>

                    {visibleDays.map(day => {
                      const items = itemsAt(time, day);
                      const theme = dayThemes[day];

                      return (
                        <td
                          key={day}
                          style={{
                            height: 106,
                            padding: 8,
                            verticalAlign: "top",
                            background: items.length ? theme.bg : "#f8fafc",
                            borderRadius: 10,
                            borderLeft: items.length
                              ? `3px solid ${theme.header}`
                              : "none",
                            boxSizing: "border-box",
                            overflow: "hidden",
                          }}
                        >
                          {items.map(item => (
                            <EntryContent
                              key={item._id || item.id}
                              item={item}
                              theme={theme}
                              showDivider={items.length > 1}
                              wrap={false}
                              {...entryProps}
                            />
                          ))}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  /*
   * MOBILE: school days as tabs in ONE row (Mon–Fri, plus Sat only if used).
   * Tap a day to see only that day's periods — no scrolling through every day.
   * Opens on today (if it is a school day), otherwise Monday.
   */
  const renderVertical = () => {
    // Saturday tab appears only when some entry is scheduled on Saturday.
    const tabDays = visibleDays;
    const todayName = new Date().toLocaleDateString("en-US", { weekday: "long" });

    const selectedDay = tabDays.includes(activeDay)
      ? activeDay
      : tabDays.includes(todayName)
      ? todayName
      : tabDays[0];

    const theme = dayThemes[selectedDay];

    const dayItems = visible
      .filter(item => item.day === selectedDay)
      .sort((a, b) => (a.startTime || "").localeCompare(b.startTime || ""));

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14, width: "100%", maxWidth: "100%", minWidth: 0 }}>
        {/* Day tabs: always one row */}
        <div
          role="tablist"
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${tabDays.length}, minmax(0, 1fr))`,
            gap: 4,
            width: "100%",
          }}
        >
          {tabDays.map(day => {
            const dayTheme = dayThemes[day];
            const on = day === selectedDay;

            return (
              <button
                key={day}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setActiveDay(day)}
                style={{
                  minWidth: 0,
                  padding: "10px 0",
                  border: `2px solid ${dayTheme.header}`,
                  borderRadius: 10,
                  background: on ? dayTheme.header : dayTheme.bg,
                  color: on ? C.white : dayTheme.accent,
                  fontSize: 12,
                  fontWeight: 800,
                  whiteSpace: "nowrap",
                  cursor: "pointer",
                }}
              >
                {day.slice(0, 3)}
              </button>
            );
          })}
        </div>

        {/* Selected day */}
        <div style={{ width: "100%", minWidth: 0 }}>
          <div
            style={{
              padding: "10px 14px",
              color: C.white,
              background: theme.header,
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 800,
              letterSpacing: 0.4,
              marginBottom: 8,
            }}
          >
            {selectedDay.toUpperCase()}
          </div>

          {dayItems.length ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {dayItems.map(item => {
                const timeTheme = timeThemes[times.indexOf(entryKey(item)) % timeThemes.length];
                const isBreak = NON_TEACHING_TYPES.includes(item.type);

                return (
                  <div
                    key={item._id || item.id}
                    style={{
                      display: "flex",
                      alignItems: "stretch",
                      gap: 10,
                      background: isBreak ? "#f8fafc" : theme.bg,
                      borderLeft: `4px solid ${isBreak ? "#cbd5e1" : theme.header}`,
                      borderRadius: 12,
                      padding: 10,
                      boxSizing: "border-box",
                      width: "100%",
                      maxWidth: "100%",
                      minWidth: 0,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        flexShrink: 0,
                        width: 64,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        background: isBreak ? "#e2e8f0" : timeTheme.bg,
                        color: isBreak ? "#475569" : timeTheme.text,
                        borderRadius: 9,
                        padding: "6px 4px",
                        fontSize: 12,
                        fontWeight: 700,
                        lineHeight: 1.35,
                      }}
                    >
                      <span>{item.startTime}</span>
                      <span style={{ fontSize: 9, opacity: 0.6, fontWeight: 600 }}>to</span>
                      <span>{item.endTime}</span>
                    </div>

                    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                      <div style={{ fontWeight: 700, fontSize: 15, color: isBreak ? "#475569" : theme.accent, overflowWrap: "anywhere" }}>
                        {subjectName(item)}
                      </div>
                      {item.type === "Class" && (
                        <div style={{ fontSize: 12, marginTop: 3, fontWeight: 600, color: theme.accent, opacity: 0.85, overflowWrap: "anywhere" }}>
                          {teacherName(item) ? `👤 ${teacherName(item)}` : "Unassigned"}
                        </div>
                      )}
                      {item.room && !isBreak && (
                        <div style={{ fontSize: 12, marginTop: 3, color: "#64748b", overflowWrap: "anywhere" }}>Room: {item.room}</div>
                      )}
                    </div>

                    <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", justifyContent: "center", gap: 6 }}>
                      <button type="button" title="Edit" onClick={() => openEdit(item)} style={iconButtonStyle}>
                        <Edit size={14} />
                      </button>
                      <button type="button" title="Delete" onClick={() => removeEntry(item)} style={{ ...iconButtonStyle, color: C.red }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ padding: 14, background: "#f8fafc", color: C.muted, borderRadius: 10, fontSize: 12, textAlign: "center" }}>
              No classes on {selectedDay}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div
      className="edumanage-page-padded"
      style={{
        boxSizing: "border-box",
        width: "100%",
        maxWidth: "100%",
        minWidth: 0,
        // Mobile: lock the whole page card to vertical scrolling only, so it can't
        // drift or wobble sideways while you scroll.
        overflowX: isMobile ? "clip" : undefined,
        touchAction: isMobile ? "pan-y" : undefined,
        overscrollBehaviorX: isMobile ? "none" : undefined,
      }}
    >
      <div
        style={{
          background: C.white,
          borderRadius: 14,
          padding: isMobile ? 12 : 22,
          boxShadow: "0 2px 8px rgba(0,0,0,.06)",
          boxSizing: "border-box",
          width: "100%",
          maxWidth: "100%",
          minWidth: 0,
          overflowX: isMobile ? "clip" : undefined,
          touchAction: isMobile ? "pan-y" : undefined,
        }}
      >
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 20, lineHeight: 1.25 }}>
            Weekly Class Timetable
          </div>
        </div>

        <div
          className="edumanage-filter-bar"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            width: "100%",
            marginBottom: 18,
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flex: "1 1 260px",
              minWidth: 0,
            }}
          >
            <label style={{ fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
              Class
            </label>

            <select
              value={classId}
              onChange={event => setClassId(event.target.value)}
              style={{
                padding: "10px 12px",
                flex: "1 1 auto",
                minWidth: 0,
                maxWidth: 280,
                border: `1px solid ${C.border}`,
                borderRadius: 8,
                background: C.white,
              }}
            >
              {!classes.length && <option value="">No classes yet</option>}

              {classes.map(item => (
                <option key={item._id} value={item._id}>
                  {classLabel(item)}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={openAdd}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 7,
              padding: "10px 14px",
              border: 0,
              borderRadius: 8,
              background: classes.length ? C.accent : C.muted,
              color: C.white,
              fontWeight: 700,
              cursor: classes.length ? "pointer" : "not-allowed",
              opacity: classes.length ? 1 : 0.6,
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
            title={classes.length ? "Add new entry" : "Create classes first"}
          >
            <Plus size={16} />
            Add entry
          </button>
        </div>

        {error && (
          <div style={{ color: C.red, fontSize: 13, marginBottom: 14 }}>
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ padding: 30, color: C.muted, textAlign: "center" }}>
            Loading live timetable...
          </div>
        ) : !visible.length ? (
          <div
            style={{
              padding: 42,
              color: C.muted,
              textAlign: "center",
              border: `1px dashed ${C.border}`,
              borderRadius: 10,
            }}
          >
            No timetable entries for this selection. Add the first one.
          </div>
        ) : isMobile ? (
          renderVertical()
        ) : (
          renderGrid()
        )}
      </div>

      {modalEntry && (
        <EntryModal
          entry={modalEntry}
          editId={editId}
          classes={classes}
          subjects={subjects}
          teachers={teachers}
          onClose={closeModal}
          onSaved={() => {
            closeModal();
            load();
          }}
        />
      )}
    </div>
  );
}