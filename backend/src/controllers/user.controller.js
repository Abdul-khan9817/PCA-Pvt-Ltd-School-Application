import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import Student from '../models/Student.js';
import Staff from '../models/Staff.js';
import { broadcast } from '../utils/realtime.js';

export function getLinkedProfileSync(role, data = {}) {
  const payload = data || {};
  const sync = {};

  if (role === 'student') {
    if (payload.classId !== undefined) sync.classId = payload.classId || null;
    if (payload.section !== undefined) sync.section = payload.section || '';
    if (payload.roll !== undefined) sync.roll = payload.roll || '';
    if (payload.cls !== undefined) sync.cls = payload.cls || '';
    if (payload.studentId !== undefined) sync.studentId = payload.studentId || '';
    if (payload.gender !== undefined) sync.gender = payload.gender || '';
    if (payload.dob !== undefined) sync.dob = payload.dob || null;
    if (payload.admissionDate !== undefined) sync.admissionDate = payload.admissionDate || null;
    if (payload.fatherName !== undefined) sync.fatherName = payload.fatherName || '';
    if (payload.motherName !== undefined) sync.motherName = payload.motherName || '';
    if (payload.guardianName !== undefined) sync.guardianName = payload.guardianName || '';
    if (payload.parentPhone !== undefined) sync.parentPhone = payload.parentPhone || '';
    if (payload.address !== undefined) sync.address = payload.address || '';
    if (payload.village !== undefined) sync.village = payload.village || '';
    if (payload.status !== undefined) sync.status = payload.status || 'active';
    if (payload.gpa !== undefined) sync.gpa = Number(payload.gpa) || 0;
  } else if (['teacher', 'principal', 'vice_principal'].includes(role)) {
    if (payload.staffId !== undefined) sync.staffId = payload.staffId || '';
    if (payload.employeeId !== undefined) sync.employeeId = payload.employeeId || '';
    if (payload.designation !== undefined) sync.designation = payload.designation || '';
    if (payload.department !== undefined) sync.department = payload.department || '';
    if (payload.qualification !== undefined) sync.qualification = payload.qualification || '';
    if (payload.experience !== undefined) sync.experience = payload.experience || '';
    if (payload.gender !== undefined) sync.gender = payload.gender || '';
    if (payload.dob !== undefined) sync.dob = payload.dob || null;
    if (payload.joiningDate !== undefined) sync.joiningDate = payload.joiningDate || null;
    if (payload.address !== undefined) sync.address = payload.address || '';
    if (payload.village !== undefined) sync.village = payload.village || '';
    if (payload.status !== undefined) sync.status = payload.status || 'active';
  }

  return sync;
}

export async function syncLinkedProfileRecord(req, userId, role, data = {}) {
  const sync = getLinkedProfileSync(role, data);
  if (!Object.keys(sync).length) return null;

  if (role === 'student') {
    return Student.updateOne({ user: userId }, { $set: sync }, { upsert: true });
  }

  if (['teacher', 'principal', 'vice_principal'].includes(role)) {
    return Staff.updateOne({ user: userId }, { $set: sync }, { upsert: true });
  }

  return null;
}

export async function list(req,res){
  const search=String(req.query.q||'').trim().replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const q=search?{$or:[{name:new RegExp(search,'i')},{email:new RegExp(search,'i')}]}:{};
  const page=Math.max(1,Number(req.query.page)||1),limit=Math.min(100,Math.max(1,Number(req.query.limit)||20));
  const [users,total]=await Promise.all([
    User.find(q).select('-passwordHash -refreshTokenHash').sort({createdAt:-1}).skip((page-1)*limit).limit(limit),
    User.countDocuments(q)
  ]);
  res.json({success:true,data:users,meta:{page,limit,total,pages:Math.ceil(total/limit)}});
}

export async function get(req,res){
  const u=await User.findById(req.params.id).select('-passwordHash -refreshTokenHash');
  if(!u)return res.status(404).json({success:false,message:'User not found'});
  res.json({success:true,data:u});
}

