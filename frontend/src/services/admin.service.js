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
export const toggleBot = (id, data) => authApi.put(`/admin/telegram/bots/${id}`, data);
export const getTelegramUsers = (params) => authApi.get('/admin/telegram/users', params);
export const getTelegramOrders = (params) => authApi.get('/admin/telegram/orders', params);
export const getTelegramRecharges = (params) => authApi.get('/admin/telegram/recharges', params);
export const getTelegramBroadcast = (params) => authApi.get('/admin/telegram/broadcast', params);
export const sendTelegramBroadcast = (data) => authApi.post('/admin/telegram/broadcast', data);
export const getTelegramGiftCards = (params) => authApi.get('/admin/telegram/giftcards', params);
export const createTelegramGiftCards = (data) => authApi.post('/admin/telegram/giftcards', data);
export const getTelegramAffiliates = (params) => authApi.get('/admin/telegram/affiliates', params);
export const updateAffiliateCommission = (data) => authApi.put('/admin/telegram/affiliates/commission', data);
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

// --- Cards Advanced ---
export const exportCards = (params) => authApi('/admin/cards/export', { method: 'POST', body: JSON.stringify(params) });
export const getCardDuplicates = (params) => authApi(`/admin/cards/duplicates?${new URLSearchParams(params)}`);
export const reactivateDeadCards = (data) => authApi('/admin/cards/reactivate', { method: 'POST', body: JSON.stringify(data) });
export const getCardStats = (params) => authApi(`/admin/cards/stats?${new URLSearchParams(params)}`);
export const batchDeleteCards = (data) => authApi('/admin/cards/batch-delete', { method: 'POST', body: JSON.stringify(data) });

// --- Batches Advanced ---
export const getBatchCards = (batchId, params) => authApi(`/admin/batches/${batchId}/cards?${new URLSearchParams(params)}`);
export const activateBatch = (batchId) => authApi(`/admin/batches/${batchId}/activate`, { method: 'POST' });
export const deactivateBatch = (batchId) => authApi(`/admin/batches/${batchId}/deactivate`, { method: 'POST' });

// --- Financial / Payments ---
export const getPixPayments = (params) => authApi(`/admin/payments/pix/payments?${new URLSearchParams(params)}`);
export const getCryptoPayments = (params) => authApi(`/admin/payments/crypto/payments?${new URLSearchParams(params)}`);
export const getManualAttempts = (params) => authApi(`/admin/payments/manual/attempts?${new URLSearchParams(params)}`);
export const getManualSettings = (params) => authApi(`/admin/payments/manual/settings?${new URLSearchParams(params)}`);
export const updateManualSettings = (data) => authApi('/admin/payments/manual/settings', { method: 'PUT', body: JSON.stringify(data) });
export const getManualStatistics = (params) => authApi(`/admin/payments/manual/statistics?${new URLSearchParams(params)}`);
export const getUnifiedSettings = (params) => authApi(`/admin/payments/unified-settings?${new URLSearchParams(params)}`);
export const updateUnifiedSettings = (data) => authApi('/admin/payments/unified-settings', { method: 'PUT', body: JSON.stringify(data) });
export const getRechargeBonus = (params) => authApi(`/admin/payments/recharge-bonus?${new URLSearchParams(params)}`);
export const updateRechargeBonus = (data) => authApi('/admin/payments/recharge-bonus', { method: 'PUT', body: JSON.stringify(data) });
export const getPaymentGateways = (params) => authApi(`/admin/payments/gateways?${new URLSearchParams(params)}`);
export const updatePaymentGateway = (id, data) => authApi(`/admin/payments/gateways/${id}`, { method: 'PUT', body: JSON.stringify(data) });

