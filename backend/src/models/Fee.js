import mongoose from 'mongoose';
const schema=new mongoose.Schema({student:{type:mongoose.Schema.Types.ObjectId,ref:'Student',required:true},type:String,month:String,amount:{type:Number,required:true},paid:{type:Number,default:0},dueDate:Date,status:{type:String,enum:['Pending','Partial','Paid','Overdue'],default:'Pending'},paymentMethod:String,transactionId:String,paidAt:Date,notes:String},{timestamps:true});
export default mongoose.model('Fee',schema);
