import mongoose from 'mongoose';
const schema=new mongoose.Schema({staff:{type:mongoose.Schema.Types.ObjectId,ref:'Staff',required:true},month:String,basic:Number,allowances:Number,deductions:Number,net:Number,absentDays:{type:Number,default:0,min:0},advance:{type:Number,default:0,min:0},otherDeductions:{type:Number,default:0,min:0},status:{type:String,enum:['Pending','Paid'],default:'Pending'},paidOn:Date,paymentMethod:String,transactionId:String},{timestamps:true});
export default mongoose.model('Payroll',schema);
