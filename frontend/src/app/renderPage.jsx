import { useState, useEffect, useRef, lazy, Suspense } from "react";
import { motion, AnimatePresence } from "../shared/ui";

// FIX (Lighthouse Performance): every page for every role used to be imported
// eagerly here, so the very first page load downloaded and parsed the entire
// app's JS (admin + teacher + student pages all at once) — a major contributor
// to a low Performance score. Each page is now its own lazily-loaded chunk,
// fetched only when its route is actually visited.
const AdminDashboard      = lazy(() => import("../pages/admin/AdminDashboard").then(m => ({ default: m.AdminDashboard })));
const AdminClasses        = lazy(() => import("../pages/admin/AdminClasses").then(m => ({ default: m.AdminClasses })));
const AdminTimetable      = lazy(() => import("../pages/admin/AdminTimetable").then(m => ({ default: m.AdminTimetable })));
const AdminStudents       = lazy(() => import("../pages/admin/AdminStudents").then(m => ({ default: m.AdminStudents })));
const AdminTeachers       = lazy(() => import("../pages/admin/AdminTeachers").then(m => ({ default: m.AdminTeachers })));
const AdminSubjects       = lazy(() => import("../pages/admin/AdminSubjects").then(m => ({ default: m.AdminSubjects })));
const AdminAttendance     = lazy(() => import("../pages/admin/AdminAttendance").then(m => ({ default: m.AdminAttendance })));
const AdminStaffAttendance = lazy(() => import("../pages/admin/AdminStaffAttendance").then(m => ({ default: m.AdminStaffAttendance })));
const AdminSalary         = lazy(() => import("../pages/admin/AdminSalary").then(m => ({ default: m.AdminSalary })));
const AdminFees           = lazy(() => import("../pages/admin/AdminFees").then(m => ({ default: m.AdminFees })));
const UserManagement      = lazy(() => import("../pages/admin/UserManagement").then(m => ({ default: m.UserManagement })));
const Announcements       = lazy(() => import("../pages/shared/Announcements").then(m => ({ default: m.Announcements })));
const GradeManagement     = lazy(() => import("../pages/shared/GradeManagement").then(m => ({ default: m.GradeManagement })));
const ProfilePage         = lazy(() => import("../pages/shared/ProfilePage").then(m => ({ default: m.ProfilePage })));
const StudentDashboard    = lazy(() => import("../pages/student/StudentDashboard").then(m => ({ default: m.StudentDashboard })));
const StudentAttendance   = lazy(() => import("../pages/student/StudentAttendance").then(m => ({ default: m.StudentAttendance })));
const StudentMarks        = lazy(() => import("../pages/student/StudentMarks").then(m => ({ default: m.StudentMarks })));
const StudentFees         = lazy(() => import("../pages/student/StudentFees").then(m => ({ default: m.StudentFees })));
const StudentTimetable    = lazy(() => import("../pages/student/StudentTimetable").then(m => ({ default: m.StudentTimetable })));
const StudentAssignments  = lazy(() => import("../pages/student/StudentAssignments").then(m => ({ default: m.StudentAssignments })));
const TeacherDashboard    = lazy(() => import("../pages/teacher/TeacherDashboard").then(m => ({ default: m.TeacherDashboard })));
const TeacherClasses      = lazy(() => import("../pages/teacher/TeacherClasses").then(m => ({ default: m.TeacherClasses })));
const TeacherAttendance   = lazy(() => import("../pages/teacher/TeacherAttendance").then(m => ({ default: m.TeacherAttendance })));
const TeacherSalary       = lazy(() => import("../pages/teacher/TeacherSalary").then(m => ({ default: m.TeacherSalary })));
const TeacherTimetable    = lazy(() => import("../pages/teacher/TeacherTimetable").then(m => ({ default: m.TeacherTimetable })));
const TeacherStudents     = lazy(() => import("../pages/teacher/TeacherStudents").then(m => ({ default: m.TeacherStudents })));

// Fixed-height fallback (not 0-height) so swapping in the real page doesn't
// itself cause a layout shift — this also helps the CLS score.
const pageFallback = <div style={{ minHeight: "60vh" }} />;
function wrap(content) { return <div className="edumanage-page"><Suspense fallback={pageFallback}>{content}</Suspense></div>; }