// --- Telegram Advanced ---
export const getTelegramExchangesFull = (params) => authApi(`/admin/telegram/exchanges?${new URLSearchParams(params)}`);
export const updateExchange = (id, data) => authApi(`/admin/telegram/exchanges/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const getTelegramReferences = (params) => authApi(`/admin/telegram/references?${new URLSearchParams(params)}`);
export const updateReference = (id, data) => authApi(`/admin/telegram/references/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const getAffiliatesConfig = (params) => authApi(`/admin/telegram/affiliates/config?${new URLSearchParams(params)}`);
export const updateAffiliatesConfig = (data) => authApi('/admin/telegram/affiliates/config', { method: 'PUT', body: JSON.stringify(data) });
export const getAffiliatesUsers = (params) => authApi(`/admin/telegram/affiliates/users?${new URLSearchParams(params)}`);
export const getAffiliatesEarnings = (params) => authApi(`/admin/telegram/affiliates/recent-earnings?${new URLSearchParams(params)}`);
export const uploadStartImage = (formData) => authApi('/admin/telegram/start-image', { method: 'POST', body: formData, headers: {} });
export const deleteStartImage = (params) => authApi(`/admin/telegram/start-image?${new URLSearchParams(params)}`, { method: 'DELETE' });
export const createGiftCardsBulk = (data) => authApi('/admin/telegram/gift-cards/bulk', { method: 'POST', body: JSON.stringify(data) });
export const getTelegramUsersDelta = (params) => authApi(`/admin/telegram/users/delta?${new URLSearchParams(params)}`);
export const getCustomEmojis = (params) => authApi(`/admin/telegram/custom-emojis?${new URLSearchParams(params)}`);
export const updateCustomEmojis = (data) => authApi('/admin/telegram/custom-emojis', { method: 'PUT', body: JSON.stringify(data) });

// --- Users Advanced ---
export const getUserActivities = (params) => authApi(`/admin/users/activities?${new URLSearchParams(params)}`);
export const getTopUsers = (params) => authApi(`/admin/users/top?${new URLSearchParams(params)}`);

// --- Dashboard Advanced ---
export const getDashboardAdvanced = (params) => authApi(`/admin/dashboard/advanced?${new URLSearchParams(params)}`);
export const getDashboardBanners = (params) => authApi(`/admin/dashboard/banners?${new URLSearchParams(params)}`);
export const updateDashboardBanners = (data) => authApi('/admin/dashboard/banners', { method: 'POST', body: JSON.stringify(data) });

// --- Referral Advanced ---
export const getReferralStats = (params) => authApi(`/admin/referral/stats?${new URLSearchParams(params)}`);
export const getReferralTop = (params) => authApi(`/admin/referral/top?${new URLSearchParams(params)}`);
export const getReferralEarnings = (params) => authApi(`/admin/referral/earnings?${new URLSearchParams(params)}`);
export const getReferralUsers = (params) => authApi(`/admin/referral/users?${new URLSearchParams(params)}`);

// --- Settings Advanced ---
export const getSettingValue = (key, params) => authApi(`/admin/settings/key-value/${key}?${new URLSearchParams(params || {})}`);
export const setSettingValue = (data) => authApi('/admin/settings/key-value', { method: 'POST', body: JSON.stringify(data) });
export const getNotifications = (params) => authApi(`/admin/settings/notifications?${new URLSearchParams(params || {})}`);
export const updateNotifications = (data) => authApi('/admin/settings/notifications', { method: 'PUT', body: JSON.stringify(data) });
export const getRegistrationSettings = (params) => authApi(`/admin/settings/registration?${new URLSearchParams(params || {})}`);
export const updateRegistrationSettings = (data) => authApi('/admin/settings/registration', { method: 'PUT', body: JSON.stringify(data) });
export const getRulesSettings = (params) => authApi(`/admin/settings/rules?${new URLSearchParams(params || {})}`);
export const updateRulesSettings = (data) => authApi('/admin/settings/rules', { method: 'PUT', body: JSON.stringify(data) });
export const getSupportContacts = (params) => authApi(`/admin/settings/support?${new URLSearchParams(params || {})}`);
export const updateSupportContacts = (data) => authApi('/admin/settings/support', { method: 'PUT', body: JSON.stringify(data) });

// --- System ---
export const getSystemStatus = () => authApi('/admin/system/status');
export const getSystemUptime = () => authApi('/admin/system/uptime');
export const uploadLogo = (formData) => authApi('/admin/system/upload-logo', { method: 'POST', body: formData, headers: {} });
export const uploadHeaderLogo = (formData) => authApi('/admin/system/upload-header-logo', { method: 'POST', body: formData, headers: {} });
export const getPurchaseValidationLogs = (params) => authApi(`/admin/system/purchase-validation-logs?${new URLSearchParams(params)}`);
export const toggleBonusVisibility = (data) => authApi('/admin/system/bonus-visibility', { method: 'POST', body: JSON.stringify(data) });

// --- Missing page-specific functions ---
export const getAuxiliaryPool = (params) => authApi(`/admin/batches/auxiliary-pool?${new URLSearchParams(params || {})}`);
export const uploadAuxiliaryPool = (data) => authApi('/admin/batches/auxiliary-pool/upload', { method: 'POST', body: JSON.stringify(data) });
export const getBonusVisibility = (params) => authApi(`/admin/settings/key-value/bonus_visible?${new URLSearchParams(params || {})}`);
export const updateBonusVisibility = (data) => authApi('/admin/system/bonus-visibility', { method: 'POST', body: JSON.stringify(data) });
export const deleteCardDuplicates = (data) => authApi('/admin/cards/batch-delete', { method: 'POST', body: JSON.stringify(data) });
export const getCardExportPreview = (params) => authApi(`/admin/cards/stats?${new URLSearchParams(params || {})}`);
export const getGateways = (params) => authApi(`/admin/payments/gateways?${new URLSearchParams(params || {})}`);
export const updateGateways = (id, data) => authApi(`/admin/payments/gateways/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const bulkGenerateGiftCards = (data) => authApi('/admin/telegram/gift-cards/bulk', { method: 'POST', body: JSON.stringify(data) });
export const manualRecharge = (id, data) => authApi(`/admin/telegram/recharges/${id}/approve`, { method: 'POST', body: JSON.stringify(data) });
export const getMixOffers = (params) => authApi(`/admin/batches/mix-offers?${new URLSearchParams(params || {})}`);
export const createMixOffer = (data) => authApi('/admin/batches/mix-offers', { method: 'POST', body: JSON.stringify(data) });
export const updateMixOffer = (id, data) => authApi(`/admin/batches/mix-offers/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const getDeadCards = (params) => authApi(`/admin/cards?${new URLSearchParams({ ...params, status: 'dead' })}`);
export const getRechargeBonusSettings = (params) => authApi(`/admin/payments/recharge-bonus?${new URLSearchParams(params || {})}`);
export const updateRechargeBonusSettings = (data) => authApi('/admin/payments/recharge-bonus', { method: 'PUT', body: JSON.stringify(data) });
export const getStartImage = (params) => authApi(`/admin/telegram/start-image-proxy?${new URLSearchParams(params || {})}`);
export const updateStartImage = (formData) => authApi('/admin/telegram/start-image', { method: 'POST', body: formData, headers: {} });
export const createTelegramReference = (data) => authApi('/admin/telegram/references', { method: 'POST', body: JSON.stringify(data) });
export const deleteTelegramReference = (id) => authApi(`/admin/telegram/references/${id}`, { method: 'DELETE' });

export const getCpfViewSettings = () => authApi.get('/admin/settings/cpf-view');
export const updateCpfViewSettings = (data) => authApi.put('/admin/settings/cpf-view', data);
