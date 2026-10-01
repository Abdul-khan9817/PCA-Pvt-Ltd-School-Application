import mongoose from 'mongoose';
const schema=new mongoose.Schema({title:{type:String,required:true},content:String,priority:{type:String,enum:['High','Medium','Low'],default:'Medium'},audience:[{type:String,enum:['admin','principal','vice_principal','teacher','student','parent']}],publishedBy:{type:mongoose.Schema.Types.ObjectId,ref:'User'},publishedAt:{type:Date,default:Date.now},expiresAt:Date,status:{type:String,default:'Published'}},{timestamps:true});
export default mongoose.model('Announcement',schema);