// ✅ Now accepts handlers as third argument
function renderPage(page, role, { onLogout, setPage, userData } = {}) {
  if (["admin", "principal", "vice_principal"].includes(role)) {
    switch (page) {
      case "dashboard":     return wrap(<AdminDashboard onLogout={onLogout} setPage={setPage} userData={userData} />);
      case "classes":       return wrap(<AdminClasses onLogout={onLogout} setPage={setPage} userData={userData} />);
      case "timetable":     return wrap(<AdminTimetable onLogout={onLogout} setPage={setPage} userData={userData} />);
      case "students":      return wrap(<AdminStudents onLogout={onLogout} setPage={setPage} userData={userData} />);
      case "teachers":      return wrap(<AdminTeachers onLogout={onLogout} setPage={setPage} userData={userData} />);
      case "subjects":      return wrap(<AdminSubjects onLogout={onLogout} setPage={setPage} userData={userData} />);
      case "attendance":    return wrap(<AdminAttendance onLogout={onLogout} setPage={setPage} userData={userData} />);
      case "staff-attendance": return wrap(<AdminStaffAttendance onLogout={onLogout} setPage={setPage} userData={userData} />);
      case "grades":        return wrap(<GradeManagement role="admin" onLogout={onLogout} setPage={setPage} userData={userData} />);
      case "salary":        return wrap(<AdminSalary onLogout={onLogout} setPage={setPage} userData={userData} />);
      case "fees":          return wrap(<AdminFees onLogout={onLogout} setPage={setPage} userData={userData} />);
      case "user-accounts": return role === "admin" ? wrap(<UserManagement onLogout={onLogout} setPage={setPage} userData={userData} />) : wrap(<AdminDashboard onLogout={onLogout} setPage={setPage} userData={userData} />);
      case "announcements": return wrap(<Announcements role={role} onLogout={onLogout} setPage={setPage} userData={userData} />);
      case "profile":       return wrap(<ProfilePage role={role} userData={userData} onLogout={onLogout} setPage={setPage} />);
      default:              return wrap(<AdminDashboard onLogout={onLogout} setPage={setPage} userData={userData} />);
    }
  }
  if (role === "teacher") {
    switch (page) {
      case "dashboard":     return wrap(<TeacherDashboard onLogout={onLogout} setPage={setPage} userData={userData} />);
      case "classes":       return wrap(<TeacherClasses onLogout={onLogout} setPage={setPage} userData={userData} />);
      case "students":      return wrap(<TeacherStudents onLogout={onLogout} setPage={setPage} userData={userData} />);
      case "timetable":     return wrap(<TeacherTimetable onLogout={onLogout} setPage={setPage} userData={userData} />);
      case "attendance":    return wrap(<TeacherAttendance onLogout={onLogout} setPage={setPage} userData={userData} />);
      case "marks":         return wrap(<GradeManagement role="teacher" onLogout={onLogout} setPage={setPage} userData={userData} />);
      case "salary":        return wrap(<TeacherSalary onLogout={onLogout} setPage={setPage} userData={userData} />);
      case "announcements": return wrap(<Announcements role="teacher" onLogout={onLogout} setPage={setPage} userData={userData} />);
      case "profile":       return wrap(<ProfilePage role={role} userData={userData} onLogout={onLogout} setPage={setPage} />);
      default:              return wrap(<TeacherDashboard onLogout={onLogout} setPage={setPage} userData={userData} />);
    }
  }
  if (role === "student") {
    switch (page) {
      case "dashboard":     return wrap(<StudentDashboard onLogout={onLogout} setPage={setPage} userData={userData} />);
      case "attendance":    return wrap(<StudentAttendance onLogout={onLogout} setPage={setPage} userData={userData} />);
      case "marks":         return wrap(<StudentMarks onLogout={onLogout} setPage={setPage} userData={userData} />);
      case "fees":          return wrap(<StudentFees onLogout={onLogout} setPage={setPage} userData={userData} />);
      case "announcements": return wrap(<Announcements role="student" onLogout={onLogout} setPage={setPage} userData={userData} />);
      case "assignments":   return wrap(<StudentAssignments onLogout={onLogout} setPage={setPage} userData={userData} />);
      case "timetable":     return wrap(<StudentTimetable onLogout={onLogout} setPage={setPage} userData={userData} />);
      case "profile":       return wrap(<ProfilePage role={role} userData={userData} onLogout={onLogout} setPage={setPage} />);
      default:              return wrap(<StudentDashboard onLogout={onLogout} setPage={setPage} userData={userData} />);
    }
  }
  return wrap(<AdminDashboard onLogout={onLogout} setPage={setPage} userData={userData} />);
}

export { renderPage };