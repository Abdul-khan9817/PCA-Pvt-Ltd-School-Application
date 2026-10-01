import Grade from '../models/Grade.js';
import { broadcast } from '../utils/realtime.js';
import Student from '../models/Student.js';
import { getTeacherAccess } from '../services/teacherAccess.service.js';

const grade = a => (a >= 90 ? 'A+' : a >= 80 ? 'A' : a >= 70 ? 'B+' : a >= 60 ? 'B' : a >= 50 ? 'C' : 'D');

/**
 * Resolve teacher class/subject access LIVE from Class.classTeacher and
 * Subject.teacherIds (the actual source of truth an admin edits), rather
 * than from the denormalized Staff.assignedClassIds/subjectIds cache.
 * That cache is only ever added to and never fully cleaned up when a
 * teacher is reassigned, so relying on it let stale class access persist
 * indefinitely (e.g. after a teacher stopped teaching a subject).
 */
export async function scope(req, q) {
  if (req.user.role === 'student') {
    const student = await Student.findOne({ user: req.user._id }).select('_id');
    q.student = student?._id || null;
  }
  if (req.user.role === 'parent') {
    const students = await Student.find({ guardianIds: req.user._id }).select('_id');
    q.student = { $in: students.map(item => item._id) };
  }
  if (req.user.role === 'teacher') {
    const access = await getTeacherAccess(req.user._id);
    q.classId = { $in: access.classIds };
    if (access.subjectIds.length) q.subjectId = { $in: access.subjectIds };
  }
}

const studentPopulate = {
  path: 'student',
  populate: { path: 'user', select: 'name email' },
};

export async function list(req, res) {
  const q = {};
  if (req.query.classId) q.classId = req.query.classId;
  if (req.query.subjectId) q.subjectId = req.query.subjectId;
  if (req.query.student) q.student = req.query.student;
  if (req.query.exam) q.exam = req.query.exam;
  if (req.query.term && String(req.query.term).trim()) q.term = req.query.term;

  if (req.user.role === 'student') {
    const s = await Student.findOne({ user: req.user._id });
    if (!s) {
      return res.json({
        success: true,
        data: [],
        meta: { page: 1, limit: 20, total: 0, pages: 0, warning: 'Student profile is not linked to this login' },
      });
    }
    q.student = s._id;
  }
  if (req.user.role === 'parent') {
    const kids = await Student.find({ guardianIds: req.user._id }).select('_id');
    q.student = { $in: kids.map(x => x._id) };
  }
  if (req.user.role === 'teacher') {
    const access = await getTeacherAccess(req.user._id);
    if (!access.classIds.length) {
      return res.json({
        success: true,
        data: [],
        meta: {
          page: 1,
          limit: 20,
          total: 0,
          pages: 0,
          warning: 'No classes assigned. Ask admin to set you as class teacher or assign subjects.',
        },
      });
    }
    if (req.query.classId) {
      if (access.classIds.some(id => String(id) === String(req.query.classId))) {
        q.classId = req.query.classId;
      } else {
        q.classId = { $in: [] };
      }
    } else {
      q.classId = { $in: access.classIds };
    }
    // Only filter by subject when teacher has explicit subject assignments;
    // class teachers (classIds only) see all grades for their classes.
    if (access.subjectIds.length) q.subjectId = { $in: access.subjectIds };
  }

  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(5000, Math.max(1, Number(req.query.limit) || 20));

  const [data, total] = await Promise.all([
    Grade.find(q)
      .populate(studentPopulate)
      .populate('classId')
      .populate('subjectId')
      .populate('enteredBy', 'name role')
      .populate('history.changedBy', 'name role')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Grade.countDocuments(q),
  ]);

  res.json({
    success: true,
    data,
    meta: { page, limit, total, pages: Math.ceil(total / limit) },
  });
}

async function assertTeacherAccess(req, data) {
  // Admins and school leadership can enter grades for any class/subject
  if (['admin', 'principal', 'vice_principal'].includes(req.user.role)) return true;
  if (req.user.role !== 'teacher') return true;
  const access = await getTeacherAccess(req.user._id);
  if (!access.classIds.length) return false;
  if (!access.classIds.some(id => String(id) === String(data.classId))) return false;
  if (
    data.subjectId &&
    access.subjectIds.length &&
    !access.subjectIds.some(id => String(id) === String(data.subjectId))
  ) {
    return false;
  }
  return true;
}

export async function create(req, res) {
  const d = { ...req.body, enteredBy: req.user._id };
  if (!d.subjectId) return res.status(400).json({ success: false, message: 'Subject ID is required' });
  if (!(await assertTeacherAccess(req, d))) {
    return res.status(403).json({ success: false, message: 'You are not assigned to this class or subject' });
  }
  if (d.marks !== undefined && d.marks !== null && d.marks !== '') {
    const pct = (Number(d.marks) / Number(d.maxMarks || 100)) * 100;
    d.grade = grade(pct);
  } else if (d.marks !== undefined) d.grade = null;

  const key = { student: d.student, subjectId: d.subjectId, exam: d.exam, term: d.term || null };
  let record = await Grade.findOne(key);
  const previousMarks = record?.marks;
  if (!record) {
    record = new Grade({
      ...d,
      history: [{ marks: d.marks, previousMarks: null, grade: d.grade, changedBy: req.user._id, changedAt: new Date() }],
    });
  } else {
    if (String(previousMarks ?? '') !== String(d.marks ?? '')) {
      record.history.push({
        marks: d.marks,
        previousMarks,
        grade: d.grade,
        changedBy: req.user._id,
        changedAt: new Date(),
      });
    }
    Object.assign(record, d);
  }
  await record.save();
  const data = await Grade.findById(record._id)
    .populate(studentPopulate)
    .populate('classId')
    .populate('subjectId')
    .populate('history.changedBy', 'name role');
  broadcast(req, 'resource:change', { resource: 'grades', action: 'create', data });
  broadcast(req, 'grades:created', data);
  broadcast(req, 'grades:saved', data); // legacy alias
  res.status(201).json({ success: true, data });
}

export async function update(req, res) {
  const data = { ...req.body };
  const existing = await Grade.findById(req.params.id);
  if (!existing) return res.status(404).json({ success: false, message: 'Grade not found' });
  if (
    !(await assertTeacherAccess(req, {
      classId: data.classId || existing.classId,
      subjectId: data.subjectId || existing.subjectId,
    }))
  ) {
    return res.status(403).json({ success: false, message: 'You are not assigned to this class or subject' });
  }
  if (data.marks !== undefined && data.marks !== null && data.marks !== '') {
    data.grade = grade((Number(data.marks) / Number(data.maxMarks || existing.maxMarks || 100)) * 100);
  } else if (data.marks !== undefined) data.grade = null;
  if (data.marks !== undefined && String(existing.marks ?? '') !== String(data.marks ?? '')) {
    existing.history.push({
      marks: data.marks,
      previousMarks: existing.marks,
      grade: data.grade,
      changedBy: req.user._id,
      changedAt: new Date(),
    });
  }
  Object.assign(existing, data);
  await existing.save();
  const out = await Grade.findById(existing._id)
    .populate(studentPopulate)
    .populate('classId')
    .populate('subjectId')
    .populate('history.changedBy', 'name role');
  if (!out) return res.status(404).json({ success: false, message: 'Grade not found' });
  broadcast(req, 'resource:change', { resource: 'grades', action: 'update', id: req.params.id, data: out });
  broadcast(req, 'grades:updated', out);
  res.json({ success: true, data: out });
}
