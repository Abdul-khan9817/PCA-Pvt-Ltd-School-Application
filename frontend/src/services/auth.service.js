import { request, setAccessToken } from './apiClient.js';

export async function login(email, password) {
  const result = await request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }, false);
  setAccessToken(result.data.accessToken);
  return result.data;
}

export async function me() {
  return (await request('/auth/me')).data;
}

export async function refresh() {
  const result = await request('/auth/refresh', { method: 'POST' }, false);
  setAccessToken(result.data.accessToken);
  return result.data;
}

// ✅ FIXED: was sending GET request (empty {}), logout must be POST
export async function logout() {
  try {
    await request('/auth/logout', { method: 'POST' }, false);
  } finally {
    setAccessToken('');
  }
}

export async function forgotPassword(email) {
  return (await request('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }, false));
}

export async function resetPassword(email, otp, newPassword) {
  return (await request('/auth/reset-password', { method: 'POST', body: JSON.stringify({ email, otp, newPassword }) }, false));
}