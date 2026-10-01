import Assignment from '../models/Assignment.js';
import Submission from '../models/Submission.js';
import Student from '../models/Student.js';
import Notification from '../models/Notification.js';
import { broadcast } from '../utils/realtime.js';

export async function list(req, res) {
  const q = {};
  if (req.query.classId) q.classId = req.query.classId;
  if (req.query.subjectId) q.subjectId = req.query.subjectId;
  if (req.user.role === 'teacher') q.teacher = req.user._id;

  let studentProfile = null;
  if (req.user.role === 'student') {
    studentProfile = await Student.findOne({ user: req.user._id });
    if (studentProfile?.classId && !req.query.classId) {
      q.classId = studentProfile.classId;
    }
  }

  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));

  const [data, total] = await Promise.all([
    Assignment.find(q)
      .populate('classId')
      .populate('subjectId')
      .populate('teacher', 'name role')
      .sort({ dueDate: 1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Assignment.countDocuments(q)
  ]);

  let mySubmissions = [];
  if (studentProfile) {
    mySubmissions = await Submission.find({ student: studentProfile._id });
  }

  const subMap = new Map(mySubmissions.map(s => [String(s.assignment), s]));

  const formattedData = data.map(a => {
    const obj = a.toObject();
    if (studentProfile) {
      const sub = subMap.get(String(a._id));
      obj.submission = sub || null;
      obj.status = sub ? (sub.status === 'Submitted' ? 'Completed' : sub.status) : 'Pending';
    }
    return obj;
  });

  res.json({
    success: true,
    data: formattedData,
    meta: { page, limit, total, pages: Math.ceil(total / limit) }
  });
}

export async function create(req, res) {
  const teacher = req.user.role === 'admin' ? (req.body.teacher || req.user._id) : req.user._id;
  const data = await Assignment.create({ ...req.body, teacher });
  
  // Notify all students in the assigned class that a new assignment is available
  const { notifyUsers } = await import('../services/notification.service.js');
  const Student = (await import('../models/Student.js')).default;
  const classStudents = await Student.find({ classId: data.classId }).select('user');
  const studentUserIds = classStudents.map(s => s.user);
  await notifyUsers(req, studentUserIds, {
    type: 'assignment',
    title: `New Assignment: ${data.title}`,
    text: `A new assignment has been assigned in your class.`,
    link: `/student/assignments/${data._id}`
  }).catch(() => null);
  
  broadcast(req, 'resource:change', { resource: 'assignments', action: 'create', data });
  broadcast(req, 'assignments:created', data);
  res.status(201).json({ success: true, data });
}

export async function submit(req, res) {
  if (!['student'].includes(req.user.role)) return res.status(403).json({ success: false, message: 'Students only' });
  const s = await Student.findOne({ user: req.user._id });
  if (!s) return res.status(404).json({ success: false, message: 'Student profile not found' });
  const a = await Assignment.findById(req.params.id);
  if (!a) return res.status(404).json({ success: false, message: 'Assignment not found' });
  const late = a.dueDate && new Date() > new Date(a.dueDate);
  const data = await Submission.findOneAndUpdate(
    { assignment: a._id, student: s._id },
    { assignment: a._id, student: s._id, submittedAt: new Date(), content: req.body.content || 'Submitted', attachments: req.body.attachments || [], status: late ? 'Late' : 'Submitted' },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  
  // Notify the teacher that a student submitted
  const { notifyUser } = await import('../services/notification.service.js');
  const User = (await import('../models/User.js')).default;
  const student = await Student.findById(s._id).populate('user', 'name');
  await notifyUser(req, a.teacher, {
    type: 'submission',
    title: `New Submission: ${a.title}`,
    text: `${student?.user?.name || 'A student'} submitted the assignment.`,
    link: `/teacher/assignments/${a._id}`
  }).catch(() => null);
  
  broadcast(req, 'resource:change', { resource: 'submissions', action: 'create', data });
  broadcast(req, 'submissions:created', data);
  res.status(201).json({ success: true, data });
}

export async function submissions(req, res) {
  const assignment = await Assignment.findById(req.params.id).select('teacher');
  if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found' });
  if (req.user.role === 'teacher' && String(assignment.teacher) !== String(req.user._id)) {
    return res.status(403).json({ success: false, message: 'Access denied' });
  }
  const data = await Submission.find({ assignment: req.params.id })
    .populate({ path: 'student', populate: { path: 'user', select: 'name email' } })
    .sort({ submittedAt: -1 });
  res.json({ success: true, data });
}

export async function gradeSubmission(req, res) {
  const data = await Submission.findByIdAndUpdate(
    req.params.id,
    { marks: req.body.marks, feedback: req.body.feedback, status: 'Graded' },
    { new: true, runValidators: true }
  )
    .populate({ path: 'student', populate: { path: 'user', select: 'name' } })
    .populate({ path: 'assignment', select: 'title' });
  
  if (!data) return res.status(404).json({ success: false, message: 'Submission not found' });
  
  // Notify the student that their submission was graded
  const { notifyUser } = await import('../services/notification.service.js');
  const studentUserId = data.student?.user?._id;
  if (studentUserId) {
    await notifyUser(req, studentUserId, {
      type: 'graded',
      title: `Assignment Graded: ${data.assignment?.title}`,
      text: `Your submission was graded. Score: ${data.marks}/${req.body.maxMarks || 100}`,
      link: `/student/assignments/${data.assignment?._id}`
    }).catch(() => null);
  }
  
  broadcast(req, 'resource:change', { resource: 'submissions', action: 'update', id: req.params.id, data });
  broadcast(req, 'submissions:updated', data);
  res.json({ success: true, data });
}
