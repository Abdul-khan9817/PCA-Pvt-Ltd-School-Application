import Attendance from '../models/Attendance.js';
import Student from '../models/Student.js';
import { broadcast } from '../utils/realtime.js';
import { getTeacherAccess } from '../services/teacherAccess.service.js';

/**
 * Resolve class/subject access LIVE from Class.classTeacher and
 * Subject.teacherIds (the actual source of truth an admin edits) instead of
 * the denormalized Staff.assignedClassIds/subjectIds cache, which is only
 * ever added to and never fully cleaned up on reassignment — letting stale
 * access to old classes persist indefinitely for a 'teacher' role account.
 *
 * Principals/vice-principals aren't tied to a specific class/subject
 * assignment, so they keep full access here, same as before.
 */
export async function list(req, res) {
  const q = {};
  if (req.query.student) q.student = req.query.student;
  if (req.query.classId) q.classId = req.query.classId;
  if (req.query.subjectId) q.subjectId = req.query.subjectId;
  if (req.query.status) q.status = req.query.status;
  if (req.query.from || req.query.to) q.date = {};
  if (req.query.from) q.date.$gte = new Date(req.query.from + 'T00:00:00');
  if (req.query.to) q.date.$lte = new Date(req.query.to + 'T23:59:59.999');

  if (req.user.role === 'student') {
    const s = await Student.findOne({ user: req.user._id });
    if (!s) return res.json({ success: true, data: [] });
    q.student = s._id;
  }
  if (req.user.role === 'parent') {
    const kids = await Student.find({ guardianIds: req.user._id }).select('_id');
    q.student = { $in: kids.map(x => x._id) };
  }
  if (['teacher', 'principal', 'vice_principal'].includes(req.user.role)) {
    const access = await getTeacherAccess(req.user._id, req.user.role);
    q.classId = { $in: access.classIds };
    if (access.subjectIds.length) {
      q.subjectId = { $in: access.subjectIds };
    }
  }

  const data = await Attendance.find(q)
    .populate({ path: 'student', populate: { path: 'user', select: 'name email' } })
    .populate('classId')
    .populate('subjectId')
    .populate('markedBy', 'name role')
    .sort({ date: -1 })
    .limit(2000);
  res.json({ success: true, data });
}

export async function mark(req, res) {
  const { student, classId, subjectId, date, status, remarks } = req.body;
  if (!student || !date || !status) {
    return res.status(400).json({ success: false, message: 'student, date and status are required' });
  }
  if (['teacher', 'principal', 'vice_principal'].includes(req.user.role)) {
    const access = await getTeacherAccess(req.user._id, req.user.role);
    if (!access.classIds.some(id => String(id) === String(classId))) {
      return res.status(403).json({ success: false, message: 'You are not assigned to this class' });
    }
    if (
      ['teacher', 'principal', 'vice_principal'].includes(req.user.role) &&
      subjectId &&
      access.subjectIds.length &&
      !access.subjectIds.some(id => String(id) === String(subjectId))
    ) {
      return res.status(403).json({ success: false, message: 'You are not assigned to this subject' });
    }
  }
  const d = await Attendance.findOneAndUpdate(
    { student, date: new Date(date), subjectId: subjectId || null },
    {
      student,
      classId,
      subjectId: subjectId || null,
      date: new Date(date),
      status,
      remarks,
      markedBy: req.user._id,
    },
    { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true }
  )
    .populate({ path: 'student', populate: { path: 'user', select: 'name email' } })
    .populate('classId');
  broadcast(req, 'resource:change', { resource: 'attendance', action: 'mark', data: d });
  broadcast(req, 'attendance:marked', d);
  res.status(201).json({ success: true, data: d });
}

/**
 * Bulk-mark attendance for a whole class in one request.
 * Used by the teacher/admin attendance screens instead of calling `mark()`
 * once per student, which previously fired one socket broadcast per student
 * and made the page flicker as each event triggered a re-render.
 */
export async function markBulk(req, res) {
  const { records, classId, date } = req.body;
  if (!Array.isArray(records) || !records.length || !date) {
    return res.status(400).json({ success: false, message: 'records[] and date are required' });
  }

  if (['teacher', 'principal', 'vice_principal'].includes(req.user.role)) {
    const access = await getTeacherAccess(req.user._id, req.user.role);
    if (classId && !access.classIds.some(id => String(id) === String(classId))) {
      return res.status(403).json({ success: false, message: 'You are not assigned to this class' });
    }
  }

  const roleAccess = ['teacher', 'principal', 'vice_principal'].includes(req.user.role)
    ? await getTeacherAccess(req.user._id, req.user.role)
    : null;
  const results = [];
  for (const r of records) {
    if (!r.student || !r.status) continue;
    if (roleAccess && !roleAccess.classIds.some(id => String(id) === String(r.classId || classId))) {
      return res.status(403).json({ success: false, message: 'You are not assigned to this class' });
    }
    const d = await Attendance.findOneAndUpdate(
      { student: r.student, date: new Date(date), subjectId: r.subjectId || null },
      {
        student: r.student,
        classId: r.classId || classId,
        subjectId: r.subjectId || null,
        date: new Date(date),
        status: r.status,
        remarks: r.remarks,
        markedBy: req.user._id,
      },
      { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true }
    )
      .populate({ path: 'student', populate: { path: 'user', select: 'name email' } })
      .populate('classId');
    results.push(d);
  }

  broadcast(req, 'resource:change', { resource: 'attendance', action: 'mark-bulk', data: results });
  broadcast(req, 'attendance:marked-bulk', results);
  res.status(201).json({ success: true, data: results });
}
