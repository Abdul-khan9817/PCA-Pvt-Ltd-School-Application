import 'dotenv/config';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
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
import Exam from './models/Exam.js';
import Assignment from './models/Assignment.js';
import Submission from './models/Submission.js';
import Leave from './models/Leave.js';
import Timetable from './models/Timetable.js';
import Notification from './models/Notification.js';
import Message from './models/Message.js';
import AuditLog from './models/AuditLog.js';

async function wipeAll() {
  await connectDB();
  console.log('--- Wiping ALL Collections in Database ---');

  await Promise.all([
    User.deleteMany({}),
    Student.deleteMany({}),
    Staff.deleteMany({}),
    Class.deleteMany({}),
    Subject.deleteMany({}),
    Attendance.deleteMany({}),
    Grade.deleteMany({}),
    Fee.deleteMany({}),
    Payroll.deleteMany({}),
    Announcement.deleteMany({}),
    Exam.deleteMany({}),
    Assignment.deleteMany({}),
    Submission.deleteMany({}),
    Leave.deleteMany({}),
    Timetable.deleteMany({}),
    Notification.deleteMany({}),
    Message.deleteMany({}),
    AuditLog.deleteMany({})
  ]);

  // Create a single fresh Admin user
  const adminEmail = (process.env.DEFAULT_ADMIN_EMAIL || 'admin@edumanage.com').trim().toLowerCase();
  const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD || 'Password@123';
  const passwordHash = await bcrypt.hash(adminPassword, 12);

  const admin = await User.create({
    name: 'Admin',
    email: adminEmail,
    passwordHash,
    role: 'admin',
    status: 'active'
  });

  console.log('All collections have been completely cleared.');
  console.log(`Fresh single Admin created: ${admin.email} (Password: ${adminPassword})`);
  console.log(`Remaining counts:`);
  console.log(`- Users: ${await User.countDocuments()}`);
  console.log(`- Students: ${await Student.countDocuments()}`);
  console.log(`- Staff: ${await Staff.countDocuments()}`);
  console.log(`- Classes: ${await Class.countDocuments()}`);
  console.log(`- Subjects: ${await Subject.countDocuments()}`);
  console.log(`- Announcements: ${await Announcement.countDocuments()}`);
  console.log(`- Attendance: ${await Attendance.countDocuments()}`);
  console.log(`- Grades: ${await Grade.countDocuments()}`);
  console.log(`- Fees: ${await Fee.countDocuments()}`);
  console.log(`- Exams: ${await Exam.countDocuments()}`);
  console.log(`- Assignments: ${await Assignment.countDocuments()}`);

  process.exit(0);
}

wipeAll().catch(err => {
  console.error('Error wiping database:', err);
  process.exit(1);
});
