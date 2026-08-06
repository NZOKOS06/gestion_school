import { prisma } from '../utils/prisma.js';
import { createLogger } from '../utils/logger.js';
import { logAudit } from '../utils/auditLogger.js';
import { generateForInscription } from '../services/echeances.service.js';

const log = createLogger('InscriptionsController');

async function resolveFees(tenantId, classeId) {
  const [classe, config] = await Promise.all([
    prisma.classe.findFirst({ where: { id: classeId, tenantId } }),
    prisma.tenantConfig.findUnique({ where: { tenantId } }),
  ]);
  const fraisScolarite = Number(classe?.fraisScolarite ?? config?.fraisScolariteDefault ?? 0);
  const fraisInscription = Number(config?.fraisInscriptionDefault ?? 0);
  return { classe, config, fraisScolarite, fraisInscription };
}

export const getAll = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { page = 1, limit = 20, search, classeId, anneeScolaireId, statut, sortBy = 'createdAt', order = 'desc' } = req.query;
    const take = parseInt(limit);
    const skip = (parseInt(page) - 1) * take;

    const where = { tenantId };
    if (statut) where.statut = statut;
    if (classeId) where.classeId = classeId;
    if (anneeScolaireId) where.anneeScolaireId = anneeScolaireId;
    if (search) {
      where.eleve = {
        OR: [
          { matricule: { contains: search, mode: 'insensitive' } },
          { nom: { contains: search, mode: 'insensitive' } },
          { prenom: { contains: search, mode: 'insensitive' } },
        ],
      };
    }

    const orderBy = {};
    orderBy[sortBy] = order;

    const [rows, total] = await Promise.all([
      prisma.inscription.findMany({
        where,
        include: {
          eleve: { select: { id: true, matricule: true, nom: true, prenom: true, sexe: true, photoUrl: true, dateNaissance: true } },
          classe: { select: { id: true, nom: true, niveau: true } },
          anneeScolaire: { select: { id: true, libelle: true } },
        },
        skip,
        take,
        orderBy,
      }),
      prisma.inscription.count({ where }),
    ]);

    res.json({
      data: rows,
      pagination: {
        page: parseInt(page),
        limit: take,
        total,
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId }, 'Get all inscriptions error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getById = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;

    const inscription = await prisma.inscription.findFirst({
      where: { id, tenantId },
      include: {
        eleve: true,
        classe: { include: { anneeScolaire: true } },
        anneeScolaire: true,
        paiements: { orderBy: { datePaiement: 'desc' } },
      },
    });

    if (!inscription) {
      return res.status(404).json({ error: 'Inscription non trouvée' });
    }

    res.json(inscription);
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId, id: req.params.id }, 'Get inscription by ID error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const create = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { eleveId, classeId, anneeScolaireId } = req.body;

    const existing = await prisma.inscription.findFirst({
      where: { tenantId, eleveId, anneeScolaireId },
    });
    if (existing) {
      return res.status(409).json({ error: 'Cet élève est déjà inscrit pour cette année scolaire' });
    }

    const { fraisScolarite, fraisInscription } = await resolveFees(tenantId, classeId);

    const inscription = await prisma.$transaction(async (tx) => {
      const insc = await tx.inscription.create({
        data: {
          tenantId,
          eleveId,
          classeId,
          anneeScolaireId,
          statut: 'en_attente',
          soldeScolarite: fraisInscription + fraisScolarite,
        },
      });
      await generateForInscription(tx, insc, {
        fraisInscription,
        fraisScolarite,
        nbTranches: 3,
      });
      return tx.inscription.findUnique({
        where: { id: insc.id },
        include: { echeances: true },
      });
    });

    await logAudit(req, 'inscription_created', 'Inscription', inscription.id, { eleveId, classeId });

    res.status(201).json(inscription);
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId }, 'Create inscription error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const update = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;
    const {
      classeId, statut, decisionFinAnnee, niveauCibleId, classeCibleId, motifDecision, resultatExamenId,
    } = req.body;

    const existing = await prisma.inscription.findFirst({ where: { id, tenantId } });
    if (!existing) {
      return res.status(404).json({ error: 'Inscription non trouvée' });
    }

    const data = {};
    if (classeId !== undefined) data.classeId = classeId;
    if (statut !== undefined) data.statut = statut;
    if (decisionFinAnnee !== undefined) data.decisionFinAnnee = decisionFinAnnee;
    if (niveauCibleId !== undefined) data.niveauCibleId = niveauCibleId || null;
    if (classeCibleId !== undefined) data.classeCibleId = classeCibleId || null;
    if (motifDecision !== undefined) data.motifDecision = motifDecision || null;
    if (resultatExamenId !== undefined) data.resultatExamenId = resultatExamenId || null;

    const inscription = await prisma.inscription.update({
      where: { id },
      data,
      include: {
        niveauCible: true,
        classeCible: true,
        resultatExamen: true,
      },
    });

    await logAudit(req, 'inscription_updated', 'Inscription', inscription.id, { statut, decisionFinAnnee });

    res.json(inscription);
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId, id: req.params.id }, 'Update inscription error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Décision de fin d'année + génération inscription N+1 si passage/redoublement
 */
