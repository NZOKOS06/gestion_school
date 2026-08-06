import { prisma } from '../utils/prisma.js';
import { createLogger } from '../utils/logger.js';
import { logAudit } from '../utils/auditLogger.js';
import {
  applyPaymentToEcheance,
  listByInscription,
  listRetards,
  normalizeModePaiement,
} from '../services/echeances.service.js';
import { buildRecuPdf } from '../services/pdf/recu.pdf.js';
import { uploadPdfBuffer, isCloudinaryConfigured } from '../utils/cloudinary.js';
import { sendRelanceEcheance } from '../services/email.service.js';
import { broadcastPaiement, broadcastPaiementEchu } from '../utils/notifications.js';

const log = createLogger('PaiementsController');

async function loadPaiementFull(id, tenantId) {
  return prisma.paiement.findFirst({
    where: { id, tenantId },
    include: {
      inscription: {
        include: {
          eleve: {
            select: {
              id: true,
              matricule: true,
              nom: true,
              prenom: true,
              parent: { select: { id: true, email: true, nom: true, prenom: true } },
              parentId: true,
            },
          },
          classe: { select: { id: true, nom: true } },
          anneeScolaire: { select: { id: true, libelle: true } },
        },
      },
      recuPar: { select: { id: true, nom: true, prenom: true } },
      echeance: true,
    },
  });
}

