import User from '../models/User.js';
import Student from '../models/Student.js';
import Staff from '../models/Staff.js';
import Attendance from '../models/Attendance.js';
import Fee from '../models/Fee.js';
import Grade from '../models/Grade.js';
import Assignment from '../models/Assignment.js';
import Announcement from '../models/Announcement.js';
import Class from '../models/Class.js';
import { resolveTeacherClassIds } from '../services/teacherAccess.service.js';

// Computed live from Class.classTeacher + Subject.teacherIds — see the
// matching comment in resource.routes.js for why we don't read
// Staff.assignedClassIds/subjectIds here (it drifts and never fully clears).
export async function stats(req, res) {
  const role = req.user.role;

  if (role === 'admin') {
    const [
      users,
      students,
      staff,
      classes,
      attendanceTotal,
      attendancePresent,
      fees,
      gradeDistribution,
      gradedStudentsCount,
      enrollmentByGrade,
      notices
    ] = await Promise.all([
      User.countDocuments({ status: 'active' }),
      Student.countDocuments({ status: 'active' }),
      Staff.countDocuments({ status: 'active' }),
      Class.countDocuments({ status: 'active' }),
      Attendance.countDocuments(),
      Attendance.countDocuments({ status: 'Present' }),
      Fee.aggregate([{ $group: { _id: null, total: { $sum: '$amount' }, paid: { $sum: '$paid' } } }]),
      // Grade distribution by letter grade — used for the GPA donut chart bands
      Grade.aggregate([{ $group: { _id: '$grade', count: { $sum: 1 } } }]),
      // Honest distinct-student count — how many unique students have at least one grade
      Grade.aggregate([{ $group: { _id: '$student' } }, { $count: 'total' }]),
      // Enrollment by grade level — lookup class and resolve grade level robustly
      Student.aggregate([
        { $match: { status: 'active' } },
        { $lookup: { from: 'classes', localField: 'classId', foreignField: '_id', as: 'class' } },
        { $unwind: { path: '$class', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            resolvedGrade: {
              $let: {
                vars: {
                  rawGrade: { $ifNull: ['$class.gradeLevel', ''] },
                  rawName: { $ifNull: ['$class.name', { $ifNull: ['$cls', ''] }] }
                },
                in: {
                  $cond: [
                    { $ne: ['$$rawGrade', ''] },
                    '$$rawGrade',
                    {
                      $cond: [
                        { $regexMatch: { input: '$$rawName', regex: /nursery/i } }, 'Nursery',
                        {
                          $cond: [
                            { $regexMatch: { input: '$$rawName', regex: /lkg/i } }, 'LKG',
                            {
                              $cond: [
                                { $regexMatch: { input: '$$rawName', regex: /ukg/i } }, 'UKG',
                                {
                                  $cond: [
                                    { $regexMatch: { input: '$$rawName', regex: /\d+/ } },
                                    {
                                      $let: {
                                        vars: { found: { $regexFind: { input: '$$rawName', regex: /\d+/ } } },
                                        in: '$$found.match'
                                      }
                                    },
                                    {
                                      $cond: [
                                        { $ne: ['$$rawName', ''] },
                                        '$$rawName',
                                        'Unassigned'
                                      ]
                                    }
                                  ]
                                }
                              ]
                            }
                          ]
                        }
                      ]
                    }
                  ]
                }
              }
            }
          }
        },
        { $group: { _id: '$resolvedGrade', count: { $sum: 1 } } },
        { $sort: { _id: 1 } }
      ]),
      Announcement.countDocuments({ status: 'Published' })
    ]);

    const attendance = {
      total: attendanceTotal,
      present: attendancePresent,
      percentage: attendanceTotal ? Math.round((attendancePresent / attendanceTotal) * 100) : 0
    };

    return res.json({
      success: true,
      data: {
        role,
        users,
        students,
        staff,
        classes,
        attendance,
        fees: fees[0] || { total: 0, paid: 0 },
        gradeDistribution,
        gradedStudentsCount: gradedStudentsCount[0]?.total || 0,
        enrollmentByGrade,
        notices
      }
    });
  }

  if (['teacher', 'principal', 'vice_principal'].includes(role)) {
    const staff = await Staff.findOne({ user: req.user._id });
    const classIds = await resolveTeacherClassIds(req.user._id);

    const [classes, students, assignments, attendanceTotal, attendancePresent, classStudentCounts] = await Promise.all([
      Class.countDocuments({ _id: { $in: classIds } }),
      Student.countDocuments({ classId: { $in: classIds }, status: 'active' }),
      Assignment.countDocuments({ teacher: req.user._id }),
      Attendance.countDocuments({ classId: { $in: classIds } }),
      Attendance.countDocuments({ classId: { $in: classIds }, status: 'Present' }),
      Student.aggregate([
        { $match: { classId: { $in: classIds }, status: 'active' } },
        { $group: { _id: '$classId', count: { $sum: 1 } } }
      ])
    ]);

    const attendance = {
      total: attendanceTotal,
      present: attendancePresent,
      percentage: attendanceTotal ? Math.round((attendancePresent / attendanceTotal) * 100) : 0,
    };

    return res.json({
      success: true,
      data: { role, classes, students, assignments, attendance, classStudentCounts, staff: staff ? 1 : 0 }
    });
  }

  const student = await Student.findOne(
    role === 'student' ? { user: req.user._id } : { guardianIds: req.user._id }
  ).populate('classId');

  const students = role === 'parent'
    ? await Student.find({ guardianIds: req.user._id }).populate('classId user', 'name email')
    : [];

  const ids = role === 'parent' ? students.map(s => s._id) : (student ? [student._id] : []);

  const [attendanceTotal, attendancePresent, grades, fees, assignments] = await Promise.all([
    Attendance.countDocuments({ student: { $in: ids } }),
    Attendance.countDocuments({ student: { $in: ids }, status: 'Present' }),
    Grade.find({ student: { $in: ids }, subjectId: { $ne: null } }).populate('subjectId', 'name').sort({ createdAt: -1 }).limit(20),
    Fee.find({ student: { $in: ids } }).sort({ dueDate: 1 }),
    Assignment.find(student?.classId ? { classId: student.classId._id } : {}).sort({ dueDate: 1 }).limit(10)
  ]);

  const attendance = {
    present: attendancePresent,
    total: attendanceTotal,
    percentage: attendanceTotal ? Math.round((attendancePresent / attendanceTotal) * 100) : 0
  };

  res.json({ success: true, data: { role, student, students, attendance, grades, fees, assignments } });
}