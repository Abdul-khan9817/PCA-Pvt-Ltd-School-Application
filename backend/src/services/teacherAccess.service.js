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

  const [assignedClasses, taughtSubjects] = await Promise.all([
    Class.find({ classTeacher: userId }).select('_id'),
    Subject.find({ teacherIds: userId }).select('_id'),
  ]);

  // Class access comes ONLY from classes the admin assigned to this user
  // as class teacher. Subjects never add extra classes.
  const classIds = assignedClasses.map(item => String(item._id));
  const subjectIds = taughtSubjects.map(item => String(item._id));

  return { classIds, subjectIds };
}

export async function resolveTeacherClassIds(userId) {
  return (await getTeacherAccess(userId)).classIds;
}

export async function resolveClassTeacherIds(userId) {
  const classes = await Class.find({ classTeacher: userId }).select('_id');
  return classes.map(item => String(item._id));
}