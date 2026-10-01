import mongoose from 'mongoose';
const historySchema=new mongoose.Schema({marks:Number,previousMarks:Number,grade:String,changedBy:{type:mongoose.Schema.Types.ObjectId,ref:'User'},changedAt:{type:Date,default:Date.now}},{_id:false});
const schema=new mongoose.Schema({student:{type:mongoose.Schema.Types.ObjectId,ref:'Student',required:true},classId:{type:mongoose.Schema.Types.ObjectId,ref:'Class'},subjectId:{type:mongoose.Schema.Types.ObjectId,ref:'Subject'},exam:String,term:String,marks:{type:Number,min:0},maxMarks:{type:Number,default:100},grade:String,remarks:String,enteredBy:{type:mongoose.Schema.Types.ObjectId,ref:'User'},history:{type:[historySchema],default:[]}},{timestamps:true});
schema.index({student:1,createdAt:-1});
schema.index({classId:1,subjectId:1,term:1});
export default mongoose.model('Grade',schema);
