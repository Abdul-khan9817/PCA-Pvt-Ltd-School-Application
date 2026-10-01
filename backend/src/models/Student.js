import mongoose from 'mongoose';
const schema=new mongoose.Schema({
  user:{type:mongoose.Schema.Types.ObjectId,ref:'User',unique:true,sparse:true},
  roll:{type:String,unique:true,sparse:true},
  studentId:String,
  classId:{type:mongoose.Schema.Types.ObjectId,ref:'Class'},
  cls:String,
  section:String,
  gender:String,
  dob:Date,
  guardianIds:[{type:mongoose.Schema.Types.ObjectId,ref:'User'}],
  admissionDate:Date,
  fatherName:String,
  motherName:String,
  guardianName:String,
  parentPhone:String,
  address:String,
  village:String,
  status:{type:String,default:'active'},
  gpa:Number
},{timestamps:true});
schema.index({classId:1,status:1});
export default mongoose.model('Student',schema);