import mongoose from 'mongoose';
const schema=new mongoose.Schema({from:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true},to:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true},text:{type:String,required:true},read:{type:Boolean,default:false},sentAt:{type:Date,default:Date.now}},{timestamps:true});
export default mongoose.model('Message',schema);
