import { prisma } from './prisma.js';
import { createLogger } from './logger.js';
import {
  emitNotificationParent,
  emitNotificationStaff,
  emitNouvelleNote,
  emitNouvelleAbsence,
  emitNouvelleSanction,
  emitPaiementEncaisse,
  emitPaiementEchu,
  emitBulletinGenere,
} from './schoolEvents.js';

const log = createLogger('Notifications');

/**
 * Persist + push a notification to a parent user.
 */
export async function notifyParent({
  tenantId,
  userId,
  type = 'systeme',
  titre,
  contenu,
  lien = null,
  tenantSlug = null,
}) {
  if (!userId || !tenantId) return null;

  try {
    const notif = await prisma.notification.create({
      data: {
        tenantId,
        userId,
        type,
        titre,
        contenu,
        lien,
      },
    });

    emitNotificationParent(userId, {
      id: notif.id,
      type: notif.type,
      titre: notif.titre,
      contenu: notif.contenu,
      message: notif.contenu,
      lien: notif.lien,
      lu: false,
    });

    return notif;
  } catch (err) {
    log.warn({ err, userId, type }, 'notifyParent failed');
    return null;
  }
}

/**
 * Persist + push a notification to a staff member.
 */
export async function notifyStaff({
  tenantId,
  staffId,
  type = 'systeme',
  titre,
  contenu,
  lien = null,
  tenantSlug = null,
}) {
  if (!staffId || !tenantId) return null;

  try {
    const notif = await prisma.notification.create({
      data: {
        tenantId,
        staffId,
        type,
        titre,
        contenu,
        lien,
      },
    });

    emitNotificationStaff(tenantId, {
      id: notif.id,
      type: notif.type,
      titre: notif.titre,
      contenu: notif.contenu,
      message: notif.contenu,
      lien: notif.lien,
      lu: false,
      staffId,
    });

    return notif;
  } catch (err) {
    log.warn({ err, staffId, type }, 'notifyStaff failed');
    return null;
  }
}

export async function getParentUserIdForEleve(tenantId, eleveId) {
  const eleve = await prisma.eleve.findFirst({
    where: { id: eleveId, tenantId },
    select: { parentId: true },
  });
  return eleve?.parentId || null;
}

export async function notifyParentOfEleve(tenantId, eleveId, payload, tenantSlug = null) {
  const userId = await getParentUserIdForEleve(tenantId, eleveId);
  if (!userId) return null;
  return notifyParent({ tenantId, userId, tenantSlug, ...payload });
}

/** Staff room + parent when a note is saved */
export async function broadcastNote(tenantSlug, tenantId, note) {
  emitNouvelleNote(tenantId, note);
  await notifyParentOfEleve(tenantId, note.eleveId, {
    type: 'note',
    titre: 'Nouvelle note',
    contenu: `Une note a été saisie pour votre enfant (valeur: ${note.valeur}).`,
    lien: '/parent/notes',
  }, tenantSlug);
}

export async function broadcastAbsence(tenantSlug, tenantId, absence) {
  emitNouvelleAbsence(tenantId, absence);
  await notifyParentOfEleve(tenantId, absence.eleveId, {
    type: 'absence',
    titre: 'Absence signalée',
    contenu: `Une absence a été enregistrée le ${new Date(absence.dateAbsence).toLocaleDateString('fr-FR')}.`,
    lien: '/parent/absences',
  }, tenantSlug);
}

export async function broadcastSanction(tenantSlug, tenantId, sanction) {
  emitNouvelleSanction(tenantId, sanction);
  await notifyParentOfEleve(tenantId, sanction.eleveId, {
    type: 'sanction',
    titre: 'Sanction disciplinaire',
    contenu: `Une sanction (${sanction.type || 'disciplinaire'}) a été enregistrée.`,
    lien: '/parent/sanctions',
  }, tenantSlug);
}

export async function broadcastPaiement(tenantSlug, tenantId, paiement, parentUserId = null) {
  emitPaiementEncaisse(tenantId, paiement);
  const userId = parentUserId
    || (paiement.inscription?.eleve?.parentId)
    || (paiement.inscription?.eleve?.parent?.id);
  if (userId) {
    await notifyParent({
      tenantId,
      userId,
      type: 'paiement',
      titre: 'Paiement encaissé',
      contenu: `Paiement de ${Number(paiement.montant).toLocaleString('fr-FR')} FCFA enregistré (reçu n°${paiement.numeroRecu}).`,
      lien: '/parent/facturation',
      tenantSlug,
    });
  }
}

export async function broadcastPaiementEchu(tenantSlug, tenantId, echeance, parentUserId) {
  emitPaiementEchu(tenantId, echeance);
  if (parentUserId) {
    await notifyParent({
      tenantId,
      userId: parentUserId,
      type: 'relance_impaye',
      titre: 'Échéance en retard',
      contenu: `L'échéance « ${echeance.libelle} » est en retard. Merci de régulariser.`,
      lien: '/parent/facturation',
      tenantSlug,
    });
  }
}

export async function broadcastBulletin(tenantSlug, tenantId, bulletin) {
  emitBulletinGenere(tenantId, bulletin);
  await notifyParentOfEleve(tenantId, bulletin.eleveId, {
    type: 'bulletin',
    titre: 'Bulletin publié',
    contenu: `Le bulletin (période ${bulletin.periodeIndex}) est disponible. Moyenne: ${Number(bulletin.moyenneGenerale).toFixed(2)}.`,
    lien: '/parent/bulletins',
  }, tenantSlug);
}
