import axios from 'axios';

const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('madastock_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  const storeId = localStorage.getItem('madastock_store_id');
  if (storeId) {
    config.headers['X-Store-Id'] = storeId;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('madastock_token');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  },
);

export default api;