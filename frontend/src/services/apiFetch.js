const API_BASE_URL = String(import.meta.env.VITE_API_URL || 'http://localhost:9999/api').replace(/\/+$/, '');
let _refreshHandler = null;
let _refreshPromise = null;
let _tokenGetter = () => '';

export function setRefreshHandler(fn) {
  _refreshHandler = fn;
}

export function setTokenGetter(fn) {
  _tokenGetter = fn;
}

export function qs(params) {
  if (!params || typeof params !== 'object') return '';
  const entries = Object.entries(params).filter(([, v]) => v != null && v !== '');
  return entries.length ? '?' + new URLSearchParams(entries).toString() : '';
}

function getSingletonRefresh() {
  if (_refreshPromise) return _refreshPromise;
  _refreshPromise = _refreshHandler().finally(() => {
    _refreshPromise = null;
  });
  return _refreshPromise;
}

const DEFAULT_ERROR_BY_STATUS = {
  400: 'Erro',
  401: 'Erro',
  403: 'Erro',
  404: 'Erro',
  409: 'Erro',
  422: 'Erro',
  429: 'Erro',
  500: 'Erro',
  503: 'Erro',
};

function toCleanText(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return '';
  return String(value).replace(/\s+/g, ' ').trim();
}

function normalizeErrorData(data, status) {
  const fallbackError = DEFAULT_ERROR_BY_STATUS[status] || `HTTP ${status}`;
  const fallbackMessage = status >= 500
    ? 'Tente novamente'
    : 'Nao foi possivel concluir';

  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const normalized = {
      statusCode: Number.isFinite(Number(data.statusCode)) ? Number(data.statusCode) : status,
      error: toCleanText(data.error) || fallbackError,
      message: toCleanText(data.message) || toCleanText(data?.attributes?.error) || toCleanText(data.error) || fallbackMessage,
    };

    if (toCleanText(data.code)) normalized.code = toCleanText(data.code);
    if (data.details && typeof data.details === 'object' && !Array.isArray(data.details)) {
      normalized.details = data.details;
    }

    return normalized;
  }

  const text = toCleanText(data);
  return { statusCode: status, error: fallbackError, message: text || fallbackMessage };
}

export async function apiFetch(path, options = {}) {
  const {
    method = 'GET',
    body,
    token = '',
    auth = false,
    signal,
    headers = {},
  } = options;

  const requestHeaders = { ...headers };

  if (body !== undefined && !(body instanceof FormData)) {
    requestHeaders['Content-Type'] = requestHeaders['Content-Type'] || 'application/json';
  }

  if (auth && token) {
    requestHeaders.Authorization = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
  }

  let response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      signal,
      headers: requestHeaders,
      body: body === undefined
        ? undefined
        : requestHeaders['Content-Type'] === 'application/json'
          ? JSON.stringify(body)
          : body,
    });
  } catch (err) {
    if (err?.name === 'AbortError') throw err;

    const normalizedData = { statusCode: 0, error: 'Erro', message: 'Falha de conexao' };
    const error = new Error(normalizedData.message);
    error.name = normalizedData.error;
    error.status = 0;
    error.data = normalizedData;
    throw error;
  }

  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  const data = isJson ? await response.json().catch(() => null) : await response.text().catch(() => null);

  if (!response.ok) {
    if ((response.status === 401 || response.status === 404) && auth && _refreshHandler && !options._isRetry) {
      const newToken = await getSingletonRefresh();
      if (newToken) {
        return apiFetch(path, { ...options, token: newToken, _isRetry: true });
      }
    }

    const normalizedData = normalizeErrorData(data, response.status);
    const error = new Error(normalizedData.message);
    error.name = normalizedData.error;
    error.status = response.status;
    error.data = normalizedData;
    throw error;
  }

  if (data && typeof data === 'object' && data.success && 'data' in data) return data.data;
  return data;
}

export const api = {
  get: (path, opts = {}) => apiFetch(path, { ...opts, method: 'GET' }),
  post: (path, body, opts = {}) => apiFetch(path, { ...opts, method: 'POST', body }),
  put: (path, body, opts = {}) => apiFetch(path, { ...opts, method: 'PUT', body }),
  patch: (path, body, opts = {}) => apiFetch(path, { ...opts, method: 'PATCH', body }),
  delete: (path, opts = {}) => apiFetch(path, { ...opts, method: 'DELETE' }),
};

function authOpts(opts) {
  return { ...opts, auth: true, token: _tokenGetter() };
}

export const authApi = {
  get: (path, params, opts = {}) => apiFetch(`${path}${qs(params)}`, authOpts({ ...opts, method: 'GET' })),
  post: (path, body, opts = {}) => apiFetch(path, authOpts({ ...opts, method: 'POST', body })),
  put: (path, body, opts = {}) => apiFetch(path, authOpts({ ...opts, method: 'PUT', body })),
  patch: (path, body, opts = {}) => apiFetch(path, authOpts({ ...opts, method: 'PATCH', body })),
  delete: (path, opts = {}) => apiFetch(path, authOpts({ ...opts, method: 'DELETE' })),
};
