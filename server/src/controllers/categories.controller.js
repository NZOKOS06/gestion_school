import { prisma } from '../utils/prisma.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('CategoriesController');

export const getAll = async (req, res) => {
  try {
    const categories = await prisma.categorie.findMany({
      where: { tenantId: req.tenantId, actif: true },
      include: { enfants: true },
      orderBy: { nom: 'asc' }
    });
    res.json(categories);
  } catch (error) {
    log.error({ err: error }, 'getAll error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const create = async (req, res) => {
  try {
    const { nom, description, parentId } = req.body;
    const categorie = await prisma.categorie.create({
      data: { tenantId: req.tenantId, nom, description, parentId }
    });
    res.status(201).json(categorie);
  } catch (error) {
    log.error({ err: error }, 'create error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const update = async (req, res) => {
  try {
    const categorie = await prisma.categorie.updateMany({
      where: { id: req.params.id, tenantId: req.tenantId },
      data: req.body
    });
    res.json(categorie);
  } catch (error) {
    log.error({ err: error }, 'update error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const remove = async (req, res) => {
  try {
    await prisma.categorie.updateMany({
      where: { id: req.params.id, tenantId: req.tenantId },
      data: { actif: false }
    });
    res.json({ message: 'Catégorie désactivée' });
  } catch (error) {
    log.error({ err: error }, 'remove error');
    res.status(500).json({ error: 'Internal server error' });
  }
};
