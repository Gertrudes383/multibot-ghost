import { authApi } from './apiFetch';

export function getCards(filters) {
  return authApi.get('/cards', filters);
}

export function getCard(id) {
  return authApi.get(`/cards/${id}`);
}

export function getCountries() {
  return authApi.get('/cards/countries');
}

export function getGateways() {
  return authApi.get('/cards/gateways');
}

export function massCheck(data) {
  return authApi.post('/cards/mass-check', data);
}
