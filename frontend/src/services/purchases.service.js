import { authApi } from './apiFetch';

export function purchase(data) {
  return authApi.post('/purchases', data);
}

export function asyncPurchase(data) {
  return authApi.post('/purchases/async', data);
}

export function autoLive(data) {
  return authApi.post('/purchases/auto-live', data);
}

export function mixPackage(data) {
  return authApi.post('/purchases/mix-package', data);
}

export function purchaseHistory(params) {
  return authApi.get('/purchases/history', params);
}
