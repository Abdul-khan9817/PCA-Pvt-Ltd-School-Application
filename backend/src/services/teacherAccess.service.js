import Class from '../models/Class.js';
import Subject from '../models/Subject.js';

export async function getTeacherAccess(userId, role = 'teacher') {
  if (role === 'admin') {
    const [classes, subjects] = await Promise.all([
      Class.find({}).select('_id'),
      Subject.find({}).select('_id'),
    ]);
    return {
      classIds: classes.map(item => String(item._id)),
      subjectIds: subjects.map(item => String(item._id)),
    };
  }

  const [classesAsClassTeacher, taughtSubjects] = await Promise.all([
    Class.find({ classTeacher: userId }).select('_id'),
    Subject.find({ teacherIds: userId }).select('_id classIds'),
  ]);

  const classIds = new Set(classesAsClassTeacher.map(item => String(item._id)));
  const subjectIds = new Set(taughtSubjects.map(item => String(item._id)));
  for (const subject of taughtSubjects) {
    for (const classId of subject.classIds || []) classIds.add(String(classId));
  }

  return { classIds: [...classIds], subjectIds: [...subjectIds] };
}

export async function resolveTeacherClassIds(userId) {
  return (await getTeacherAccess(userId)).classIds;
}

export async function resolveClassTeacherIds(userId) {
  const classes = await Class.find({ classTeacher: userId }).select('_id');
  return classes.map(item => String(item._id));
}