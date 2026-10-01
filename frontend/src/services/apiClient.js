const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

let accessToken = localStorage.getItem('edumanage_access_token') || '';
let refreshPromise = null;

export const getAccessToken = () => accessToken;

// ✅ The realtime socket id for THIS browser tab. Sent as a header on every
// request so the backend can exclude this tab when it broadcasts the
// resulting change back out over the socket. Without this, the tab that just
// saved data would receive its own change event a moment later and re-render
// (this was the cause of pages "blinking/vibrating" right after Save — every
// row re-rendering, sometimes dozens of times in a row for a bulk save).
// Other connected users (admin/teacher/student) still get the event instantly.
let currentSocketId = '';
export function setSocketId(id) {
  currentSocketId = id || '';
}

export function setAccessToken(token) {
  accessToken = token || '';
  if (accessToken) localStorage.setItem('edumanage_access_token', accessToken);
  else localStorage.removeItem('edumanage_access_token');
}

async function raw(path, options = {}) {
  const headers = new Headers(options.headers || {});
  // ✅ Don't manually set Content-Type for FormData — browser adds boundary automatically
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  if (currentSocketId) headers.set('X-Socket-Id', currentSocketId);
  const response = await fetch(`${API_URL}${path}`, { ...options, headers, credentials: 'include' });
  const data = await response.json().catch(() => ({}));
  return { response, data };
}

async function refreshAccessToken() {
  try {
    const { response, data } = await raw('/auth/refresh', { method: 'POST' });
    if (!response.ok || !data?.data?.accessToken) throw new Error('Refresh failed');
    setAccessToken(data.data.accessToken);
    return data.data.accessToken;
  } catch {
    setAccessToken('');
    return null;
  }
}

export async function request(path, options = {}, retry = true) {
  let result = await raw(path, options);

  // ✅ Auto-refresh token on 401 then retry once
  if (result.response.status === 401 && retry && !path.startsWith('/auth/')) {
    if (!refreshPromise) refreshPromise = refreshAccessToken();
    const token = await refreshPromise;
    refreshPromise = null;
    if (token) result = await raw(path, options);
  }

  if (!result.response.ok) {
    const error = new Error(result.data?.message || `Request failed (${result.response.status})`);
    error.status = result.response.status;
    error.details = result.data;
    throw error;
  }

  return result.data;
}

export const api = {
  get:    (path)           => request(path),
  post:   (path, body)     => request(path, { method: 'POST',   body: JSON.stringify(body) }),
  patch:  (path, body)     => request(path, { method: 'PATCH',  body: JSON.stringify(body) }),
  put:    (path, body)     => request(path, { method: 'PUT',    body: JSON.stringify(body) }),
  delete: (path)           => request(path, { method: 'DELETE' }),
  // ✅ FormData — no JSON.stringify, no Content-Type header
  upload: (path, formData) => request(path, { method: 'POST',   body: formData }),
};