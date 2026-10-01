import mongoose from 'mongoose';
const schema=new mongoose.Schema({assignment:{type:mongoose.Schema.Types.ObjectId,ref:'Assignment',required:true},student:{type:mongoose.Schema.Types.ObjectId,ref:'Student',required:true},submittedAt:Date,content:String,attachments:[String],marks:Number,feedback:String,status:{type:String,enum:['Draft','Submitted','Graded','Late'],default:'Draft'}},{timestamps:true});
schema.index({assignment:1,student:1},{unique:true});
export default mongoose.model('Submission',schema);
