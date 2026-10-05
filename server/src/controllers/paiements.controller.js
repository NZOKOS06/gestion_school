import { prisma } from '../utils/prisma.js';
import { createLogger } from '../utils/logger.js';
import { logAudit } from '../utils/auditLogger.js';

import {
  applyPaymentToEcheance,
  applyPaymentCascade,
  categorieEcheance,
  listByInscription,
  listRetards,
  normalizeModePaiement,
  resteAPayer,
  syncInscriptionSolde,
} from '../services/echeances.service.js';

import {
  formatMontant,
  safeOrderBy,
} from '../utils/formatters.js';

import { loadSchoolPdfMeta } from '../services/pdf/schoolMeta.js';
import { buildRecuPdf } from '../services/pdf/recu.pdf.js';
import { buildJournalCaissePdf } from '../services/pdf/journalCaisse.pdf.js';
import { buildSituationFinancierePdf } from '../services/pdf/situationFinanciere.pdf.js';

import {
  uploadPdfBuffer,
  isCloudinaryConfigured,
} from '../utils/cloudinary.js';

import { sendRelanceEcheance } from '../services/email.service.js';

import {
  broadcastPaiement,
  broadcastPaiementEchu,
} from '../utils/notifications.js';


const log = createLogger('paiements.controller');


// ============================================================
// HELPERS
// ============================================================

async function recuPdfPayload(
  full,
  tenantId,
  req,
  allocation = null
) {
  const meta = await loadSchoolPdfMeta(tenantId, req);

  const echeance = allocation
    ? null
    : full.echeance;

  const libelle =
    allocation?.libelle ||
    echeance?.libelle ||
    full.motif ||
    null;

  const montant =
    allocation?.montant != null
      ? Number(allocation.montant)
      : Number(full.montant);

  const isAvance =
    Boolean(allocation?.avance) ||
    /^avance/i.test(String(libelle || ''));

  return {
    ...meta,

    numeroRecu: full.numeroRecu,

    datePaiement: full.datePaiement,

    montant,

    typePaiement: isAvance
      ? 'autre'
      : (full.typePaiement || 'scolarite'),

    modePaiement: full.modePaiement,

    reference: full.reference,

    motif: isAvance
      ? 'Avance sur scolarité'
      : (full.motif || null),

    libelle,

    periode: libelle,

    dateEcheance:
      allocation?.dateEcheance ||
      echeance?.dateEcheance ||
      null,

    eleve: `${full.inscription.eleve.prenom} ${full.inscription.eleve.nom}`,

    matricule:
      full.inscription.eleve.matricule,

    classe:
      full.inscription.classe?.nom,

    anneeScolaire:
      full.inscription.anneeScolaire?.libelle,

    recuPar: full.recuPar
      ? `${full.recuPar.prenom} ${full.recuPar.nom}`
      : null,

    parent: full.inscription.eleve.parent
      ? `${full.inscription.eleve.parent.prenom} ${full.inscription.eleve.parent.nom}`
      : null,
  };
}


async function loadPaiementFull(id, tenantId) {
  return prisma.paiement.findFirst({
    where: {
      id,
      tenantId,
    },

    include: {
      inscription: {
        include: {
          eleve: {
            select: {
              id: true,
              matricule: true,
              nom: true,
              prenom: true,

              parent: {
                select: {
                  id: true,
                  email: true,
                  nom: true,
                  prenom: true,
                },
              },

              parentId: true,
            },
          },

          classe: {
            select: {
              id: true,
              nom: true,
            },
          },

          anneeScolaire: {
            select: {
              id: true,
              libelle: true,
            },
          },
        },
      },

      recuPar: {
        select: {
          id: true,
          nom: true,
          prenom: true,
        },
      },

      echeance: true,
    },
  });
}


async function attachRecuPdf(
  paiement,
  tenantId,
  req,
  allocation = null
) {
  try {
    const full = await loadPaiementFull(
      paiement.id,
      tenantId
    );

    if (!full) {
      return null;
    }

    const payload = await recuPdfPayload(
      full,
      tenantId,
      req,
      allocation
    );

    const buffer = await buildRecuPdf(payload);

    if (
      isCloudinaryConfigured() &&
      buffer
    ) {
      try {
        const uploaded = await uploadPdfBuffer(
          buffer,
          `recu-${full.numeroRecu}`
        );

        if (uploaded?.secure_url) {
          return uploaded.secure_url;
        }
      } catch (uploadError) {
        log.warn(
          {
            err: uploadError,
            paiementId: paiement.id,
          },
          'Cloudinary upload failed'
        );
      }
    }

    return null;
  } catch (pdfErr) {
    log.warn(
      {
        err: pdfErr,
        paiementId: paiement.id,
      },
      'PDF recu generation failed'
    );

    return null;
  }
}


// ============================================================
// GET RECU PDF
// ============================================================

export const getRecuPdf = async (req, res) => {
  try {
    const paiement = await loadPaiementFull(
      req.params.id,
      req.tenantId
    );

    if (!paiement) {
      return res.status(404).json({
        error: 'Paiement non trouvé',
      });
    }

    // Vérification supplémentaire pour les parents
    if (req.user.role === 'parent') {
      const parentId = req.user.id;

      const eleveParentId =
        paiement.inscription?.eleve?.parent?.id;

      if (eleveParentId !== parentId) {
        return res.status(403).json({
          error: 'Accès refusé',
        });
      }
    }

    // IMPORTANT :
    // Le payload doit être construit AVANT d'être utilisé.
    const payload = await recuPdfPayload(
      paiement,
      req.tenantId,
      req
    );

    const format = String(
      req.query.format || 'a4'
    ).toLowerCase();

    payload.format = format;

    const buffer = await buildRecuPdf(
      payload,
      format
    );

    const filename =
      format === 'thermique' ||
      format === 'pos'
        ? `recu-${paiement.numeroRecu}-ticket.pdf`
        : `recu-${paiement.numeroRecu}.pdf`;

    res.setHeader(
      'Content-Type',
      'application/pdf'
    );

    res.setHeader(
      'Content-Disposition',
      `inline; filename="${filename}"`
    );

    res.send(buffer);

  } catch (error) {
    log.error(
      {
        err: error,
        tenantId: req.tenantId,
        id: req.params.id,
      },
      'Get recu PDF error'
    );

    res.status(500).json({
      error: 'Internal server error',
    });
  }
};