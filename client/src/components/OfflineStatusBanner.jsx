/**
 * OfflineStatusBanner.jsx
 *
 * Bandeau d'état réseau et de synchronisation temps réel pour GestSchool.
 * Informe les utilisateurs du mode Hors-Ligne et permet de déclencher
 * la synchronisation dès retour du réseau.
 */

import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react';
import { subscribeSyncState, syncPendingActions, initOfflineSyncEngine } from '../services/offlineSync.js';

export default function OfflineStatusBanner() {
  const [syncState, setSyncState] = useState({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    isSyncing: false,
    pendingCount: 0,
  });
  const [justSynced, setJustSynced] = useState(false);

  useEffect(() => {
    initOfflineSyncEngine();
    const unsubscribe = subscribeSyncState((state) => {
      setSyncState((prev) => ({
        ...prev,
        ...state,
      }));
    });
    return unsubscribe;
  }, []);

  const handleManualSync = async () => {
    const res = await syncPendingActions();
    if (res.syncedCount > 0) {
      setJustSynced(true);
      setTimeout(() => setJustSynced(false), 4000);
    }
  };

  // Si en ligne sans opération en attente et sans synchro récente, masquer le bandeau
  if (syncState.isOnline && syncState.pendingCount === 0 && !syncState.isSyncing && !justSynced) {
    return null;
  }

  return (
    <div
      className={`w-full px-4 py-2 text-sm font-medium transition-all duration-300 flex items-center justify-between shadow-sm z-50 ${
        !syncState.isOnline
          ? 'bg-amber-600 text-white'
          : syncState.isSyncing
          ? 'bg-blue-600 text-white'
          : justSynced
          ? 'bg-emerald-600 text-white'
          : 'bg-amber-500 text-white'
      }`}
    >
      <div className="flex items-center space-x-2">
        {!syncState.isOnline ? (
          <>
            <WifiOff className="w-4 h-4 animate-pulse text-amber-200" />
            <span>
              <strong>Mode Hors-Ligne</strong> — Connexion coupée. Vos encaissements et saisies sont enregistrés localement sur cet appareil.
            </span>
          </>
        ) : syncState.isSyncing ? (
          <>
            <RefreshCw className="w-4 h-4 animate-spin text-blue-200" />
            <span>Synchronisation en cours avec le serveur GestSchool...</span>
          </>
        ) : justSynced ? (
          <>
            <CheckCircle2 className="w-4 h-4 text-emerald-200" />
            <span>Toutes les opérations hors-ligne ont été synchronisées avec succès !</span>
          </>
        ) : (
          <>
            <AlertTriangle className="w-4 h-4 text-amber-200" />
            <span>
              Réseau rétabli — <strong>{syncState.pendingCount}</strong> opération(s) en attente de transmission.
            </span>
          </>
        )}
      </div>

      <div className="flex items-center space-x-3">
        {syncState.pendingCount > 0 && (
          <span className="bg-black/20 px-2 py-0.5 rounded text-xs">
            {syncState.pendingCount} en attente
          </span>
        )}

        {syncState.isOnline && syncState.pendingCount > 0 && !syncState.isSyncing && (
          <button
            onClick={handleManualSync}
            className="bg-white text-slate-900 hover:bg-slate-100 px-3 py-1 rounded text-xs font-semibold flex items-center space-x-1.5 transition-colors shadow-sm"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Synchroniser maintenant</span>
          </button>
        )}
      </div>
    </div>
  );
}
