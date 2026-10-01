import Notification from '../models/Notification.js';
import { broadcast } from '../utils/realtime.js';

/**
 * Create a notification for a single user and push it in realtime.
 * Before this helper existed, `Notification.create` was never called
 * anywhere in the codebase — the bell icon / notifications panel had a
 * working list+read API but nothing ever populated it, so admin → teacher
 * → student updates never showed up there.
 */
export async function notifyUser(req, userId, { type, title, text, link } = {}) {
  if (!userId) return null;
  const data = await Notification.create({ user: userId, type, title, text, link });
  broadcast(req, 'resource:change', { resource: 'notifications', action: 'create', data });
  broadcast(req, 'notifications:created', data);
  return data;
}

/** Create the same notification for many users at once. */
export async function notifyUsers(req, userIds = [], payload = {}) {
  const unique = [...new Set((userIds || []).filter(Boolean).map(String))];
  return Promise.all(unique.map(id => notifyUser(req, id, payload)));
}
