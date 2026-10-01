import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import User from '../models/User.js';
import Staff from '../models/Staff.js';
import Student from '../models/Student.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/tokens.js';
import { env } from '../config/env.js';
import { sendPasswordResetOtp } from '../services/mail.service.js';

const cookieOpts={httpOnly:true,sameSite:'lax',secure:env.cookieSecure,maxAge:7*24*60*60*1000};

export async function login(req,res){
  const {email,password}=req.body;
  const user=await User.findOne({email:email?.toLowerCase()});
  if(!user||!(await bcrypt.compare(password||'',user.passwordHash))||user.status!=='active') return res.status(401).json({success:false,message:'Invalid credentials'});
  const accessToken=signAccessToken(user), refreshToken=signRefreshToken(user);
  user.refreshTokenHash=await bcrypt.hash(refreshToken,10);user.lastLoginAt=new Date(); await user.save();
  res.cookie('refreshToken',refreshToken,cookieOpts);
  res.json({success:true,data:{user,accessToken,role:user.role}});
}

export async function refresh(req,res){
  try{
    const token=req.cookies.refreshToken||req.body.refreshToken;
    if(!token) return res.status(401).json({success:false,message:'Refresh token required'});
    const payload=verifyRefreshToken(token); const user=await User.findById(payload.sub);
    if(!user?.refreshTokenHash||user.status!=='active'||!(await bcrypt.compare(token,user.refreshTokenHash))) throw new Error('Invalid refresh token');
    const accessToken=signAccessToken(user); const next=signRefreshToken(user); user.refreshTokenHash=await bcrypt.hash(next,10); await user.save();
    res.cookie('refreshToken',next,cookieOpts); res.json({success:true,data:{accessToken,user}});
  }catch{return res.status(401).json({success:false,message:'Invalid or expired refresh token'});}
}

export async function logout(req,res){if(req.user){req.user.refreshTokenHash=null;await req.user.save();} res.clearCookie('refreshToken',cookieOpts);res.json({success:true,message:'Logged out'});}
export async function me(req,res){
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

export async function changePassword(req,res){
  const {currentPassword,newPassword}=req.body;
  if(!newPassword||newPassword.length<8)return res.status(400).json({success:false,message:'New password must be at least 8 characters'});
  if(!(await bcrypt.compare(currentPassword||'',req.user.passwordHash)))return res.status(400).json({success:false,message:'Current password is incorrect'});
  req.user.passwordHash=await bcrypt.hash(newPassword,12);req.user.refreshTokenHash=null;await req.user.save();res.json({success:true,message:'Password updated. Please log in again.'});
}

/* ── Forgot password: generate & email a 6-digit OTP ── */
export async function forgotPassword(req,res){
  const email=String(req.body.email||'').trim().toLowerCase();
  if(!email) return res.status(400).json({success:false,message:'Email address is required'});
  const user=await User.findOne({email});
  const generic='If an account exists for that email, a verification code has been sent.';
  if(!user||user.status!=='active') return res.json({success:true,message:generic});

  const otp=String(crypto.randomInt(100000,999999));
  user.resetTokenHash=crypto.createHash('sha256').update(otp).digest('hex');
  user.resetTokenExpiresAt=new Date(Date.now()+10*60*1000);
  await user.save();

  const emailed=await sendPasswordResetOtp({to:user.email,name:user.name,otp});
  const response={success:true,message:generic,delivery:emailed?'email':'development'};
  if(!emailed&&env.nodeEnv!=='production') response.devOtp=otp;
  res.json(response);
}

/* ── Verify OTP + set new password in one step ── */
export async function resetPassword(req,res){
  const email=String(req.body.email||'').trim().toLowerCase();
  const {otp,newPassword}=req.body;
  if(!email||!otp||!newPassword||newPassword.length<8) return res.status(400).json({success:false,message:'Email, code and a password of at least 8 characters are required'});
  const hash=crypto.createHash('sha256').update(String(otp)).digest('hex');
  const user=await User.findOne({email,resetTokenHash:hash,resetTokenExpiresAt:{$gt:new Date()},status:'active'});
  if(!user) return res.status(400).json({success:false,message:'This code is invalid or has expired'});
  user.passwordHash=await bcrypt.hash(newPassword,12);user.refreshTokenHash=null;user.resetTokenHash=null;user.resetTokenExpiresAt=null;await user.save();
  res.json({success:true,message:'Password reset successfully. You can now sign in.'});
}