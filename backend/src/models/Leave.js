import mongoose from 'mongoose';
const schema=new mongoose.Schema({user:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true},type:String,from:Date,to:Date,days:Number,status:{type:String,enum:['Pending','Approved','Rejected'],default:'Pending'},reason:String,reviewedBy:{type:mongoose.Schema.Types.ObjectId,ref:'User'},reviewedAt:Date},{timestamps:true});
export default mongoose.model('Leave',schema);