export const getAll = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { page = 1, limit = 20, search, inscriptionId, typePaiement, modePaiement, type, dateDebut, dateFin, sortBy = 'datePaiement', order = 'desc' } = req.query;
    const take = parseInt(limit);
    const skip = (parseInt(page) - 1) * take;

    const where = { tenantId };
    if (inscriptionId) where.inscriptionId = inscriptionId;
    if (typePaiement || type) where.typePaiement = typePaiement || type;
    if (modePaiement) where.modePaiement = normalizeModePaiement(modePaiement);
    if (dateDebut || dateFin) {
      where.datePaiement = {};
      if (dateDebut) where.datePaiement.gte = new Date(dateDebut);
      if (dateFin) where.datePaiement.lte = new Date(dateFin);
    }
    if (search) {
      where.inscription = {
        eleve: {
          OR: [
            { matricule: { contains: search, mode: 'insensitive' } },
            { nom: { contains: search, mode: 'insensitive' } },
            { prenom: { contains: search, mode: 'insensitive' } },
          ],
        },
      };
    }

    const orderBy = {};
    orderBy[sortBy] = order;

    const [rows, total] = await Promise.all([
      prisma.paiement.findMany({
        where,
        include: {
          inscription: {
            select: {
              id: true,
              eleve: { select: { id: true, matricule: true, nom: true, prenom: true } },
              classe: { select: { id: true, nom: true } },
              anneeScolaire: { select: { id: true, libelle: true } },
            },
          },
          recuPar: { select: { id: true, nom: true, prenom: true } },
        },
        skip,
        take,
        orderBy,
      }),
      prisma.paiement.count({ where }),
    ]);

    const data = rows.map((p) => ({
      ...p,
      elevePrenom: p.inscription?.eleve?.prenom,
      eleveNom: p.inscription?.eleve?.nom,
      matricule: p.inscription?.eleve?.matricule,
      classeNom: p.inscription?.classe?.nom,
      montant: Number(p.montant),
    }));

    res.json({
      data,
      pagination: {
        page: parseInt(page),
        limit: take,
        total,
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId }, 'Get all paiements error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getById = async (req, res) => {
  try {
    const paiement = await loadPaiementFull(req.params.id, req.tenantId);
    if (!paiement) return res.status(404).json({ error: 'Paiement non trouvé' });
    res.json(paiement);
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId, id: req.params.id }, 'Get paiement by ID error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getEcheances = async (req, res) => {
  try {
    const { inscriptionId } = req.query;
    if (!inscriptionId) {
      return res.status(400).json({ error: 'inscriptionId requis' });
    }
    const data = await listByInscription(req.tenantId, inscriptionId);
    res.json(data);
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId }, 'getEcheances error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getEcheancesRetard = async (req, res) => {
  try {
    const data = await listRetards(req.tenantId);
    res.json(data);
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId }, 'getEcheancesRetard error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const batchRelances = async (req, res) => {
  try {
    const { runRelancesBatch } = await import('../jobs/relances.job.js');
    const result = await runRelancesBatch({ tenantId: req.tenantId });
    await logAudit(req, 'echeances_relance_batch', 'Echeance', null, result);
    res.json({ message: 'Relances batch exécutées', ...result });
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId }, 'batchRelances error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const relancerEcheance = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;

    const echeance = await prisma.echeance.findFirst({
      where: { id, tenantId },
      include: {
        inscription: {
          include: {
            eleve: {
              include: { parent: true },
            },
            classe: true,
          },
        },
      },
    });
    if (!echeance) return res.status(404).json({ error: 'Échéance non trouvée' });

    const parentEmail = echeance.inscription?.eleve?.parent?.email;
    const config = await prisma.tenantConfig.findUnique({ where: { tenantId } });
    const reste = Number(echeance.montantAttendu) - Number(echeance.montantPaye);

    if (parentEmail) {
      try {
        await sendRelanceEcheance({
          to: parentEmail,
          nomApp: config?.nomEcole || 'GestSchool',
          eleveNom: `${echeance.inscription.eleve.prenom} ${echeance.inscription.eleve.nom}`,
          libelle: echeance.libelle,
          montantReste: reste,
          devise: config?.devise || 'FCFA',
          dateEcheance: echeance.dateEcheance,
        });
      } catch (emailErr) {
        log.warn({ err: emailErr }, 'Relance email failed (logged)');
      }
    }

    await prisma.echeance.update({
      where: { id },
      data: { lastRelanceAt: new Date() },
    });

    try {
      await broadcastPaiementEchu(
        req.tenant?.slug,
        tenantId,
        echeance,
        echeance.inscription?.eleve?.parentId || echeance.inscription?.eleve?.parent?.id
      );
    } catch { /* optional */ }

    await logAudit(req, 'echeance_relance', 'Echeance', id, {
      parentEmail: parentEmail || null,
      reste,
    });

    res.json({
      message: parentEmail ? 'Relance envoyée' : 'Aucun email parent — relance enregistrée',
      sent: !!parentEmail,
    });
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId }, 'relancerEcheance error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const create = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { inscriptionId, echeanceId, montant, typePaiement, modePaiement, reference, motif } = req.body;
    const amount = parseFloat(montant);
    if (!inscriptionId || !amount || amount <= 0) {
      return res.status(400).json({ error: 'inscriptionId et montant > 0 requis' });
    }

    const mode = normalizeModePaiement(modePaiement);

    const paiement = await prisma.$transaction(async (tx) => {
      const inscription = await tx.inscription.findFirst({
        where: { id: inscriptionId, tenantId },
      });
      if (!inscription) {
        const err = new Error('INSCRIPTION_NOT_FOUND');
        throw err;
      }

      if (echeanceId) {
        const ech = await tx.echeance.findFirst({
          where: { id: echeanceId, tenantId, inscriptionId },
        });
        if (!ech) {
          throw new Error('ECHEANCE_NOT_FOUND');
        }
      }

      const lastPaiement = await tx.paiement.findFirst({
        where: { tenantId },
        orderBy: { numeroRecu: 'desc' },
        select: { numeroRecu: true },
      });
      const numeroRecu = (lastPaiement?.numeroRecu || 0) + 1;

      const created = await tx.paiement.create({
        data: {
          tenantId,
          inscriptionId,
          echeanceId: echeanceId || null,
          numeroRecu,
          montant: amount,
          typePaiement: typePaiement || 'scolarite',
          modePaiement: mode,
          reference: reference || null,
          motif: motif || null,
          recuParId: req.user.id,
        },
      });

      const newSolde = Math.max(0, Number(inscription.soldeScolarite) - amount);
      await tx.inscription.update({
        where: { id: inscriptionId },
        data: { soldeScolarite: newSolde },
      });

      await applyPaymentToEcheance(tx, echeanceId, amount);

      return created;
    });

    // PDF after commit
    let pdfUrl = null;
    try {
      const full = await loadPaiementFull(paiement.id, tenantId);
      const config = await prisma.tenantConfig.findUnique({ where: { tenantId } });
      const buffer = await buildRecuPdf({
        nomEcole: config?.nomEcole || req.tenant?.nom || 'GestSchool',
        numeroRecu: full.numeroRecu,
        datePaiement: full.datePaiement,
        montant: full.montant,
        devise: config?.devise || 'FCFA',
        typePaiement: full.typePaiement,
        modePaiement: full.modePaiement,
        reference: full.reference,
        motif: full.motif,
        eleve: `${full.inscription.eleve.prenom} ${full.inscription.eleve.nom}`,
        matricule: full.inscription.eleve.matricule,
        classe: full.inscription.classe?.nom,
        anneeScolaire: full.inscription.anneeScolaire?.libelle,
        recuPar: full.recuPar ? `${full.recuPar.prenom} ${full.recuPar.nom}` : null,
      });

      if (isCloudinaryConfigured()) {
        try {
          pdfUrl = await uploadPdfBuffer(buffer, {
            folder: 'gestschool/recus',
            publicId: `recu-${tenantId.slice(0, 8)}-${paiement.numeroRecu}`,
          });
        } catch (upErr) {
          log.warn({ err: upErr }, 'Cloudinary recu upload failed');
        }
      }

      if (pdfUrl) {
        await prisma.paiement.update({ where: { id: paiement.id }, data: { pdfUrl } });
      }
    } catch (pdfErr) {
      log.warn({ err: pdfErr }, 'PDF recu generation failed');
    }

    const result = await loadPaiementFull(paiement.id, tenantId);

    await logAudit(req, 'paiement_created', 'Paiement', paiement.id, {
      montant: amount,
      modePaiement: mode,
      inscriptionId,
      echeanceId: echeanceId || null,
    });

    try {
      await broadcastPaiement(req.tenant?.slug, tenantId, result);
    } catch { /* optional */ }

    res.status(201).json(result);
  } catch (error) {
    if (error.message === 'INSCRIPTION_NOT_FOUND') {
      return res.status(404).json({ error: 'Inscription non trouvée' });
    }
    if (error.message === 'ECHEANCE_NOT_FOUND') {
      return res.status(404).json({ error: 'Échéance non trouvée' });
    }
    log.error({ err: error, tenantId: req.tenantId }, 'Create paiement error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getRecu = async (req, res) => {
  try {
    const paiement = await loadPaiementFull(req.params.id, req.tenantId);
    if (!paiement) return res.status(404).json({ error: 'Paiement non trouvé' });

    res.json({
      recu: {
        numeroRecu: paiement.numeroRecu,
        datePaiement: paiement.datePaiement,
        montant: Number(paiement.montant),
        typePaiement: paiement.typePaiement,
        modePaiement: paiement.modePaiement,
        reference: paiement.reference,
        eleve: `${paiement.inscription.eleve.prenom} ${paiement.inscription.eleve.nom}`,
        matricule: paiement.inscription.eleve.matricule,
        classe: paiement.inscription.classe.nom,
        anneeScolaire: paiement.inscription.anneeScolaire.libelle,
        recuPar: paiement.recuPar ? `${paiement.recuPar.prenom} ${paiement.recuPar.nom}` : null,
        pdfUrl: paiement.pdfUrl || null,
      },
    });
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId, id: req.params.id }, 'Get recu error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getRecuPdf = async (req, res) => {
  try {
    const paiement = await loadPaiementFull(req.params.id, req.tenantId);
    if (!paiement) return res.status(404).json({ error: 'Paiement non trouvé' });

    if (req.user.role === 'parent') {
      const parentId = req.user.id;
      const eleveParentId = paiement.inscription?.eleve?.parent?.id;
      if (eleveParentId !== parentId) {
        return res.status(403).json({ error: 'Accès refusé' });
      }
    }

    const config = await prisma.tenantConfig.findUnique({ where: { tenantId: req.tenantId } });
    const buffer = await buildRecuPdf({
      nomEcole: config?.nomEcole || req.tenant?.nom || 'GestSchool',
      numeroRecu: paiement.numeroRecu,
      datePaiement: paiement.datePaiement,
      montant: paiement.montant,
      devise: config?.devise || 'FCFA',
      typePaiement: paiement.typePaiement,
      modePaiement: paiement.modePaiement,
      reference: paiement.reference,
      motif: paiement.motif,
      eleve: `${paiement.inscription.eleve.prenom} ${paiement.inscription.eleve.nom}`,
      matricule: paiement.inscription.eleve.matricule,
      classe: paiement.inscription.classe?.nom,
      anneeScolaire: paiement.inscription.anneeScolaire?.libelle,
      recuPar: paiement.recuPar ? `${paiement.recuPar.prenom} ${paiement.recuPar.nom}` : null,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="recu-${paiement.numeroRecu}.pdf"`);
    res.send(buffer);
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId, id: req.params.id }, 'Get recu PDF error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const remove = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;

    await prisma.$transaction(async (tx) => {
      const existing = await tx.paiement.findFirst({ where: { id, tenantId } });
      if (!existing) throw new Error('NOT_FOUND');

      await tx.inscription.update({
        where: { id: existing.inscriptionId },
        data: {
          soldeScolarite: { increment: Number(existing.montant) },
        },
      });

      if (existing.echeanceId) {
        const ech = await tx.echeance.findUnique({ where: { id: existing.echeanceId } });
        if (ech) {
          const montantPaye = Math.max(0, Number(ech.montantPaye) - Number(existing.montant));
          await tx.echeance.update({
            where: { id: ech.id },
            data: {
              montantPaye,
              statut: montantPaye >= Number(ech.montantAttendu) - 0.01 ? 'payee' : 'en_attente',
            },
          });
        }
      }

      await tx.paiement.delete({ where: { id } });
    });

    await logAudit(req, 'paiement_deleted', 'Paiement', id, {});

    res.json({ message: 'Paiement supprimé' });
  } catch (error) {
    if (error.message === 'NOT_FOUND') {
      return res.status(404).json({ error: 'Paiement non trouvé' });
    }
    log.error({ err: error, tenantId: req.tenantId, id: req.params.id }, 'Delete paiement error');
    res.status(500).json({ error: 'Internal server error' });
  }
};
