import { verifyAccessToken } from '../utils/tokens.js';
import User from '../models/User.js';
export async function protect(req,res,next){
  try{
    const h=req.headers.authorization;
    if(!h?.startsWith('Bearer ')) return res.status(401).json({success:false,message:'Authentication required'});
    const payload=verifyAccessToken(h.slice(7));
    const user=await User.findById(payload.sub).select('-passwordHash -refreshTokenHash');
    if(!user||user.status!=='active') return res.status(401).json({success:false,message:'User is not active'});
    req.user=user; next();
  }catch(e){return res.status(401).json({success:false,message:'Invalid or expired access token'});}
}
export const authorize=(...roles)=>(req,res,next)=>roles.includes(req.user.role)?next():res.status(403).json({success:false,message:'Insufficient permissions'});
export const isSelfOr=(roles=[])=>(req,res,next)=>roles.includes(req.user.role)||req.params.id===req.user._id.toString()?next():res.status(403).json({success:false,message:'Access denied'});
