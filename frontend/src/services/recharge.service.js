import { authApi } from './apiFetch';

export function createRecharge(data) {
  return authApi.post('/recharges', data);
}

export function rechargeHistory(params) {
  return authApi.get('/recharges/history', params);
}

export function pixCreate(data) {
  return authApi.post('/recharges/pix', data);
}

export function pixStatus(id) {
  return authApi.get(`/recharges/pix/${id}/status`);
}

export function manualRecharge(data) {
  return authApi.post('/recharges/manual', data);
}
