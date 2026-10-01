import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { connectDB } from './config/db.js';
import User from './models/User.js';
import Student from './models/Student.js';
import Staff from './models/Staff.js';
import Class from './models/Class.js';
import Subject from './models/Subject.js';
import Attendance from './models/Attendance.js';
import Grade from './models/Grade.js';
import Fee from './models/Fee.js';
import Payroll from './models/Payroll.js';
import Announcement from './models/Announcement.js';
import Leave from './models/Leave.js';
import Timetable from './models/Timetable.js';

await connectDB();
await Promise.all([
  User.deleteMany({}), Student.deleteMany({}), Staff.deleteMany({}), Class.deleteMany({}),
  Subject.deleteMany({}), Attendance.deleteMany({}), Grade.deleteMany({}), Fee.deleteMany({}),
  Payroll.deleteMany({}), Announcement.deleteMany({}), Leave.deleteMany({}), Timetable.deleteMany({})
]);

for (const [collection, index] of [[Student, 'rollNo_1'], [Subject, 'code_1'], [Attendance, 'classId_1_date_1'], [Grade, 'student_1_subject_1_term_1_academicYear_1']]) {
  try { await collection.collection.dropIndex(index); } catch (_) {}
}

const password = await bcrypt.hash('Password@123', 12);
const makeUser = (name, email, role, extra = {}) => ({ name, email, passwordHash: password, role, status: 'active', ...extra });

const users = await User.insertMany([
  makeUser('Sarah Johnson', 'admin@edumanage.com', 'admin'),
  makeUser('Sakib Ahamad', 'principal@school.edu', 'principal'),
  makeUser('Sohil Khan', 'viceprincipal@school.edu', 'vice_principal'),
  ...Array.from({ length: 15 }, (_, index) => makeUser(`Teacher ${String.fromCharCode(65 + index)}`, `teacher${index + 1}@school.edu`, 'teacher', { phone: `920000${String(index + 1).padStart(4, '0')}` })),
  ...Array.from({ length: 260 }, (_, index) => makeUser(`Student ${String(index + 1).padStart(3, '0')}`, `student${index + 1}@school.edu`, 'student'))
]);

const byRole = role => users.filter(user => user.role === role);
const admin = byRole('admin')[0];
const teachers = byRole('teacher');
const studentUsers = byRole('student');
const levels = ['Nursery', 'LKG', 'UKG', ...Array.from({ length: 10 }, (_, index) => String(index + 1))];
const sections = ['A', 'B'];

const classes = await Class.insertMany(levels.flatMap((level, levelIndex) => sections.map((section, sectionIndex) => ({
  name: `Class ${level}-${section}`, section, gradeLevel: level, academicYear: '2026-2027',
  classTeacher: teachers[(levelIndex * 2 + sectionIndex) % teachers.length]._id,
  capacity: 100, room: `${100 + levelIndex * 2 + sectionIndex + 1}`, status: 'active'
}))));

const subjects = await Subject.insertMany([
  { name: 'Mathematics', teacherIds: teachers.slice(0, 3).map(user => user._id), classIds: classes.map(item => item._id), status: 'active' },
  { name: 'Science', teacherIds: teachers.slice(3, 6).map(user => user._id), classIds: classes.map(item => item._id), status: 'active' },
  { name: 'English', teacherIds: teachers.slice(6, 9).map(user => user._id), classIds: classes.map(item => item._id), status: 'active' },
  { name: 'Social Studies', teacherIds: teachers.slice(9, 12).map(user => user._id), classIds: classes.map(item => item._id), status: 'active' },
  { name: 'Computer Science', teacherIds: teachers.slice(12, 15).map(user => user._id), classIds: classes.map(item => item._id), status: 'active' },
  { name: 'Physical Education', teacherIds: teachers.slice(0, 3).map(user => user._id), classIds: classes.map(item => item._id), status: 'active' }
]);

