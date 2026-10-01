import {Router} from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import {protect} from '../middleware/auth.js';
import {get,update,password,uploadAvatar} from '../controllers/profile.controller.js';

const r=Router();
const uploadDir=path.join(process.cwd(),'uploads','profiles');
fs.mkdirSync(uploadDir,{recursive:true});
const storage=multer.diskStorage({
  destination:(_req,_file,cb)=>cb(null,uploadDir),
  filename:(_req,file,cb)=>{
    const ext={
      'image/jpeg':'.jpg',
      'image/png':'.png',
      'image/webp':'.webp'
    }[file.mimetype];
    cb(null,`${crypto.randomUUID()}${ext}`);
  }
});
const upload=multer({
  storage,
  limits:{fileSize:5*1024*1024},
  fileFilter:(_req,file,cb)=>{
    const allowed=['image/jpeg','image/png','image/webp'];
    cb(allowed.includes(file.mimetype)?null:new Error('Only JPG, PNG and WebP images are allowed.'),allowed.includes(file.mimetype));
  }
});

r.use(protect);
r.get('/',get);
r.patch('/',update);
r.post('/password',password);
r.post('/avatar',upload.single('avatar'),uploadAvatar);
export default r;
