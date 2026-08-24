import { prisma } from '../utils/prisma.js';
import { createLogger } from '../utils/logger.js';
import { logAudit } from '../utils/auditLogger.js';
import {
  applyPaymentToEcheance,
  applyPaymentCascade,
  listByInscription,
  listRetards,
  normalizeModePaiement,
  resteAPayer,
  syncInscriptionSolde,
} from '../services/echeances.service.js';
import { formatMontant } from '../utils/formatters.js';
import { loadSchoolPdfMeta } from '../services/pdf/schoolMeta.js';
import { buildRecuPdf } from '../services/pdf/recu.pdf.js';
import { buildJournalCaissePdf } from '../services/pdf/journalCaisse.pdf.js';
import { buildSituationFinancierePdf } from '../services/pdf/situationFinanciere.pdf.js';
import { uploadPdfBuffer, isCloudinaryConfigured } from '../utils/cloudinary.js';
import { sendRelanceEcheance } from '../services/email.service.js';
import { broadcastPaiement, broadcastPaiementEchu } from '../utils/notifications.js';

const log = createLogger('PaiementsController');

function parseDayStart(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  if (String(value).length <= 10) d.setHours(0, 0, 0, 0);
  return d;
}

function parseDayEnd(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  if (String(value).length <= 10) d.setHours(23, 59, 59, 999);
  return d;
}

async function schoolPdfMeta(tenantId, req) {
  return loadSchoolPdfMeta(tenantId, req);
}

/** Un encaissement ne peut ni dépasser le reste dû, ni s'ajouter à une scolarité soldée. */
async function assertMontantEncaissable(tx, tenantId, inscriptionId, amount) {
  const reste = await resteAPayer(tx, tenantId, inscriptionId);
  if (reste <= 0.01) throw new Error('SCOLARITE_SOLDEE');
  if (amount > reste + 0.01) {
    const err = new Error('MONTANT_SUPERIEUR_RESTE');
    err.reste = reste;
    throw err;
  }
}

function reponseEncaissementRefuse(res, error) {
  if (error.message === 'SCOLARITE_SOLDEE') {
    return res.status(400).json({
      error: 'La scolarité est entièrement soldée : aucun paiement supplémentaire ne peut être enregistré.',
    });
  }
  if (error.message === 'MONTANT_SUPERIEUR_RESTE') {
    return res.status(400).json({
      error: `Veuillez saisir le montant restant : ${formatMontant(error.reste)}`,
    });
  }
  return null;
}

async function recuPdfPayload(full, tenantId, req, allocation = null) {
  const meta = await schoolPdfMeta(tenantId, req);
  const echeance = allocation
    ? null
    : full.echeance;
  const libelle = allocation?.libelle
    || echeance?.libelle
    || full.motif
    || null;
  const montant = allocation?.montant != null
    ? Number(allocation.montant)
    : Number(full.montant);
  const isAvance = Boolean(allocation?.avance) || /^avance/i.test(String(libelle || ''));

  return {
    ...meta,
    numeroRecu: full.numeroRecu,
    datePaiement: full.datePaiement,
    montant,
    typePaiement: isAvance ? 'autre' : (full.typePaiement || 'scolarite'),
    modePaiement: full.modePaiement,
    reference: full.reference,
    motif: isAvance
      ? 'Avance sur scolarité'
      : (full.motif || null),
    libelle,
    periode: libelle,
    dateEcheance: allocation?.dateEcheance || echeance?.dateEcheance || null,
    eleve: `${full.inscription.eleve.prenom} ${full.inscription.eleve.nom}`,
    matricule: full.inscription.eleve.matricule,
    classe: full.inscription.classe?.nom,
    anneeScolaire: full.inscription.anneeScolaire?.libelle,
    recuPar: full.recuPar ? `${full.recuPar.prenom} ${full.recuPar.nom}` : null,
    parent: full.inscription.eleve.parent
      ? `${full.inscription.eleve.parent.prenom} ${full.inscription.eleve.parent.nom}`
      : null,
  };
}

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

async function attachRecuPdf(paiement, tenantId, req, allocation = null) {
  try {
    const full = await loadPaiementFull(paiement.id, tenantId);
    if (!full) return null;
    const buffer = await buildRecuPdf(await recuPdfPayload(full, tenantId, req, allocation));

    let pdfUrl = null;
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
    return pdfUrl;
  } catch (pdfErr) {
    log.warn({ err: pdfErr }, 'PDF recu generation failed');
    return null;
  }
}

