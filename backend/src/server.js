import express from 'express';import path from 'path';import http from 'http';import cors from 'cors';import helmet from 'helmet';import morgan from 'morgan';import cookieParser from 'cookie-parser';import rateLimit from 'express-rate-limit';import {Server as SocketServer} from 'socket.io';
import {connectDB} from './config/db.js';import {env} from './config/env.js';import {notFound,errorHandler} from './middleware/error.js';
import authRoutes from './routes/auth.routes.js';import userRoutes from './routes/user.routes.js';import attendanceRoutes from './routes/attendance.routes.js';import gradeRoutes from './routes/grade.routes.js';import messageRoutes from './routes/message.routes.js';import notificationRoutes from './routes/notification.routes.js';import dashboardRoutes from './routes/dashboard.routes.js';import assignmentRoutes from './routes/assignment.routes.js';import examRoutes from './routes/exam.routes.js';import profileRoutes from './routes/profile.routes.js';import reportRoutes from './routes/report.routes.js';
import {studentRoutes,staffRoutes,classRoutes,subjectRoutes,feeRoutes,payrollRoutes,leaveRoutes,timetableRoutes} from './routes/resource.routes.js';
import announcementRoutes from './routes/announcement.routes.js';
import payrollApiRoutes from './routes/payroll.routes.js';
import staffAttendanceRoutes from './routes/staffAttendance.routes.js';
import User from './models/User.js';
import { verifyAccessToken } from './utils/tokens.js';
const app=express();const server=http.createServer(app);
const isAllowedOrigin=(origin)=>!origin||env.allowedOrigins.includes(origin)||(env.nodeEnv!=='production'&&/^http:\/\/localhost:\d+$/.test(origin));
const corsOptions={origin:(origin,callback)=>callback(null,isAllowedOrigin(origin)),credentials:true};
const io=new SocketServer(server,{cors:corsOptions});app.set('io',io);
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication required'));
    const payload = verifyAccessToken(token);
    const user = await User.findById(payload.sub).select('_id role status');
    if (!user || user.status !== 'active' || user.role !== payload.role) {
      return next(new Error('Invalid socket identity'));
    }
    socket.user = user;
    next();
  } catch {
    next(new Error('Invalid or expired access token'));
  }
});
app.use(helmet({crossOriginResourcePolicy:{policy:'cross-origin'}}));app.use(cors(corsOptions));app.use(express.json({limit:'2mb'}));app.use(express.urlencoded({extended:true}));app.use(cookieParser());app.use(morgan(env.nodeEnv==='production'?'combined':'dev'));app.use(rateLimit({windowMs:15*60*1000,max:Number(process.env.RATE_LIMIT_MAX||(env.nodeEnv==='production'?300:5000)),standardHeaders:true,legacyHeaders:false}));
app.use('/uploads',express.static(path.join(process.cwd(),'uploads')));app.get('/api/health',(req,res)=>res.json({success:true,status:'ok',service:'EduManage API',time:new Date().toISOString()}));
app.use('/api/auth',authRoutes);app.use('/api/users',userRoutes);app.use('/api/students',studentRoutes);app.use('/api/staff',staffRoutes);app.use('/api/classes',classRoutes);app.use('/api/subjects',subjectRoutes);app.use('/api/attendance',attendanceRoutes);app.use('/api/grades',gradeRoutes);app.use('/api/fees',feeRoutes);app.use('/api/payroll',payrollApiRoutes);app.use('/api/leaves',leaveRoutes);app.use('/api/assignments',assignmentRoutes);app.use('/api/timetable',timetableRoutes);app.use('/api/announcements',announcementRoutes);app.use('/api/messages',messageRoutes);app.use('/api/notifications',notificationRoutes);app.use('/api/dashboard',dashboardRoutes);app.use('/api/exams',examRoutes);app.use('/api/profile',profileRoutes);app.use('/api/reports',reportRoutes);
app.use('/api/staff-attendance',staffAttendanceRoutes);
io.on('connection',socket=>{
  const userId = socket.user._id.toString();
  const role = socket.user.role.toLowerCase();
  socket.join(`user:${userId}`);
  socket.join(`role:${role}`);
  socket.join('school:broadcast');
  socket.on('auth:join',()=>{
    // Identity and room membership come from the verified handshake token.
    socket.join('school:broadcast');
  });
});
app.use(notFound);app.use(errorHandler);
export { app, server };
async function ensureDefaultAdmin(){
  const User = (await import('./models/User.js')).default;
  const bcrypt = (await import('bcryptjs')).default;
  const desiredEmail = (process.env.DEFAULT_ADMIN_EMAIL || 'admin@edumanage.com').trim().toLowerCase();
  const desiredPassword = process.env.DEFAULT_ADMIN_PASSWORD || 'Password@123';
  const legacyEmails = ['admin@school.edu', 'admin@school.com'];
  let admin = await User.findOne({ email: desiredEmail }).select('+passwordHash');

  // Migrate older admin addresses without deleting school data.
  if (!admin) {
    admin = await User.findOne({ email: { $in: legacyEmails }, role: 'admin' }).select('+passwordHash');
    if (admin) {
      admin.email = desiredEmail;
      await admin.save();
    }
  }

  if (!admin) {
    const passwordHash = await bcrypt.hash(desiredPassword, 12);
    admin = await User.create({
      name: 'Dr. Sarah Johnson',
      email: desiredEmail,
      passwordHash,
      role: 'admin',
      status: 'active',
      phone: '9000000001',
      address: 'School Campus, Main Building'
    });
    console.log(`Default admin created: ${desiredEmail}`);
    return;
  }

  // In local development, keep the documented admin credentials usable even if
  // an older database contains a different password or inactive admin record.
  if (env.nodeEnv !== 'production') {
    const passwordMatches = await bcrypt.compare(desiredPassword, admin.passwordHash || '');
    if (admin.status !== 'active' || !passwordMatches) {
      admin.passwordHash = await bcrypt.hash(desiredPassword, 12);
      admin.status = 'active';
      admin.role = 'admin';
      await admin.save();
      console.log(`Default admin credentials synchronized: ${desiredEmail}`);
    }
  }
}

