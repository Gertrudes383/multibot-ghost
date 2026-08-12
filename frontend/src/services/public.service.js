import { api } from './apiFetch';

export function getSiteSettings() {
  return api.get('/public/settings');
}

export function getBonusInfo() {
  return api.get('/public/bonus');
}

export function getRecentBatches() {
  return api.get('/public/batches/recent');
}

export function getRecentPurchases() {
  return api.get('/public/purchases/recent');
}

export function getRules() {
  return api.get('/public/rules');
}
