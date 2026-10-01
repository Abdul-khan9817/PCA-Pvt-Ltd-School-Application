import mongoose from 'mongoose';
const schema=new mongoose.Schema({classId:{type:mongoose.Schema.Types.ObjectId,ref:'Class'},day:String,startTime:String,endTime:String,subjectId:{type:mongoose.Schema.Types.ObjectId,ref:'Subject'},teacher:{type:mongoose.Schema.Types.ObjectId,ref:'User'},room:String,type:{type:String,default:'Class'}},{timestamps:true});
export default mongoose.model('Timetable',schema);
