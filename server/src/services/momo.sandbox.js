import crypto from 'crypto';
import { prisma } from '../utils/prisma.js';
import { applyPaymentToEcheance, applyPaymentCascade, syncInscriptionSolde, listByInscription } from './echeances.service.js';
import { buildRecuPdf } from './pdf/recu.pdf.js';
import { loadSchoolPdfMeta } from './pdf/schoolMeta.js';
import { uploadPdfBuffer, isCloudinaryConfigured } from '../utils/cloudinary.js';
import { broadcastPaiement } from '../utils/notifications.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('MomoSandbox');

/** @type {Map<string, object>} */
const pending = new Map();

const PENDING_TTL_MS = 30 * 60 * 1000;

function pruneExpired() {
  const now = Date.now();
  for (const [ref, intent] of pending.entries()) {
    if (now - intent.createdAt > PENDING_TTL_MS) pending.delete(ref);
  }
}

export function initSandboxPayment({
  tenantId,
  parentId,
  eleveId,
  inscriptionId,
  echeanceId,
  montant,
  motif,
}) {
  pruneExpired();
  const reference = `MOMO-SIM-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
  const intent = {
    reference,
    tenantId,
    parentId,
    eleveId,
    inscriptionId,
    echeanceId: echeanceId || null,
    montant: Number(montant),
    motif: motif || 'Paiement Mobile Money (sandbox)',
    status: 'pending',
    createdAt: Date.now(),
  };
  pending.set(reference, intent);
  return {
    paymentId: reference,
    reference,
    status: 'pending',
    montant: intent.montant,
    simulateUrl: `/api/parent/paiements/${reference}/confirm`,
  };
}

export function getPending(reference) {
  pruneExpired();
  return pending.get(reference) || null;
}

async function resolveRecuParId(tenantId) {
  const staff = await prisma.staff.findFirst({
    where: {
      tenantId,
      actif: true,
      role: { in: ['comptable', 'directeur', 'secretaire'] },
    },
    orderBy: { role: 'asc' },
  });
  return staff?.id || null;
}

/**
 * Confirm sandbox payment → ACID paiement like caisse.
 */
export async function confirmSandboxPayment(reference, { tenantSlug = null } = {}) {
  const intent = getPending(reference);
  if (!intent) {
    const err = new Error('INTENT_NOT_FOUND');
    throw err;
  }
  if (intent.status !== 'pending') {
    const err = new Error('INTENT_NOT_PENDING');
    throw err;
  }

  const recuParId = await resolveRecuParId(intent.tenantId);
  if (!recuParId) {
    const err = new Error('NO_STAFF_RECEIVER');
    throw err;
  }

  const paiement = await prisma.$transaction(async (tx) => {
    const inscription = await tx.inscription.findFirst({
      where: { id: intent.inscriptionId, tenantId: intent.tenantId },
    });
    if (!inscription) throw new Error('INSCRIPTION_NOT_FOUND');

    let resolvedEcheanceId = intent.echeanceId || null;

    if (intent.echeanceId) {
      const ech = await tx.echeance.findFirst({
        where: {
          id: intent.echeanceId,
          tenantId: intent.tenantId,
          inscriptionId: intent.inscriptionId,
        },
      });
      if (!ech) throw new Error('ECHEANCE_NOT_FOUND');
      await applyPaymentToEcheance(tx, intent.echeanceId, intent.montant);
    } else {
      const cascade = await applyPaymentCascade(
        tx,
        intent.tenantId,
        intent.inscriptionId,
        intent.montant
      );
      resolvedEcheanceId = cascade.allocations[0]?.echeanceId || null;
    }

    const lastPaiement = await tx.paiement.findFirst({
      where: { tenantId: intent.tenantId },
      orderBy: { numeroRecu: 'desc' },
      select: { numeroRecu: true },
    });
    const numeroRecu = (lastPaiement?.numeroRecu || 0) + 1;

    const created = await tx.paiement.create({
      data: {
        tenantId: intent.tenantId,
        inscriptionId: intent.inscriptionId,
        echeanceId: resolvedEcheanceId,
        numeroRecu,
        montant: intent.montant,
        typePaiement: 'scolarite',
        modePaiement: 'mobile_money',
        reference: intent.reference,
        motif: intent.motif,
        recuParId,
      },
    });

    await syncInscriptionSolde(tx, intent.tenantId, intent.inscriptionId);
    return created;
  });

  intent.status = 'confirmed';
  pending.delete(reference);

  // PDF optional
  try {
    const full = await prisma.paiement.findFirst({
      where: { id: paiement.id },
      include: {
        inscription: {
          include: {
            eleve: {
              select: {
                prenom: true,
                nom: true,
                matricule: true,
                parentId: true,
                parent: { select: { id: true, prenom: true, nom: true } },
              },
            },
            classe: { select: { nom: true } },
            anneeScolaire: { select: { libelle: true } },
          },
        },
        recuPar: { select: { prenom: true, nom: true } },
      },
    });
    const meta = await loadSchoolPdfMeta(intent.tenantId);
    const echeances = full.inscriptionId || full.inscription?.id
      ? await listByInscription(intent.tenantId, full.inscriptionId || full.inscription.id)
      : [];
    const buffer = await buildRecuPdf({
      ...meta,
      numeroRecu: full.numeroRecu,
      datePaiement: full.datePaiement,
      montant: full.montant,
      typePaiement: full.typePaiement,
      modePaiement: full.modePaiement,
      reference: full.reference,
      motif: full.motif,
      eleve: `${full.inscription.eleve.prenom} ${full.inscription.eleve.nom}`,
      matricule: full.inscription.eleve.matricule,
      classe: full.inscription.classe?.nom,
      anneeScolaire: full.inscription.anneeScolaire?.libelle,
      recuPar: full.recuPar ? `${full.recuPar.prenom} ${full.recuPar.nom}` : 'Mobile Money',
      parent: full.inscription.eleve.parent
        ? `${full.inscription.eleve.parent.prenom} ${full.inscription.eleve.parent.nom}`
        : null,
      echeances,
    });
    if (isCloudinaryConfigured()) {
      try {
        const pdfUrl = await uploadPdfBuffer(buffer, {
          folder: 'gestschool/recus',
          publicId: `recu-momo-${paiement.numeroRecu}`,
        });
        if (pdfUrl) {
          await prisma.paiement.update({ where: { id: paiement.id }, data: { pdfUrl } });
          full.pdfUrl = pdfUrl;
        }
      } catch (upErr) {
        log.warn({ err: upErr }, 'MoMo recu upload failed');
      }
    }
    await broadcastPaiement(tenantSlug, intent.tenantId, full);
    return full;
  } catch (err) {
    log.warn({ err }, 'MoMo post-confirm extras failed');
    return paiement;
  }
}
