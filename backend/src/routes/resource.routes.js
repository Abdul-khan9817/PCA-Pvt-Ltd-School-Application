import {Router} from 'express';
import {protect,authorize} from '../middleware/auth.js';
import {makeCrud} from '../controllers/generic.controller.js';

import Student from '../models/Student.js';
import Staff from '../models/Staff.js';
import Class from '../models/Class.js';
import Subject from '../models/Subject.js';
import Fee from '../models/Fee.js';
import {monthKey,normType} from '../utils/duplicates.js';
import Payroll from '../models/Payroll.js';
import Leave from '../models/Leave.js';
import Timetable from '../models/Timetable.js';
import Announcement from '../models/Announcement.js';
import { resolveTeacherClassIds, resolveClassTeacherIds } from '../services/teacherAccess.service.js';

const roleMap={
	admin:['admin'],
	manage:['admin','principal','vice_principal','teacher'],
	teacher:['admin','principal','vice_principal','teacher'],
	academic:['admin','principal','vice_principal','teacher'],
	finance:['admin','principal','vice_principal'],
	all:['admin','principal','vice_principal','teacher','student','parent']
};

/**
 * Classes a teacher can access, computed LIVE from the two places an admin
 * actually assigns a teacher: Class.classTeacher and Subject.teacherIds.
 *
 * We intentionally do NOT read Staff.assignedClassIds/subjectIds here.
 * Those fields are only kept as a denormalized, best-effort mirror for
 * display (see syncClassTeacherAssignment / syncSubjectTeacherAssignment
 * below) and they only ever get ADDED to, never fully cleaned up when a
 * teacher is reassigned away from a class or a subject. Using them for
 * authorization let old assignments "stick" forever — e.g. a teacher who
 * used to teach a subject spanning many classes would keep seeing all of
 * those classes even after being unassigned. Deriving live from the
 * source-of-truth relations makes that class of bug impossible.
 */
async function studentScope(req,q){
	if(req.user.role==='teacher'){
		const classIds=await resolveTeacherClassIds(req.user._id);
		q.classId={$in:classIds};
	}

	if(req.user.role==='student'){
		const student=await Student.findOne({user:req.user._id}).select('_id');
		q._id=student?._id||null;
	}

	if(req.user.role==='parent'){
		const students=await Student.find({guardianIds:req.user._id}).select('_id');
		q._id={$in:students.map(item=>item._id)};
	}
}

async function classScope(req,q){
	if(req.user.role==='teacher'){
		const classIds=await resolveTeacherClassIds(req.user._id);
		q._id={$in:classIds};
	}
}

async function subjectScope(req,q){
	if(req.user.role==='teacher'){
		// Class teachers see subjects for the classes they are CURRENTLY the
		// class teacher of; subject teachers see subjects they are CURRENTLY
		// listed on directly. Both computed live — see resolveTeacherClassIds.
		const classIds=await resolveClassTeacherIds(req.user._id);
		q.$or=[
			{teacherIds:req.user._id},
			...(classIds.length?[{classIds:{$in:classIds}}]:[])
		];
	}
}

async function timetableScope(req,q){
	if(req.user.role==='student'){
		const student=await Student.findOne({user:req.user._id}).select('classId');
		q.classId=student?.classId||null;
	}

	if(req.user.role==='teacher'){
		const classIds=await resolveTeacherClassIds(req.user._id);
		q.$or=[
			{classId:{$in:classIds}},
			{teacher:req.user._id}
		];
	}
}

async function validateTimetableSlot(payload, currentId) {
	if (!payload.classId || !payload.day || !payload.startTime || !payload.endTime) return;
	if (payload.endTime <= payload.startTime) {
		throw new Error('End time must be after start time');
	}

	const query = {
		classId: payload.classId,
		day: payload.day,
		startTime: { $lt: payload.endTime },
		endTime: { $gt: payload.startTime }
	};
	if (currentId) query._id = { $ne: currentId };

	if (await Timetable.exists(query)) {
		throw new Error('This class already has an overlapping timetable slot on this day');
	}
}

async function staffRecordScope(req,q){
	if(req.user.role==='teacher'){
		const staff=await Staff.findOne({user:req.user._id}).select('_id');
		q._id=staff?._id||null;
	}
}

async function feeScope(req,q){
	if(req.user.role==='student'){
		const student=await Student.findOne({user:req.user._id}).select('_id');
		q.student=student?._id||null;
	}

	if(req.user.role==='parent'){
		const students=await Student.find({guardianIds:req.user._id}).select('_id');
		q.student={$in:students.map(item=>item._id)};
	}
}


/* =========================================================
   CLASS / SUBJECT TEACHER -> STAFF ASSIGNMENT SYNC
   ========================================================= */

