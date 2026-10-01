import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
export const signAccessToken=user=>jwt.sign({sub:user._id.toString(),role:user.role,email:user.email},env.accessSecret,{expiresIn:env.accessExpires});
export const signRefreshToken=user=>jwt.sign({sub:user._id.toString(),type:'refresh'},env.refreshSecret,{expiresIn:env.refreshExpires});
export const verifyAccessToken=t=>jwt.verify(t,env.accessSecret);
export const verifyRefreshToken=t=>jwt.verify(t,env.refreshSecret);
