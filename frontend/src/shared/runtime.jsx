import {
  LayoutDashboard, GraduationCap, Users, BookOpen, ClipboardCheck,
  ListChecks, Megaphone, DollarSign, UserCircle, LogOut, Clock, BarChart2, Calendar
} from "lucide-react";

const C = {
  navy:"#1e2a4a", navyD:"#161e36", accent:"#4f6ef7", accentL:"#6c84f8",
  teal:"#047857", purple:"#7c3aed", orange:"#b45309", red:"#dc2626",
  pink:"#ec4899", bg:"#f0f2f8", white:"#ffffff", border:"#e5e7eb",
  muted:"#4b5563", text:"#111827",
};
const ROW_COLORS = ["#f0fdf4","#fefce8","#ffffff","#fff0f6","#f0f4ff"];
const GRADE_CHART_COLORS = ["#8b5cf6","#38bdf8","#10b981","#f59e0b","#ec4899","#a78bfa","#f87171","#34d399","#fbbf24","#60a5fa"];
const SUBJECTS_LIST = ["Mathematics","Science","English","History","Computer Science","Physical Education"];

const initials = name => String(name || "").split(" ").map(word => word[0]).join("").slice(0, 2).toUpperCase();
const avatarColors = ["#8b5cf6","#3b82f6","#10b981","#f59e0b","#ec4899","#ef4444","#06b6d4","#6366f1"];
const avatarColor = name => avatarColors[(String(name || "?").charCodeAt(0) || 0) % avatarColors.length];
const calcAvg = grades => {
  const values = Object.values(grades || {}).map(Number).filter(Number.isFinite);
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
};
const calcGrade = score => score >= 90 ? "A+" : score >= 80 ? "A" : score >= 70 ? "B+" : score >= 60 ? "B" : score >= 50 ? "C" : "D";
const gradeCol = grade => grade?.startsWith("A") ? C.teal : grade?.startsWith("B") ? C.accent : grade?.startsWith("C") ? C.purple : C.orange;

const ADMIN_NAV = [
  { section:"MAIN", items:[{ id:"dashboard", icon:LayoutDashboard, label:"Dashboard" }] },
  { section:"ACADEMIC", items:[
    { id:"classes", icon:BookOpen, label:"Classes" }, { id:"timetable", icon:Clock, label:"Timetable" },
    { id:"students", icon:Users, label:"Students" }, { id:"teachers", icon:GraduationCap, label:"Staff" },
    { id:"subjects", icon:BookOpen, label:"Subjects" },
  ]},
  { section:"OPERATIONS", items:[
    { id:"attendance", icon:ClipboardCheck, label:"Attendance" }, { id:"staff-attendance", icon:Calendar, label:"Staff Attendance" }, { id:"grades", icon:BarChart2, label:"Grades" },
    { id:"announcements", icon:Megaphone, label:"Announcements" },
  ]},
  { section:"FINANCE", items:[{ id:"fees", icon:DollarSign, label:"Fees" }, { id:"salary", icon:DollarSign, label:"Salary" }] },
  { section:"ACCOUNT", items:[
    { id:"user-accounts", icon:Users, label:"User Accounts" }, { id:"profile", icon:UserCircle, label:"Profile" },
    { id:"logout", icon:LogOut, label:"Logout" },
  ]},
];

const TEACHER_NAV = [
  { section:"MAIN", items:[{ id:"dashboard", icon:LayoutDashboard, label:"Dashboard" }] },
  { section:"ACADEMIC", items:[
    { id:"classes", icon:BookOpen, label:"My Classes" }, { id:"students", icon:Users, label:"Students" },
    { id:"timetable", icon:Clock, label:"Timetable" }, { id:"attendance", icon:ClipboardCheck, label:"Attendance" },
    { id:"marks", icon:BarChart2, label:"Marks" }, { id:"announcements", icon:Megaphone, label:"Announcements" },
  ]},
  { section:"FINANCE", items:[{ id:"salary", icon:DollarSign, label:"Salary" }] },
  { section:"ACCOUNT", items:[{ id:"profile", icon:UserCircle, label:"Profile" }, { id:"logout", icon:LogOut, label:"Logout" }] },
];

const STUDENT_NAV = [
  { section:"MAIN", items:[{ id:"dashboard", icon:LayoutDashboard, label:"Dashboard" }] },
  { section:"ACADEMIC", items:[
    { id:"marks", icon:ListChecks, label:"My Grades" }, { id:"attendance", icon:ClipboardCheck, label:"Attendance" },
    { id:"assignments", icon:ListChecks, label:"Assignments" }, { id:"timetable", icon:Clock, label:"Timetable" },
  ]},
  { section:"COMMUNICATION", items:[{ id:"announcements", icon:Megaphone, label:"Announcements" }] },
  { section:"FINANCE", items:[{ id:"fees", icon:DollarSign, label:"Fees" }] },
  { section:"ACCOUNT", items:[{ id:"profile", icon:UserCircle, label:"Profile" }, { id:"logout", icon:LogOut, label:"Logout" }] },
];

const PAGE_META = {
  dashboard:{ title:"Dashboard", subtitle:"Welcome back!" }, students:{ title:"Students", subtitle:"Manage student records" },
  teachers:{ title:"Staff Management", subtitle:"Manage staff members" }, subjects:{ title:"Subjects", subtitle:"Manage curriculum" },
  attendance:{ title:"Attendance", subtitle:"Track attendance" }, "staff-attendance":{ title:"Staff Attendance", subtitle:"Mark daily staff attendance" }, grades:{ title:"Grades", subtitle:"Academic performance" },
  salary:{ title:"Salary", subtitle:"Salary management" }, marks:{ title:"Marks", subtitle:"Manage student grades" },
  fees:{ title:"Fee Management", subtitle:"Manage student fees, collection & invoices" },
  announcements:{ title:"Announcements", subtitle:"School announcements" }, assignments:{ title:"Assignments", subtitle:"My assignments" },
  timetable:{ title:"Timetable", subtitle:"Weekly schedule" }, classes:{ title:"My Classes", subtitle:"Assigned classes" },
  profile:{ title:"Profile", subtitle:"Manage your account" }, "user-accounts":{ title:"User Accounts", subtitle:"Manage school login accounts" },
};

export {
  C, ROW_COLORS, GRADE_CHART_COLORS, SUBJECTS_LIST,
  initials, avatarColors, avatarColor, calcAvg, calcGrade, gradeCol,
  ADMIN_NAV, TEACHER_NAV, STUDENT_NAV, PAGE_META,
};
