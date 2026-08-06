import { useState, useEffect, useCallback } from 'react';
import { useSocket } from './useSocket';

const MAX_NOTIFICATIONS = 50;

export function useNotifications() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const { on, off } = useSocket();

  const add = useCallback((notif) => {
    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      ...notif,
      createdAt: new Date(),
      read: false,
    };
    setNotifications((prev) => [entry, ...prev].slice(0, MAX_NOTIFICATIONS));
    setUnreadCount((prev) => prev + 1);
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  }, []);

  const markRead = useCallback((id) => {
    setNotifications((prev) =>
      prev.map((n) => {
        if (n.id === id && !n.read) {
          setUnreadCount((c) => Math.max(0, c - 1));
          return { ...n, read: true };
        }
        return n;
      })
    );
  }, []);

  const clear = useCallback(() => {
    setNotifications([]);
    setUnreadCount(0);
  }, []);

  useEffect(() => {
    const handlers = {
      stockAlerte: (data) =>
        add({
          type: 'stock',
          title: 'Alerte effectif',
          message: `${data.classe || data.eleve} — effectif critique (${data.effectif} élèves)`,
          icon: 'Package',
          color: 'danger',
        }),

      peremptionAlerte: (data) =>
        add({
          type: 'peremption',
          title: 'Échéance proche',
          message: `Échéance de ${data.eleve} — ${data.joursRestants} jours restants`,
          icon: 'Clock',
          color: 'warning',
        }),

      nouvelleOrdonnance: (data) =>
        add({
          type: 'inscription',
          title: 'Nouvelle inscription',
          message: `Inscription de ${data.nomEleve || 'un élève'} en attente de validation`,
          icon: 'FileText',
          color: 'info',
        }),

      nouvelleVente: (data) =>
        add({
          type: 'paiement',
          title: 'Nouveau paiement',
          message: `Paiement #${data.numeroPaiement} — ${data.montantTotal} FCFA`,
          icon: 'ShoppingCart',
          color: 'success',
        }),

      livraisonMAJ: (data) =>
        add({
          type: 'communication',
          title: 'Communication mise à jour',
          message: `Message #${data.messageId} → ${data.statut}`,
          icon: 'MessageCircle',
          color: 'info',
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