/**
 * Un encaissement qui couvre N mois (ou une avance) produit N reçus partagés.
 * Chaque allocation cascade → 1 Paiement + 1 PDF.
 */
async function createSplitPaiements(tx, {
  tenantId,
  inscriptionId,
  amount,
  typePaiement,
  mode,
  reference,
  motif,
  recuParId,
  echeanceId = null,
}) {
  let allocations = [];

  if (echeanceId) {
    const ech = await tx.echeance.findFirst({
      where: { id: echeanceId, tenantId, inscriptionId },
    });
    if (!ech) throw new Error('ECHEANCE_NOT_FOUND');
    const resteEch = Math.max(0, Number(ech.montantAttendu) - Number(ech.montantPaye));
    if (resteEch <= 0.01) throw new Error('SCOLARITE_SOLDEE');
    if (amount > resteEch + 0.01) {
      const err = new Error('MONTANT_SUPERIEUR_RESTE');
      err.reste = resteEch;
      throw err;
    }
    await applyPaymentToEcheance(tx, echeanceId, amount);
    allocations = [{
      echeanceId,
      libelle: ech.libelle,
      montant: amount,
      dateEcheance: ech.dateEcheance,
      statut: Number(ech.montantPaye) + amount >= Number(ech.montantAttendu) - 0.01 ? 'payee' : 'en_attente',
    }];
  } else {
    await assertMontantEncaissable(tx, tenantId, inscriptionId, amount);
    const cascade = await applyPaymentCascade(tx, tenantId, inscriptionId, amount);
    allocations = cascade.allocations || [];
    if (!allocations.length) {
      allocations = [{
        echeanceId: null,
        libelle: motif || 'Paiement scolarité',
        montant: amount,
        dateEcheance: null,
        statut: 'payee',
      }];
    }
  }

  const lastPaiement = await tx.paiement.findFirst({
    where: { tenantId },
    orderBy: { numeroRecu: 'desc' },
    select: { numeroRecu: true },
  });
  let nextNumero = (lastPaiement?.numeroRecu || 0) + 1;

  const created = [];
  for (const alloc of allocations) {
    const isAvance = Boolean(alloc.avance) || /^avance/i.test(String(alloc.libelle || ''));
    const row = await tx.paiement.create({
      data: {
        tenantId,
        inscriptionId,
        echeanceId: alloc.echeanceId || null,
        numeroRecu: nextNumero,
        montant: Number(alloc.montant),
        typePaiement: isAvance ? 'autre' : (typePaiement || 'scolarite'),
        modePaiement: mode,
        reference: reference || null,
        motif: isAvance
          ? (alloc.libelle || 'Avance sur scolarité')
          : (motif || alloc.libelle || null),
        recuParId,
      },
    });
    created.push({ paiement: row, allocation: alloc });
    nextNumero += 1;
  }

  await syncInscriptionSolde(tx, tenantId, inscriptionId);
  return { created, allocations };
}

