import { useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../contexts/AuthContext';
import { useTenant } from '../contexts/TenantContext';
import toast from 'react-hot-toast';

export const useSocket = () => {
  const socketRef = useRef(null);
  const { user } = useAuth();
  const { slug } = useTenant();

  useEffect(() => {
    if (!user) return;

    const SOCKET_URL = import.meta.env.VITE_SOCKET_URL
      || import.meta.env.VITE_API_URL
      || window.location.origin;

    const socket = io(SOCKET_URL, {
      auth: {
        tenantSlug: slug,
        userId: user.id,
        role: user.role
      },
      withCredentials: true,
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Socket connected');
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected');
    });

    socket.on('stockAlerte', (data) => {
      toast.error(`Stock critique: ${data.dci} (${data.stockTotal} restant)`, {
        duration: 6000,
        icon: '⚠️'
      });
    });

    socket.on('peremptionAlerte', (data) => {
      toast(`Péremption proche: ${data.numeroLot}`, {
        duration: 5000,
        icon: '⏰'
      });
    });

    socket.on('nouvelleOrdonnance', () => {
      toast.info('Nouvelle ordonnance reçue', {
        duration: 4000
      });
    });

    socket.on('notification', (data) => {
      toast(data.message, {
        duration: 5000,
        icon: data.type === 'success' ? '✅' : data.type === 'warning' ? '⚠️' : 'ℹ️'
      });
    });

    return () => {
      socket.disconnect();
    };
  }, [user, slug]);

  const joinLivraison = useCallback((livraisonId) => {
    socketRef.current?.emit('join-livraison', livraisonId);
  }, []);

  const leaveLivraison = useCallback((livraisonId) => {
    socketRef.current?.emit('leave-livraison', livraisonId);
  }, []);

  const on = useCallback((event, callback) => {
    socketRef.current?.on(event, callback);
  }, []);

  const off = useCallback((event, callback) => {
    socketRef.current?.off(event, callback);
  }, []);

  return {
    socket: socketRef.current,
    joinLivraison,
    leaveLivraison,
    on,
    off
  };
};

export default useSocket;
