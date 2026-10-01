import mongoose from 'mongoose';
const schema=new mongoose.Schema({
  name:{type:String,required:true,trim:true},email:{type:String,required:true,unique:true,lowercase:true,trim:true},
  passwordHash:{type:String,required:true},role:{type:String,enum:['admin','principal','vice_principal','teacher','student','parent'],required:true},
  phone:String,address:String,avatar:String,status:{type:String,enum:['active','inactive','suspended'],default:'active'},
  refreshTokenHash:String,lastLoginAt:Date,resetTokenHash:String,resetTokenExpiresAt:Date,permissions:[String],
  profile:{type:mongoose.Schema.Types.Mixed,default:{}}
},{timestamps:true});
schema.set('toJSON',{transform:(doc,ret)=>{delete ret.passwordHash;delete ret.refreshTokenHash;return ret;}});
export default mongoose.model('User',schema);
