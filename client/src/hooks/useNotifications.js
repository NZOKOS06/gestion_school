import { useState, useEffect, useCallback } from 'react';
import { useSocket } from './useSocket';
import { useAxios } from './useAxios';
import { useAuth } from '../contexts/AuthContext';

const MAX_NOTIFICATIONS = 50;

const STAFF_ROLES = [
  'directeur',
  'directeur_etudes',
  'secretaire',
  'enseignant',
  'surveillant',
  'comptable',
  'super_admin',
];

export function useNotifications() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const { on, off } = useSocket();
  const { get, put } = useAxios();
  const { user } = useAuth();
  const isParent = user?.role === 'parent';
  const isStaff = STAFF_ROLES.includes(user?.role);

  const add = useCallback((notif) => {
    const entry = {
      id: notif.id || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      type: notif.type || 'systeme',
      title: notif.titre || notif.title || 'Notification',
      message: notif.contenu || notif.message || '',
      lien: notif.lien || null,
      createdAt: notif.createdAt ? new Date(notif.createdAt) : new Date(),
      read: !!(notif.lu || notif.read),
    };
    setNotifications((prev) => {
      if (prev.some((n) => n.id === entry.id)) return prev;
      return [entry, ...prev].slice(0, MAX_NOTIFICATIONS);
    });
    if (!entry.read) {
      setUnreadCount((prev) => prev + 1);
    }
  }, []);

  const markAllRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    try {
      if (isParent) {
        await put('/api/parent/notifications/read-all', {}, { silent: true });
      } else if (isStaff) {
        await put('/api/notifications/read-all', {}, { silent: true });
      }
    } catch { /* ignore */ }
  }, [put, isParent, isStaff]);

  const markRead = useCallback(async (id) => {
    setNotifications((prev) =>
      prev.map((n) => {
        if (n.id === id && !n.read) {
          setUnreadCount((c) => Math.max(0, c - 1));
          return { ...n, read: true };
        }
        return n;
      })
    );
    try {
      if (isParent) {
        await put(`/api/parent/notifications/${id}/read`, {}, { silent: true });
      } else if (isStaff) {
        await put(`/api/notifications/${id}/read`, {}, { silent: true });
      }
    } catch { /* ignore */ }
  }, [put, isParent, isStaff]);

  const clear = useCallback(() => {
    setNotifications([]);
    setUnreadCount(0);
  }, []);

  useEffect(() => {
    if (!isParent && !isStaff) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const endpoint = isParent ? '/api/parent/notifications' : '/api/notifications';
        const res = await get(endpoint, { silent: true });
        const rows = res?.data || res || [];
        if (cancelled || !Array.isArray(rows)) return;
        setNotifications(
          rows.slice(0, MAX_NOTIFICATIONS).map((n) => ({
            id: n.id,
            type: n.type,
            title: n.titre,
            message: n.contenu,
            lien: n.lien,
            createdAt: new Date(n.createdAt),
            read: !!n.lu,
          }))
        );
        setUnreadCount(rows.filter((n) => !n.lu).length);
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [get, isParent, isStaff]);

  useEffect(() => {
    const handlers = {
      notification: (data) =>
        add({
          id: data.id,
          type: data.type || 'systeme',
          titre: data.titre || 'Notification',
          contenu: data.contenu || data.message,
          lien: data.lien,
        }),

      nouvelleNote: (data) =>
        add({
          type: 'note',
          titre: 'Nouvelle note',
          contenu: `Note saisie (valeur: ${data.valeur ?? '—'})`,
          lien: '/parent/notes',
        }),

      nouvelleAbsence: (data) =>
        add({
          type: 'absence',
          titre: 'Absence signalée',
          contenu: data.dateAbsence
            ? `Absence du ${new Date(data.dateAbsence).toLocaleDateString('fr-FR')}`
            : 'Une absence a été enregistrée',
          lien: '/parent/absences',
        }),

      nouvelleSanction: () =>
        add({
          type: 'sanction',
          titre: 'Sanction disciplinaire',
          contenu: 'Une sanction a été enregistrée pour votre enfant',
          lien: '/parent/sanctions',
        }),

      paiementEncaisse: (data) =>
        add({
          type: 'paiement',
          titre: 'Paiement encaissé',
          contenu: `Reçu n°${data.numeroRecu ?? '—'} — ${data.montant ?? ''} FCFA`,
          lien: '/parent/facturation',
        }),

      paiementEchu: (data) =>
        add({
          type: 'relance_impaye',
          titre: 'Échéance en retard',
          contenu: data.libelle
            ? `L'échéance « ${data.libelle} » est en retard`
            : 'Une échéance de scolarité est en retard',
          lien: '/parent/facturation',
        }),

      bulletinGenere: (data) =>
        add({
          type: 'bulletin',
          titre: 'Bulletin disponible',
          contenu: data.moyenneGenerale != null
            ? `Bulletin publié — moyenne ${Number(data.moyenneGenerale).toFixed(2)}`
            : 'Un bulletin a été publié',
          lien: '/parent/bulletins',
        }),
    };

    Object.entries(handlers).forEach(([event, handler]) => {
      on(event, handler);
    });

    return () => {
      Object.entries(handlers).forEach(([event, handler]) => {
        off(event, handler);
      });
    };
  }, [on, off, add]);

  return { notifications, unreadCount, markAllRead, markRead, clear };
}
