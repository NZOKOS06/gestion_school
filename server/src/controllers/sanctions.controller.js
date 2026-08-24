import { prisma } from '../utils/prisma.js';
import { createLogger } from '../utils/logger.js';
import { logAudit } from '../utils/auditLogger.js';
import { broadcastSanction } from '../utils/notifications.js';
import { resolveAnneeScolaireId, getAnneeOperationnelle } from '../utils/anneeScolaire.js';

const log = createLogger('SanctionsController');

export const getAll = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const {
      page = 1,
      limit = 20,
      eleveId,
      type,
      anneeScolaireId,
      sortBy = 'createdAt',
      order = 'desc',
    } = req.query;
    const take = parseInt(limit);
    const skip = (parseInt(page) - 1) * take;

    const resolvedAnneeId = await resolveAnneeScolaireId(tenantId, anneeScolaireId || null);

    const where = { tenantId };
    if (resolvedAnneeId) where.anneeScolaireId = resolvedAnneeId;
    if (eleveId) where.eleveId = eleveId;
    if (type) where.type = type;

    const orderBy = {};
    orderBy[sortBy] = order;

    const [rows, total] = await Promise.all([
      prisma.sanction.findMany({
        where,
        include: {
          eleve: { select: { id: true, matricule: true, nom: true, prenom: true, photoUrl: true } },
        },
        skip,
        take,
        orderBy,
      }),
      prisma.sanction.count({ where }),
    ]);

    res.json({
      data: rows,
      anneeScolaireId: resolvedAnneeId,
      pagination: {
        page: parseInt(page),
        limit: take,
        total,
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId }, 'Get all sanctions error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const create = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { eleveId, type, motif, dureeJours, anneeScolaireId } = req.body;

    const resolvedAnneeId =
      (await resolveAnneeScolaireId(tenantId, anneeScolaireId || null)) ||
      (await getAnneeOperationnelle(tenantId))?.id ||
      null;

    const sanction = await prisma.sanction.create({
      data: {
        tenantId,
        eleveId,
        anneeScolaireId: resolvedAnneeId,
        type,
        motif,
        dureeJours: dureeJours ? parseInt(dureeJours, 10) : null,
      },
    });

    await logAudit(req, 'sanction_created', 'Sanction', sanction.id, { eleveId, type, anneeScolaireId: resolvedAnneeId });

    try {
      await broadcastSanction(req.tenant?.slug, tenantId, sanction);
    } catch { /* optional */ }

    res.status(201).json(sanction);
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId, code: error.code, meta: error.meta }, 'Create sanction error');
    if (error.code === 'P2003') {
      return res.status(400).json({ error: 'Élève introuvable' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const update = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;
    const { type, motif, dureeJours } = req.body;

    const existing = await prisma.sanction.findFirst({ where: { id, tenantId } });
    if (!existing) {
      return res.status(404).json({ error: 'Sanction non trouvée' });
    }

    const data = {};
    if (type !== undefined) data.type = type;
    if (motif !== undefined) data.motif = motif;
    if (dureeJours !== undefined) data.dureeJours = dureeJours;

    const sanction = await prisma.sanction.update({ where: { id }, data });

    await logAudit(req, 'sanction_updated', 'Sanction', sanction.id, { type });

    res.json(sanction);
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId, id: req.params.id }, 'Update sanction error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const remove = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;

    const existing = await prisma.sanction.findFirst({ where: { id, tenantId } });
    if (!existing) {
      return res.status(404).json({ error: 'Sanction non trouvée' });
    }

    await prisma.sanction.delete({ where: { id } });

    await logAudit(req, 'sanction_deleted', 'Sanction', id, {});

    res.json({ message: 'Sanction supprimée' });
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId, id: req.params.id }, 'Delete sanction error');
    res.status(500).json({ error: 'Internal server error' });
  }
};
