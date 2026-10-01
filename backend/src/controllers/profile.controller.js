import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import Staff from '../models/Staff.js';
import Student from '../models/Student.js';

export async function get(req,res){
  const user = req.user.toJSON ? req.user.toJSON() : {...req.user._doc};
  if (!user.address) {
    const staffRoles = ['teacher','principal','vice_principal'];
    if (staffRoles.includes(user.role)) {
      const staff = await Staff.findOne({user: user._id}).select('address village').lean();
      if (staff?.address) user.address = staff.address;
    } else if (user.role === 'student') {
      const student = await Student.findOne({user: user._id}).select('address village').lean();
      if (student?.address) user.address = student.address;
    }
  }
  res.json({success:true,data:user});
}

export async function update(req,res){
  const allowed=['name','email','phone','address','village','avatar','profile'];
  const patch={};
  for(const k of allowed) if(req.body[k]!==undefined) patch[k]=req.body[k];
  if(patch.email){
    patch.email=String(patch.email).trim().toLowerCase();
    const existing=await User.findOne({email:patch.email,_id:{$ne:req.user._id}});
    if(existing)return res.status(409).json({success:false,message:'That email address is already in use.'});
  }

  const u=await User.findByIdAndUpdate(req.user._id,patch,{new:true,runValidators:true});

  if (u?.role === 'student') {
    await Student.updateOne({ user: req.user._id }, { $set: { address: patch.address ?? '', village: patch.village ?? '' } }, { upsert: true }).catch(() => null);
  } else if (['teacher','principal','vice_principal'].includes(u?.role)) {
    await Staff.updateOne({ user: req.user._id }, { $set: { address: patch.address ?? '', village: patch.village ?? '' } }, { upsert: true }).catch(() => null);
  }

  res.json({success:true,data:u});
}

export async function password(req,res){
  const {currentPassword,newPassword}=req.body;
  if(!currentPassword||!newPassword||newPassword.length<8)return res.status(400).json({success:false,message:'Valid passwords are required'});
  const u=await User.findById(req.user._id);
  if(!await bcrypt.compare(currentPassword,u.passwordHash))return res.status(400).json({success:false,message:'Current password is incorrect'});
  u.passwordHash=await bcrypt.hash(newPassword,12);
  u.refreshTokenHash=undefined;
  await u.save();
  res.json({success:true,message:'Password changed. Please sign in again.'});
}

export async function uploadAvatar(req,res){
  if(!req.file)return res.status(400).json({success:false,message:'Please select an image.'});
  const user=await User.findById(req.user._id);
  if(!user)return res.status(404).json({success:false,message:'User not found.'});
  if(user.avatar && user.avatar.startsWith('/uploads/profiles/')){
    const oldPath=path.join(process.cwd(),user.avatar.replace(/^\//,''));
    try{if(fs.existsSync(oldPath))fs.unlinkSync(oldPath);}catch{}
  }
  user.avatar=`/uploads/profiles/${req.file.filename}`;
  await user.save();
  res.json({success:true,data:user,message:'Profile photo updated.'});
}