const studentDocs = await Student.insertMany(studentUsers.map((user, index) => ({
  user: user._id, roll: `S${String(index + 1).padStart(4, '0')}`, studentId: `STU-${String(index + 1).padStart(4, '0')}`,
  classId: classes[Math.floor(index / 10)]._id, cls: classes[Math.floor(index / 10)].name, section: classes[Math.floor(index / 10)].section,
  gender: index % 2 ? 'Female' : 'Male', dob: new Date(2012 + (index % 6), index % 12, (index % 26) + 1), admissionDate: new Date('2026-04-01'),
  fatherName: `Parent ${String(index + 1).padStart(3, '0')}`, motherName: `Guardian ${String(index + 1).padStart(3, '0')}`,
  guardianName: `Parent ${String(index + 1).padStart(3, '0')}`, parentPhone: `930000${String(index + 1).padStart(4, '0')}`,
  address: `${101 + index} School Road`, village: `Ward ${(index % 12) + 1}`,
  gpa: Number((2.5 + (index % 15) / 10).toFixed(1)), status: 'active'
})));

await Staff.insertMany([
  { user: users[1]._id, employeeId: 'LEAD-001', designation: 'Principal', department: 'Administration', joiningDate: new Date('2020-04-01'), assignedClassIds: classes.map(item => item._id) },
  { user: users[2]._id, employeeId: 'LEAD-002', designation: 'Vice Principal', department: 'Administration', joiningDate: new Date('2021-04-01'), assignedClassIds: classes.map(item => item._id) },
  ...teachers.map((user, index) => ({
    user: user._id, employeeId: `T${String(index + 1).padStart(3, '0')}`, designation: index < 2 ? 'Department Head' : 'Subject Teacher',
    department: subjects[index % subjects.length].name, joiningDate: new Date('2024-04-01'),
    salary: { basic: 45000 + index * 1000, allowances: 6000, deductions: 3500, net: 47500 + index * 1000 },
    assignedClassIds: classes.filter((_, classIndex) => classIndex % teachers.length === index).map(item => item._id),
    subjectIds: [subjects[index % subjects.length]._id]
  }))
]);

const attendance = [];
const grades = [];
const fees = [];
studentDocs.forEach((student, index) => {
  const classItem = classes[Math.floor(index / 10)];
  for (let day = 0; day < 3; day += 1) {
    attendance.push({ student: student._id, classId: classItem._id, subjectId: subjects[day]._id, date: new Date(2026, 7, 25 + day), status: day === 2 && index % 5 === 0 ? 'Absent' : 'Present', markedBy: teachers[index % teachers.length]._id });
  }
  subjects.forEach((subject, subjectIndex) => grades.push({ student: student._id, classId: classItem._id, subjectId: subject._id, exam: 'First Term', term: 'Term 1', marks: 60 + ((index + subjectIndex * 4) % 36), maxMarks: 100, grade: 'B', enteredBy: teachers[index % teachers.length]._id }));
  fees.push({ student: student._id, type: 'Term Fee', amount: 12000, paid: index % 3 === 0 ? 12000 : 0, status: index % 3 === 0 ? 'Paid' : 'Pending', dueDate: new Date('2026-09-30') });
});
await Attendance.insertMany(attendance);
await Grade.insertMany(grades);
await Fee.insertMany(fees);

const staffDocs = await Staff.find({ user: { $in: [users[1]._id, users[2]._id, ...teachers.map(user => user._id)] } });
await Payroll.insertMany(staffDocs.map((staff, index) => ({ staff: staff._id, month: 'September 2026', basic: 45000 + index * 1000, allowances: 6000, deductions: 3500, net: 47500 + index * 1000, status: index % 2 ? 'Pending' : 'Paid', paidOn: index % 2 ? undefined : new Date('2026-09-01') })));
await Leave.insertMany(teachers.slice(0, 3).map((user, index) => ({ user: user._id, type: index === 0 ? 'Casual Leave' : 'Sick Leave', from: new Date(2026, 8, 10 + index), to: new Date(2026, 8, 10 + index), days: 1, status: 'Pending', reason: 'Personal leave application' })));
// Timetables are intentionally left empty. Admins create the exact slots needed
// for each class, including different periods and breaks by day.
await Announcement.insertMany([
  { title: 'Welcome to the 2026-2027 Session', content: 'Classes and schedules are now available in the portal.', priority: 'High', audience: ['admin', 'principal', 'vice_principal', 'teacher', 'student', 'parent'], publishedBy: admin._id },
  { title: 'Parent Meeting', content: 'The first parent meeting will be held this month.', priority: 'Medium', audience: ['teacher', 'student', 'parent'], publishedBy: admin._id }
]);

console.log(`Seed complete: ${classes.length} classes, ${studentDocs.length} students, ${teachers.length} teachers, linked academic and HR records.`);
console.log('Accounts use Password@123. Admin: admin@edumanage.com');
process.exit(0);
