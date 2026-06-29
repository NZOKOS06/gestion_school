import { prisma } from '../utils/prisma.js';
import { createLogger } from '../utils/logger.js';
import { logAudit } from '../utils/auditLogger.js';

const log = createLogger('ActualitesController');

export const getAll = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { page = 1, limit = 20, publique, sortBy = 'createdAt', order = 'desc' } = req.query;
    const take = parseInt(limit);
    const skip = (parseInt(page) - 1) * take;

    const where = { tenantId };
    if (publique !== undefined) where.publique = publique === 'true';

    const orderBy = {};
    orderBy[sortBy] = order;

    const [rows, total] = await Promise.all([
      prisma.actualite.findMany({
        where,
        include: {
          auteur: { select: { id: true, nom: true, prenom: true } },
        },
        skip,
        take,
        orderBy,
      }),
      prisma.actualite.count({ where }),
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
    log.error({ err: error, tenantId: req.tenantId }, 'Get all actualites error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getById = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;

    const actualite = await prisma.actualite.findFirst({
      where: { id, tenantId },
      include: {
        auteur: { select: { id: true, nom: true, prenom: true } },
      },
    });

    if (!actualite) {
      return res.status(404).json({ error: 'Actualité non trouvée' });
    }

    res.json(actualite);
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId, id: req.params.id }, 'Get actualite by ID error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const create = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { titre, contenu, photoUrl, publique } = req.body;

    const actualite = await prisma.actualite.create({
      data: {
        tenantId,
        titre,
        contenu,
        photoUrl: photoUrl || null,
        publique: publique !== undefined ? publique : true,
        auteurId: req.user.id,
      },
    });

    await logAudit(req, 'actualite_created', 'Actualite', actualite.id, { titre });

    res.status(201).json(actualite);
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId }, 'Create actualite error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const update = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;
    const { titre, contenu, photoUrl, publique } = req.body;

    const existing = await prisma.actualite.findFirst({ where: { id, tenantId } });
    if (!existing) {
      return res.status(404).json({ error: 'Actualité non trouvée' });
    }

    const data = {};
    if (titre !== undefined) data.titre = titre;
    if (contenu !== undefined) data.contenu = contenu;
    if (photoUrl !== undefined) data.photoUrl = photoUrl;
    if (publique !== undefined) data.publique = publique;

    const actualite = await prisma.actualite.update({ where: { id }, data });

    await logAudit(req, 'actualite_updated', 'Actualite', actualite.id, { titre });

    res.json(actualite);
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId, id: req.params.id }, 'Update actualite error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const remove = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;

    const existing = await prisma.actualite.findFirst({ where: { id, tenantId } });
    if (!existing) {
      return res.status(404).json({ error: 'Actualité non trouvée' });
    }

    await prisma.actualite.delete({ where: { id } });

    await logAudit(req, 'actualite_deleted', 'Actualite', id, { titre: existing.titre });

    res.json({ message: 'Actualité supprimée' });
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId, id: req.params.id }, 'Delete actualite error');
    res.status(500).json({ error: 'Internal server error' });
  }
};
