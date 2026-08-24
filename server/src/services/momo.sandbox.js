import crypto from 'crypto';
import { prisma } from '../utils/prisma.js';
import { applyPaymentToEcheance, applyPaymentCascade, syncInscriptionSolde } from './echeances.service.js';
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
 * Un montant multi-mois génère autant de reçus partagés que d'allocations.
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

  const { created } = await prisma.$transaction(async (tx) => {
    const inscription = await tx.inscription.findFirst({
      where: { id: intent.inscriptionId, tenantId: intent.tenantId },
    });
    if (!inscription) throw new Error('INSCRIPTION_NOT_FOUND');

    let allocations = [];

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
      allocations = [{
        echeanceId: intent.echeanceId,
        libelle: ech.libelle,
        montant: intent.montant,
        dateEcheance: ech.dateEcheance,
      }];
    } else {
      const cascade = await applyPaymentCascade(
        tx,
        intent.tenantId,
        intent.inscriptionId,
        intent.montant
      );
      allocations = cascade.allocations?.length
        ? cascade.allocations
        : [{
          echeanceId: null,
          libelle: intent.motif || 'Paiement Mobile Money',
          montant: intent.montant,
          dateEcheance: null,
        }];
    }

    const lastPaiement = await tx.paiement.findFirst({
      where: { tenantId: intent.tenantId },
      orderBy: { numeroRecu: 'desc' },
      select: { numeroRecu: true },
    });
    let nextNumero = (lastPaiement?.numeroRecu || 0) + 1;
    const rows = [];

    for (const alloc of allocations) {
      const isAvance = Boolean(alloc.avance) || /^avance/i.test(String(alloc.libelle || ''));
      const row = await tx.paiement.create({
        data: {
          tenantId: intent.tenantId,
          inscriptionId: intent.inscriptionId,
          echeanceId: alloc.echeanceId || null,
          numeroRecu: nextNumero,
          montant: Number(alloc.montant),
          typePaiement: isAvance ? 'autre' : 'scolarite',
          modePaiement: 'mobile_money',
          reference: intent.reference,
          motif: isAvance
            ? (alloc.libelle || 'Avance sur scolarité')
            : (intent.motif || alloc.libelle || null),
          recuParId,
        },
      });
      rows.push({ paiement: row, allocation: alloc });
      nextNumero += 1;
    }

    await syncInscriptionSolde(tx, intent.tenantId, intent.inscriptionId);
    return { created: rows };
  });

  intent.status = 'confirmed';
  pending.delete(reference);

  const primary = created[0]?.paiement;
  if (!primary) throw new Error('PAIEMENT_NOT_CREATED');

  const results = [];
  try {
    for (const item of created) {
      const full = await prisma.paiement.findFirst({
        where: { id: item.paiement.id },
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
          echeance: true,
        },
      });
      const meta = await loadSchoolPdfMeta(intent.tenantId);
      const buffer = await buildRecuPdf({
        ...meta,
        numeroRecu: full.numeroRecu,
        datePaiement: full.datePaiement,
        montant: full.montant,
        typePaiement: full.typePaiement,
        modePaiement: full.modePaiement,
        reference: full.reference,
        motif: full.motif,
        libelle: item.allocation?.libelle || full.echeance?.libelle || full.motif,
        periode: item.allocation?.libelle || full.echeance?.libelle,
        dateEcheance: item.allocation?.dateEcheance || full.echeance?.dateEcheance,
        eleve: `${full.inscription.eleve.prenom} ${full.inscription.eleve.nom}`,
        matricule: full.inscription.eleve.matricule,
        classe: full.inscription.classe?.nom,
        anneeScolaire: full.inscription.anneeScolaire?.libelle,
        recuPar: full.recuPar ? `${full.recuPar.prenom} ${full.recuPar.nom}` : 'Mobile Money',
        parent: full.inscription.eleve.parent
          ? `${full.inscription.eleve.parent.prenom} ${full.inscription.eleve.parent.nom}`
          : null,
      });
      if (isCloudinaryConfigured()) {
        try {
          const pdfUrl = await uploadPdfBuffer(buffer, {
            folder: 'gestschool/recus',
            publicId: `recu-momo-${full.numeroRecu}`,
          });
          if (pdfUrl) {
            await prisma.paiement.update({ where: { id: full.id }, data: { pdfUrl } });
            full.pdfUrl = pdfUrl;
          }
        } catch (upErr) {
          log.warn({ err: upErr }, 'MoMo recu upload failed');
        }
      }
      results.push(full);
    }

    if (results[0]) {
      await broadcastPaiement(tenantSlug, intent.tenantId, results[0]);
    }

    return {
      ...results[0],
      paiements: results,
      recusPartages: results.map((p) => ({
        id: p.id,
        numeroRecu: p.numeroRecu,
        montant: Number(p.montant),
        motif: p.motif,
        pdfUrl: p.pdfUrl || null,
      })),
    };
  } catch (err) {
    log.warn({ err }, 'MoMo post-confirm extras failed');
    return {
      ...primary,
      paiements: created.map((c) => c.paiement),
      recusPartages: created.map((c) => ({
        id: c.paiement.id,
        numeroRecu: c.paiement.numeroRecu,
        montant: Number(c.paiement.montant),
        motif: c.paiement.motif,
        pdfUrl: null,
      })),
    };
  }
}
