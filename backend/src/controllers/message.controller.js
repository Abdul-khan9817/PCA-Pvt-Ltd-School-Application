import Message from '../models/Message.js';
export async function inbox(req,res){const data=await Message.find({to:req.user._id}).populate('from','name role avatar').sort({createdAt:-1});res.json({success:true,data});}
export async function conversation(req,res){const data=await Message.find({$or:[{from:req.user._id,to:req.params.userId},{from:req.params.userId,to:req.user._id}]}).populate('from','name role').sort({createdAt:1});res.json({success:true,data});}
export async function send(req,res){const data=await Message.create({from:req.user._id,to:req.body.to,text:req.body.text});const io=req.app.get('io');io?.to(`user:${req.body.to}`).emit('message:new',data);res.status(201).json({success:true,data});}
