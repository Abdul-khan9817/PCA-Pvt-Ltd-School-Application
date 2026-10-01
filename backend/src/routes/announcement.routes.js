import { Router } from 'express';
import { protect, authorize } from '../middleware/auth.js';
import { list, read, create, update, remove } from '../controllers/announcement.controller.js';

const r = Router();

r.use(protect);
r.get('/', authorize('admin', 'principal', 'vice_principal', 'teacher', 'student', 'parent'), list);
r.post('/', authorize('admin', 'principal', 'vice_principal', 'teacher'), create);
r.get('/:id', authorize('admin', 'principal', 'vice_principal', 'teacher', 'student', 'parent'), read);
r.patch('/:id', authorize('admin', 'principal', 'vice_principal', 'teacher'), update);
r.delete('/:id', authorize('admin', 'principal', 'vice_principal'), remove);

export default r;
