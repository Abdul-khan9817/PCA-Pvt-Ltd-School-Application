import Student from '../models/Student.js';
import Staff from '../models/Staff.js';
import Class from '../models/Class.js';
import Attendance from '../models/Attendance.js';
import Fee from '../models/Fee.js';
import Payroll from '../models/Payroll.js';
import User from '../models/User.js';

export async function overview(req,res){
  const [students,staff,classes,users,attendance,fees,payroll]=await Promise.all([
    Student.countDocuments({status:'active'}),
    Staff.countDocuments({status:'active'}),
    Class.countDocuments({status:'active'}),
    User.countDocuments({status:'active'}),
    Attendance.aggregate([{$group:{_id:'$status',count:{$sum:1}}}]),
    Fee.aggregate([{$group:{_id:null,billed:{$sum:'$amount'},paid:{$sum:'$paid'}}}]),
    Payroll.aggregate([{$group:{_id:'$status',count:{$sum:1},net:{$sum:'$net'}}}])
  ]);
  res.json({success:true,data:{students,staff,classes,users,attendance,fees:fees[0]||{billed:0,paid:0},payroll}});
}
