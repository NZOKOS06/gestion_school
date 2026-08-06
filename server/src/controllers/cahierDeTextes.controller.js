import { prisma } from '../utils/prisma.js';
import { createLogger } from '../utils/logger.js';
import { logAudit } from '../utils/auditLogger.js';

const log = createLogger('CahierDeTextesController');

export const getAll = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { page = 1, limit = 20, enseignantId, classeId, matiereId, dateDebut, dateFin, sortBy = 'dateCours', order = 'desc' } = req.query;
    const take = parseInt(limit);
    const skip = (parseInt(page) - 1) * take;

    const where = { tenantId };
    if (enseignantId) where.enseignantId = enseignantId;
    if (classeId) where.classeId = classeId;
    if (matiereId) where.matiereId = matiereId;
    if (dateDebut || dateFin) {
      where.dateCours = {};
      if (dateDebut) where.dateCours.gte = new Date(dateDebut);
      if (dateFin) where.dateCours.lte = new Date(dateFin);
    }

    // Enseignant ne voit que ses propres entrées
    if (req.user.role === 'enseignant' && !enseignantId) {
      where.enseignantId = req.user.id;
    }

    const orderBy = {};
    orderBy[sortBy] = order;

    const [rows, total] = await Promise.all([
      prisma.cahierDeTextes.findMany({
        where,
        include: {
          enseignant: { select: { id: true, nom: true, prenom: true } },
          classe: { select: { id: true, nom: true, cycle: true } },
          matiere: { select: { id: true, nom: true, code: true } },
        },
        skip,
        take,
        orderBy,
      }),
      prisma.cahierDeTextes.count({ where }),
    ]);

    res.json({
      data: rows,
      pagination: { page: parseInt(page), limit: take, total, totalPages: Math.ceil(total / take) },
    });
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId }, 'Get all cahier de textes error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getOne = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;

    const entry = await prisma.cahierDeTextes.findFirst({
      where: { id, tenantId },
      include: {
        enseignant: { select: { id: true, nom: true, prenom: true } },
        classe: { select: { id: true, nom: true, cycle: true } },
        matiere: { select: { id: true, nom: true, code: true } },
        emploiDuTemps: { select: { id: true, jourSemaine: true, heureDebut: true, heureFin: true } },
      },
    });

    if (!entry) {
      return res.status(404).json({ error: 'Entrée non trouvée' });
    }

    res.json(entry);
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId, id: req.params.id }, 'Get cahier de textes error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const create = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { classeId, matiereId, emploiDuTempsId, dateCours, lecon, devoirsDonnes, observations } = req.body;

    // Enseignant ne peut créer que pour lui-même
    const enseignantId = req.user.role === 'enseignant' ? req.user.id : req.body.enseignantId;

    const entry = await prisma.cahierDeTextes.create({
      data: {
        tenantId,
        enseignantId,
        classeId,
        matiereId,
        emploiDuTempsId: emploiDuTempsId || null,
        dateCours: dateCours ? new Date(dateCours) : new Date(),
        lecon,
        devoirsDonnes: devoirsDonnes || null,
        observations: observations || null,
      },
      include: {
        classe: { select: { nom: true } },
        matiere: { select: { nom: true } },
      },
    });

    await logAudit(req, 'cahier_de_textes_saisi', 'CahierDeTextes', entry.id, { classeId, matiereId });

    res.status(201).json(entry);
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId }, 'Create cahier de textes error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const update = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;
    const { lecon, devoirsDonnes, observations } = req.body;

    const existing = await prisma.cahierDeTextes.findFirst({ where: { id, tenantId } });
    if (!existing) {
      return res.status(404).json({ error: 'Entrée non trouvée' });
    }

    // Enseignant ne peut modifier que ses propres entrées
    if (req.user.role === 'enseignant' && existing.enseignantId !== req.user.id) {
      return res.status(403).json({ error: 'Vous ne pouvez modifier que vos propres entrées' });
    }

    const data = {};
    if (lecon !== undefined) data.lecon = lecon;
    if (devoirsDonnes !== undefined) data.devoirsDonnes = devoirsDonnes;
    if (observations !== undefined) data.observations = observations;

    const entry = await prisma.cahierDeTextes.update({ where: { id }, data });

    res.json(entry);
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId, id: req.params.id }, 'Update cahier de textes error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const remove = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;

    const existing = await prisma.cahierDeTextes.findFirst({ where: { id, tenantId } });
    if (!existing) {
      return res.status(404).json({ error: 'Entrée non trouvée' });
    }

    if (req.user.role === 'enseignant' && existing.enseignantId !== req.user.id) {
      return res.status(403).json({ error: 'Vous ne pouvez supprimer que vos propres entrées' });
    }

    await prisma.cahierDeTextes.delete({ where: { id } });

    res.json({ message: 'Entrée supprimée' });
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId, id: req.params.id }, 'Delete cahier de textes error');
    res.status(500).json({ error: 'Internal server error' });
  }
};
