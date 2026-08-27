import { io } from '../index.js';

/** Salle staff isolée par tenantId JWT — jamais un slug client. */
export const staffRoom = (tenantId) => (tenantId ? `staff-tenant-${tenantId}` : null);

export const emitNouvelleNote = (tenantId, note) => {
  const room = staffRoom(tenantId);
  if (!room) return;
  io?.to(room).emit('nouvelleNote', {
    type: 'note_saisie',
    noteId: note.id,
    eleveId: note.eleveId,
    evaluationId: note.evaluationId,
    valeur: note.valeur,
    timestamp: new Date().toISOString(),
  });
};

export const emitNouvelleAbsence = (tenantId, absence) => {
  const room = staffRoom(tenantId);
  if (!room) return;
  io?.to(room).emit('nouvelleAbsence', {
    type: 'absence_saisie',
    absenceId: absence.id,
    eleveId: absence.eleveId,
    dateAbsence: absence.dateAbsence,
    timestamp: new Date().toISOString(),
  });
};

export const emitNouvelleSanction = (tenantId, sanction) => {
  const room = staffRoom(tenantId);
  if (!room) return;
  io?.to(room).emit('nouvelleSanction', {
    type: 'sanction_saisie',
    sanctionId: sanction.id,
    eleveId: sanction.eleveId,
    typeSanction: sanction.type,
    timestamp: new Date().toISOString(),
  });
};

export const emitPaiementEncaisse = (tenantId, paiement) => {
  const room = staffRoom(tenantId);
  if (!room) return;
  io?.to(room).emit('paiementEncaisse', {
    type: 'paiement_encaisse',
    paiementId: paiement.id,
    numeroRecu: paiement.numeroRecu,
    montant: paiement.montant,
    modePaiement: paiement.modePaiement,
    timestamp: new Date().toISOString(),
  });
};

export const emitPaiementEchu = (tenantId, echeance) => {
  const room = staffRoom(tenantId);
  if (!room) return;
  io?.to(room).emit('paiementEchu', {
    type: 'paiement_echu',
    echeanceId: echeance.id,
    libelle: echeance.libelle,
    montantAttendu: echeance.montantAttendu,
    timestamp: new Date().toISOString(),
  });
};

export const emitBulletinGenere = (tenantId, bulletin) => {
  const room = staffRoom(tenantId);
  if (!room) return;
  io?.to(room).emit('bulletinGenere', {
    type: 'bulletin_genere',
    bulletinId: bulletin.id,
    eleveId: bulletin.eleveId,
    moyenneGenerale: bulletin.moyenneGenerale,
    timestamp: new Date().toISOString(),
  });
};

export const emitNotificationParent = (userId, notification) => {
  if (!userId) return;
  io?.to(`parent-room-${userId}`).emit('notification', {
    ...notification,
    timestamp: new Date().toISOString(),
  });
};

export const emitNotificationStaff = (tenantId, notification) => {
  const room = staffRoom(tenantId);
  if (!room) return;
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
];

export const setupSocketRooms = (socket) => {
  const { userId, role, tenantId } = socket.handshake.auth || {};

  if (tenantId && STAFF_ROLES.includes(role)) {
    socket.join(staffRoom(tenantId));
  }

  if (userId && role === 'parent') {
    socket.join(`parent-room-${userId}`);
  }
};
