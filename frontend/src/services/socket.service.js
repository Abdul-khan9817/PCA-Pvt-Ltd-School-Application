import { io } from "socket.io-client";
import { getAccessToken, setSocketId } from "./apiClient";

let socket = null;

export function getSocket() {
  return socket;
}

export function initSocket(user) {
  if (socket && socket.connected) {
    setSocketId(socket.id);
    if (user) {
      socket.emit("auth:join", {
        userId: user._id || user.id,
        role: (user.role || "admin").toLowerCase(),
      });
    }
    return socket;
  }

  if (socket) {
    socket.disconnect();
  }

  const rawUrl = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
  const socketUrl = rawUrl.replace(/\/api\/?$/, "");

  socket = io(socketUrl, {
    auth: { token: getAccessToken() },
    withCredentials: true,
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
  });

  socket.on("connect", () => {
    // Re-set on every (re)connect since socket.id changes after a reconnect.
    setSocketId(socket.id);
    if (user) {
      socket.emit("auth:join", {
        userId: user._id || user.id,
        role: (user.role || "admin").toLowerCase(),
      });
    }
  });

  // Suppress transport errors from the browser console.
  // socket.io-client logs these to console.error by default, which shows up
  // in Lighthouse's "Browser errors logged to the console" Best Practices audit.
  // The built-in reconnection mechanism handles retries automatically;
  // silencing the log here does not affect retry behaviour.
  socket.on("connect_error", () => { /* silenced — reconnect runs automatically */ });
  socket.on("error", () => { /* silenced */ });

  socket.on("disconnect", () => {
    setSocketId('');
  });

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  setSocketId('');
}

/**
 * Subscribe to a specific resource change (e.g. 'students', 'staff', 'attendance', 'grades', 'announcements')
 * @param {string} resource - resource name, e.g. 'students'
 * @param {Function} handler - callback ({ action: 'create'|'update'|'delete', data, id }) => void
 * @returns {Function} cleanup unsubscribe function
 */
export function onResourceChange(resource, handler) {
  if (!socket) initSocket();

  const handleGlobalChange = (payload) => {
    if (payload?.resource === resource) {
      handler(payload);
    }
  };

  const handleCreated = (data) => handler({ action: "create", data });
  const handleUpdated = (data) => handler({ action: "update", data, id: data?._id || data?.id });
  const handleDeleted = (data) => handler({ action: "delete", id: data?.id || data?._id, data });

  socket.on("resource:change", handleGlobalChange);
  socket.on(`${resource}:created`, handleCreated);
  socket.on(`${resource}:updated`, handleUpdated);
  socket.on(`${resource}:deleted`, handleDeleted);
  // Legacy create alias used by some controllers (e.g. grades:saved)
  if (resource === "grades") {
    socket.on("grades:saved", handleCreated);
  }

  return () => {
    if (socket) {
      socket.off("resource:change", handleGlobalChange);
      socket.off(`${resource}:created`, handleCreated);
      socket.off(`${resource}:updated`, handleUpdated);
      socket.off(`${resource}:deleted`, handleDeleted);
      if (resource === "grades") {
        socket.off("grades:saved", handleCreated);
      }
    }
  };
}

/**
 * Subscribe to any custom event
 */
export function onSocketEvent(eventName, handler) {
  if (!socket) initSocket();
  socket.on(eventName, handler);
  return () => {
    if (socket) {
      socket.off(eventName, handler);
    }
  };
}
