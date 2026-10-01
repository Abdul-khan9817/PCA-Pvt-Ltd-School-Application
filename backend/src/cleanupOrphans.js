// One-time cleanup for orphaned Staff/Student records.
//
// Before the fix to `removePermanent` in controllers/user.controller.js, deleting
// a staff member or student from Admin > Users only deleted the User document —
// the linked Staff/Student record was left behind in the database with a `user`
// field pointing at an account that no longer exists. Those leftover records are
// what show up as "fake" staff/student profiles (blank name, "Unnamed", etc.)
// even though nobody created them.
//
// This script finds exactly those orphaned records — Staff/Student docs whose
// `user` reference no longer resolves to a real User — and deletes them. It does
// NOT touch any record whose linked User still exists, so real staff/students,
// including your admin account, are never affected.
//
// Usage:
//   node src/cleanupOrphans.js            (dry run — lists what WOULD be deleted)
//   node src/cleanupOrphans.js --delete   (actually deletes the orphans)
import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from './config/db.js';
import User from './models/User.js';
import Student from './models/Student.js';
import Staff from './models/Staff.js';

const shouldDelete = process.argv.includes('--delete');

async function findOrphans(Model, label) {
  const records = await Model.find({}).select('user name employeeId roll studentId');
  const orphans = [];
  for (const rec of records) {
    if (!rec.user) { orphans.push(rec); continue; } // no user link at all
    const exists = await User.exists({ _id: rec.user });
    if (!exists) orphans.push(rec);
  }
  console.log(`\n${label}: ${records.length} total, ${orphans.length} orphaned`);
  orphans.forEach(rec => console.log(`  - ${rec._id} (${label === 'Staff' ? rec.employeeId || 'no employeeId' : rec.studentId || rec.roll || 'no id'})`));
  return orphans;
}

async function run() {
  await connectDB();
  console.log(shouldDelete ? '--- Deleting orphaned Staff/Student records ---' : '--- DRY RUN: finding orphaned Staff/Student records (pass --delete to actually remove them) ---');

  const orphanStaff = await findOrphans(Staff, 'Staff');
  const orphanStudents = await findOrphans(Student, 'Student');

  if (shouldDelete) {
    if (orphanStaff.length) await Staff.deleteMany({ _id: { $in: orphanStaff.map(r => r._id) } });
    if (orphanStudents.length) await Student.deleteMany({ _id: { $in: orphanStudents.map(r => r._id) } });
    console.log(`\nDeleted ${orphanStaff.length} orphaned staff and ${orphanStudents.length} orphaned student record(s).`);
  } else {
    console.log(`\nNo changes made. Re-run with --delete to remove the ${orphanStaff.length + orphanStudents.length} orphaned record(s) listed above.`);
  }

  await mongoose.disconnect();
  process.exit(0);
}

run().catch(err => { console.error(err); process.exit(1); });
