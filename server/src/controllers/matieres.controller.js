import { prisma } from '../utils/prisma.js';
import { createLogger } from '../utils/logger.js';
import { logAudit } from '../utils/auditLogger.js';

const log = createLogger('MatieresController');

export const getAll = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { search, sortBy = 'nom', order = 'asc' } = req.query;

    const where = {};
    if (search) {
      where.OR = [
        { nom: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
      ];
    }

    const orderBy = {};
    orderBy[sortBy] = order;

    const matieres = await prisma.matiere.findMany({
      where: { tenantId, ...where },
      include: {
        _count: { select: { enseignantClasses: true, evaluations: true } },
      },
      orderBy,
    });

    res.json({ data: matieres });
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId }, 'Get all matieres error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getById = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;

    const matiere = await prisma.matiere.findFirst({
      where: { id, tenantId },
      include: {
        enseignantClasses: {
          include: {
            enseignant: { select: { id: true, nom: true, prenom: true } },
            classe: { select: { id: true, nom: true, niveau: true } },
          },
        },
      },
    });

    if (!matiere) {
      return res.status(404).json({ error: 'Matière non trouvée' });
    }

    res.json(matiere);
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId, id: req.params.id }, 'Get matiere by ID error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const create = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { nom, code, coefficient, description } = req.body;

    const existing = await prisma.matiere.findFirst({ where: { tenantId, code } });
    if (existing) {
      return res.status(409).json({ error: 'Ce code matière existe déjà' });
    }

    const matiere = await prisma.matiere.create({
      data: {
        tenantId,
        nom,
        code,
        coefficient: coefficient || 1,
        description: description || null,
      },
    });

    await logAudit(req, 'matiere_created', 'Matiere', matiere.id, { nom, code });

    res.status(201).json(matiere);
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId }, 'Create matiere error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const update = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;
    const { nom, code, coefficient, description, actif } = req.body;

    const existing = await prisma.matiere.findFirst({ where: { id, tenantId } });
    if (!existing) {
      return res.status(404).json({ error: 'Matière non trouvée' });
    }

    const data = {};
    if (nom !== undefined) data.nom = nom;
    if (code !== undefined) data.code = code;
    if (coefficient !== undefined) data.coefficient = coefficient;
    if (description !== undefined) data.description = description;
    if (actif !== undefined) data.actif = actif;

    const matiere = await prisma.matiere.update({ where: { id }, data });

    await logAudit(req, 'matiere_updated', 'Matiere', matiere.id, { nom });

    res.json(matiere);
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId, id: req.params.id }, 'Update matiere error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const remove = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;

    const existing = await prisma.matiere.findFirst({ where: { id, tenantId } });
    if (!existing) {
      return res.status(404).json({ error: 'Matière non trouvée' });
    }

    await prisma.matiere.update({ where: { id }, data: { actif: false } });

    await logAudit(req, 'matiere_deleted', 'Matiere', id, { nom: existing.nom });

    res.json({ message: 'Matière désactivée' });
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId, id: req.params.id }, 'Delete matiere error');
    res.status(500).json({ error: 'Internal server error' });
  }
};
