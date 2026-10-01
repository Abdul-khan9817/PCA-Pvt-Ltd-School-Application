/**
 * Broadcast a realtime event to all connected clients EXCEPT the browser tab
 * that triggered it (identified by the `X-Socket-Id` header the frontend
 * apiClient attaches to every request).
 *
 * Why: every save action re-fetches its own new state directly from the API
 * response already, so that tab does not need the socket echo of its own
 * change. Previously every client (including the one that just saved)
 * received the same `resource:change` event, which meant bulk saves (e.g.
 * marking attendance for a whole class, saving grades for a whole class)
 * fired one event per row and the saving tab re-rendered its whole table
 * once per row within a few hundred ms — visible as the page
 * "blinking / vibrating" right after Save. Other logged-in users (admin,
 * teacher, student, parent) still receive the event instantly as before.
 */
export function broadcast(req, event, payload) {
  const io = req.app.get('io');
  if (!io) return;
  const socketId = req.headers['x-socket-id'];
  const target = socketId ? io.except(socketId) : io;
  target.emit(event, payload);
}