export const decideFinAnnee = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;
    const {
      decisionFinAnnee,
      niveauCibleId,
      classeCibleId,
      motifDecision,
      resultatExamenId,
      anneeCibleId,
      genererInscription = true,
    } = req.body;

    if (!decisionFinAnnee) {
      return res.status(400).json({ error: 'decisionFinAnnee requise' });
    }

    const existing = await prisma.inscription.findFirst({
      where: { id, tenantId },
      include: {
        classe: { include: { niveauOfficiel: true } },
        eleve: true,
      },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Inscription non trouvée' });
    }

    let resolvedNiveauCibleId = niveauCibleId || null;
    let resolvedClasseCibleId = classeCibleId || null;

    // Auto-resolve next niveau on passage
    if (decisionFinAnnee === 'passage' && !resolvedNiveauCibleId && existing.classe?.niveauOfficiel) {
      const { PASSAGE_NIVEAU } = await import('../data/referentielCongo.js');
      const nextCode = PASSAGE_NIVEAU[existing.classe.niveauOfficiel.code];
      if (nextCode) {
        const next = await prisma.niveauOfficiel.findFirst({
          where: {
            tenantId,
            referentielVersionId: existing.classe.niveauOfficiel.referentielVersionId,
            code: nextCode,
          },
        });
        resolvedNiveauCibleId = next?.id || null;
      }
    }

    if (decisionFinAnnee === 'redoublement' && !resolvedNiveauCibleId) {
      resolvedNiveauCibleId = existing.classe?.niveauOfficielId || null;
    }

    const updated = await prisma.inscription.update({
      where: { id },
      data: {
        decisionFinAnnee,
        niveauCibleId: resolvedNiveauCibleId,
        classeCibleId: resolvedClasseCibleId,
        motifDecision: motifDecision || null,
        resultatExamenId: resultatExamenId || null,
      },
      include: {
        niveauCible: true,
        classeCible: true,
        resultatExamen: true,
      },
    });

    let nouvelleInscription = null;
    if (
      genererInscription
      && resolvedClasseCibleId
      && anneeCibleId
      && ['passage', 'redoublement', 'orientation'].includes(decisionFinAnnee)
    ) {
      const anneeCible = await prisma.anneeScolaire.findFirst({
        where: { id: anneeCibleId, tenantId },
      });
      const classeCible = await prisma.classe.findFirst({
        where: { id: resolvedClasseCibleId, tenantId, anneeScolaireId: anneeCibleId },
      });

      if (anneeCible && classeCible) {
        const already = await prisma.inscription.findFirst({
          where: {
            tenantId,
            anneeScolaireId: anneeCibleId,
            eleveId: existing.eleveId,
          },
        });
        if (!already) {
          nouvelleInscription = await prisma.inscription.create({
            data: {
              tenantId,
              eleveId: existing.eleveId,
              classeId: classeCible.id,
              anneeScolaireId: anneeCibleId,
              statut: 'en_attente',
              soldeScolarite: parseFloat(classeCible.fraisScolarite),
            },
          });
        } else {
          nouvelleInscription = already;
        }
      }
    }

    await logAudit(req, 'decision_fin_annee', 'Inscription', id, {
      decisionFinAnnee,
      niveauCibleId: resolvedNiveauCibleId,
      classeCibleId: resolvedClasseCibleId,
      nouvelleInscriptionId: nouvelleInscription?.id,
    });

    res.json({ inscription: updated, nouvelleInscription });
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId }, 'decideFinAnnee error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const validate = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;

    const existing = await prisma.inscription.findFirst({
      where: { id, tenantId },
      include: { echeances: true, classe: true },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Inscription non trouvée' });
    }

    const { fraisScolarite, fraisInscription } = await resolveFees(tenantId, existing.classeId);

    const inscription = await prisma.$transaction(async (tx) => {
      const insc = await tx.inscription.update({
        where: { id },
        data: { statut: 'validee' },
      });
      if (!existing.echeances?.length) {
        await generateForInscription(tx, insc, {
          fraisInscription,
          fraisScolarite: Number(existing.classe?.fraisScolarite ?? fraisScolarite),
          nbTranches: 3,
        });
      }
      return tx.inscription.findUnique({
        where: { id },
        include: { echeances: true },
      });
    });

    await logAudit(req, 'inscription_validated', 'Inscription', id, { eleveId: existing.eleveId });

    res.json(inscription);
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId, id: req.params.id }, 'Validate inscription error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const remove = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;

    const existing = await prisma.inscription.findFirst({ where: { id, tenantId } });
    if (!existing) {
      return res.status(404).json({ error: 'Inscription non trouvée' });
    }

    await prisma.inscription.update({
      where: { id },
      data: { statut: 'annulee' },
    });

    await logAudit(req, 'inscription_cancelled', 'Inscription', id, { eleveId: existing.eleveId });

    res.json({ message: 'Inscription annulée' });
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId, id: req.params.id }, 'Delete inscription error');
    res.status(500).json({ error: 'Internal server error' });
  }
};
