import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const MAX_RETRIES = 3;

console.log('[Axios] API URL:', API_URL);

export const axiosInstance = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  timeout: 30000,
  // NE PAS forcer Content-Type ici : Axios le définit automatiquement selon le type de data
  // (application/json pour les objets, multipart/form-data avec boundary pour FormData)
  // Forcer 'application/json' ici casse tous les uploads de fichiers.
});

function shouldRetry(error) {
  if (!error.config || error.config.__retryCount >= MAX_RETRIES) return false;
  // Ne jamais rejouer uploads / mutations non-idempotentes sauf réseau pur
  const method = (error.config.method || 'get').toLowerCase();
  if (method !== 'get' && method !== 'head' && error.response) return false;
  if (!error.response) return true; // réseau / timeout
  const status = error.response.status;
  return status >= 500 || status === 429;
}

axiosInstance.interceptors.response.use(
  (res) => res,
  async (error) => {
    const config = error.config;
    if (!config || !shouldRetry(error)) {
      return Promise.reject(error);
    }
    config.__retryCount = (config.__retryCount || 0) + 1;
    const delayMs = 300 * config.__retryCount;
    await new Promise((r) => setTimeout(r, delayMs));
    return axiosInstance.request(config);
  }
);

export default axiosInstance;
