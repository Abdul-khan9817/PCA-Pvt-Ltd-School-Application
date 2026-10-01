export function notFound(req,res){res.status(404).json({success:false,message:`Route not found: ${req.method} ${req.originalUrl}`});}
export function errorHandler(err,req,res,next){
  console.error(err);
  const status=err.statusCode||((err.name==='ValidationError'||err.name==='ZodError')?400:err.code===11000?409:500);
  const message=err.code===11000?'Duplicate value':err.message||'Internal server error';
  res.status(status).json({success:false,message, ...(process.env.NODE_ENV==='development'?{stack:err.stack}: {})});
}
