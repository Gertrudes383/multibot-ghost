import { api } from './apiFetch.js';

export function loginRequest({ username, password, signal } = {}) {
  return api.post('/auth/login',
    { username: String(username || '').trim(), password: String(password || '') },
    { signal }
  );
}

export function registerRequest({ username, password, signal } = {}) {
  return api.post('/auth/register',
    { username: String(username || '').trim(), password: String(password || '') },
    { signal }
  );
}

export function validateSessionRequest({ token, signal } = {}) {
  return api.get('/auth/validate', { auth: true, token, signal });
}

export function refreshTokenRequest({ refreshToken, signal } = {}) {
  return api.post('/auth/refresh',
    { refreshToken: String(refreshToken || '').trim() },
    { signal }
  );
}

export function logoutRequest({ refreshToken, signal } = {}) {
  return api.post('/auth/logout',
    { refreshToken: String(refreshToken || '').trim() },
    { signal }
  );
}

export function changePasswordRequest({ token, currentPassword, newPassword, signal } = {}) {
  return api.put('/auth/change-password',
    { currentPassword: String(currentPassword || ''), newPassword: String(newPassword || '') },
    { auth: true, token, signal }
  );
}

export function getProfileRequest({ token, signal } = {}) {
  return api.get('/auth/profile', { auth: true, token, signal });
}
