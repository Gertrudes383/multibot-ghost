import { authApi } from './apiFetch';

export const getDashboard = () => authApi.get('/admin/dashboard');

export const getUsers = (params) => authApi.get('/admin/users', params);
export const getUser = (id) => authApi.get(`/admin/users/${id}`);
export const updateUser = (id, data) => authApi.put(`/admin/users/${id}`, data);
export const banUser = (id) => authApi.post(`/admin/users/${id}/ban`);
export const unbanUser = (id) => authApi.post(`/admin/users/${id}/unban`);
export const deleteUser = (id) => authApi.delete(`/admin/users/${id}`);
export const creditUser = (id, data) => authApi.post(`/admin/users/${id}/credit`, data);

export const getAdminCards = (params) => authApi.get('/admin/cards', params);
export const uploadCards = (data) => authApi.post('/admin/cards/upload', data);
export const deleteCard = (id) => authApi.delete(`/admin/cards/${id}`);
export const updateCard = (id, data) => authApi.put(`/admin/cards/${id}`, data);

export const getBatches = (params) => authApi.get('/admin/batches', params);
export const createBatch = (data) => authApi.post('/admin/batches', data);
export const updateBatch = (id, data) => authApi.put(`/admin/batches/${id}`, data);
export const deleteBatch = (id) => authApi.delete(`/admin/batches/${id}`);

export const getBins = (params) => authApi.get('/admin/bins', params);
export const createBin = (data) => authApi.post('/admin/bins', data);
export const updateBin = (id, data) => authApi.put(`/admin/bins/${id}`, data);
export const deleteBin = (id) => authApi.delete(`/admin/bins/${id}`);

export const getCheckerStatus = () => authApi.get('/admin/checker/status');
export const updateCheckerSettings = (data) => authApi.put('/admin/checker/settings', data);
export const getCheckerMonitor = () => authApi.get('/admin/checker/monitor');

export const getBots = () => authApi.get('/admin/telegram/bots');
export const createBot = (data) => authApi.post('/admin/telegram/bots', data);
export const updateBot = (id, data) => authApi.put(`/admin/telegram/bots/${id}`, data);
export const deleteBot = (id) => authApi.delete(`/admin/telegram/bots/${id}`);
export const toggleBot = (id, data) => authApi.patch(`/admin/telegram/bots/${id}/toggle`, data);
export const getTelegramUsers = (params) => authApi.get('/admin/telegram/users', params);
export const getTelegramOrders = (params) => authApi.get('/admin/telegram/orders', params);
export const getTelegramRecharges = (params) => authApi.get('/admin/telegram/recharges', params);
export const getTelegramBroadcast = (params) => authApi.get('/admin/telegram/broadcast', params);
export const sendTelegramBroadcast = (data) => authApi.post('/admin/telegram/broadcast', data);
export const getTelegramGiftCards = (params) => authApi.get('/admin/telegram/giftcards', params);
export const getTelegramAffiliates = (params) => authApi.get('/admin/telegram/affiliates', params);
export const getTelegramExchanges = (params) => authApi.get('/admin/telegram/exchanges', params);
export const getTelegramSettings = () => authApi.get('/admin/telegram/settings');
export const updateTelegramSettings = (data) => authApi.put('/admin/telegram/settings', data);

export const getPaymentSettings = () => authApi.get('/admin/payments/settings');
export const updatePaymentSettings = (data) => authApi.put('/admin/payments/settings', data);

export const getSettings = () => authApi.get('/admin/settings');
export const updateSettings = (data) => authApi.put('/admin/settings', data);

export const getPromotions = (params) => authApi.get('/admin/promotions', params);
export const createPromotion = (data) => authApi.post('/admin/promotions', data);
export const updatePromotion = (id, data) => authApi.put(`/admin/promotions/${id}`, data);
export const deletePromotion = (id) => authApi.delete(`/admin/promotions/${id}`);

export const getReferralSettings = () => authApi.get('/admin/referrals/settings');
export const updateReferralSettings = (data) => authApi.put('/admin/referrals/settings', data);
export const getReferrals = (params) => authApi.get('/admin/referrals', params);

export const getBroadcasts = (params) => authApi.get('/admin/broadcasts', params);
export const createBroadcast = (data) => authApi.post('/admin/broadcasts', data);

export const getSecuritySettings = () => authApi.get('/admin/security/settings');
export const updateSecuritySettings = (data) => authApi.put('/admin/security/settings', data);
export const getLogs = (params) => authApi.get('/admin/security/logs', params);

export const getApiKeys = () => authApi.get('/admin/api-keys');
export const createApiKey = (data) => authApi.post('/admin/api-keys', data);
export const deleteApiKey = (id) => authApi.delete(`/admin/api-keys/${id}`);
export const updateApiKey = (id, data) => authApi.put(`/admin/api-keys/${id}`, data);
