import { authApi } from './apiFetch';

export function redeemGiftCard(code) {
  return authApi.post('/giftcards/redeem', { code });
}

export function giftCardHistory(params) {
  return authApi.get('/giftcards/history', params);
}