export const getAll = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { page = 1, limit = 20, search, inscriptionId, typePaiement, modePaiement, type, dateDebut, dateFin, anneeScolaireId, sortBy = 'datePaiement', order = 'desc' } = req.query;
    const take = parseInt(limit);
    const skip = (parseInt(page) - 1) * take;

    const { resolveAnneeScolaireId } = await import('../utils/anneeScolaire.js');
    const resolvedAnneeId = await resolveAnneeScolaireId(tenantId, anneeScolaireId || null);

    const where = { tenantId };
    if (inscriptionId) where.inscriptionId = inscriptionId;
    if (typePaiement || type) where.typePaiement = typePaiement || type;
    if (modePaiement) where.modePaiement = normalizeModePaiement(modePaiement);
    if (dateDebut || dateFin) {
      where.datePaiement = {};
      const from = parseDayStart(dateDebut);
      const to = parseDayEnd(dateFin);
      if (from) where.datePaiement.gte = from;
      if (to) where.datePaiement.lte = to;
    }
    if (resolvedAnneeId) {
      where.inscription = {
        ...(where.inscription || {}),
        anneeScolaireId: resolvedAnneeId,
      };
    }
    if (search) {
      where.inscription = {
        ...(where.inscription || {}),
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
              anneeScolaire: { select: { id: true, libelle: true, statut: true } },
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
      anneeScolaireId: resolvedAnneeId,
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
    const { resolveAnneeScolaireId } = await import('../utils/anneeScolaire.js');
    const anneeScolaireId = await resolveAnneeScolaireId(req.tenantId, req.query.anneeScolaireId || null);
    const data = await listRetards(req.tenantId, { anneeScolaireId });
    res.json({ data, anneeScolaireId });
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

    const { created, allocations } = await prisma.$transaction(async (tx) => {
      const inscription = await tx.inscription.findFirst({
        where: { id: inscriptionId, tenantId },
      });
      if (!inscription) throw new Error('INSCRIPTION_NOT_FOUND');

      return createSplitPaiements(tx, {
        tenantId,
        inscriptionId,
        amount,
        typePaiement,
        mode,
        reference,
        motif,
        recuParId: req.user.id,
        echeanceId: echeanceId || null,
      });
    });

    for (const item of created) {
      await attachRecuPdf(item.paiement, tenantId, req, item.allocation);
    }

    const results = [];
    for (const item of created) {
      const full = await loadPaiementFull(item.paiement.id, tenantId);
      if (full) results.push(full);
    }

    const primary = results[0] || null;

    await logAudit(req, 'paiement_created', 'Paiement', primary?.id || created[0]?.paiement?.id, {
      montant: amount,
      modePaiement: mode,
      inscriptionId,
      echeanceId: echeanceId || null,
      recus: created.map((c) => c.paiement.numeroRecu),
      allocations,
    });

    try {
      if (primary) await broadcastPaiement(req.tenant?.slug, tenantId, primary);
    } catch { /* optional */ }

    res.status(201).json({
      ...(primary || {}),
      paiements: results,
      allocations,
      recusPartages: results.map((p) => ({
        id: p.id,
        numeroRecu: p.numeroRecu,
        montant: Number(p.montant),
        motif: p.motif,
        pdfUrl: p.pdfUrl || `/api/paiements/${p.id}/recu-pdf`,
      })),
    });
  } catch (error) {
    if (error.message === 'INSCRIPTION_NOT_FOUND') {
      return res.status(404).json({ error: 'Inscription non trouvée' });
    }
    if (error.message === 'ECHEANCE_NOT_FOUND') {
      return res.status(404).json({ error: 'Échéance non trouvée' });
    }
    const refus = reponseEncaissementRefuse(res, error);
    if (refus) return refus;
    log.error({ err: error, tenantId: req.tenantId }, 'Create paiement error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createBatch = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { inscriptionId, montant, typePaiement, modePaiement, reference, motif } = req.body;
    const amount = parseFloat(montant);
    if (!inscriptionId || !amount || amount <= 0) {
      return res.status(400).json({ error: 'inscriptionId et montant > 0 requis' });
    }

    const mode = normalizeModePaiement(modePaiement);

    const { created, allocations } = await prisma.$transaction(async (tx) => {
      const inscription = await tx.inscription.findFirst({
        where: { id: inscriptionId, tenantId },
      });
      if (!inscription) throw new Error('INSCRIPTION_NOT_FOUND');

      return createSplitPaiements(tx, {
        tenantId,
        inscriptionId,
        amount,
        typePaiement,
        mode,
        reference,
        motif,
        recuParId: req.user.id,
        echeanceId: null,
      });
    });

    for (const item of created) {
      await attachRecuPdf(item.paiement, tenantId, req, item.allocation);
    }

    const results = [];
    for (const item of created) {
      const full = await loadPaiementFull(item.paiement.id, tenantId);
      if (full) results.push(full);
    }
    const primary = results[0] || null;

    await logAudit(req, 'paiement_encaisse', 'Paiement', primary?.id || created[0]?.paiement?.id, {
      montant: amount,
      modePaiement: mode,
      inscriptionId,
      allocations,
      recus: created.map((c) => c.paiement.numeroRecu),
    });

    try {
      if (primary) await broadcastPaiement(req.tenant?.slug, tenantId, primary);
    } catch { /* optional */ }

    res.status(201).json({
      ...(primary || {}),
      paiements: results,
      allocations,
      recusPartages: results.map((p) => ({
        id: p.id,
        numeroRecu: p.numeroRecu,
        montant: Number(p.montant),
        motif: p.motif,
        pdfUrl: p.pdfUrl || `/api/paiements/${p.id}/recu-pdf`,
      })),
    });
  } catch (error) {
    if (error.message === 'INSCRIPTION_NOT_FOUND') {
      return res.status(404).json({ error: 'Inscription non trouvée' });
    }
    const refus = reponseEncaissementRefuse(res, error);
    if (refus) return refus;
    log.error({ err: error, tenantId: req.tenantId }, 'Create batch paiement error');
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

    const buffer = await buildRecuPdf(await recuPdfPayload(paiement, req.tenantId, req));

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="recu-${paiement.numeroRecu}.pdf"`);
    res.send(buffer);
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId, id: req.params.id }, 'Get recu PDF error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getJournalPdf = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { search, modePaiement, dateDebut, dateFin } = req.query;
    const where = { tenantId };
    if (modePaiement) where.modePaiement = normalizeModePaiement(modePaiement);
    if (dateDebut || dateFin) {
      where.datePaiement = {};
      const from = parseDayStart(dateDebut);
      const to = parseDayEnd(dateFin);
      if (from) where.datePaiement.gte = from;
      if (to) where.datePaiement.lte = to;
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

    const rows = await prisma.paiement.findMany({
      where,
      include: {
        inscription: {
          select: {
            eleve: { select: { nom: true, prenom: true } },
            classe: { select: { nom: true } },
          },
        },
      },
      orderBy: { datePaiement: 'asc' },
      take: 500,
    });

    const meta = await schoolPdfMeta(tenantId, req);
    const buffer = await buildJournalCaissePdf({
      ...meta,
      dateDebut: dateDebut || rows[0]?.datePaiement,
      dateFin: dateFin || new Date(),
      recuPar: req.user ? `${req.user.prenom || ''} ${req.user.nom || ''}`.trim() : null,
      paiements: rows.map((p) => ({
        numeroRecu: p.numeroRecu,
        datePaiement: p.datePaiement,
        montant: Number(p.montant),
        modePaiement: p.modePaiement,
        elevePrenom: p.inscription?.eleve?.prenom,
        eleveNom: p.inscription?.eleve?.nom,
        classeNom: p.inscription?.classe?.nom,
      })),
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="journal-caisse.pdf"');
    res.send(buffer);
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId }, 'Get journal PDF error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getSituationPdf = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { inscriptionId } = req.query;
    if (!inscriptionId) {
      return res.status(400).json({ error: 'inscriptionId requis' });
    }

    const inscription = await prisma.inscription.findFirst({
      where: { id: inscriptionId, tenantId },
      include: {
        eleve: {
          select: {
            nom: true,
            prenom: true,
            matricule: true,
            parent: { select: { nom: true, prenom: true } },
          },
        },
        classe: { select: { nom: true } },
        anneeScolaire: { select: { libelle: true } },
        paiements: { orderBy: { datePaiement: 'desc' }, take: 50 },
      },
    });
    if (!inscription) return res.status(404).json({ error: 'Inscription non trouvée' });

    const echeances = await listByInscription(tenantId, inscriptionId);
    const meta = await schoolPdfMeta(tenantId, req);
    const buffer = await buildSituationFinancierePdf({
      ...meta,
      eleve: `${inscription.eleve.prenom} ${inscription.eleve.nom}`,
      matricule: inscription.eleve.matricule,
      classe: inscription.classe?.nom,
      anneeScolaire: inscription.anneeScolaire?.libelle,
      parent: inscription.eleve.parent
        ? `${inscription.eleve.parent.prenom} ${inscription.eleve.parent.nom}`
        : null,
      echeances,
      paiements: (inscription.paiements || []).map((p) => ({
        numeroRecu: p.numeroRecu,
        datePaiement: p.datePaiement,
        montant: Number(p.montant),
        modePaiement: p.modePaiement,
        motif: p.motif,
        typePaiement: p.typePaiement,
      })),
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="situation-${inscription.eleve.matricule}.pdf"`);
    res.send(buffer);
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId }, 'Get situation PDF error');
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
      await syncInscriptionSolde(tx, tenantId, existing.inscriptionId);
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
