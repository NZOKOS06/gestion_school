import { io } from '../index.js';

// Émission d'événements temps réel
export const emitStockAlerte = (tenantSlug, medicament) => {
  const room = `tenant-${tenantSlug}-staff`;
  io?.to(room).emit('stockAlerte', {
    type: 'stock_critique',
    medicamentId: medicament.id,
    dci: medicament.dci,
    nomCommercial: medicament.nomCommercial,
    stockTotal: medicament.stockTotal,
    seuilAlerte: medicament.seuilAlerte,
    timestamp: new Date().toISOString()
  });
};

export const emitPeremptionAlerte = (tenantSlug, lot) => {
  const room = `tenant-${tenantSlug}-staff`;
  io?.to(room).emit('peremptionAlerte', {
    type: 'peremption_proche',
    lotId: lot.id,
    medicamentId: lot.medicamentId,
    numeroLot: lot.numeroLot,
    datePeremption: lot.datePeremption,
    quantiteRestante: lot.quantiteRestante,
    timestamp: new Date().toISOString()
  });
};

export const emitNouvelleVente = (tenantSlug, vente) => {
  const room = `tenant-${tenantSlug}-staff`;
  io?.to(room).emit('nouvelleVente', {
    venteId: vente.id,
    numeroVente: vente.numeroVente,
    montantTotal: vente.montantTotal,
    typeVente: vente.typeVente,
    statut: vente.statut,
    createdAt: vente.createdAt,
    timestamp: new Date().toISOString()
  });
};

export const emitNouvelleOrdonnance = (tenantSlug, ordonnance) => {
  const room = `tenant-${tenantSlug}-staff`;
  io?.to(room).emit('nouvelleOrdonnance', {
    ordonnanceId: ordonnance.id,
    nomMedecin: ordonnance.nomMedecin,
    statut: ordonnance.statut,
    createdAt: ordonnance.createdAt,
    timestamp: new Date().toISOString()
  });
};

export const emitLivraisonMAJ = (livraisonId, data) => {
  const room = `livraison-${livraisonId}`;
  io?.to(room).emit('livraisonMAJ', {
    livraisonId,
    ...data,
    timestamp: new Date().toISOString()
  });
};

export const emitOrderUpdated = (orderId, data) => {
  const room = `order-room-${orderId}`;
  io?.to(room).emit('orderUpdated', {
    orderId,
    ...data,
    timestamp: new Date().toISOString()
  });
};

export const emitNotificationClient = (userId, notification) => {
  const room = `client-room-${userId}`;
  io?.to(room).emit('notification', {
    ...notification,
    timestamp: new Date().toISOString()
  });
};

// Configuration des rooms Socket.IO
export const setupSocketRooms = (socket) => {
  // Authentification du socket via handshake
  const { tenantSlug, userId, role } = socket.handshake.auth;

  if (tenantSlug && (role === 'pharmacien' || role === 'admin' || role === 'vendeur' || 
                     role === 'preparateur' || role === 'caissier' || role === 'livreur')) {
    socket.join(`tenant-${tenantSlug}-staff`);
  }

  if (userId) {
    socket.join(`client-room-${userId}`);
  }

  // Join room spécifique pour le suivi de livraison
  socket.on('join-livraison', (livraisonId) => {
    socket.join(`livraison-${livraisonId}`);
  });

  socket.on('leave-livraison', (livraisonId) => {
    socket.leave(`livraison-${livraisonId}`);
  });

  socket.on('join-order-room', (orderId) => {
    if (orderId) socket.join(`order-room-${orderId}`);
  });

  socket.on('leave-order-room', (orderId) => {
    if (orderId) socket.leave(`order-room-${orderId}`);
  });

  socket.on('disconnect', () => {
    // Nettoyage automatique des rooms
  });
};
