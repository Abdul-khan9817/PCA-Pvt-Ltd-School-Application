import { useState, useEffect, useRef } from "react";
import { C, ROW_COLORS } from "../../shared/runtime";
import { list, create, update, remove } from "../../services/resource.service";
import { onResourceChange } from "../../services/socket.service";
import { Modal } from "../../components/common/Modal";
import { motion } from "../../shared/ui";
import {
  DollarSign, Search, Plus, Trash2, Edit, CheckCircle2,
  AlertTriangle, Clock, X, Check, Calendar, ChevronDown, Download
} from "../../shared/ui";
import { downloadFeeReceipt, downloadClassFeeReport } from "../../utils/documents";
import { allocatePayment, feeStatus } from "../../utils/feeAllocation";
import { monthKey, monthSortValue, latestByKey, normType } from "../../utils/history";
import { FeeTypeFilterDropdown as SharedFeeTypeFilterDropdown } from "../../components/fees/FeeTypeFilterDropdown";
import useCanHover from "../../hooks/useCanHover";
import { MONTH_NAMES } from "../../utils/months";
import { FeeFormFields as SharedAdminFeeFormFields } from "../../components/fees/AdminFeeFormFields";
import { ClassFeeFields as SharedClassFeeFields } from "../../components/fees/ClassFeeFields";


const FEE_TYPES = ["Tuition", "Admission", "Exam", "Transport", "Annual", "Library", "Sports", "Other"];

// Unique colour per fee type (bg, text, border)
const FEE_TYPE_COLORS = {
  Tuition:   { bg: "#eef2ff", text: "#6366f1", border: "#c7d2fe" },
  Admission: { bg: "#fdf4ff", text: "#a21caf", border: "#e879f9" },
  Exam:      { bg: "#fff7ed", text: "#ea580c", border: "#fed7aa" },
  Transport: { bg: "#ecfdf5", text: "#059669", border: "#6ee7b7" },
  Annual:    { bg: "#eff6ff", text: "#2563eb", border: "#93c5fd" },
  Library:   { bg: "#fefce8", text: "#ca8a04", border: "#fde68a" },
  Sports:    { bg: "#fdf2f8", text: "#db2777", border: "#f9a8d4" },
  Other:     { bg: "#f8fafc", text: "#64748b", border: "#cbd5e1" },
};
const STATUS_OPTIONS = ["All", "Pending", "Partial", "Paid", "Overdue"];
const PAYMENT_METHODS = ["Cash", "Card", "Bank Transfer", "UPI", "Online Portal", "Cheque"];

const CURRENT_YEAR = new Date().getFullYear();
const MONTHS_LIST = MONTH_NAMES.map((m) => `${m} ${CURRENT_YEAR}`);

// Class label used for grouping students (e.g. "Class 10" or "Class 10-A")
const classLabelOf = (st) => (st?.cls ? `${st.cls}${st.section ? `-${st.section}` : ""}` : "");

/**
 * True only on devices that have a real hovering pointer (mouse / trackpad).
 * On phones/tablets :hover "sticks" after a touch, so hover animations
 * (scale / lift) made cards jump and grow while scrolling. We only enable
 * whileHover animations when this returns true.
 */
const STATUS_RANK = { Overdue: 0, Pending: 1, Partial: 2, Paid: 3 };
// "Worst" status wins for a group of fees (one student + month)
const worstStatusOf = (group) =>
  group.reduce((worst, f) => ((STATUS_RANK[f.status] ?? 1) < (STATUS_RANK[worst] ?? 1) ? f.status : worst), group[0].status);

