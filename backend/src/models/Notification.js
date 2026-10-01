import mongoose from 'mongoose';
const schema=new mongoose.Schema({user:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true},type:String,title:String,text:String,read:{type:Boolean,default:false},link:String},{timestamps:true});
export default mongoose.model('Notification',schema);