async function syncClassTeacherAssignment(classDoc,_req,previous){

	const classId=classDoc._id;

	const newTeacherId=classDoc.classTeacher
		? String(classDoc.classTeacher)
		: null;

	const oldTeacherId=previous?.classTeacher
		? String(previous.classTeacher)
		: null;


	// If the class teacher was changed,
	// remove this class from the previous teacher.
	if(oldTeacherId && oldTeacherId!==newTeacherId){

		await Staff.findOneAndUpdate(
			{user:oldTeacherId},
			{$pull:{assignedClassIds:classId}}
		);

	}


	// Add this class to the new teacher.
	// $addToSet prevents duplicate class IDs.
	if(newTeacherId){

		await Staff.findOneAndUpdate(
			{user:newTeacherId},
			{$addToSet:{assignedClassIds:classId}}
		);

		// Also grant subjects linked to this class so grades/subjects APIs resolve for class teachers
		const classSubjects=await Subject.find({classIds:classId}).select('_id');
		if(classSubjects.length){
			await Staff.findOneAndUpdate(
				{user:newTeacherId},
				{$addToSet:{subjectIds:{$each:classSubjects.map(s=>s._id)}}}
			);
		}

	}
}

/** Keep Staff.assignedClassIds + subjectIds in sync when admin assigns subject teachers */
async function syncSubjectTeacherAssignment(subjectDoc,_req,previous){
	const subjectId=subjectDoc._id;
	const classIds=(subjectDoc.classIds||[]).map(id=>String(id));
	const newTeacherIds=new Set((subjectDoc.teacherIds||[]).map(id=>String(id)));
	const oldTeacherIds=new Set((previous?.teacherIds||[]).map(id=>String(id)));

	const removed=[...oldTeacherIds].filter(id=>!newTeacherIds.has(id));
	for(const teacherId of removed){
		await Staff.findOneAndUpdate(
			{user:teacherId},
			{$pull:{subjectIds:subjectId}}
		);
	}

	for(const teacherId of newTeacherIds){
		await Staff.findOneAndUpdate(
			{user:teacherId},
			{
				$addToSet:{
					subjectIds:subjectId,
					assignedClassIds:{$each:classIds}
				}
			}
		);
	}
}


/* =========================================================
   GENERIC RESOURCE ROUTES
   ========================================================= */

export function resourceRoutes(Model,readRoles,writeRoles,options={}){

	const r=Router();

	const c=makeCrud(Model,options);

	r.use(protect);

	r.get(
		'/',
		authorize(...roleMap[readRoles]),
		c.list
	);

	if(options.summary)
		r.get(
			'/summary',
			authorize(...roleMap[readRoles]),
			options.summary
		);

	if(options.assignClass)
		r.patch(
			'/assign-class',
			authorize('admin'),
			options.assignClass
		);

	r.get(
		'/:id',
		authorize(...roleMap[readRoles]),
		c.get
	);

	r.post(
		'/',
		authorize(...roleMap[writeRoles]),
		c.create
	);

	r.patch(
		'/:id',
		authorize(...roleMap[writeRoles]),
		c.update
	);

	r.delete(
		'/:id',
		authorize('admin'),
		c.remove
	);

	return r;
}


/* =========================================================
   STUDENT SUMMARY
   ========================================================= */

async function studentSummary(req,res){

	const match={status:'active'};

	if(req.user.role==='teacher'){
		const classIds=await resolveTeacherClassIds(req.user._id);
		match.classId={ $in:classIds };
	}

	const data=await Student.aggregate([
		{$match:match},
		{
			$group:{
				_id:'$classId',
				count:{$sum:1}
			}
		}
	]);

	res.json({
		success:true,
		data:data.map(item=>({
			_id:String(item._id),
			count:item.count
		}))
	});
}


/* =========================================================
   STUDENTS BY GRADE
   ========================================================= */

async function studentsByGrade(req,res){

	const classes=await Class.find({
		gradeLevel:req.params.gradeLevel,
		status:'active'
	}).select('_id');

	const data=await Student.find({
		classId:{
			$in:classes.map(item=>item._id)
		},
		status:'active'
	})
	.populate('user','name email')
	.populate('classId','name section gradeLevel')
	.sort({roll:1})
	.limit(500);

	res.json({
		success:true,
		data
	});
}


/* =========================================================
   ASSIGN STUDENTS TO CLASS
   ========================================================= */

async function assignStudentsToClass(req,res){

	const {classId,studentIds=[]}=req.body;

	if(
		!classId ||
		!Array.isArray(studentIds)
	){
		return res.status(400).json({
			success:false,
			message:'classId and studentIds are required'
		});
	}

	const classDoc=await Class.findById(classId)
		.select('name section capacity');

	if(!classDoc){

		return res.status(404).json({
			success:false,
			message:'Selected class does not exist'
		});

	}

	const ids=[
		...new Set(
			studentIds.map(String)
		)
	];

	const current=await Student.countDocuments({
		classId,
		status:'active',
		_id:{$nin:ids}
	});

	if(
		current+ids.length>
		(classDoc.capacity||100)
	){

		return res.status(400).json({
			success:false,
			message:`This section cannot contain more than ${classDoc.capacity||100} students.`
		});

	}

	await Student.updateMany(
		{
			_id:{$in:ids},
			status:'active'
		},
		{
			$set:{
				classId,
				cls:classDoc.name,
				section:classDoc.section
			}
		}
	);

	const io=req.app.get('io');

	if(io)
		io.emit(
			'resource:change',
			{
				resource:'students',
				action:'update'
			}
		);

	res.json({
		success:true,
		data:{
			classId,
			studentIds:ids,
			count:ids.length
		}
	});
}


