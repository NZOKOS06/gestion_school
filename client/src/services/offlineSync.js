/**
 * offlineSync.js
 *
 * Moteur de synchronisation en arrière-plan (Background Sync).
 * Détecte le rétablissement du réseau internet et rejoue automatiquement
 * toutes les opérations de caisse, appels et notes enregistrées hors-ligne.
 */

import axiosInstance from '../utils/axios.js';
import { getAllItems, deleteItem, putItem, getPendingSyncCount } from './offlineDb.js';

// Système d'abonnements pour mettre à jour l'interface en temps réel
const listeners = new Set();

export function subscribeSyncState(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function notifyListeners(state) {
  listeners.forEach((cb) => {
    try {
      cb(state);
    } catch (e) {
      console.error('[OfflineSync] Erreur listener:', e);
    }
  });
}

let isSyncing = false;

/**
 * Rejoue toutes les opérations de la file d'attente IndexedDB vers l'API GestSchool.
 * @returns {Promise<{ success: boolean, syncedCount: number, errors: Array }>}
 */
export async function syncPendingActions() {
  if (isSyncing) return { success: false, message: 'Synchronisation déjà en cours' };
  if (!navigator.onLine) {
    notifyListeners({ isOnline: false, isSyncing: false, pendingCount: await getPendingSyncCount() });
    return { success: false, message: 'Toujours hors-ligne' };
  }

  isSyncing = true;
  notifyListeners({ isOnline: true, isSyncing: true, pendingCount: await getPendingSyncCount() });

  const queue = await getAllItems('syncQueue');
  let syncedCount = 0;
  const errors = [];

  for (const item of queue) {
    try {
      if (item.type === 'PAIEMENT') {
        const { id, offline, statut, ...payload } = item.payload;
        await axiosInstance.post('/api/paiements', payload);
        // Marquer comme synchronisé dans caisseOffline
        await putItem('caisseOffline', { ...item.payload, statut: 'synchronise' });
      } else if (item.type === 'ABSENCE') {
        const { id, offline, ...payload } = item.payload;
        await axiosInstance.post('/api/absences', payload);
      } else if (item.type === 'NOTES') {
        const { id, offline, evaluationId, notes } = item.payload;
        await axiosInstance.post(`/api/evaluations/${evaluationId}/notes`, { notes });
      }

      // Retirer de la file IndexedDB
      await deleteItem('syncQueue', item.id);
      syncedCount++;
    } catch (err) {
      console.warn('[OfflineSync] Échec synchronisation item:', item, err);
      errors.push({ item, error: err.message });
      // Si c'est une erreur réseau (re-déconnexion), on interrompt le cycle
      if (!err.response) {
        break;
      }
    }
  }

  isSyncing = false;
  const pendingCount = await getPendingSyncCount();
  notifyListeners({ isOnline: navigator.onLine, isSyncing: false, pendingCount });

  return {
    success: errors.length === 0,
    syncedCount,
    pendingCount,
    errors,
  };
}

/**
 * Initialise les écouteurs d'événements réseau au démarrage de l'application.
 */
export function initOfflineSyncEngine() {
  if (typeof window === 'undefined') return;

  const handleOnline = () => {
    console.log('[OfflineSync] Réseau internet rétabli ! Démarrage de la synchronisation...');
    notifyListeners({ isOnline: true, isSyncing: false, pendingCount: null });
    // Petit délai de stabilisation réseau avant de vider la file
    setTimeout(() => {
      syncPendingActions();
    }, 1500);
  };

  const handleOffline = async () => {
    console.warn('[OfflineSync] Connexion perdue. Bascule en mode Hors-Ligne.');
    notifyListeners({ isOnline: false, isSyncing: false, pendingCount: await getPendingSyncCount() });
  };

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  // Vérification initiale
  getPendingSyncCount().then((count) => {
    notifyListeners({ isOnline: navigator.onLine, isSyncing: false, pendingCount: count });
  });
}