export async function create(req,res){
  const {password,email,role,...data}=req.body;
  if(!password||password.length<8)return res.status(400).json({success:false,message:'Password must be at least 8 characters'});
  if(!email||!role)return res.status(400).json({success:false,message:'Name, email and role are required'});
  const allowed=['admin','principal','vice_principal','teacher','student','parent'];
  if(!allowed.includes(role))return res.status(400).json({success:false,message:'Invalid role'});
  try{
    const u=await User.create({...data,email:email.toLowerCase().trim(),role,passwordHash:await bcrypt.hash(password,12)});

    if (role === 'student') {
      await syncLinkedProfileRecord(req, u._id, 'student', data);
    } else if (['teacher', 'principal', 'vice_principal'].includes(role)) {
      await syncLinkedProfileRecord(req, u._id, role, data);
    }

    const safeUser=u.toObject();delete safeUser.passwordHash;delete safeUser.refreshTokenHash;
    broadcast(req,'resource:change',{resource:'users',action:'create',data:safeUser});
    broadcast(req,'users:created',safeUser);
    res.status(201).json({success:true,data:safeUser});
  }catch(e){
    if(e?.code===11000)return res.status(409).json({success:false,message:'An account with this email already exists'});
    throw e;
  }
}

export async function createStaffAccount(req,res){
  const {name,email,phone,department,qualification,experience,address,village}=req.body;
  const normalizedEmail=String(email||'').trim().toLowerCase();
  if(!name||!normalizedEmail)return res.status(400).json({success:false,message:'Name and email are required'});
  try{
    let user=await User.findOne({email:normalizedEmail});
    if(user&&user.role!=='teacher')return res.status(409).json({success:false,message:'This email already belongs to a non-teacher account'});
    if(user){
      const existing=await Staff.findOne({user:user._id});
      if(existing)return res.status(409).json({success:false,message:'This staff member already exists'});
      if(user.status!=='active')return res.status(400).json({success:false,message:'This account is inactive'});
    }else{
      user=await User.create({name, email:normalizedEmail, phone, address: address || '', passwordHash:await bcrypt.hash('Welcome@123',12), role:'teacher', status:'active'});
    }
    const staff=await Staff.create({user:user._id,designation:'Subject Teacher',department,qualification,experience,address: address || '', village: village || '',status:'active'});
    const data=await Staff.findById(staff._id).populate('user','name email phone status role');
    broadcast(req,'resource:change',{resource:'staff',action:'create',data});
    broadcast(req,'staff:created',data);
    res.status(201).json({success:true,data});
  }catch(e){
    if(e?.code===11000)return res.status(409).json({success:false,message:'A staff account with this email or employee ID already exists'});
    res.status(400).json({success:false,message:e.message||'Staff creation failed'});
  }
}

async function emitLinkedRecordUpdate(req, userId, role) {
  try {
    const userDoc = await User.findById(userId).select('-passwordHash -refreshTokenHash');
    if (role === 'student') {
      const rec = await Student.findOne({ user: userId }).populate('user classId guardianIds');
      if (rec) {
        const payload = rec.toObject();
        if (userDoc) {
          payload.user = userDoc.toObject();
          payload.status = userDoc.status || rec.status;
        }
        broadcast(req, 'resource:change', { resource: 'students', action: 'update', id: String(rec._id), data: payload });
        broadcast(req, 'students:updated', payload);
      }
    } else if (['teacher','principal','vice_principal'].includes(role)) {
      const rec = await Staff.findOne({ user: userId }).populate('user assignedClassIds subjectIds');
      if (rec) {
        const payload = rec.toObject();
        if (userDoc) {
          payload.user = userDoc.toObject();
          payload.status = userDoc.status || rec.status;
        }
        broadcast(req, 'resource:change', { resource: 'staff', action: 'update', id: String(rec._id), data: payload });
        broadcast(req, 'staff:updated', payload);
      }
    }
  } catch(_) { /* non-fatal */ }
}

