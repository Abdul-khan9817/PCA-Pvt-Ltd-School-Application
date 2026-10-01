import Announcement from '../models/Announcement.js';
import Student from '../models/Student.js';
import { broadcast } from '../utils/realtime.js';
import { notifyUsers } from '../services/notification.service.js';

/**
 * Create announcement and notify all students
 */
export async function create(req, res) {
  try {
    const data = await Announcement.create({ ...req.body, publishedBy: req.user._id });
    
    // Notify all students about the new announcement
    const students = await Student.find({ status: 'active' }).select('user');
    const studentUserIds = students.map(s => s.user);
    await notifyUsers(req, studentUserIds, {
      type: 'announcement',
      title: data.title,
      text: data.content?.substring(0, 100) || 'New announcement posted',
      link: `/student/announcements`
    }).catch(() => null);
    
    broadcast(req, 'resource:change', { resource: 'announcements', action: 'create', data });
    broadcast(req, 'announcements:created', data);
    res.status(201).json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

/**
 * List announcements
 */
export async function list(req, res) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    
    const [data, total] = await Promise.all([
      Announcement.find()
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('publishedBy', 'name email'),
      Announcement.countDocuments()
    ]);
    
    res.json({ success: true, data, total, page, limit });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

/**
 * Get single announcement
 */
export async function read(req, res) {
  try {
    const data = await Announcement.findById(req.params.id).populate('publishedBy', 'name email');
    if (!data) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

/**
 * Update announcement
 */
export async function update(req, res) {
  try {
    const data = await Announcement.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('publishedBy', 'name email');
    
    if (!data) return res.status(404).json({ success: false, message: 'Not found' });
    
    broadcast(req, 'resource:change', { resource: 'announcements', action: 'update', id: req.params.id, data });
    broadcast(req, 'announcements:updated', data);
    res.json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

/**
 * Delete announcement
 */
export async function remove(req, res) {
  try {
    const data = await Announcement.findByIdAndDelete(req.params.id);
    if (!data) return res.status(404).json({ success: false, message: 'Not found' });
    
    broadcast(req, 'resource:change', { resource: 'announcements', action: 'delete', id: req.params.id, data });
    broadcast(req, 'announcements:deleted', { id: req.params.id, data });
    res.json({ success: true, message: 'Deleted' });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}
