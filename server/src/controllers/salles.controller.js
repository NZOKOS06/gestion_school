import { prisma } from '../utils/prisma.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('SallesController');

export const getAll = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { actif, type, sortBy = 'nom', order = 'asc' } = req.query;

    const where = { tenantId };
    if (actif !== undefined) where.actif = actif === 'true';
    if (type) where.type = type;

    const orderBy = {};
    orderBy[sortBy] = order;

    const salles = await prisma.salle.findMany({
      where,
      include: {
        _count: { select: { emploisDuTemps: true } },
      },
      orderBy,
    });

    res.json({ data: salles });
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId }, 'Get all salles error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const create = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { nom, batiment, capacite, type } = req.body;

    if (!nom) {
      return res.status(400).json({ error: 'Nom de salle requis' });
    }

    const existing = await prisma.salle.findFirst({ where: { tenantId, nom } });
    if (existing) {
      return res.status(400).json({ error: 'Une salle avec ce nom existe déjà' });
    }

    const salle = await prisma.salle.create({
      data: {
        tenantId,
        nom,
        batiment: batiment || null,
        capacite: capacite ? parseInt(capacite) : 40,
        type: type || 'cours',
      },
    });

    res.status(201).json(salle);
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId }, 'Create salle error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const update = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;
    const { nom, batiment, capacite, type, actif } = req.body;

    const existing = await prisma.salle.findFirst({ where: { id, tenantId } });
    if (!existing) {
      return res.status(404).json({ error: 'Salle non trouvée' });
    }

    const data = {};
    if (nom !== undefined) data.nom = nom;
    if (batiment !== undefined) data.batiment = batiment;
    if (capacite !== undefined) data.capacite = parseInt(capacite);
    if (type !== undefined) data.type = type;
    if (actif !== undefined) data.actif = actif;

    const salle = await prisma.salle.update({ where: { id }, data });

    res.json(salle);
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId, id: req.params.id }, 'Update salle error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const remove = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;

    const existing = await prisma.salle.findFirst({ where: { id, tenantId } });
    if (!existing) {
      return res.status(404).json({ error: 'Salle non trouvée' });
    }

    // Check if salle is used in emplois du temps
    const usedCount = await prisma.emploiDuTemps.count({ where: { salleId: id } });
    if (usedCount > 0) {
      return res.status(400).json({ error: 'Salle utilisée dans des emplois du temps — désactivez-la plutôt' });
    }

    await prisma.salle.delete({ where: { id } });

    res.json({ message: 'Salle supprimée' });
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId, id: req.params.id }, 'Delete salle error');
    res.status(500).json({ error: 'Internal server error' });
  }
};
