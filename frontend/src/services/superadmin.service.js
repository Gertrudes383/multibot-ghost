import { authApi } from './apiFetch';

export function getSuperadminDashboard() {
  return authApi.get('/superadmin/dashboard');
}

export function getTenants(params) {
  return authApi.get('/superadmin/tenants', params);
}

export function createTenant(data) {
  return authApi.post('/superadmin/tenants', data);
}

export function updateTenant(id, data) {
  return authApi.put(`/superadmin/tenants/${id}`, data);
}

export function deleteTenant(id) {
  return authApi.delete(`/superadmin/tenants/${id}`);
}

export function getSuperadminPayments(params) {
  return authApi.get('/superadmin/payments', params);
}

export function getSuperadminStats() {
  return authApi.get('/superadmin/stats');
}

export function superadminSearch(query) {
  return authApi.get('/superadmin/search', { query });
}

export function createSuperadminUser(data) {
  return authApi.post('/superadmin/users', data);
}

export const searchGlobal = (params) => authApi(`/superadmin/search?${new URLSearchParams(params)}`);
export const createSupportUser = (data) => authApi('/superadmin/create-support-user', { method: 'POST', body: JSON.stringify(data) });
export const changeSuperadminPassword = (data) => authApi('/superadmin/me/password', { method: 'PUT', body: JSON.stringify(data) });
