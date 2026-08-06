import { prisma } from '../utils/prisma.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('CalendrierScolaireController');

export const getAll = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { anneeScolaireId, type, dateDebut, dateFin, sortBy = 'dateDebut', order = 'asc' } = req.query;

    const where = { tenantId };
    if (anneeScolaireId) where.anneeScolaireId = anneeScolaireId;
    if (type) where.type = type;
    if (dateDebut || dateFin) {
      where.dateDebut = {};
      if (dateDebut) where.dateDebut.gte = new Date(dateDebut);
      if (dateFin) where.dateDebut.lte = new Date(dateFin);
    }

    const orderBy = {};
    orderBy[sortBy] = order;

    const events = await prisma.calendrierScolaire.findMany({
      where,
      include: {
        anneeScolaire: { select: { id: true, libelle: true } },
      },
      orderBy,
    });

    res.json({ data: events });
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId }, 'Get all calendrier error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const create = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { titre, type, dateDebut, dateFin, description, anneeScolaireId, concerneCycles } = req.body;

    if (!titre || !type || !dateDebut || !anneeScolaireId) {
      return res.status(400).json({ error: 'Titre, type, dateDebut et anneeScolaireId requis' });
    }

    const event = await prisma.calendrierScolaire.create({
      data: {
        tenantId,
        anneeScolaireId,
        titre,
        type,
        dateDebut: new Date(dateDebut),
        dateFin: dateFin ? new Date(dateFin) : null,
        description: description || null,
        concerneCycles: concerneCycles || null,
      },
    });

    res.status(201).json(event);
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId }, 'Create calendrier event error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const update = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;
    const { titre, type, dateDebut, dateFin, description, concerneCycles } = req.body;

    const existing = await prisma.calendrierScolaire.findFirst({ where: { id, tenantId } });
    if (!existing) {
      return res.status(404).json({ error: 'Événement non trouvé' });
    }

    const data = {};
    if (titre !== undefined) data.titre = titre;
    if (type !== undefined) data.type = type;
    if (dateDebut !== undefined) data.dateDebut = new Date(dateDebut);
    if (dateFin !== undefined) data.dateFin = dateFin ? new Date(dateFin) : null;
    if (description !== undefined) data.description = description;
    if (concerneCycles !== undefined) data.concerneCycles = concerneCycles;

    const event = await prisma.calendrierScolaire.update({ where: { id }, data });

    res.json(event);
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId, id: req.params.id }, 'Update calendrier event error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const remove = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;

    const existing = await prisma.calendrierScolaire.findFirst({ where: { id, tenantId } });
    if (!existing) {
      return res.status(404).json({ error: 'Événement non trouvé' });
    }

    await prisma.calendrierScolaire.delete({ where: { id } });

    res.json({ message: 'Événement supprimé' });
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId, id: req.params.id }, 'Delete calendrier event error');
    res.status(500).json({ error: 'Internal server error' });
  }
};
