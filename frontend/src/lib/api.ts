import axios from 'axios';

const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

const PUBLIC_PATHS = ['/login', '/register', '/verify-email', '/forgot-password', '/reset-password'];

const isPublicPath = () =>
  PUBLIC_PATHS.some((p) => window.location.pathname === p || window.location.pathname.startsWith(`${p}/`));

let refreshPromise: Promise<boolean> | null = null;
let endingSession = false;

/** Session morte : on purge l'état local et on renvoie UNE seule fois vers la connexion. */
function endSession(): Promise<never> {
  localStorage.removeItem('madastock_token');
  localStorage.removeItem('madastock_store_id');
  // Purge du cache React Query -> `isAuthenticated` passe à false immédiatement,
  // sinon la landing `/` renverrait encore vers /dashboard.
  window.dispatchEvent(new CustomEvent('madastock:session-expired'));

  if (!endingSession && !isPublicPath()) {
    endingSession = true;
    // `replace` et non `assign` : le bouton « retour » ne renvoie pas au dashboard.
    window.location.replace('/login?expired=1');
  }
  return Promise.reject(new Error('Session expirée'));
}

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
  // Un en-tête fourni par l'appelant (ex. suppression d'une autre boutique)
  // garde la priorité sur la boutique courante mémorisée.
  if (!config.headers['X-Store-Id']) {
    const storeId = localStorage.getItem('madastock_store_id');
    if (storeId) {
      config.headers['X-Store-Id'] = storeId;
    }
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
      return endSession();
    }
    return Promise.reject(err);
  },
);

export default api;