const inputStyle = { width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid " + C.border, fontSize: 13, outline: "none", boxSizing: "border-box", minWidth: 0 };
const labelStyle = { display: "block", fontSize: 12, fontWeight: 700, color: C.muted, marginBottom: 4 };

/**
 * The fee form fields, shared by "Assign Fee to Student" and
 * "Edit Fee Records / Record Payment" so both screens always look and behave
 * exactly the same.
 *
 * data: { student, selectedTypes, typeAmounts, month, paid, dueDate, paymentMethod, transactionId, notes }
 */
function LegacyFeeFormFields({ data, onChange, students, typeOptions, monthOptions, paidLabel, showBalance = false, studentFallback, getDefaultAmount }) {
  const selected = data.selectedTypes || [];
  const totalAmount = Object.values(data.typeAmounts || {}).reduce((sum, v) => sum + (Number(v) || 0), 0);
  const paidNum = Number(data.paid) || 0;
  const balance = Math.max(0, totalAmount - paidNum);
  const studentKnown = students.some((st) => st._id === data.student);

  return (
    <>
      <div>
        <label style={labelStyle}>Select Student *</label>
        <select
          value={data.student}
          onChange={(e) => {
            const sid = e.target.value;
            if (!getDefaultAmount) return onChange({ student: sid });
            // Refill amounts from the newly chosen student's last saved fee (keep anything the admin typed)
            const amts = { ...(data.typeAmounts || {}) };
            selected.forEach((t) => {
              const cur = amts[t];
              const oldDef = getDefaultAmount(data.student, t);
              if (cur === "" || cur === undefined || String(cur) === String(oldDef)) amts[t] = getDefaultAmount(sid, t);
            });
            onChange({ student: sid, typeAmounts: amts });
          }}
          required
          style={inputStyle}
        >
          <option value="">-- Choose Student --</option>
          {/* keep the current student selectable even if the students list hasn't loaded it */}
          {!studentKnown && data.student && studentFallback && (
            <option value={data.student}>{studentFallback}</option>
          )}
          {students.map((st) => {
            const name = st.user?.name || st.name || "Student";
            const roll = st.roll || st.studentId || "";
            const cls = st.cls ? ` (${st.cls}${st.section ? `-${st.section}` : ""})` : "";
            return (
              <option key={st._id} value={st._id}>
                {name} {roll ? `[${roll}]` : ""} {cls}
              </option>
            );
          })}
        </select>
      </div>

      {/* Checkboxes for Fee Types */}
      <div>
        <label style={{ ...labelStyle, marginBottom: 6 }}>
          Fee Types * (Select one or multiple)
        </label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(112px, 1fr))", gap: 8, background: "#f8fafc", padding: 12, borderRadius: 10, border: "1px solid " + C.border }}>
          {typeOptions.map((t) => {
            const checked = selected.includes(t);
            const tc = FEE_TYPE_COLORS[t] || FEE_TYPE_COLORS.Other;
            return (
              <label
                key={t}
                style={{
                  display: "flex", alignItems: "center", gap: 6, fontSize: 12.5,
                  fontWeight: 700, cursor: "pointer", padding: "5px 8px", borderRadius: 7,
                  background: checked ? tc.bg : "transparent",
                  color: checked ? tc.text : C.text,
                  border: checked ? `1px solid ${tc.border}` : "1px solid transparent",
                  transition: "all .15s",
                  minWidth: 0
                }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  style={{ accentColor: tc.text }}
                  onChange={() => {
                    const updated = checked ? selected.filter((x) => x !== t) : [...selected, t];
                    // Keep typeAmounts in sync — add entry when checked, remove when unchecked
                    const newAmounts = { ...(data.typeAmounts || {}) };
                    if (updated.includes(t)) {
                      if (!newAmounts[t]) newAmounts[t] = getDefaultAmount ? getDefaultAmount(data.student, t) : "";
                    } else {
                      delete newAmounts[t];
                    }
                    onChange({ selectedTypes: updated, typeAmounts: newAmounts });
                  }}
                />
                {t}
              </label>
            );
          })}
        </div>
      </div>

      {/* Month selector */}
      <div>
        <label style={labelStyle}>Month / Period *</label>
        <select value={data.month} onChange={(e) => onChange({ month: e.target.value })} style={inputStyle}>
          {monthOptions.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>

      {/* Per-type Amount Inputs — compact layout with total */}
      {selected.length > 0 && (
        <div>
          <label style={{ ...labelStyle, marginBottom: 8 }}>
            Fee Amount per Type (₹) *
          </label>
          <div style={{ display: "grid", gridTemplateColumns: selected.length > 2 ? "repeat(auto-fit, minmax(min(100%, 210px), 1fr))" : "1fr", gap: 8 }}>
            {selected.map((t) => {
              const tc = FEE_TYPE_COLORS[t] || FEE_TYPE_COLORS.Other;
              return (
                <div key={t} style={{ display: "flex", alignItems: "center", gap: 8, background: tc.bg, border: `1px solid ${tc.border}`, borderRadius: 8, padding: "6px 10px", minWidth: 0 }}>
                  <span style={{ minWidth: 70, fontSize: 11.5, fontWeight: 700, color: tc.text }}>{t}</span>
                  <input
                    type="number"
                    min="0"
                    placeholder="₹ Amount"
                    value={data.typeAmounts?.[t] || ""}
                    onChange={(e) => onChange({ typeAmounts: { ...(data.typeAmounts || {}), [t]: e.target.value } })}
                    style={{
                      flex: 1, padding: "5px 8px", borderRadius: 6, minWidth: 0,
                      border: `1px solid ${tc.border}`, fontSize: 13,
                      outline: "none", background: "#fff", color: C.text
                    }}
                  />
                </div>
              );
            })}
          </div>
          {/* Total Amount Summary */}
          {(selected.length > 1 || showBalance) && (
            <div style={{
              display: "flex", alignItems: "center", justifyContent: showBalance ? "space-between" : "flex-end", gap: 10, flexWrap: "wrap",
              marginTop: 8, padding: "8px 12px", background: "#f0fdf4", border: "1px solid #bbf7d0",
              borderRadius: 8
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: "#166534" }}>Total Amount:</span>
                <span style={{ fontSize: 15, fontWeight: 800, color: "#15803d" }}>₹{totalAmount.toLocaleString()}</span>
              </div>
              {showBalance && (
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: "#166534" }}>Balance Due:</span>
                  <span style={{ fontSize: 15, fontWeight: 800, color: balance > 0 ? "#dc2626" : "#15803d" }}>₹{balance.toLocaleString()}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <label style={labelStyle}>{paidLabel}</label>
          <input
            type="number"
            min="0"
            placeholder="0"
            value={data.paid}
            onChange={(e) => onChange({ paid: e.target.value })}
            style={inputStyle}
          />
        </div>
        <div style={{ minWidth: 0 }}>
          <label style={labelStyle}>Due Date</label>
          <input
            type="date"
            value={data.dueDate}
            onChange={(e) => onChange({ dueDate: e.target.value })}
            style={inputStyle}
          />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <label style={labelStyle}>Payment Method</label>
          <select value={data.paymentMethod} onChange={(e) => onChange({ paymentMethod: e.target.value })} style={inputStyle}>
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
        <div style={{ minWidth: 0 }}>
          <label style={labelStyle}>Transaction ID / Ref</label>
          <input
            type="text"
            placeholder="Optional TXN ID"
            value={data.transactionId}
            onChange={(e) => onChange({ transactionId: e.target.value })}
            style={inputStyle}
          />
        </div>
      </div>

      <div>
        <label style={labelStyle}>Notes / Remarks</label>
        <input
          type="text"
          placeholder="Optional notes..."
          value={data.notes}
          onChange={(e) => onChange({ notes: e.target.value })}
          style={inputStyle}
        />
      </div>
    </>
  );
}

/**
 * Form fields for assigning a fee to a whole class at once.
 * data: { cls, selectedTypes, typeAmounts, month, dueDate }
 */
export function AdminFees() {
  const canHover = useCanHover();
  const [fees, setFees] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [monthFilter, setMonthFilter] = useState("All");
  const [classFilter, setClassFilter] = useState("All");

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedFee, setSelectedFee] = useState(null);
  // Group edit modal (one row = one student+month group)
  const [showGroupEditModal, setShowGroupEditModal] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState([]); // array of fee records
  // Same shape as the Assign Fee form so both use <FeeFormFields/>
  const [groupFormData, setGroupFormData] = useState({
    student: "",
    selectedTypes: [],
    typeAmounts: {},
    month: "",
    paid: 0,            // total paid across all fee types
    dueDate: "",
    paymentMethod: "Cash",
    transactionId: "",
    notes: ""
  });
  // Snapshot of what is saved in the database for the group being edited:
  // entries = one per fee type { type, ids:[...], amount, paid, status, paidAt }
  const [groupOriginal, setGroupOriginal] = useState({ entries: [], totalPaid: 0 });
  const [historyStudentId, setHistoryStudentId] = useState(null); // all months of one student
  // Quick "Pay" popup (record a payment against one student + month)
  const [payGroup, setPayGroup] = useState(null); // full set of fee records for that student + month
  const [payForm, setPayForm] = useState({ amount: "", paymentMethod: "Cash", transactionId: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const currentMonthStr = `${MONTH_NAMES[new Date().getMonth()]} ${CURRENT_YEAR}`;

  // Form states
  const [formData, setFormData] = useState({
    student: "",
    selectedTypes: ["Tuition"],
    typeAmounts: { Tuition: "" },   // per-type amounts map
    type: "Tuition",
    month: currentMonthStr,
    amount: "",
    paid: 0,
    dueDate: "",
    status: "Pending",
    paymentMethod: "Cash",
    transactionId: "",
    notes: ""
  });

  // Class-wise assign
  const [assignMode, setAssignMode] = useState("student"); // "student" | "class"
  const [classForm, setClassForm] = useState({ cls: "", selectedTypes: ["Tuition"], typeAmounts: { Tuition: "" }, month: currentMonthStr, dueDate: "" });
  const [classEdits, setClassEdits] = useState({}); // type -> new amount

  const loadData = async () => {
    setLoading(true);
    try {
      const [feesRes, studentsRes] = await Promise.all([
        list("fees", "limit=1000"),
        list("students", "limit=1000")
      ]);
      setFees(feesRes?.data || feesRes || []);
      setStudents(studentsRes?.data || studentsRes || []);
    } catch (err) {
      console.error("Failed to fetch fee records:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const unsubFees = onResourceChange("fees", () => loadData());
    const unsubStudents = onResourceChange("students", () => loadData());
    return () => {
      unsubFees?.();
      unsubStudents?.();
    };
  }, []);

  const handleOpenCreate = () => {
    setError("");
    setFormData({
      student: students[0]?._id || "",
      selectedTypes: ["Tuition"],
      typeAmounts: { Tuition: lastAmountFor(students[0]?._id, "Tuition") },
      type: "Tuition",
      month: currentMonthStr,
      amount: "",
      paid: 0,
      dueDate: new Date().toISOString().split("T")[0],
      status: "Pending",
      paymentMethod: "Cash",
      transactionId: "",
      notes: ""
    });
    setAssignMode("student");
    setClassEdits({});
    setClassForm({ cls: "", selectedTypes: ["Tuition"], typeAmounts: { Tuition: "" }, month: currentMonthStr, dueDate: new Date().toISOString().split("T")[0] });
    setShowCreateModal(true);
  };

  const handleOpenEdit = (fee) => {
    setError("");
    setSelectedFee(fee);
    setFormData({
      student: fee.student?._id || fee.student || "",
      selectedTypes: [fee.type || "Tuition"],
      type: fee.type || "Tuition",
      month: fee.month || currentMonthStr,
      amount: fee.amount || "",
      paid: fee.paid || 0,
      dueDate: fee.dueDate ? new Date(fee.dueDate).toISOString().split("T")[0] : "",
      status: fee.status || "Pending",
      paymentMethod: fee.paymentMethod || "Cash",
      transactionId: fee.transactionId || "",
      notes: fee.notes || ""
    });
    setShowEditModal(true);
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!formData.student) {
      setError("Please select a student");
      return;
    }
    const typesToCreate = formData.selectedTypes && formData.selectedTypes.length > 0 ? formData.selectedTypes : [formData.type];
    if (typesToCreate.length === 0) {
      setError("Please select at least one fee type");
      return;
    }
    // Validate each type has an amount
    for (const feeType of typesToCreate) {
      const amt = Number(formData.typeAmounts?.[feeType] || 0);
      if (!amt || amt <= 0) {
        setError(`Please enter a valid amount for ${feeType}`);
        return;
      }
    }

    // Never assign the same fee type twice to a student for the same month
    const alreadyAssigned = typesToCreate.filter((t) =>
      fees.some((f) => studentIdOf(f) === formData.student && monthKey(f.month) === monthKey(formData.month) && normType(f.type) === normType(t))
    );
    if (alreadyAssigned.length > 0) {
      setError(`${alreadyAssigned.join(", ")} ${alreadyAssigned.length > 1 ? "are" : "is"} already assigned to ${getStudentDisplay({ student: formData.student }).name} for ${formData.month}. Use Edit on that month to change it.`);
      return;
    }

    setSubmitting(true);
    try {
      const totalPaidNum = Number(formData.paid) || 0;
      const totalAmountNum = typesToCreate.reduce((s, t) => s + (Number(formData.typeAmounts?.[t]) || 0), 0);

      // Distribute paid amount proportionally across fee types so the
      // "Total Fees Collected" stat stays accurate (no duplicate counting).
      let remainingPaid = totalPaidNum;
      for (let i = 0; i < typesToCreate.length; i++) {
        const feeType = typesToCreate[i];
        const amountNum = Number(formData.typeAmounts?.[feeType] || 0);

        let paidForType;
        if (i === typesToCreate.length - 1) {
          // Last type absorbs any rounding remainder
          paidForType = Math.min(remainingPaid, amountNum);
        } else {
          paidForType = totalAmountNum > 0
            ? Math.min(Math.round((amountNum / totalAmountNum) * totalPaidNum), amountNum)
            : 0;
          remainingPaid -= paidForType;
        }
        paidForType = Math.max(0, paidForType);

        let calculatedStatus = "Pending";
        if (paidForType >= amountNum) calculatedStatus = "Paid";
        else if (paidForType > 0) calculatedStatus = "Partial";

        const payload = {
          student: formData.student,
          type: feeType,
          month: formData.month,
          amount: amountNum,
          paid: paidForType,
          dueDate: formData.dueDate || undefined,
          status: calculatedStatus,
          paymentMethod: formData.paymentMethod,
          transactionId: formData.transactionId,
          notes: formData.notes,
          paidAt: paidForType > 0 ? new Date() : undefined
        };
        await create("fees", payload);
      }

      setShowCreateModal(false);
      loadData();
    } catch (err) {
      setError(err?.response?.data?.message || err.message || "Failed to create fee record");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFee?._id) return;
    setError("");
    setSubmitting(true);
    try {
      const paidNum = Number(formData.paid) || 0;
      const amountNum = Number(formData.amount) || 0;
      let calculatedStatus = formData.status;
      if (paidNum >= amountNum) calculatedStatus = "Paid";
      else if (paidNum > 0 && calculatedStatus !== "Overdue") calculatedStatus = "Partial";

      const payload = {
        type: formData.type,
        month: formData.month,
        amount: amountNum,
        paid: paidNum,
        dueDate: formData.dueDate || undefined,
        status: calculatedStatus,
        paymentMethod: formData.paymentMethod,
        transactionId: formData.transactionId,
        notes: formData.notes,
        paidAt: paidNum > 0 ? (selectedFee.paidAt || new Date()) : undefined
      };

      await update("fees", selectedFee._id, payload);
      setShowEditModal(false);
      loadData();
    } catch (err) {
      setError(err?.response?.data?.message || err.message || "Failed to update fee record");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this fee record?")) return;
    try {
      await remove("fees", id);
      loadData();
    } catch (err) {
      alert("Failed to delete fee record");
    }
  };

  // ── CLASS-WISE FEE: assign once for every student of a class ──
  const handleClassAssign = async (e) => {
    e.preventDefault();
    setError("");
    const { cls, selectedTypes: types, typeAmounts, month, dueDate } = classForm;
    if (!cls) return setError("Please select a class");
    if (types.length === 0) return setError("Please select at least one fee type");
    for (const t of types) {
      if (!(Number(typeAmounts[t]) > 0)) return setError(`Please enter a valid amount for ${t}`);
    }
    const classStudents = students.filter((s) => classLabelOf(s) === cls);
    if (classStudents.length === 0) return setError("No students found in this class");

    // Skip any student who already has that fee type for that month
    const jobs = [];
    classStudents.forEach((s) =>
      types.forEach((t) => {
        const exists = fees.some((f) => studentIdOf(f) === s._id && monthKey(f.month) === monthKey(month) && normType(f.type) === normType(t));
        if (!exists) jobs.push({ student: s._id, type: t, month, amount: Number(typeAmounts[t]), paid: 0, dueDate: dueDate || undefined, status: "Pending" });
      })
    );
    if (jobs.length === 0) return setError(`These fees are already assigned to every student of ${cls} for ${month}.`);

    setSubmitting(true);
    try {
      await Promise.all(jobs.map((j) => create("fees", j)));
      setShowCreateModal(false);
      loadData();
    } catch (err) {
      setError(err?.response?.data?.message || err.message || "Failed to assign class fee");
      loadData();
    } finally {
      setSubmitting(false);
    }
  };

  // Change the amount of one fee type for the whole class (each student's paid amount is kept)
  const handleClassFeeUpdate = async (g) => {
    const amount = Number(classEdits[g.type]);
    if (!(amount > 0)) return setError(`Please enter a valid amount for ${g.type}`);
    setError("");
    setSubmitting(true);
    try {
      await Promise.all(g.fees.map((f) => {
        const paid = Math.min(Number(f.paid) || 0, amount);
        const status = paid >= amount ? "Paid" : paid > 0 ? "Partial" : f.status === "Overdue" ? "Overdue" : "Pending";
        return update("fees", f._id, { amount, paid, status });
      }));
      setClassEdits((p) => { const n = { ...p }; delete n[g.type]; return n; });
      loadData();
    } catch (err) {
      setError(err?.response?.data?.message || err.message || "Failed to update class fee");
    } finally {
      setSubmitting(false);
    }
  };

  // Delete one fee type for the whole class
  const handleClassFeeDelete = async (g) => {
    if (!window.confirm(`Delete ${g.type} fee for all ${g.fees.length} students of ${classForm.cls} (${classForm.month})?`)) return;
    setSubmitting(true);
    try {
      await Promise.all(g.fees.map((f) => remove("fees", f._id)));
      loadData();
    } catch (err) {
      setError("Failed to delete class fee");
    } finally {
      setSubmitting(false);
    }
  };

  const studentIdOf = (fee) => (typeof fee.student === "object" && fee.student !== null ? fee.student?._id : fee.student);

  // ── SAVED AMOUNTS STAY UNTIL CHANGED ──
  // The amount last saved for a fee type is reused automatically the next time that fee
  // is assigned (newest month wins). Type a new amount to change it; the new one becomes the default.
  const lastSavedAmount = (rows) => {
    const valid = rows.filter((f) => Number(f.amount) > 0);
    if (valid.length === 0) return "";
    valid.sort((a, b) => monthSortValue(b.month, b.createdAt) - monthSortValue(a.month, a.createdAt));
    return valid[0].amount;
  };
  const lastAmountFor = (studentId, type) => {
    if (!studentId) return "";
    return lastSavedAmount(fees.filter((f) => studentIdOf(f) === studentId && normType(f.type) === normType(type)));
  };
  const lastClassAmountFor = (cls, type) => {
    if (!cls) return "";
    const clsOf = new Map(students.map((s) => [s._id, classLabelOf(s)]));
    return lastSavedAmount(fees.filter((f) => clsOf.get(studentIdOf(f)) === cls && normType(f.type) === normType(type)));
  };

  // The table may be filtered (e.g. by fee type), so always edit the COMPLETE set of
  // records for this student + month — otherwise hidden fee types would be duplicated.
  const getFullGroup = (group) => {
    const sid = studentIdOf(group[0]);
    const month = group[0]?.month || "";
    const full = fees.filter((f) => studentIdOf(f) === sid && (f.month || "") === month);
    return full.length ? full : group;
  };

  // One entry per fee type (duplicate records of the same type are merged into one line).
  const buildGroupEntries = (records) => {
    const byType = new Map();
    records.forEach((f) => {
      const type = f.type || "Tuition";
      const amount = Number(f.amount) || 0;
      const paid = Number(f.paid) || 0;
      const cur = byType.get(type);
      if (!cur) {
        byType.set(type, { type, ids: [f._id], amount, paid, status: f.status || "Pending", paidAt: f.paidAt });
      } else {
        cur.ids.push(f._id);
        cur.amount += amount;
        cur.paid += paid;
        if (f.status === "Overdue") cur.status = "Overdue";
        cur.paidAt = cur.paidAt || f.paidAt;
      }
    });
    return Array.from(byType.values());
  };

  // Open group edit modal for a student+month group
  const handleOpenGroupEdit = (group) => {
    setError("");
    const full = getFullGroup(group);
    setSelectedGroup(full);
    const entries = buildGroupEntries(full);
    const totalPaid = entries.reduce((sum, en) => sum + en.paid, 0);
    const dueDates = full.map((f) => f.dueDate).filter(Boolean).sort();
    const withMethod = full.find((f) => f.paymentMethod);
    const withTxn = full.find((f) => f.transactionId);
    const withNotes = full.find((f) => f.notes);
    setGroupOriginal({ entries, totalPaid });
    setGroupFormData({
      student: studentIdOf(full[0]) || "",
      selectedTypes: entries.map((en) => en.type),
      typeAmounts: Object.fromEntries(entries.map((en) => [en.type, en.amount])),
      month: full[0]?.month || currentMonthStr,
      paid: totalPaid,
      dueDate: dueDates.length > 0 ? new Date(dueDates[0]).toISOString().split("T")[0] : "",
      paymentMethod: withMethod?.paymentMethod || "Cash",
      transactionId: withTxn?.transactionId || "",
      notes: withNotes?.notes || ""
    });
    setShowGroupEditModal(true);
  };

  // Submit the edit form: update existing fee types, create newly-ticked ones, delete un-ticked ones
  const handleGroupEditSubmit = async (e) => {
    e.preventDefault();
    setError("");
    const g = groupFormData;
    if (!g.student) {
      setError("Please select a student");
      return;
    }
    const types = g.selectedTypes || [];
    if (types.length === 0) {
      setError("Please select at least one fee type");
      return;
    }
    for (const feeType of types) {
      const amt = Number(g.typeAmounts?.[feeType] || 0);
      if (!amt || amt <= 0) {
        setError(`Please enter a valid amount for ${feeType}`);
        return;
      }
    }
    const totalAmountNum = types.reduce((sum, t) => sum + (Number(g.typeAmounts[t]) || 0), 0);
    const targetPaid = Number(g.paid) || 0;
    if (targetPaid < 0) {
      setError("Paid amount cannot be negative");
      return;
    }
    const ownIds = new Set(selectedGroup.map((f) => f._id));
    const clashes = types.filter((t) =>
      fees.some((f) => !ownIds.has(f._id) && studentIdOf(f) === g.student && monthKey(f.month) === monthKey(g.month) && normType(f.type) === normType(t))
    );
    if (clashes.length > 0) {
      setError(`${clashes.join(", ")} ${clashes.length > 1 ? "already exist" : "already exists"} for ${getStudentDisplay({ student: g.student }).name} in ${g.month}. Edit that month's record instead.`);
      return;
    }
    if (targetPaid > totalAmountNum) {
      setError(`Paid amount (₹${targetPaid.toLocaleString()}) cannot be more than the total amount (₹${totalAmountNum.toLocaleString()})`);
      return;
    }

    // Start from what each fee type has already paid (capped to its new amount), then apply
    // only the DIFFERENCE to the total paid (see utils/feeAllocation.js).
    const originalByType = new Map(groupOriginal.entries.map((en) => [en.type, en]));
    const rows = allocatePayment(
      types.map((t) => {
        const orig = originalByType.get(t);
        const amount = Number(g.typeAmounts[t]);
        return { type: t, orig, amount, paid: Math.min(orig?.paid || 0, amount) };
      }),
      targetPaid
    );

    setSubmitting(true);
    try {
      for (const r of rows) {
        const status = feeStatus(r, r.orig?.status);
        const increased = r.paid > (r.orig?.paid || 0);
        const payload = {
          student: g.student,
          type: r.type,
          month: g.month,
          amount: r.amount,
          paid: r.paid,
          dueDate: g.dueDate || undefined,
          status,
          paymentMethod: g.paymentMethod,
          transactionId: g.transactionId,
          notes: g.notes,
          paidAt: r.paid > 0 ? (increased || !r.orig?.paidAt ? new Date() : r.orig.paidAt) : undefined
        };
        if (r.orig) await update("fees", r.orig.ids[0], payload);
        else await create("fees", payload);
      }

      // Remove fee types that were un-ticked, plus any duplicate records that were merged
      const keep = new Set(types);
      for (const en of groupOriginal.entries) {
        const idsToDelete = keep.has(en.type) ? en.ids.slice(1) : en.ids;
        for (const id of idsToDelete) await remove("fees", id);
      }

      setShowGroupEditModal(false);
      loadData();
    } catch (err) {
      setError(err?.response?.data?.message || err.message || "Failed to update fee records");
      loadData(); // some records may already have been saved — refresh the list
    } finally {
      setSubmitting(false);
    }
  };

  // Download the standard PDF receipt for a list of fee records (one student + month)
  const handleDownloadReceipt = (records) => {
    if (!records || records.length === 0) return;
    const first = records[0];
    const info = getStudentDisplay(first);
    const studentDoc = typeof first.student === "object" && first.student !== null
      ? first.student
      : students.find((st) => st._id === first.student);
    downloadFeeReceipt({
      student: { name: info.name, roll: info.roll, cls: info.cls, fatherName: studentDoc?.fatherName || studentDoc?.guardianName || "" },
      month: first.month || currentMonthStr,
      items: records.map((f) => ({
        _id: f._id,
        type: f.type,
        amount: f.amount,
        paid: f.paid,
        status: f.status,
        dueDate: f.dueDate,
        paymentMethod: f.paymentMethod,
        transactionId: f.transactionId,
        paidAt: f.paidAt,
        notes: f.notes
      }))
    });
  };

  // Delete all fee records in a group (student + month)
  const handleDeleteGroup = async (group) => {
    const count = group.length;
    if (!window.confirm(`Delete all ${count} fee record(s) for ${group[0]?.month || "this month"}?`)) return;
    try {
      for (const fee of group) {
        await remove("fees", fee._id);
      }
      loadData();
    } catch (err) {
      alert("Failed to delete fee records");
    }
  };

  // ── PAY: quickly record a payment for one student + month ──
  // The amount is applied to the fee types in order, each up to its own balance.
  const canPay = (records) => records.some((f) => (Number(f.amount) || 0) > (Number(f.paid) || 0));

  const handleOpenPay = (group) => {
    const full = getFullGroup(group);
    const entries = buildGroupEntries(full);
    const balance = entries.reduce((sum, en) => sum + Math.max(0, en.amount - en.paid), 0);
    if (balance <= 0) { alert("This month is already fully paid."); return; }
    const withMethod = full.find((f) => f.paymentMethod);
    setError("");
    setPayGroup(full);
    setPayForm({ amount: String(balance), paymentMethod: withMethod?.paymentMethod || "Cash", transactionId: "" });
  };

  const handlePaySubmit = async (e) => {
    e.preventDefault();
    if (!payGroup) return;
    setError("");
    const entries = buildGroupEntries(payGroup);
    const balance = entries.reduce((sum, en) => sum + Math.max(0, en.amount - en.paid), 0);
    const payAmt = Number(payForm.amount) || 0;
    if (payAmt <= 0) { setError("Enter an amount greater than 0"); return; }
    if (payAmt > balance) { setError(`Amount cannot be more than the balance due (₹${balance.toLocaleString()})`); return; }

    setSubmitting(true);
    try {
      let remaining = payAmt;
      for (const en of entries) {
        const due = Math.max(0, en.amount - en.paid);
        const add = Math.min(due, remaining);
        if (add <= 0) continue;
        remaining -= add;
        const newPaid = en.paid + add;
        const status = newPaid >= en.amount ? "Paid" : "Partial";
        await update("fees", en.ids[0], {
          amount: en.amount,
          paid: newPaid,
          status,
          paymentMethod: payForm.paymentMethod,
          transactionId: payForm.transactionId,
          paidAt: new Date()
        });
        // duplicate records of the same fee type were merged into the first one above
        for (const id of en.ids.slice(1)) await remove("fees", id);
      }
      setPayGroup(null);
      loadData();
    } catch (err) {
      setError(err?.response?.data?.message || err.message || "Failed to record payment");
      loadData();
    } finally {
      setSubmitting(false);
    }
  };

  // ── CLASS-WISE PDF: every student, classes ascending, roll number ascending ──
  // Uses the same PDF engine as the fee receipt (utils/documents.js) → direct download.
  // Respects the Month dropdown; with Month = All it uses each student's latest month.
  // scope "all" → every class · scope "class" → only the class chip currently selected
  const handleDownloadClassPdf = (scope = "all") => {
    const onlyClass = scope === "class" ? classFilter : "All";
    const natural = (x, y) => String(x).localeCompare(String(y), undefined, { numeric: true });

    // student -> month -> fee records
    const byStudent = new Map();
    fees.forEach((f) => {
      const sid = studentIdOf(f);
      if (!byStudent.has(sid)) byStudent.set(sid, new Map());
      const months = byStudent.get(sid);
      const k = f.month || "";
      if (!months.has(k)) months.set(k, []);
      months.get(k).push(f);
    });
    const recordsFor = (sid) => {
      const months = byStudent.get(sid);
      if (!months) return [];
      if (monthFilter !== "All") return months.get(monthFilter) || [];
      const groups = [...months.values()].sort((a, b) => monthSortValue(b[0].month, b[0].createdAt) - monthSortValue(a[0].month, a[0].createdAt));
      return groups[0] || [];
    };

    // class -> students
    const byClass = new Map();
    students.forEach((st) => {
      const cls = classLabelOf(st) || "No Class";
      if (onlyClass !== "All" && cls !== onlyClass) return;
      if (!byClass.has(cls)) byClass.set(cls, []);
      byClass.get(cls).push(st);
    });
    if (byClass.size === 0) { alert("No students found to download."); return; }

    const classes = [...byClass.keys()].sort(natural).map((cls) => ({
      name: /^class/i.test(cls) ? cls : `Class ${cls}`,
      students: byClass.get(cls)
        .sort((a, b) => natural(a.roll || a.studentId || "", b.roll || b.studentId || ""))
        .map((st) => {
          const recs = recordsFor(st._id);
          return {
            name: st.user?.name || st.name || "Student",
            roll: st.roll || st.studentId || "",
            types: recs.length ? [...new Set(recs.map((f) => f.type || "Tuition"))].join(", ") : "-",
            total: recs.reduce((sum, f) => sum + (Number(f.amount) || 0), 0),
            paid: recs.reduce((sum, f) => sum + (Number(f.paid) || 0), 0),
            status: recs.length ? worstStatusOf(recs) : "No Fee"
          };
        })
    }));

    try {
      downloadClassFeeReport({
        periodLabel: monthFilter === "All" ? "" : monthFilter,
        classes
      });
    } catch (err) {
      console.error(err);
      alert("Could not create the PDF: " + (err?.message || err));
    }
  };

  // Helper for student display name
  const getStudentDisplay = (fee) => {
    if (typeof fee.student === "object" && fee.student !== null) {
      const userName = fee.student.user?.name || fee.student.name;
      const roll = fee.student.roll || fee.student.studentId || "";
      const cls = fee.student.cls ? `${fee.student.cls}${fee.student.section ? `-${fee.student.section}` : ""}` : "";
      if (userName) return { name: userName, roll, cls };
    }
    const found = students.find((s) => s._id === fee.student);
    if (found) {
      return {
        name: found.user?.name || found.name || "Student",
        roll: found.roll || found.studentId || "",
        cls: found.cls ? `${found.cls}${found.section ? `-${found.section}` : ""}` : ""
      };
    }
    return { name: "Unknown Student", roll: "", cls: "" };
  };

  // Metrics calculations
  const totalAmount = fees.reduce((sum, f) => sum + (Number(f.amount) || 0), 0);
  const totalPaid = fees.reduce((sum, f) => sum + (Number(f.paid) || 0), 0);
  const totalPending = Math.max(0, totalAmount - totalPaid);
  const now = new Date();
  // Auto-detect overdue: past due date AND not fully paid, OR explicitly marked Overdue
  const overdueCount = fees.filter((f) => {
    if (f.status === "Overdue") return true;
    if (f.status === "Paid") return false;
    if (f.dueDate && new Date(f.dueDate) < now && (Number(f.paid) || 0) < (Number(f.amount) || 0)) return true;
    return false;
  }).length;

  // How many different months each student has fees for
  const monthsByStudent = new Map();
  fees.forEach((f) => {
    const sid = studentIdOf(f);
    if (!monthsByStudent.has(sid)) monthsByStudent.set(sid, new Set());
    monthsByStudent.get(sid).add(f.month || "");
  });

  // Class-wise fee data: class list + what is already saved for the chosen class & month
  const classOptions = [...new Set(students.map(classLabelOf).filter(Boolean))].sort();
  const studentClassMap = new Map(students.map((s) => [s._id, classLabelOf(s)]));
  const classFeeGroups = (() => {
    if (!classForm.cls) return [];
    const byType = new Map();
    fees.forEach((f) => {
      if (studentClassMap.get(studentIdOf(f)) !== classForm.cls || monthKey(f.month) !== monthKey(classForm.month)) return;
      const t = f.type || "Tuition";
      if (!byType.has(t)) byType.set(t, { type: t, amount: Number(f.amount) || 0, fees: [] });
      byType.get(t).fees.push(f);
    });
    return [...byType.values()];
  })();

  // Every month for the student whose history is open (newest first)
  const historyGroups = (() => {
    if (!historyStudentId) return [];
    const byMonth = new Map();
    fees.filter((f) => studentIdOf(f) === historyStudentId).forEach((f) => {
      const k = f.month || "";
      if (!byMonth.has(k)) byMonth.set(k, []);
      byMonth.get(k).push(f);
    });
    return [...byMonth.values()].sort((a, b) => monthSortValue(b[0].month, b[0].createdAt) - monthSortValue(a[0].month, a[0].createdAt));
  })();

  // Multi-select filtered list
  const filteredFees = fees.filter((f) => {
    const sInfo = getStudentDisplay(f);
    const q = search.toLowerCase().trim();
    const matchesSearch =
      !q ||
      sInfo.name.toLowerCase().includes(q) ||
      sInfo.roll.toLowerCase().includes(q) ||
      (f.type && f.type.toLowerCase().includes(q)) ||
      (f.month && f.month.toLowerCase().includes(q)) ||
      (f.status && f.status.toLowerCase().includes(q));

    const matchesStatus = (() => {
      if (statusFilter === "All") return true;
      if (f.status === statusFilter) return true;
      // When filtering "Overdue", also include past-due-date fees that aren't Paid
      if (statusFilter === "Overdue" && f.status !== "Paid" && f.dueDate && new Date(f.dueDate) < now && (Number(f.paid) || 0) < (Number(f.amount) || 0)) return true;
      return false;
    })();
    const matchesType = selectedTypes.length === 0 || selectedTypes.includes(f.type);
    const matchesMonth = monthFilter === "All" || f.month === monthFilter;
    const matchesClass = classFilter === "All" || studentClassMap.get(studentIdOf(f)) === classFilter;

    return matchesSearch && matchesStatus && matchesType && matchesMonth && matchesClass;
  });

  const getStatusBadge = (status) => {
    switch (status) {
      case "Paid":
        return { bg: "#d1fae5", color: "#10b981", icon: CheckCircle2 };
      case "Partial":
        return { bg: "#e0f2fe", color: "#0284c7", icon: Clock };
      case "Overdue":
        return { bg: "#fee2e2", color: "#ef4444", icon: AlertTriangle };
      default:
        return { bg: "#fef3c7", color: "#d97706", icon: Clock };
    }
  };

  // Stat Card data with vibrant gradients matching project styling
  const statCardsData = [
    {
      label: "Total Revenue Target",
      value: `₹${totalAmount.toLocaleString()}`,
      subtext: "Across all fee entries",
      icon: DollarSign,
      gradient: "linear-gradient(135deg, rgb(109, 78, 246), rgb(79, 55, 190))",
      shadow: "0 8px 24px rgba(109, 78, 246, 0.28)",
      onClick: () => setStatusFilter("All")
    },
    {
      label: "Total Fees Collected",
      value: `₹${totalPaid.toLocaleString()}`,
      subtext: totalAmount > 0 ? `${Math.round((totalPaid / totalAmount) * 100)}% collection rate` : "No entries",
      icon: CheckCircle2,
      gradient: "linear-gradient(135deg, rgb(20, 184, 166), rgb(13, 148, 136))",
      shadow: "0 8px 24px rgba(20, 184, 166, 0.28)",
      onClick: () => setStatusFilter("Paid")
    },
    {
      label: "Pending Outstanding",
      value: `₹${totalPending.toLocaleString()}`,
      subtext: "Pending collection",
      icon: Clock,
      gradient: "linear-gradient(135deg, rgb(245, 158, 11), rgb(217, 119, 6))",
      shadow: "0 8px 24px rgba(245, 158, 11, 0.28)",
      onClick: () => setStatusFilter("Pending")
    },
    {
      label: "Overdue Invoices",
      value: String(overdueCount),
      subtext: "Passed payment due date",
      icon: AlertTriangle,
      gradient: "linear-gradient(135deg, rgb(239, 68, 68), rgb(220, 38, 38))",
      shadow: "0 8px 24px rgba(239, 68, 68, 0.28)",
      onClick: () => setStatusFilter("Overdue")
    }
  ];

  // Hover animations only for real mouse pointers (never on touch → no "growing" cards while scrolling)
  const cardHover = canHover ? { whileHover: { y: -5, scale: 1.01 } } : {};
  const iconBtnHover = canHover ? { whileHover: { scale: 1.1 } } : {};
  const assignBtnHover = canHover ? { whileHover: { scale: 1.03 } } : {};

  return (
    <div className="fee-page" style={{ padding: 28, display: "flex", flexDirection: "column", gap: 24 }}>
      <style>{`
.fee-page { min-width: 0; max-width: 100%; box-sizing: border-box; overflow-x: clip; }
.fee-stats > * { min-width: 0; }
.fee-stat { -webkit-tap-highlight-color: transparent; touch-action: manipulation; user-select: none; -webkit-user-select: none; }
.fee-stat * { min-width: 0; overflow-wrap: anywhere; }

/* Touch devices: never scale / lift cards (stuck :hover made them "blow up" while scrolling) */
@media (hover: none), (pointer: coarse) {
  .fee-stat, .fee-stat:hover, .fee-stat:active { transform: none !important; scale: none !important; }
}

/* History table: keep wide min-width only on desktop; on mobile it stacks into cards */
@media (min-width: 769px) {
  .fee-history-table { min-width: 780px; }
}

@media (max-width: 768px) {
  .fee-head { padding: 14px 12px !important; gap: 12px !important; }
  .fee-head > div:first-child { width: 100%; min-width: 0; }
  .fee-note { padding: 10px 12px !important; }
  .fee-chips { padding: 10px 12px 0 !important; }
}

@media (max-width: 640px) {
  .fee-page { padding: 12px !important; gap: 12px !important; }
  .fee-stats { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; gap: 10px !important; }
  .fee-stat { padding: 12px !important; border-radius: 14px !important; }
  .fee-stat-label { font-size: 11px !important; line-height: 1.2; }
  .fee-stat-icon { width: 28px !important; height: 28px !important; border-radius: 8px !important; flex: 0 0 auto; }
  .fee-stat-icon svg { width: 15px; height: 15px; }
  .fee-stat-value { font-size: 18px !important; margin-top: 6px !important; }
  .fee-stat-sub { font-size: 10px !important; }

  /* Filters: search on its own row, then 2 per row */
  .fee-controls { display: grid !important; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px !important; width: 100%; position: relative; }
  .fee-search { grid-column: 1 / -1; min-width: 0 !important; width: 100%; }
  .fee-select { width: 100% !important; min-width: 0 !important; box-sizing: border-box; }
  .fee-type-wrap { position: static !important; min-width: 0; }
  .fee-type-btn { width: 100%; justify-content: space-between; box-sizing: border-box; }
  .fee-type-menu { left: 0 !important; right: 0 !important; width: auto !important; top: 100% !important; }
  .fee-assign-row { grid-column: 1 / -1; width: 100%; }
  .fee-assign { flex: 1; justify-content: center; box-sizing: border-box; }

  /* Fee record cards */
  .fee-cards td { padding-top: 5px !important; padding-bottom: 5px !important; font-size: 12px !important; }
  .fee-cards td.rtable-actions { display: block !important; padding: 10px 12px !important; }
  .fee-cards td.rtable-actions > div { display: grid !important; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px !important; width: 100%; }
  .fee-cards td.rtable-actions button.fee-pay-btn { grid-column: 1 / -1; gap: 6px !important; font-size: 13px; }
  .fee-cards td.rtable-actions button { width: 100% !important; min-width: 0 !important; height: 38px; margin: 0 !important; padding: 0 !important; justify-content: center !important; align-items: center !important; }
}

@media (max-width: 340px) {
  .fee-stats { grid-template-columns: 1fr !important; }
}
`}</style>

      {/* ── TOP STATS ROW ── */}
      <div className="fee-stats" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 16 }}>
        {statCardsData.map((s) => {
          const IconComponent = s.icon;
          return (
            <motion.div
              key={s.label}
              className="fee-stat"
              {...cardHover}
              transition={{ duration: 0.2 }}
              onClick={s.onClick}
              style={{
                background: s.gradient,
                borderRadius: 18,
                padding: "22px 24px",
                color: "#fff",
                boxShadow: s.shadow,
                position: "relative",
                overflow: "hidden",
                cursor: "pointer",
                minWidth: 0,
                boxSizing: "border-box"
              }}
            >
              {/* Decorative Circle */}
              <div
                style={{
                  position: "absolute",
                  right: -20,
                  top: -20,
                  width: 90,
                  height: 90,
                  borderRadius: "50%",
                  background: "rgba(255, 255, 255, 0.12)",
                  pointerEvents: "none"
                }}
              />

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, position: "relative", zIndex: 1 }}>
                <span className="fee-stat-label" style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.88)" }}>{s.label}</span>
                <div className="fee-stat-icon" style={{ width: 42, height: 42, borderRadius: 12, background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}>
                  <IconComponent size={22} color="#fff" />
                </div>
              </div>

              <div className="fee-stat-value" style={{ fontSize: 26, fontWeight: 800, color: "#fff", marginTop: 10, letterSpacing: "-0.5px", position: "relative", zIndex: 1 }}>
                {s.value}
              </div>
              <div className="fee-stat-sub" style={{ fontSize: 11.5, color: "rgba(255,255,255,0.85)", marginTop: 4, position: "relative", zIndex: 1 }}>
                {s.subtext}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* ── MAIN TABLE CONTAINER ── */}
      <div style={{ background: C.white, borderRadius: 16, border: "1px solid #edf0f6", boxShadow: "0 4px 16px rgba(15,23,42,0.06)", overflow: "hidden", minWidth: 0 }}>
        {/* Table Header & Controls */}
        <div className="fee-head" style={{ padding: "20px 24px", borderBottom: "1px solid " + C.border, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 14 }}>
          <div>
            <h3 style={{ margin: 0, fontWeight: 800, fontSize: 16, color: C.text }}>Fee Records</h3>
            <p style={{ margin: "3px 0 0", fontSize: 12, color: C.muted }}>Manage student fee structures, select payment months, record payments & track dues</p>
          </div>

          <div className="fee-controls" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            {/* Search */}
            <div className="fee-search" style={{ position: "relative", minWidth: 200 }}>
              <Search size={15} color={C.muted} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
              <input
                type="text"
                placeholder="Search student, month..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: "100%", padding: "8px 12px 8px 34px", borderRadius: 8,
                  border: "1px solid " + C.border, fontSize: 13, outline: "none", boxSizing: "border-box"
                }}
              />
            </div>

            {/* Month Filter */}
            <select
              className="fee-select"
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid " + C.border, fontSize: 13, background: "#fff", color: C.text, outline: "none" }}
            >
              <option value="All">Month: All</option>
              {MONTHS_LIST.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>

            {/* Class Filter — shows that class's students as a numbered list */}
            <select
              className="fee-select"
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid " + C.border, fontSize: 13, background: "#fff", color: C.text, outline: "none" }}
            >
              <option value="All">Class: All</option>
              {classOptions.map((c) => (
                <option key={c} value={c}>{/^class/i.test(c) ? c : `Class ${c}`}</option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              className="fee-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid " + C.border, fontSize: 13, background: "#fff", color: C.text, outline: "none" }}
            >
              {STATUS_OPTIONS.map((st) => (
                <option key={st} value={st}>Status: {st}</option>
              ))}
            </select>

            {/* Multi-Select Type Filter with Checkboxes */}
            <SharedFeeTypeFilterDropdown
              selectedTypes={selectedTypes}
              setSelectedTypes={setSelectedTypes}
            />

            {/* Assign Fee + class-wise PDF */}
            <div className="fee-assign-row" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <motion.button
              className="fee-assign"
              {...assignBtnHover}
              whileTap={{ scale: 0.97 }}
              onClick={handleOpenCreate}
              style={{
                display: "flex", alignItems: "center", gap: 6, background: "linear-gradient(135deg, rgb(109, 78, 246), rgb(79, 55, 190))", color: "#fff",
                border: "none", borderRadius: 8, padding: "8px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer", boxShadow: "0 4px 12px rgba(109,78,246,0.3)"
              }}
            >
              <Plus size={16} />
              Assign Fee
            </motion.button>
            <motion.button
              {...iconBtnHover}
              whileTap={{ scale: 0.92 }}
              type="button"
              title="Download ALL students — class-wise PDF (clickable contents)"
              aria-label="Download all students class-wise PDF"
              onClick={() => handleDownloadClassPdf("all")}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5, background: "#ecfdf5", color: "#059669", border: "none", borderRadius: 8, padding: "8px 11px", cursor: "pointer", flex: "0 0 auto", fontSize: 12.5, fontWeight: 800 }}
            >
              <Download size={17} />
              All
            </motion.button>
            </div>
          </div>
        </div>

        {/* Clickable class chips — tap a class to see its students (numbered) */}
        {classOptions.length > 0 && (
          <div className="fee-chips" style={{ display: "flex", gap: 8, overflowX: "auto", padding: "12px 24px 0", WebkitOverflowScrolling: "touch" }}>
            {["All", ...classOptions].map((c) => {
              const active = classFilter === c;
              const count = c === "All" ? students.length : students.filter((st) => classLabelOf(st) === c).length;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setClassFilter(c)}
                  style={{
                    flex: "0 0 auto", display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "6px 12px", borderRadius: 20, fontSize: 12.5, fontWeight: 700, cursor: "pointer",
                    border: active ? "1px solid transparent" : "1px solid " + C.border,
                    background: active ? "linear-gradient(135deg, rgb(109, 78, 246), rgb(79, 55, 190))" : "#fff",
                    color: active ? "#fff" : C.text,
                    boxShadow: active ? "0 4px 10px rgba(109,78,246,0.25)" : "none"
                  }}
                >
                  {c === "All" ? "All classes" : (/^class/i.test(c) ? c : `Class ${c}`)}
                  <span style={{ minWidth: 20, padding: "1px 6px", borderRadius: 10, fontSize: 11, fontWeight: 800, textAlign: "center", background: active ? "rgba(255,255,255,0.25)" : "#eef2ff", color: active ? "#fff" : C.accent }}>
                    {count}
                  </span>
                </button>
              );
            })}
            {classFilter !== "All" && (
              <button
                type="button"
                title={`Download ${classFilter} students PDF`}
                aria-label={`Download ${classFilter} students PDF`}
                onClick={() => handleDownloadClassPdf("class")}
                style={{ flex: "0 0 auto", display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 20, fontSize: 12.5, fontWeight: 800, cursor: "pointer", border: "none", background: "#ecfdf5", color: "#059669" }}
              >
                <Download size={15} />
                {/^class/i.test(classFilter) ? classFilter : `Class ${classFilter}`}
              </button>
            )}
          </div>
        )}

        <div className="fee-note" style={{ fontSize: 12, color: C.muted, padding: "10px 24px" }}>
          {monthFilter === "All"
            ? "Showing each student's latest month · double-click a row to see all months"
            : `Showing ${monthFilter} · double-click a row to see all months`}
        </div>

        {/* Table View */}
        <div style={{ overflowX: "auto" }}>
          <table className="rtable fee-cards" style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "1px solid " + C.border }}>
                {["STUDENT NAME", "ROLL / CLASS", "MONTH / PERIOD", "FEE TYPE", "TOTAL AMOUNT", "PAID AMOUNT", "DUE DATE", "STATUS", "ACTIONS"].map((h) => (
                  <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: 0.5 }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} style={{ padding: 40, textAlign: "center", color: C.muted, fontSize: 13 }}>
                    Loading fee records...
                  </td>
                </tr>
              ) : filteredFees.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ padding: 40, textAlign: "center", color: C.muted, fontSize: 13 }}>
                    No fee records found.
                  </td>
                </tr>
              ) : (() => {
                // Group records by (studentId + month) so one month = one row
                const groupMap = new Map();
                filteredFees.forEach((fee) => {
                  const studentId = typeof fee.student === "object" ? fee.student?._id : fee.student;
                  const key = `${studentId}__${fee.month || ""}`;
                  if (!groupMap.has(key)) groupMap.set(key, []);
                  groupMap.get(key).push(fee);
                });

                // "All months" → one row per student (their latest month). Pick a month to see that month for everyone.
                const allEntries = Array.from(groupMap.entries());
                const baseEntries = monthFilter === "All"
                  ? [...latestByKey(allEntries, ([, g]) => studentIdOf(g[0]), ([, g]) => monthSortValue(g[0].month, g[0].createdAt)).values()]
                  : allEntries;
                // Class selected → list its students in roll-number order (numbered 1, 2, 3 …)
                const shownEntries = classFilter === "All"
                  ? baseEntries
                  : [...baseEntries].sort((a, b) =>
                      String(getStudentDisplay(a[1][0]).roll).localeCompare(String(getStudentDisplay(b[1][0]).roll), undefined, { numeric: true }));

                return shownEntries.map(([key, group], groupIdx) => {
                  const sInfo = getStudentDisplay(group[0]);
                  const groupTotalAmount = group.reduce((s, f) => s + (Number(f.amount) || 0), 0);
                  const groupPaidAmount = group.reduce((s, f) => s + (Number(f.paid) || 0), 0);
                  // Worst status wins for the group badge
                  const worstStatus = group.reduce((worst, f) => {
                    const r = STATUS_RANK[f.status] ?? 1;
                    return r < (STATUS_RANK[worst] ?? 1) ? f.status : worst;
                  }, group[0].status);
                  const badge = getStatusBadge(worstStatus);
                  const BadgeIcon = badge.icon;
                  // Earliest due date in the group
                  const dueDates = group.map((f) => f.dueDate).filter(Boolean).sort();
                  const dueStr = dueDates.length > 0 ? new Date(dueDates[0]).toLocaleDateString() : "—";

                  return (
                    <tr
                      key={key}
                      onDoubleClick={() => setHistoryStudentId(studentIdOf(group[0]))}
                      title="Double-click to see all months"
                      style={{ background: ROW_COLORS[groupIdx % ROW_COLORS.length], borderBottom: "1px solid " + C.border, cursor: "pointer" }}
                    >
                      {/* Student Name */}
                      <td className="rtable-full" style={{ padding: "14px 16px" }}>
                        <div style={{ fontWeight: 700, fontSize: 13.5, color: C.text, display: "flex", alignItems: "center", gap: 8 }}>
                          {classFilter !== "All" && (
                            <span style={{ minWidth: 24, height: 24, padding: "0 6px", borderRadius: 12, background: "#eef2ff", color: C.accent, fontSize: 12, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}>
                              {groupIdx + 1}
                            </span>
                          )}
                          {sInfo.name}
                        </div>
                      </td>
                      {/* Roll / Class */}
                      <td data-label="Roll / Class" style={{ padding: "14px 16px" }}>
                        <div style={{ fontSize: 12.5, color: C.text }}>{sInfo.roll || "N/A"}</div>
                        {sInfo.cls && (
                          <div style={{ fontSize: 11, color: C.muted }}>
                            {/^class/i.test(sInfo.cls) ? sInfo.cls : `Class: ${sInfo.cls}`}
                          </div>
                        )}
                      </td>
                      {/* Month */}
                      <td data-label="Month" style={{ padding: "14px 16px" }}>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: C.accent, display: "flex", alignItems: "center", gap: 5 }}>
                          <Calendar size={13} />
                          {group[0].month || "Current"}
                        </div>
                      </td>
                      {/* Fee Types — all badges on one row */}
                      <td data-label="Fee Type" style={{ padding: "14px 16px" }}>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                          {group.map((fee) => {
                            const tc = FEE_TYPE_COLORS[fee.type] || FEE_TYPE_COLORS.Other;
                            return (
                              <span key={fee._id} style={{
                                display: "inline-block", padding: "3px 10px",
                                borderRadius: 20, fontSize: 11.5, fontWeight: 700,
                                background: tc.bg, color: tc.text, border: `1px solid ${tc.border}`
                              }}>
                                {fee.type || "Tuition"}
                              </span>
                            );
                          })}
                        </div>
                      </td>
                      {/* Total Amount (sum) */}
                      <td data-label="Total" style={{ padding: "14px 16px", fontSize: 13.5, fontWeight: 700, color: C.text }}>
                        ₹{groupTotalAmount.toLocaleString()}
                      </td>
                      {/* Paid Amount (sum) */}
                      <td data-label="Paid" style={{ padding: "14px 16px", fontSize: 13, fontWeight: 600, color: groupPaidAmount >= groupTotalAmount && groupTotalAmount > 0 ? "#10b981" : C.text }}>
                        ₹{groupPaidAmount.toLocaleString()}
                      </td>
                      {/* Due Date */}
                      <td data-label="Due Date" style={{ padding: "14px 16px", fontSize: 12.5, color: C.text }}>
                        {dueStr}
                      </td>
                      {/* Status badge (worst status in group) */}
                      <td data-label="Status" style={{ padding: "14px 16px" }}>
                        <span style={{
                          background: badge.bg, color: badge.color, borderRadius: 20,
                          padding: "4px 10px", fontSize: 11, fontWeight: 700, display: "inline-flex",
                          alignItems: "center", gap: 5
                        }}>
                          <BadgeIcon size={12} />
                          {worstStatus || "Pending"}
                        </span>
                      </td>
                      {/* Actions — Edit, Download receipt and Delete for the whole month group */}
                      <td className="rtable-actions" style={{ padding: "14px 16px" }} onDoubleClick={(e) => e.stopPropagation()}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <motion.button
                            className="fee-pay-btn"
                            {...iconBtnHover}
                            whileTap={{ scale: 0.94 }}
                            title={canPay(group) ? "Pay / Record Payment" : "Fully paid"}
                            disabled={!canPay(group)}
                            onClick={() => handleOpenPay(group)}
                            style={{
                              background: canPay(group) ? "linear-gradient(135deg, #10b981, #059669)" : "#e5e7eb",
                              color: canPay(group) ? "#fff" : "#9ca3af", border: "none", borderRadius: 6, padding: "7px 12px",
                              cursor: canPay(group) ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                              fontSize: 12.5, fontWeight: 800
                            }}
                          >
                            {canPay(group) ? <DollarSign size={14} /> : <CheckCircle2 size={14} />}
                            {canPay(group) ? "Pay" : "Paid"}
                          </motion.button>
                          <motion.button
                            {...iconBtnHover}
                            whileTap={{ scale: 0.9 }}
                            title="Edit / Record Payment"
                            onClick={() => handleOpenGroupEdit(group)}
                            style={{
                              background: "#eef2ff", color: C.accent, border: "none",
                              borderRadius: 6, padding: "7px 9px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4
                            }}
                          >
                            <Edit size={15} />
                          </motion.button>
                          <motion.button
                            {...iconBtnHover}
                            whileTap={{ scale: 0.9 }}
                            title="Download Receipt (PDF)"
                            onClick={() => handleDownloadReceipt(getFullGroup(group))}
                            style={{
                              background: "#ecfdf5", color: "#059669", border: "none",
                              borderRadius: 6, padding: "7px 9px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center"
                            }}
                          >
                            <Download size={15} />
                          </motion.button>
                          <motion.button
                            {...iconBtnHover}
                            whileTap={{ scale: 0.9 }}
                            title="Delete Fee Record"
                            onClick={() => handleDeleteGroup(group)}
                            style={{
                              background: "#fee2e2", color: "#ef4444", border: "none",
                              borderRadius: 6, padding: "7px 9px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center"
                            }}
                          >
                            <Trash2 size={15} />
                          </motion.button>
                        </div>
                      </td>
                    </tr>
                  );
                });
              })()}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── ASSIGN FEE MODAL — single student or whole class ── */}
      {showCreateModal && (
        <Modal title="Assign Fee" onClose={() => setShowCreateModal(false)}>
          <div style={{ display: "flex", gap: 6, background: "#f1f5f9", padding: 4, borderRadius: 10, marginBottom: 14 }}>
            {[["student", "Single Student"], ["class", "Whole Class"]].map(([k, l]) => (
              <button key={k} type="button" onClick={() => { setAssignMode(k); setError(""); }}
                style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer", background: assignMode === k ? "#fff" : "transparent", color: assignMode === k ? C.accent : C.muted, boxShadow: assignMode === k ? "0 1px 4px rgba(0,0,0,0.1)" : "none" }}>
                {l}
              </button>
            ))}
          </div>

          {error && (
            <div style={{ background: "#fee2e2", color: "#ef4444", padding: "10px 14px", borderRadius: 8, fontSize: 12.5, marginBottom: 16 }}>
              {error}
            </div>
          )}

          {assignMode === "student" ? (
            <form onSubmit={handleCreateSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <SharedAdminFeeFormFields
                data={formData}
                onChange={(patch) => setFormData((prev) => ({ ...prev, ...patch }))}
                students={students}
                typeOptions={FEE_TYPES}
                monthOptions={MONTHS_LIST}
                paidLabel="Paid Initial Amount (₹)"
                getDefaultAmount={lastAmountFor}
              />

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  style={{ padding: "10px 16px", borderRadius: 8, border: "1px solid " + C.border, background: "#fff", color: C.text, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{ padding: "10px 20px", borderRadius: 8, border: "none", background: "linear-gradient(135deg, rgb(109, 78, 246), rgb(79, 55, 190))", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
                >
                  {submitting ? "Saving..." : "Create Fee"}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleClassAssign} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <SharedClassFeeFields
                data={classForm}
                onChange={(patch) => setClassForm((prev) => ({ ...prev, ...patch }))}
                classOptions={classOptions}
                getDefaultAmount={lastClassAmountFor}
                monthOptions={MONTHS_LIST}
              />

              {classFeeGroups.length > 0 && (
                <div style={{ border: "1px solid " + C.border, borderRadius: 10, padding: 10, background: "#f8fafc" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, marginBottom: 8 }}>
                    Saved fees — {classForm.cls} · {classForm.month}
                  </div>
                  {classFeeGroups.map((g) => {
                    const tc = FEE_TYPE_COLORS[g.type] || FEE_TYPE_COLORS.Other;
                    const unchanged = classEdits[g.type] === undefined || Number(classEdits[g.type]) === g.amount;
                    return (
                      <div key={g.type} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                        <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11.5, fontWeight: 700, background: tc.bg, color: tc.text, border: `1px solid ${tc.border}` }}>{g.type}</span>
                        <span style={{ fontSize: 11.5, color: C.muted }}>{g.fees.length} students</span>
                        <input
                          type="number" min="0"
                          value={classEdits[g.type] ?? g.amount}
                          onChange={(e) => setClassEdits((p) => ({ ...p, [g.type]: e.target.value }))}
                          style={{ ...inputStyle, width: 90, padding: "5px 8px", marginLeft: "auto" }}
                        />
                        <button type="button" title="Update amount for whole class" disabled={submitting || unchanged}
                          onClick={() => handleClassFeeUpdate(g)}
                          style={{ background: "#eef2ff", color: C.accent, border: "none", borderRadius: 6, padding: "6px 9px", cursor: "pointer", display: "flex", opacity: unchanged ? 0.4 : 1 }}>
                          <Check size={14} />
                        </button>
                        <button type="button" title="Delete for whole class" disabled={submitting} onClick={() => handleClassFeeDelete(g)}
                          style={{ background: "#fee2e2", color: "#ef4444", border: "none", borderRadius: 6, padding: "6px 9px", cursor: "pointer", display: "flex" }}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  style={{ padding: "10px 16px", borderRadius: 8, border: "1px solid " + C.border, background: "#fff", color: C.text, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{ padding: "10px 20px", borderRadius: 8, border: "none", background: "linear-gradient(135deg, rgb(109, 78, 246), rgb(79, 55, 190))", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
                >
                  {submitting ? "Saving..." : "Assign to Class"}
                </button>
              </div>
            </form>
          )}
        </Modal>
      )}

      {/* ── FEE HISTORY — every month for one student ── */}
      {historyStudentId && (() => {
        const first = historyGroups[0]?.[0];
        const info = first ? getStudentDisplay(first) : getStudentDisplay({ student: historyStudentId });
        const all = historyGroups.flat();
        const tAmount = all.reduce((s, f) => s + (Number(f.amount) || 0), 0);
        const tPaid = all.reduce((s, f) => s + (Number(f.paid) || 0), 0);
        return (
          <Modal title={`Fee History — ${info.name}`} width={940} zIndex={9990} onClose={() => setHistoryStudentId(null)}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16, alignItems: "center" }}>
              {[["Months", historyGroups.length, C.accent, "#eef2ff"],
                ["Total", `₹${tAmount.toLocaleString()}`, C.text, "#f1f5f9"],
                ["Paid", `₹${tPaid.toLocaleString()}`, "#059669", "#d1fae5"],
                ["Outstanding", `₹${Math.max(0, tAmount - tPaid).toLocaleString()}`, "#dc2626", "#fee2e2"]].map(([l, v, c, bg]) => (
                <div key={l} style={{ background: bg, borderRadius: 10, padding: "8px 16px", flex: "1 1 120px", minWidth: 0 }}>
                  <div style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>{l}</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: c }}>{v}</div>
                </div>
              ))}
              <div style={{ marginLeft: "auto", fontSize: 12, color: C.muted }}>
                {info.roll && <>Roll {info.roll}</>}{info.cls && <> · Class {info.cls}</>}
              </div>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table className="rtable fee-cards fee-history-table" style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    {["MONTH", "FEE TYPES", "TOTAL", "PAID", "BALANCE", "STATUS", "ACTIONS"].map((h) => (
                      <th key={h} style={{ padding: "9px 12px", textAlign: "left", fontSize: 11, fontWeight: 700, color: C.muted, whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {historyGroups.length === 0 ? (
                    <tr><td colSpan={7} style={{ padding: 24, textAlign: "center", color: C.muted, fontSize: 13 }}>No fee records.</td></tr>
                  ) : historyGroups.map((group, i) => {
                    const gAmount = group.reduce((s, f) => s + (Number(f.amount) || 0), 0);
                    const gPaid = group.reduce((s, f) => s + (Number(f.paid) || 0), 0);
                    const st = worstStatusOf(group);
                    const badge = getStatusBadge(st);
                    return (
                      <tr key={group[0].month || i} style={{ background: ROW_COLORS[i % ROW_COLORS.length], borderBottom: "1px solid " + C.border }}>
                        <td className="rtable-full" style={{ padding: "10px 12px", fontSize: 13, fontWeight: 700, color: C.accent, whiteSpace: "nowrap" }}>{group[0].month || "Current"}</td>
                        <td data-label="Fee Types" style={{ padding: "10px 12px" }}>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                            {group.map((fee) => {
                              const tc = FEE_TYPE_COLORS[fee.type] || FEE_TYPE_COLORS.Other;
                              return (
                                <span key={fee._id} style={{ padding: "2px 9px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: tc.bg, color: tc.text, border: `1px solid ${tc.border}` }}>{fee.type || "Tuition"}</span>
                              );
                            })}
                          </div>
                        </td>
                        <td data-label="Total" style={{ padding: "10px 12px", fontSize: 13, fontWeight: 700 }}>₹{gAmount.toLocaleString()}</td>
                        <td data-label="Paid" style={{ padding: "10px 12px", fontSize: 13, color: gPaid >= gAmount && gAmount > 0 ? "#10b981" : C.text }}>₹{gPaid.toLocaleString()}</td>
                        <td data-label="Balance" style={{ padding: "10px 12px", fontSize: 13, color: gAmount - gPaid > 0 ? "#dc2626" : C.text }}>₹{Math.max(0, gAmount - gPaid).toLocaleString()}</td>
                        <td data-label="Status" style={{ padding: "10px 12px" }}>
                          <span style={{ background: badge.bg, color: badge.color, borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 700 }}>{st || "Pending"}</span>
                        </td>
                        <td className="rtable-actions" style={{ padding: "10px 12px" }}>
                          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                            <button type="button" className="fee-pay-btn" title={canPay(group) ? "Pay / Record Payment" : "Fully paid"} disabled={!canPay(group)} onClick={() => handleOpenPay(group)}
                              style={{ background: canPay(group) ? "linear-gradient(135deg, #10b981, #059669)" : "#e5e7eb", color: canPay(group) ? "#fff" : "#9ca3af", border: "none", borderRadius: 6, padding: "7px 12px", cursor: canPay(group) ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", gap: 5, fontSize: 12.5, fontWeight: 800 }}>
                              {canPay(group) ? <DollarSign size={14} /> : <CheckCircle2 size={14} />}
                              {canPay(group) ? "Pay" : "Paid"}
                            </button>
                            <button type="button" title="Edit / Record Payment" onClick={() => handleOpenGroupEdit(group)}
                              style={{ background: "#eef2ff", color: C.accent, border: "none", borderRadius: 6, padding: "7px 9px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Edit size={14} /></button>
                            <button type="button" title="Download Receipt (PDF)" onClick={() => handleDownloadReceipt(group)}
                              style={{ background: "#ecfdf5", color: "#059669", border: "none", borderRadius: 6, padding: "7px 9px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Download size={14} /></button>
                            <button type="button" title="Delete this month" onClick={() => handleDeleteGroup(group)}
                              style={{ background: "#fee2e2", color: "#ef4444", border: "none", borderRadius: 6, padding: "7px 9px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Trash2 size={14} /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Modal>
        );
      })()}

      {/* ── GROUP EDIT / RECORD PAYMENT MODAL — same form as "Assign Fee to Student" ── */}
      {showGroupEditModal && selectedGroup.length > 0 && (() => {
        const typeOptions = [
          ...FEE_TYPES,
          ...groupOriginal.entries.map((en) => en.type).filter((t) => !FEE_TYPES.includes(t))
        ];
        const monthOptions = MONTHS_LIST.includes(groupFormData.month) || !groupFormData.month
          ? MONTHS_LIST
          : [groupFormData.month, ...MONTHS_LIST];
        const removedTypes = groupOriginal.entries
          .map((en) => en.type)
          .filter((t) => !(groupFormData.selectedTypes || []).includes(t));
        return (
          <Modal title="Edit Fee Records / Record Payment" onClose={() => setShowGroupEditModal(false)}>
            {error && (
              <div style={{ background: "#fee2e2", color: "#ef4444", padding: "10px 14px", borderRadius: 8, fontSize: 12.5, marginBottom: 16 }}>
                {error}
              </div>
            )}

            <form onSubmit={handleGroupEditSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <SharedAdminFeeFormFields
                data={groupFormData}
                onChange={(patch) => setGroupFormData((prev) => ({ ...prev, ...patch }))}
                students={students}
                studentFallback={getStudentDisplay(selectedGroup[0]).name}
                typeOptions={typeOptions}
                monthOptions={monthOptions}
                paidLabel="Total Amount Paid (₹)"
                showBalance
              />

              {removedTypes.length > 0 && (
                <div style={{ background: "#fffbeb", border: "1px solid #fde68a", color: "#92400e", padding: "9px 12px", borderRadius: 8, fontSize: 12.5 }}>
                  ⚠️ {removedTypes.join(", ")} will be removed from this student's fees when you save.
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
                <button
                  type="button"
                  title="Download Receipt (PDF)"
                  aria-label="Download Receipt (PDF)"
                  onClick={() => handleDownloadReceipt(selectedGroup)}
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "10px 12px", borderRadius: 8, border: "none", background: "#ecfdf5", color: "#059669", cursor: "pointer" }}
                >
                  <Download size={16} />
                </button>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => setShowGroupEditModal(false)}
                    style={{ padding: "10px 16px", borderRadius: 8, border: "1px solid " + C.border, background: "#fff", color: C.text, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    style={{ padding: "10px 20px", borderRadius: 8, border: "none", background: "linear-gradient(135deg, rgb(109, 78, 246), rgb(79, 55, 190))", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
                  >
                    {submitting ? "Saving..." : "Update Fee Records"}
                  </button>
                </div>
              </div>
            </form>
          </Modal>
        );
      })()}

      {/* ── PAY MODAL — record a payment for one student + month ── */}
      {payGroup && (() => {
        const entries = buildGroupEntries(payGroup);
        const info = getStudentDisplay(payGroup[0]);
        const total = entries.reduce((sum, en) => sum + en.amount, 0);
        const paid = entries.reduce((sum, en) => sum + en.paid, 0);
        const balance = entries.reduce((sum, en) => sum + Math.max(0, en.amount - en.paid), 0);
        const payAmt = Number(payForm.amount) || 0;
        const left = Math.max(0, balance - payAmt);
        return (
          <Modal title="Pay Fee" zIndex={9995} onClose={() => setPayGroup(null)}>
            {error && (
              <div style={{ background: "#fee2e2", color: "#ef4444", padding: "10px 14px", borderRadius: 8, fontSize: 12.5, marginBottom: 14 }}>
                {error}
              </div>
            )}
            <form onSubmit={handlePaySubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ background: "#f8fafc", border: "1px solid " + C.border, borderRadius: 10, padding: 12 }}>
                <div style={{ fontWeight: 800, fontSize: 14, color: C.text }}>{info.name}</div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                  {info.roll && <>Roll {info.roll}</>}{info.cls && <> · {/^class/i.test(info.cls) ? info.cls : `Class ${info.cls}`}</>} · {payGroup[0].month || "Current"}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
                  {entries.map((en) => {
                    const tc = FEE_TYPE_COLORS[en.type] || FEE_TYPE_COLORS.Other;
                    return (
                      <span key={en.type} style={{ padding: "2px 9px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: tc.bg, color: tc.text, border: `1px solid ${tc.border}` }}>
                        {en.type} · ₹{Math.max(0, en.amount - en.paid).toLocaleString()} due
                      </span>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
                {[["Total", total, C.text, "#f1f5f9"], ["Paid", paid, "#059669", "#d1fae5"], ["Balance", balance, "#dc2626", "#fee2e2"]].map(([l, v, c, bg]) => (
                  <div key={l} style={{ background: bg, borderRadius: 10, padding: "8px 10px", minWidth: 0 }}>
                    <div style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>{l}</div>
                    <div style={{ fontSize: 14.5, fontWeight: 800, color: c, overflowWrap: "anywhere" }}>₹{v.toLocaleString()}</div>
                  </div>
                ))}
              </div>

              <div>
                <label style={labelStyle}>Amount Paying Now (₹) *</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    type="number" min="1" max={balance} autoFocus
                    value={payForm.amount}
                    onChange={(e) => setPayForm((p) => ({ ...p, amount: e.target.value }))}
                    style={{ ...inputStyle, fontSize: 16, fontWeight: 800 }}
                  />
                  <button type="button" onClick={() => setPayForm((p) => ({ ...p, amount: String(balance) }))}
                    style={{ flex: "0 0 auto", padding: "0 14px", borderRadius: 8, border: "1px solid " + C.border, background: "#eef2ff", color: C.accent, fontSize: 12.5, fontWeight: 800, cursor: "pointer" }}>
                    Full
                  </button>
                </div>
                <div style={{ fontSize: 12, color: left > 0 ? "#dc2626" : "#059669", marginTop: 5, fontWeight: 700 }}>
                  {payAmt > balance ? "More than the balance due" : left > 0 ? `Balance after payment: ₹${left.toLocaleString()}` : "Fully paid after this payment"}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <label style={labelStyle}>Payment Method</label>
                  <select value={payForm.paymentMethod} onChange={(e) => setPayForm((p) => ({ ...p, paymentMethod: e.target.value }))} style={inputStyle}>
                    {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div style={{ minWidth: 0 }}>
                  <label style={labelStyle}>Transaction ID / Ref</label>
                  <input type="text" placeholder="Optional" value={payForm.transactionId}
                    onChange={(e) => setPayForm((p) => ({ ...p, transactionId: e.target.value }))} style={inputStyle} />
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 4, flexWrap: "wrap" }}>
                <button type="button" onClick={() => setPayGroup(null)}
                  style={{ padding: "10px 16px", borderRadius: 8, border: "1px solid " + C.border, background: "#fff", color: C.text, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                  Cancel
                </button>
                <button type="submit" disabled={submitting || payAmt <= 0 || payAmt > balance}
                  style={{ padding: "10px 22px", borderRadius: 8, border: "none", background: "linear-gradient(135deg, #10b981, #059669)", color: "#fff", fontSize: 13, fontWeight: 800, cursor: "pointer", opacity: submitting || payAmt <= 0 || payAmt > balance ? 0.55 : 1 }}>
                  {submitting ? "Saving..." : `Pay ₹${payAmt > 0 ? payAmt.toLocaleString() : 0}`}
                </button>
              </div>
            </form>
          </Modal>
        );
      })()}
    </div>
  );
}

export default AdminFees;