export async function update(req,res){
  const data={...req.body};
  if(data.password){data.passwordHash=await bcrypt.hash(data.password,12);delete data.password;}
  delete data.refreshTokenHash;
  const u=await User.findByIdAndUpdate(req.params.id,data,{new:true,runValidators:true}).select('-passwordHash -refreshTokenHash');
  if(!u)return res.status(404).json({success:false,message:'User not found'});

  // Sync status to linked student or staff records
  if (data.status) {
    await Student.updateMany({ user: req.params.id }, { status: data.status }).catch(() => null);
    await Staff.updateMany({ user: req.params.id }, { status: data.status }).catch(() => null);
  }

  // Sync role-specific profile fields to the linked Student/Staff record as well.
  // The dashboard and role pages read from the linked document, so address and
  // other fields must be kept in sync there too.
  const linkSync = getLinkedProfileSync(u.role, data);
  if (u.role === 'student' && Object.keys(linkSync).length) {
    await Student.updateMany({ user: req.params.id }, { $set: linkSync }).catch(() => null);
  } else if (['teacher','principal','vice_principal'].includes(u.role) && Object.keys(linkSync).length) {
    await Staff.updateMany({ user: req.params.id }, { $set: linkSync }).catch(() => null);
  }

  broadcast(req,'resource:change',{resource:'users',action:'update',id:req.params.id,data:u});
  broadcast(req,'users:updated',u);
  emitLinkedRecordUpdate(req, req.params.id, u.role);
  res.json({success:true,data:u});
}

export async function remove(req,res){
  const u=await User.findByIdAndUpdate(req.params.id,{status:'inactive'},{new:true}).select('-passwordHash -refreshTokenHash');
  if(!u)return res.status(404).json({success:false,message:'User not found'});
  await Student.updateMany({ user: req.params.id }, { status: 'inactive' }).catch(() => null);
  await Staff.updateMany({ user: req.params.id }, { status: 'inactive' }).catch(() => null);
  broadcast(req,'resource:change',{resource:'users',action:'update',id:req.params.id,data:u});
  broadcast(req,'users:updated',u);
  emitLinkedRecordUpdate(req, req.params.id, u.role);
  res.json({success:true,message:'User deactivated'});
}

export async function removePermanent(req,res){
  const existing=await User.findById(req.params.id).select('role');
  const u=await User.findByIdAndDelete(req.params.id).select('-passwordHash -refreshTokenHash');
  if(!u)return res.status(404).json({success:false,message:'User not found'});
  broadcast(req,'resource:change',{resource:'users',action:'delete',id:req.params.id,data:u});
  broadcast(req,'users:deleted',{id:req.params.id,data:u});
  {
    const role = existing?.role || u.role;
    try {
      if (role === 'student') {
        // FIX: this used to only findOne + broadcast a fake "deleted" event —
        // the Student document itself was never removed, so it kept showing
        // up in lists (with a dangling `user` reference) after "deletion".
        const rec = await Student.findOneAndDelete({ user: req.params.id });
        if (rec) {
          broadcast(req, 'resource:change', { resource: 'students', action: 'delete', id: String(rec._id), data: rec });
          broadcast(req, 'students:deleted', { id: String(rec._id), data: rec });
        }
      } else if (['teacher','principal','vice_principal'].includes(role)) {
        // FIX: same issue for Staff — actually delete it, don't just fake the event.
        const rec = await Staff.findOneAndDelete({ user: req.params.id });
        if (rec) {
          broadcast(req, 'resource:change', { resource: 'staff', action: 'delete', id: String(rec._id), data: rec });
          broadcast(req, 'staff:deleted', { id: String(rec._id), data: rec });
        }
      }
    } catch(_) { /* non-fatal */ }
  }
  res.json({success:true,message:'User permanently deleted'});
}