async function removeObsoleteSubjectCodeIndex() {
  try {
    const Subject = (await import('./models/Subject.js')).default;
    const indexes = await Subject.collection.indexes();
    if (indexes.some(index => index.name === 'code_1')) {
      await Subject.collection.dropIndex('code_1');
      console.log('Removed obsolete unique subject code index.');
    }
  } catch (error) {
    console.warn(`Subject code index cleanup skipped: ${error.message}`);
  }
}

async function syncClassGradeLevels() {
  try {
    const Class = (await import('./models/Class.js')).default;
    const classes = await Class.find({ $or: [{ gradeLevel: { $exists: false } }, { gradeLevel: null }, { gradeLevel: '' }] });
    for (const c of classes) {
      const source = String(c.name || '').toLowerCase();
      let gl = '';
      if (source.includes('nursery')) gl = 'Nursery';
      else if (source.includes('lkg')) gl = 'LKG';
      else if (source.includes('ukg')) gl = 'UKG';
      else {
        const m = source.match(/\d+/);
        gl = m ? m[0] : c.name;
      }
      c.gradeLevel = gl;
      await c.save();
    }
    if (classes.length > 0) {
      console.log(`Synchronized gradeLevel for ${classes.length} classes.`);
    }
  } catch (err) {
    console.warn(`Class gradeLevel sync skipped: ${err.message}`);
  }
}

if (env.nodeEnv !== 'test') {
  connectDB()
    .then(ensureDefaultAdmin)
    .then(syncClassGradeLevels)
    .then(removeObsoleteSubjectCodeIndex)
    .then(() => {
      server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          console.error(`[EduManage Backend] Port ${env.port} is already in use. Please stop the running process before restarting.`);
        } else {
          console.error('[EduManage Backend] Server error:', err);
        }
        process.exit(1);
      });
      server.listen(env.port, () => console.log(`EduManage API running on http://localhost:${env.port}`));
    })
    .catch(e => { console.error(e); process.exit(1); });
}

