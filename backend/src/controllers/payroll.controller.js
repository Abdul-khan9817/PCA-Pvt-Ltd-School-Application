import Payroll from '../models/Payroll.js';
import Staff from '../models/Staff.js';
import User from '../models/User.js';
import {monthKey} from '../utils/duplicates.js';

export async function staffOptions(req,res){
  const users=await User.find({role:{$in:['principal','vice_principal','teacher']},status:'active'}).select('name email phone role').sort({name:1});
  const existing=await Staff.find({user:{$in:users.map(user=>user._id)}}).populate('user','name email phone role');
  const byUser=new Map(existing.map(staff=>[String(staff.user?._id||staff.user),staff]));
  const data=[];
  for(const user of users){
    let staff=byUser.get(String(user._id));
    if(!staff){
      const designation=user.role==='principal'?'Principal':user.role==='vice_principal'?'Vice Principal':'Subject Teacher';
      staff=await Staff.create({user:user._id,designation,status:'active'});
      staff=await staff.populate('user','name email phone role');
    }
    data.push(staff);
  }
  res.json({success:true,data});
}

export async function list(req,res){
  const q={};
  if(['teacher', 'principal', 'vice_principal'].includes(req.user.role)){
    const staff=await Staff.findOne({user:req.user._id}).select('_id');
    q.staff=staff?._id||null;
  } else if(req.query.staff) q.staff=req.query.staff;
  if(req.query.status) q.status=req.query.status;
  if(req.query.month) q.month=req.query.month;
  const page=Math.max(1,Number(req.query.page)||1),limit=Math.min(1000,Math.max(1,Number(req.query.limit)||20));
  const [data,total]=await Promise.all([
    Payroll.find(q).populate({path:'staff',populate:{path:'user',select:'name email phone'}}).sort({createdAt:-1}).skip((page-1)*limit).limit(limit),
    Payroll.countDocuments(q)
  ]);
  res.json({success:true,data,meta:{page,limit,total,pages:Math.ceil(total/limit)}});
}
// One payroll record per staff member per month ("Sep 2026" and "September 2026" count as the same month).
async function findDuplicate(staff,month,exceptId){
  if(!staff||!month) return null;
  const key=monthKey(month);
  const others=await Payroll.find({staff}).select('month');
  return others.find(p=>String(p._id)!==String(exceptId||'')&&monthKey(p.month)===key)||null;
}
const duplicateMessage=month=>`Payroll for ${month} already exists for this staff member. Edit the existing record instead.`;

export async function create(req,res){
  if(await findDuplicate(req.body.staff,req.body.month)) return res.status(409).json({success:false,message:duplicateMessage(req.body.month)});
  const data=await Payroll.create(req.body);res.status(201).json({success:true,data:await data.populate({path:'staff',populate:{path:'user',select:'name email phone'}})});
}
export async function update(req,res){
  if(req.body.month!==undefined||req.body.staff!==undefined){
    const current=await Payroll.findById(req.params.id).select('staff month');
    if(!current)return res.status(404).json({success:false,message:'Payroll record not found'});
    const staff=req.body.staff??current.staff,month=req.body.month??current.month;
    const changed=String(staff)!==String(current.staff)||monthKey(month)!==monthKey(current.month);
    if(changed&&await findDuplicate(staff,month,req.params.id)) return res.status(409).json({success:false,message:duplicateMessage(month)});
  }
  const data=await Payroll.findByIdAndUpdate(req.params.id,req.body,{new:true,runValidators:true}).populate({path:'staff',populate:{path:'user',select:'name email phone'}});
  if(!data)return res.status(404).json({success:false,message:'Payroll record not found'});res.json({success:true,data});
}
export async function remove(req,res){const data=await Payroll.findByIdAndDelete(req.params.id);if(!data)return res.status(404).json({success:false,message:'Payroll record not found'});res.json({success:true,message:'Deleted successfully'});}
