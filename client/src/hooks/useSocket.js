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
      console.log('[Socket] Connecté');
    });

    socket.on('disconnect', () => {
      console.log('[Socket] Déconnecté');
    });

    // Événements scolaires — Staff
    socket.on('nouvelleNote', (data) => {
      toast.success(`Nouvelle note saisie : ${data.valeur}/20`, {
        duration: 5000,
        icon: '📝',
      });
    });

    socket.on('nouvelleAbsence', (data) => {
      toast.warning(`Absence enregistrée : ${data.eleveNom}`, {
        duration: 5000,
        icon: '📋',
      });
    });

    socket.on('nouvelleSanction', (data) => {
      toast(`Sanction attribuée à ${data.eleveNom}`, {
        duration: 5000,
        icon: '⚠️',
      });
    });

    socket.on('paiementEncaisse', (data) => {
      toast.success(`Paiement encaissé : ${data.montant} FCFA`, {
        duration: 5000,
        icon: '💰',
      });
    });

    socket.on('actualitePubliee', (data) => {
      toast(`Nouvelle actualité : ${data.titre}`, {
        duration: 5000,
        icon: '📢',
      });
    });

    socket.on('notification', (data) => {
      toast(data.message || data.titre, {
        duration: 5000,
        icon: data.type === 'success' ? '✅' : data.type === 'warning' ? '⚠️' : 'ℹ️',
      });
    });

    return () => {
      socket.disconnect();
    };
  }, [user, slug]);

  // Rejoindre une room spécifique (ex: classe-{classeId})
  const joinRoom = useCallback((roomName) => {
    socketRef.current?.emit('join-room', roomName);
  }, []);

  const leaveRoom = useCallback((roomName) => {
    socketRef.current?.emit('leave-room', roomName);
  }, []);

  const on = useCallback((event, callback) => {
    socketRef.current?.on(event, callback);
  }, []);

  const off = useCallback((event, callback) => {
    socketRef.current?.off(event, callback);
  }, []);

  return {
    socket: socketRef.current,
    joinRoom,
    leaveRoom,
    on,
    off,
  };
};

export default useSocket;
