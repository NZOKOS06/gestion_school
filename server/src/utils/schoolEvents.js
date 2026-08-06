import { io } from '../index.js';

// Émission d'événements temps réel pour GestSchool

export const emitNouvelleNote = (tenantSlug, note) => {
  const room = `tenant-${tenantSlug}-staff`;
  io?.to(room).emit('nouvelleNote', {
    type: 'note_saisie',
    noteId: note.id,
    eleveId: note.eleveId,
    evaluationId: note.evaluationId,
    valeur: note.valeur,
    timestamp: new Date().toISOString(),
  });
};

export const emitNouvelleAbsence = (tenantSlug, absence) => {
  const room = `tenant-${tenantSlug}-staff`;
  io?.to(room).emit('nouvelleAbsence', {
    type: 'absence_saisie',
    absenceId: absence.id,
    eleveId: absence.eleveId,
    dateAbsence: absence.dateAbsence,
    timestamp: new Date().toISOString(),
  });
};

export const emitNouvelleSanction = (tenantSlug, sanction) => {
  const room = `tenant-${tenantSlug}-staff`;
  io?.to(room).emit('nouvelleSanction', {
    type: 'sanction_saisie',
    sanctionId: sanction.id,
    eleveId: sanction.eleveId,
    typeSanction: sanction.type,
    timestamp: new Date().toISOString(),
  });
};

export const emitPaiementEncaisse = (tenantSlug, paiement) => {
  const room = `tenant-${tenantSlug}-staff`;
  io?.to(room).emit('paiementEncaisse', {
    type: 'paiement_encaisse',
    paiementId: paiement.id,
    numeroRecu: paiement.numeroRecu,
    montant: paiement.montant,
    modePaiement: paiement.modePaiement,
    timestamp: new Date().toISOString(),
  });
};

export const emitPaiementEchu = (tenantSlug, echeance) => {
  const room = `tenant-${tenantSlug}-staff`;
  io?.to(room).emit('paiementEchu', {
    type: 'paiement_echu',
    echeanceId: echeance.id,
    libelle: echeance.libelle,
    montantAttendu: echeance.montantAttendu,
    timestamp: new Date().toISOString(),
  });
};

export const emitBulletinGenere = (tenantSlug, bulletin) => {
  const room = `tenant-${tenantSlug}-staff`;
  io?.to(room).emit('bulletinGenere', {
    type: 'bulletin_genere',
    bulletinId: bulletin.id,
    eleveId: bulletin.eleveId,
    moyenneGenerale: bulletin.moyenneGenerale,
    timestamp: new Date().toISOString(),
  });
};

export const emitNotificationParent = (userId, notification) => {
  const room = `parent-room-${userId}`;
  io?.to(room).emit('notification', {
    ...notification,
    timestamp: new Date().toISOString(),
  });
};

export const emitNotificationStaff = (tenantSlug, notification) => {
  const room = `tenant-${tenantSlug}-staff`;
  io?.to(room).emit('notification', {
    ...notification,
    timestamp: new Date().toISOString(),
  });
};

const STAFF_ROLES = [
  'directeur',
  'directeur_etudes',
  'secretaire',
  'enseignant',
  'surveillant',
  'comptable',
  'super_admin',
];

export const setupSocketRooms = (socket) => {
  const { tenantSlug, userId, role, userType } = socket.handshake.auth || {};

  if (tenantSlug && STAFF_ROLES.includes(role)) {
    socket.join(`tenant-${tenantSlug}-staff`);
  }

  if (userId && (userType === 'parent' || role === 'parent')) {
    socket.join(`parent-room-${userId}`);
  }

  if (userId) {
    socket.join(`parent-room-${userId}`);
  }

  socket.on('disconnect', () => {
    // Nettoyage automatique des rooms
  });
};
