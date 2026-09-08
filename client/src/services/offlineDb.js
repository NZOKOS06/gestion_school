/**
 * offlineDb.js
 *
 * Base de données locale IndexedDB native pour le mode Offline-First de GestSchool.
 * Permet à l'école de continuer à travailler (encaissement caisse, appel, notes)
 * en cas de coupure de connexion internet.
 */

const DB_NAME = 'GestSchool_OfflineDB';
const DB_VERSION = 1;

let dbInstance = null;

/**
 * Initialise et ouvre la connexion IndexedDB.
 * @returns {Promise<IDBDatabase>}
 */
export function openDb() {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // 1. Cache des élèves pour recherche / autocomplétion hors-ligne
      if (!db.objectStoreNames.contains('eleves')) {
        const storeEleves = db.createObjectStore('eleves', { keyPath: 'id' });
        storeEleves.createIndex('classeId', 'classeId', { unique: false });
        storeEleves.createIndex('matricule', 'matricule', { unique: false });
      }

      // 2. Cache des classes & matières
      if (!db.objectStoreNames.contains('classes')) {
        db.createObjectStore('classes', { keyPath: 'id' });
      }

      // 3. Encaissements de caisse hors-ligne
      if (!db.objectStoreNames.contains('caisseOffline')) {
        const storeCaisse = db.createObjectStore('caisseOffline', { keyPath: 'id' });
        storeCaisse.createIndex('statut', 'statut', { unique: false });
        storeCaisse.createIndex('createdAt', 'createdAt', { unique: false });
      }

      // 4. Fiches d'appel d'absences hors-ligne
      if (!db.objectStoreNames.contains('absencesQueue')) {
        db.createObjectStore('absencesQueue', { keyPath: 'id' });
      }

      // 5. Notes saisies hors-ligne
      if (!db.objectStoreNames.contains('notesQueue')) {
        db.createObjectStore('notesQueue', { keyPath: 'id' });
      }

      // 6. File générale des actions de synchronisation en attente
      if (!db.objectStoreNames.contains('syncQueue')) {
        const storeSync = db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
        storeSync.createIndex('type', 'type', { unique: false });
        storeSync.createIndex('createdAt', 'createdAt', { unique: false });
      }

      // 7. Métadonnées (dernière sync, config établissement)
      if (!db.objectStoreNames.contains('metadata')) {
        db.createObjectStore('metadata', { keyPath: 'key' });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = event.target.result;
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      console.error('[OfflineDB] Erreur ouverture IndexedDB:', event.target.error);
      reject(event.target.error);
    };
  });
}

// ─── Helpers Transactions Génériques ──────────────────────────────────────────

async function getStore(storeName, mode = 'readonly') {
  const db = await openDb();
  const tx = db.transaction(storeName, mode);
  return tx.objectStore(storeName);
}

export async function putItem(storeName, item) {
  const store = await getStore(storeName, 'readwrite');
  return new Promise((resolve, reject) => {
    const req = store.put(item);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getAllItems(storeName) {
  const store = await getStore(storeName, 'readonly');
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteItem(storeName, key) {
  const store = await getStore(storeName, 'readwrite');
  return new Promise((resolve, reject) => {
    const req = store.delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function clearStore(storeName) {
  const store = await getStore(storeName, 'readwrite');
  return new Promise((resolve, reject) => {
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ─── API Métier Offline ───────────────────────────────────────────────────────

/**
 * Met en cache la liste des élèves pour consultation et saisie hors-ligne.
 */
export async function cacheEleves(elevesList) {
  if (!Array.isArray(elevesList)) return;
  const store = await getStore('eleves', 'readwrite');
  for (const eleve of elevesList) {
    store.put(eleve);
  }
}

/**
 * Récupère les élèves d'une classe depuis le cache local.
 */
export async function getElevesByClasse(classeId) {
  const db = await openDb();
  const tx = db.transaction('eleves', 'readonly');
  const store = tx.objectStore('eleves');
  const index = store.index('classeId');

  return new Promise((resolve, reject) => {
    const req = index.getAll(classeId);
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Enregistre un paiement hors-ligne dans la forteresse locale.
 * Génère un identifiant local sécurisé et met en file d'attente de synchronisation.
 */
export async function savePaiementOffline(paiementData) {
  const localId = `offline-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
  const record = {
    ...paiementData,
    id: localId,
    offline: true,
    statut: 'en_attente_sync',
    createdAt: new Date().toISOString(),
  };

  await putItem('caisseOffline', record);
  await putItem('syncQueue', {
    type: 'PAIEMENT',
    payload: record,
    createdAt: new Date().toISOString(),
  });

  return record;
}

/**
 * Enregistre une fiche d'appel d'absence hors-ligne.
 */
export async function saveAbsenceOffline(absenceData) {
  const localId = `abs-offline-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
  const record = {
    ...absenceData,
    id: localId,
    offline: true,
    createdAt: new Date().toISOString(),
  };

  await putItem('absencesQueue', record);
  await putItem('syncQueue', {
    type: 'ABSENCE',
    payload: record,
    createdAt: new Date().toISOString(),
  });

  return record;
}

/**
 * Enregistre un paquet de notes d'évaluation hors-ligne.
 */
export async function saveNotesOffline(notesData) {
  const localId = `note-offline-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
  const record = {
    ...notesData,
    id: localId,
    offline: true,
    createdAt: new Date().toISOString(),
  };

  await putItem('notesQueue', record);
  await putItem('syncQueue', {
    type: 'NOTES',
    payload: record,
    createdAt: new Date().toISOString(),
  });

  return record;
}

/**
 * Calcule le nombre total d'actions en attente de synchronisation vers le serveur.
 */
export async function getPendingSyncCount() {
  try {
    const items = await getAllItems('syncQueue');
    return items.length;
  } catch {
    return 0;
  }
}
