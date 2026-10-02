import axios from 'axios';
import { APP_KEY } from './appBase';

const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

// Pages accessibles sans compte : aucun visiteur ne doit y être
// redirigé de force vers /login quand sa session est morte ou inexistante.
const PUBLIC_PATHS = ['/login', '/register', '/verify-email', '/forgot-password', '/reset-password', '/faq', '/pricing'];

const isPublicPath = () => {
  // Le préfixe secret fait partie de l'adresse mais pas de la route : on le
  // retire avant la comparaison, sinon `/k7m4x9q2/register` serait pris pour
  // une page privée et le refresh de session renverrait à tort vers /login.
  const prefix = APP_KEY ? `/${APP_KEY}` : '';
  let p = window.location.pathname;
  if (prefix && (p === prefix || p.startsWith(`${prefix}/`))) {
    p = p.slice(prefix.length) || '/';
  }
  if (p === '/') return true;
  return PUBLIC_PATHS.some((path) => p === path || p.startsWith(`${path}/`));
};

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