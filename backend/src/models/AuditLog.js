import mongoose from 'mongoose';
const schema=new mongoose.Schema({actor:{type:mongoose.Schema.Types.ObjectId,ref:'User'},action:String,entity:String,entityId:mongoose.Schema.Types.ObjectId,method:String,path:String,statusCode:Number,ip:String},{timestamps:true});
export default mongoose.model('AuditLog',schema);
