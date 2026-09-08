/**
 * useOfflineSync.js
 * Hook React pour intégrer les capacités offline dans n'importe quel composant.
 * Expose : statut réseau, queue de sync, et helpers pour enregistrer des opérations offline.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { offlineDb } from './offlineDb';
import { offlineSyncService } from './offlineSync';

// ─── Constantes ───────────────────────────────────────────────────────────────
const PING_INTERVAL_MS = 10_000; // Vérification toutes les 10s
const PING_URL = '/api/health';   // Endpoint léger du serveur

// ─── Hook principal ───────────────────────────────────────────────────────────
export function useOfflineSync() {
  const [isOnline, setIsOnline]         = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing]       = useState(false);
  const [lastSyncAt, setLastSyncAt]     = useState(null);
  const pingTimerRef = useRef(null);

  // ── Mettre à jour le compteur depuis IndexedDB ────────────────────────────
  const refreshPendingCount = useCallback(async () => {
    try {
      const queue = await offlineDb.getSyncQueue();
      const pending = queue.filter(op => op.status === 'pending' || op.status === 'error');
      setPendingCount(pending.length);
    } catch {
      // IndexedDB non disponible (SSR ou private mode)
    }
  }, []);

  // ── Ping serveur pour confirmer connectivité réelle ───────────────────────
  const pingServer = useCallback(async () => {
    try {
      const res = await fetch(PING_URL, { method: 'HEAD', cache: 'no-store' });
      const reachable = res.ok;
      setIsOnline(reachable);
      if (reachable) {
        // Réseau retrouvé : déclencher la synchro
        const hadSync = await triggerSync();
        if (hadSync) setLastSyncAt(new Date());
      }
    } catch {
      setIsOnline(false);
    }
  }, []); // eslint-disable-line

  // ── Déclencher la synchronisation manuelle ────────────────────────────────
  const triggerSync = useCallback(async () => {
    if (isSyncing) return false;
    const queue = await offlineDb.getSyncQueue();
    const pending = queue.filter(op => op.status === 'pending' || op.status === 'error');
    if (pending.length === 0) return false;

    setIsSyncing(true);
    try {
      await offlineSyncService.flush();
      await refreshPendingCount();
      return true;
    } catch (err) {
      console.error('[offlineSync] Erreur lors du flush :', err);
      return false;
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, refreshPendingCount]);

  // ── Enregistrer une opération offline (appelé par les composants POS/notes) ─
  const enqueue = useCallback(async (operation) => {
    /**
     * @param {Object} operation
     *   @param {'PAIEMENT'|'ABSENCE'|'NOTE'} operation.type
     *   @param {string} operation.url      - Endpoint API cible
     *   @param {'POST'|'PUT'|'PATCH'} operation.method
     *   @param {Object} operation.payload  - Corps de la requête
     *   @param {string} [operation.label]  - Label lisible (affiché dans la bannière)
     */
    try {
      await offlineDb.addToSyncQueue({
        ...operation,
        id: `${operation.type}_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        status: 'pending',
        createdAt: new Date().toISOString(),
        retries: 0,
      });
      await refreshPendingCount();
    } catch (err) {
      console.error('[offlineSync] Impossible d'enregistrer l\'opération :', err);
      throw err;
    }
  }, [refreshPendingCount]);

  // ── Lifecycle ────────────────────────────────────────────────────────────
  useEffect(() => {
    // Compteur initial
    refreshPendingCount();

    // Événements navigateur
    const handleOnline  = () => { setIsOnline(true);  pingServer(); };
    const handleOffline = () => { setIsOnline(false); refreshPendingCount(); };

    window.addEventListener('online',  handleOnline);
    window.addEventListener('offline', handleOffline);

    // Ping périodique (ne pas se fier uniquement à navigator.onLine)
    pingTimerRef.current = setInterval(pingServer, PING_INTERVAL_MS);

    return () => {
      window.removeEventListener('online',  handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(pingTimerRef.current);
    };
  }, [pingServer, refreshPendingCount]);

  return {
    /** true si le réseau est disponible ET le serveur joignable */
    isOnline,
    /** Nombre d'opérations en attente de synchronisation */
    pendingCount,
    /** true pendant la synchronisation */
    isSyncing,
    /** Date/heure de la dernière sync réussie */
    lastSyncAt,
    /** Enregistrer une mutation pour replay offline */
    enqueue,
    /** Déclencher manuellement la synchronisation */
    triggerSync,
    /** Rafraîchir le compteur depuis IndexedDB */
    refreshPendingCount,
  };
}

// ─── Hook simplifié pour les composants qui n'ont besoin que du statut ────────
export function useOnlineStatus() {
  const { isOnline, pendingCount } = useOfflineSync();
  return { isOnline, pendingCount };
}
