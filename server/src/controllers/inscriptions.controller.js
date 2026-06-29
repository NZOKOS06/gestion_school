import { prisma } from '../utils/prisma.js';
import { createLogger } from '../utils/logger.js';
import { logAudit } from '../utils/auditLogger.js';

const log = createLogger('InscriptionsController');

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

    const inscription = await prisma.inscription.create({
      data: {
        tenantId,
        eleveId,
        classeId,
        anneeScolaireId,
        statut: 'en_attente',
      },
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
    const { classeId, statut } = req.body;

    const existing = await prisma.inscription.findFirst({ where: { id, tenantId } });
    if (!existing) {
      return res.status(404).json({ error: 'Inscription non trouvée' });
    }

    const data = {};
    if (classeId !== undefined) data.classeId = classeId;
    if (statut !== undefined) data.statut = statut;

    const inscription = await prisma.inscription.update({ where: { id }, data });

    await logAudit(req, 'inscription_updated', 'Inscription', inscription.id, { statut });

    res.json(inscription);
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId, id: req.params.id }, 'Update inscription error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const validate = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;

    const existing = await prisma.inscription.findFirst({ where: { id, tenantId } });
    if (!existing) {
      return res.status(404).json({ error: 'Inscription non trouvée' });
    }

    const inscription = await prisma.inscription.update({
      where: { id },
      data: { statut: 'validee' },
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
