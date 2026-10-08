import { Users, School } from "../../shared/ui";
import { C } from "../../shared/runtime";
import { FormField as Field } from "../common/FormField";
import { MultiSelectDropdown } from "./MultiSelectDropdown";

const capacityOptions = Array.from({ length: 20 }, (_, index) => (index + 1) * 5);
const capacityDropdownOptions = capacityOptions.map(value => ({ id: value, name: `${value} students` }));

export function AdminClassForm({ form, setForm, teachers, students, subjects, selectedStudentIds, setSelectedStudentIds, selectedSubjectIds, setSelectedSubjectIds, loading, onCancel, onSubmit, saving, edit = false, saved = false }) {
  const set = (key, value) => setForm(previous => ({ ...previous, [key]: value }));
  const selectTeacher = id => {
    const teacher = teachers.find(item => String(item.user?._id || item.user || item._id || item.id) === String(id));
    const name = teacher?.user?.name || teacher?.name || teacher?.fullName || "";
    setForm(previous => ({ ...previous, classTeacher: id, subjectTeacher: previous.subjectTeacher || name }));
  };
  const teacherOptions = teachers.map(item => ({ id: String(item.user?._id || item.user || item._id || item.id), name: item.user?.name || item.name || item.fullName || "Unnamed Teacher", detail: item.department || item.designation || "" }));

  return <>
    <Field label="Class Name" value={form.name} onChange={value => set("name", value)} placeholder={edit ? undefined : "Class 10-A"} required />
    <Field label="Section" value={form.section} onChange={value => set("section", value)} placeholder={edit ? undefined : "A"} />
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
      <Field label="Room Number" value={form.room} onChange={value => set("room", value)} placeholder={edit ? undefined : "101"} />
      <MultiSelectDropdown single searchable={false} label="Capacity" options={capacityDropdownOptions} selectedIds={form.capacity ? [String(form.capacity)] : []} onChange={ids => set("capacity", ids[0] || form.capacity)} placeholder="Select capacity" accent="#4f6ef7" />
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
      <Field label="Subject Teacher" value={form.subjectTeacher} onChange={value => set("subjectTeacher", value)} placeholder="Enter subject teacher" />
      <MultiSelectDropdown single label="Select Teacher" options={teacherOptions} selectedIds={form.classTeacher ? [String(form.classTeacher)] : []} onChange={ids => selectTeacher(ids[0] || "")} placeholder="Select Teacher..." emptyText="No teachers available" getLabel={item => item.name} getSecondary={item => item.detail} accent="#4f6ef7" />
    </div>
    <MultiSelectDropdown label="Students" icon={Users} options={students} selectedIds={selectedStudentIds} onChange={setSelectedStudentIds} disabled={loading} placeholder="Select students" emptyText="No active students available" getLabel={student => student.user?.name || student.name || student.fullName || "Unnamed Student"} getSecondary={student => student.roll ? `Roll ${student.roll}` : student.email || ""} accent="#4f6ef7" />
    <MultiSelectDropdown label="Subjects" icon={School} options={subjects} selectedIds={selectedSubjectIds} onChange={setSelectedSubjectIds} disabled={loading} placeholder="Select subjects" emptyText="No subjects available" getLabel={subject => subject.name || subject.title || "Unnamed Subject"} getSecondary={subject => subject.code || subject.subjectCode || subject.type || ""} accent="#8b5cf6" />
    <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 24 }}><button type="button" onClick={onCancel} style={{ padding: "10px 18px", borderRadius: 10, border: "1.5px solid " + C.border, background: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancel</button><button type="button" onClick={onSubmit} disabled={saving} style={{ padding: "10px 22px", borderRadius: 10, border: "none", background: saved ? C.teal : C.accent, color: "#fff", fontSize: 13, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer" }}>{saving ? (edit ? "Saving..." : "Creating...") : edit ? (saved ? "Saved" : "Save Changes") : "Create Class"}</button></div>
  </>;
}