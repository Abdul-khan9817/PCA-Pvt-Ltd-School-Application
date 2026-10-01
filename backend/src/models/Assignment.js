import mongoose from 'mongoose';
const schema=new mongoose.Schema({title:String,description:String,classId:{type:mongoose.Schema.Types.ObjectId,ref:'Class'},subjectId:{type:mongoose.Schema.Types.ObjectId,ref:'Subject'},teacher:{type:mongoose.Schema.Types.ObjectId,ref:'User'},dueDate:Date,maxMarks:Number,attachments:[String],status:{type:String,default:'Published'}},{timestamps:true});
export default mongoose.model('Assignment',schema);
