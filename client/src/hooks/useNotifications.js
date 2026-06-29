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
          title: 'Alerte stock',
          message: `${data.medicament || data.dci} — stock critique (${data.stockTotal} unités)`,
          icon: 'Package',
          color: 'danger',
        }),

      peremptionAlerte: (data) =>
        add({
          type: 'peremption',
          title: 'Péremption proche',
          message: `Lot ${data.numeroLot} de ${data.medicament} expire dans ${data.joursRestants} jours`,
          icon: 'Clock',
          color: 'warning',
        }),

      nouvelleOrdonnance: (data) =>
        add({
          type: 'ordonnance',
          title: 'Nouvelle ordonnance',
          message: `Ordonnance de ${data.nomClient || 'un client'} en attente de validation`,
          icon: 'FileText',
          color: 'info',
        }),

      nouvelleVente: (data) =>
        add({
          type: 'vente',
          title: 'Nouvelle vente',
          message: `Vente #${data.numeroVente} — ${data.montantTotal} FCFA`,
          icon: 'ShoppingCart',
          color: 'success',
        }),

      livraisonMAJ: (data) =>
        add({
          type: 'livraison',
          title: 'Livraison mise à jour',
          message: `Livraison #${data.livraisonId} → ${data.statut}`,
          icon: 'MapPin',
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
