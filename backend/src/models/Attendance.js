import mongoose from 'mongoose';
const schema=new mongoose.Schema({student:{type:mongoose.Schema.Types.ObjectId,ref:'Student',required:true},classId:{type:mongoose.Schema.Types.ObjectId,ref:'Class'},subjectId:{type:mongoose.Schema.Types.ObjectId,ref:'Subject'},date:{type:Date,required:true},status:{type:String,enum:['Present','Absent','Late','Excused'],required:true},markedBy:{type:mongoose.Schema.Types.ObjectId,ref:'User'},remarks:String},{timestamps:true});
schema.index({student:1,date:1,subjectId:1},{unique:true});
schema.index({classId:1,date:-1});
schema.index({student:1,date:-1});
export default mongoose.model('Attendance',schema);
