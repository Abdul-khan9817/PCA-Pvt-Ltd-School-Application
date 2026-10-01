import 'dotenv/config';
export const env={
  nodeEnv:process.env.NODE_ENV||'development', port:Number(process.env.PORT||5000),
  mongo:process.env.MONGODB_URI, clientUrl:process.env.CLIENT_URL||'http://localhost:5173',
  allowedOrigins:(process.env.ALLOWED_ORIGINS||'http://localhost:5173,http://localhost:5174').split(',').map(v=>v.trim()).filter(Boolean),
  accessSecret:process.env.JWT_ACCESS_SECRET, refreshSecret:process.env.JWT_REFRESH_SECRET,
  accessExpires:process.env.ACCESS_TOKEN_EXPIRES||'15m', refreshExpires:process.env.REFRESH_TOKEN_EXPIRES||'7d',
  cookieSecure:process.env.COOKIE_SECURE==='true',
  frontendUrl:process.env.FRONTEND_URL||process.env.CLIENT_URL||'http://localhost:5173',
  smtp:{host:process.env.SMTP_HOST||'',port:Number(process.env.SMTP_PORT||587),secure:process.env.SMTP_SECURE==='true',user:process.env.SMTP_USER||'',pass:process.env.SMTP_PASS||'',from:process.env.SMTP_FROM||''}
};
if(!env.accessSecret||!env.refreshSecret) console.warn('JWT secrets are not set. Configure .env before authentication use.');
