import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

console.log('[Axios] API URL:', API_URL);

export const axiosInstance = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  timeout: 30000,
  // NE PAS forcer Content-Type ici : Axios le définit automatiquement selon le type de data
  // (application/json pour les objets, multipart/form-data avec boundary pour FormData)
  // Forcer 'application/json' ici casse tous les uploads de fichiers.
});

export default axiosInstance;