/* =========================================================
   ROUTES
   ========================================================= */

export const studentRoutes=resourceRoutes(
	Student,
	'teacher',
	'admin',
	{
		resource:'students',
		populate:[
			'user',
			'classId',
			'guardianIds'
		],
		searchFields:['roll'],
		filterFields:['classId','status'],
		summary:studentSummary,
		enforceCapacity:true,
		assignClass:assignStudentsToClass,
		scope:studentScope
	}
);

studentRoutes.get(
	'/grade/:gradeLevel',
	authorize(...roleMap.teacher),
	studentsByGrade
);


export const staffRoutes=resourceRoutes(
	Staff,
	'manage',
	'admin',
	{
		resource:'staff',
		populate:[
			'user',
			'assignedClassIds',
			'subjectIds'
		],
		searchFields:[
			'employeeId',
			'designation',
			'department'
		],
		scope:staffRecordScope
	}
);


/* =========================================================
   CLASS ROUTES
   ========================================================= */

export const classRoutes=resourceRoutes(
	Class,
	'manage',
	'admin',
	{
		resource:'classes',
		populate:['classTeacher'],
		searchFields:[
			'name',
			'section',
			'gradeLevel'
		],
		sort:{
			gradeLevelOrder:1,
			section:1,
			name:1,
			createdAt:1
		},
		scope:classScope,

		// NEW:
		// Whenever classTeacher is created or changed,
		// keep Staff.assignedClassIds synchronized.
		afterSave:syncClassTeacherAssignment
	}
);


export const subjectRoutes=resourceRoutes(
	Subject,
	'manage',
	'admin',
	{
		resource:'subjects',
		populate:[
			'classIds',
			'teacherIds'
		],
		searchFields:[
			'name',
			'code'
		],
		scope:subjectScope,
		afterSave:syncSubjectTeacherAssignment
	}
);


/* A student can only have ONE fee of each type per month (e.g. one "Tuition" for "September 2026").
   Only checked when the student / month / type is new or actually being changed, so existing
   records (including older duplicates) can still be edited and marked as paid. */
async function validateFeeUnique(payload,currentId){
	if(!payload?.student||!payload?.month) return;
	const key=monthKey(payload.month),type=normType(payload.type);
	if(currentId){
		const cur=await Fee.findById(currentId).select('student month type').lean();
		if(cur&&String(cur.student)===String(payload.student)&&monthKey(cur.month)===key&&normType(cur.type)===type) return;
	}
	const siblings=await Fee.find({student:payload.student}).select('month type').lean();
	const dup=siblings.find(f=>String(f._id)!==String(currentId||'')&&monthKey(f.month)===key&&normType(f.type)===type);
	if(dup) throw new Error(`${payload.type||'This'} fee for ${payload.month} is already assigned to this student. Edit the existing record instead.`);
}

export const feeRoutes=resourceRoutes(
	Fee,
	'all',
	'admin',
	{
		resource:'fees',
		populate:[
			{
				path:'student',
				populate:{
					path:'user',
					select:'name email'
				}
			}
		],
		filterFields:[
			'student',
			'status',
			'type'
		],
		scope:feeScope,
		validate:validateFeeUnique
	}
);


export const payrollRoutes=resourceRoutes(
	Payroll,
	'finance',
	'admin',
	{
		resource:'payroll',
		populate:['staff'],
		filterFields:[
			'staff',
			'status',
			'month'
		]
	}
);


export const leaveRoutes=resourceRoutes(
	Leave,
	'all',
	'admin',
	{
		resource:'leaves',
		scope:async(req,q)=>{
			if(req.user.role==='student'){
				q.user=req.user._id;
			}
			if(req.user.role==='parent'){
				const students=await Student.find({guardianIds:req.user._id}).select('user');
				q.user={$in:students.map(student=>student.user)};
			}
		},
		populate:[
			'user',
			'reviewedBy'
		],
		filterFields:[
			'user',
			'status'
		]
	}
);


export const timetableRoutes=resourceRoutes(
	Timetable,
	'all',
	'admin',
	{
		resource:'timetable',
		populate:[
			'classId',
			'subjectId',
			'teacher'
		],
		filterFields:[
			'classId',
			'teacher',
			'day'
		],
		scope:timetableScope,
		validate:validateTimetableSlot
	}
);


export const announcementRoutes=resourceRoutes(
	Announcement,
	'all',
	'admin',
	{
		resource:'announcements',
		populate:['publishedBy'],
		filterFields:['status']
	}
);
