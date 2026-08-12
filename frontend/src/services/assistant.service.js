import { authApi } from './apiFetch';

export function userLookup(query) {
  return authApi.get('/assistant/user-lookup', { query });
}

export function getAssistantPurchases(userId, params) {
  return authApi.get(`/assistant/users/${userId}/purchases`, params);
}

export function getAssistantRecharges(userId, params) {
  return authApi.get(`/assistant/users/${userId}/recharges`, params);
}

export function refundPurchase(purchaseId) {
  return authApi.post(`/assistant/purchases/${purchaseId}/refund`);
}

export function creditUserAssistant(userId, data) {
  return authApi.post(`/assistant/users/${userId}/credit`, data);
}

export function getAssistantGiftCards(params) {
  return authApi.get('/assistant/giftcards', params);
}
