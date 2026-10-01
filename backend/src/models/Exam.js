import mongoose from 'mongoose';
const schema=new mongoose.Schema({name:{type:String,required:true,trim:true},term:String,classIds:[{type:mongoose.Schema.Types.ObjectId,ref:'Class'}],subjectIds:[{type:mongoose.Schema.Types.ObjectId,ref:'Subject'}],startDate:Date,endDate:Date,maxMarks:{type:Number,default:100},status:{type:String,enum:['Draft','Scheduled','Completed'],default:'Draft'}},{timestamps:true});
export default mongoose.model('Exam',schema);
