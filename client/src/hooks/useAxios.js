import { useState, useCallback } from 'react';
import axiosInstance from '../utils/axios';
import toast from 'react-hot-toast';
import { savePaiementOffline, saveAbsenceOffline, saveNotesOffline } from '../services/offlineDb';

/** Écritures rejouables plus tard : mises en file IndexedDB si le réseau est coupé (synchro dans offlineSync.js). */
async function mettreEnFile(method, url, data) {
  if (method !== 'post' || !data || typeof data !== 'object' || data instanceof FormData) return null;
  const chemin = String(url).split('?')[0];
  if (chemin === '/api/paiements') return savePaiementOffline(data);
  if (chemin === '/api/absences') return saveAbsenceOffline(data);
  const m = chemin.match(/^\/api\/evaluations\/([^/]+)\/notes$/);
  if (m) return saveNotesOffline({ evaluationId: m[1], notes: data.notes });
  return null;
}

export const useAxios = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const request = useCallback(async (method, url, data = null, options = {}) => {
    setLoading(true);
    setError(null);

    try {
      const response = await axiosInstance({
        method,
        url,
        data,
        ...options
      });
      
      setLoading(false);
      return response.data;
      
    } catch (err) {
      setLoading(false);
      const message = err.response?.data?.error || err.message || 'Erreur';
      setError(message);
      
      if (!options.silent) {
        toast.error(message);
      }
      
      throw err;
    }
  }, []);

  const get = useCallback((url, options) => request('get', url, null, options), [request]);
  const post = useCallback((url, data, options) => request('post', url, data, options), [request]);
  const put = useCallback((url, data, options) => request('put', url, data, options), [request]);
  const del = useCallback((url, options) => request('delete', url, null, options), [request]);

  return { loading, error, get, post, put, delete: del, request };
};

export default useAxios;
