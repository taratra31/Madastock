import axios from 'axios';

const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

const PUBLIC_PATHS = ['/login', '/register', '/verify-email', '/forgot-password', '/reset-password', '/'];

let refreshPromise: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = api
      .post('/auth/refresh')
      .then(() => true)
      .catch(() => false)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

api.interceptors.request.use((config) => {
  const storeId = localStorage.getItem('madastock_store_id');
  if (storeId) {
    config.headers['X-Store-Id'] = storeId;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const status = err.response?.status;
    const url: string = err.config?.url ?? '';

    if (status === 401 && !url.includes('/auth/refresh') && !url.includes('/auth/login')) {
      const refreshed = await tryRefresh();
      if (refreshed) {
        return api.request(err.config);
      }
      if (!PUBLIC_PATHS.some((p) => window.location.pathname.startsWith(p))) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  },
);

export default api;