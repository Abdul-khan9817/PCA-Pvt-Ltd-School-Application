import mongoose from 'mongoose';
const schema=new mongoose.Schema({
  user:{type:mongoose.Schema.Types.ObjectId,ref:'User',unique:true},
  employeeId:{type:String,unique:true,sparse:true},
  staffId:String,
  designation:String,
  department:String,
  subject:String,
  cls:String,
  section:String,
  gender:String,
  dob:Date,
  qualification:String,
  experience:String,
  joiningDate:Date,
  salary:{basic:Number,allowances:Number,deductions:Number,net:Number},
  assignedClassIds:[{type:mongoose.Schema.Types.ObjectId,ref:'Class'}],
  subjectIds:[{type:mongoose.Schema.Types.ObjectId,ref:'Subject'}],
  address:String,
  village:String,
  status:{type:String,default:'active'}
},{timestamps:true});
export default mongoose.model('Staff',schema);