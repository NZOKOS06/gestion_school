import { prisma } from '../utils/prisma.js';
import { createLogger } from '../utils/logger.js';
import { logAudit } from '../utils/auditLogger.js';

const log = createLogger('AnneesScolairesController');

export const getAll = async (req, res) => {
  try {
    const tenantId = req.tenantId;

    const annees = await prisma.anneeScolaire.findMany({
      where: { tenantId },
      include: {
        _count: { select: { classes: true, inscriptions: true } },
      },
      orderBy: { dateDebut: 'desc' },
    });

    res.json({ data: annees });
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId }, 'Get all anneesScolaires error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getById = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;

    const annee = await prisma.anneeScolaire.findFirst({
      where: { id, tenantId },
      include: {
        classes: { select: { id: true, nom: true, niveau: true, _count: { select: { inscriptions: { where: { statut: 'validee' } } } } } },
        _count: { select: { inscriptions: true } },
      },
    });

    if (!annee) {
      return res.status(404).json({ error: 'Année scolaire non trouvée' });
    }

    res.json(annee);
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId, id: req.params.id }, 'Get anneeScolaire by ID error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const create = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { libelle, dateDebut, dateFin } = req.body;

    if (new Date(dateDebut) >= new Date(dateFin)) {
      return res.status(400).json({ error: 'La date de début doit être antérieure à la date de fin' });
    }

    const annee = await prisma.anneeScolaire.create({
      data: {
        tenantId,
        libelle,
        dateDebut: new Date(dateDebut),
        dateFin: new Date(dateFin),
      },
    });

    await logAudit(req, 'annee_scolaire_created', 'AnneeScolaire', annee.id, { libelle });

    res.status(201).json(annee);
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId }, 'Create anneeScolaire error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const update = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;
    const { libelle, dateDebut, dateFin, actif } = req.body;

    const existing = await prisma.anneeScolaire.findFirst({ where: { id, tenantId } });
    if (!existing) {
      return res.status(404).json({ error: 'Année scolaire non trouvée' });
    }

    const data = {};
    if (libelle !== undefined) data.libelle = libelle;
    if (dateDebut !== undefined) data.dateDebut = new Date(dateDebut);
    if (dateFin !== undefined) data.dateFin = new Date(dateFin);
    if (actif !== undefined) data.actif = actif;

    if (data.dateDebut && data.dateFin && data.dateDebut >= data.dateFin) {
      return res.status(400).json({ error: 'La date de début doit être antérieure à la date de fin' });
    }

    const annee = await prisma.anneeScolaire.update({ where: { id }, data });

    await logAudit(req, 'annee_scolaire_updated', 'AnneeScolaire', annee.id, { libelle });

    res.json(annee);
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId, id: req.params.id }, 'Update anneeScolaire error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const remove = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;

    const existing = await prisma.anneeScolaire.findFirst({ where: { id, tenantId } });
    if (!existing) {
      return res.status(404).json({ error: 'Année scolaire non trouvée' });
    }

    await prisma.anneeScolaire.update({ where: { id }, data: { actif: false } });

    await logAudit(req, 'annee_scolaire_deleted', 'AnneeScolaire', id, { libelle: existing.libelle });

    res.json({ message: 'Année scolaire désactivée' });
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId, id: req.params.id }, 'Delete anneeScolaire error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const activate = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;

    const existing = await prisma.anneeScolaire.findFirst({ where: { id, tenantId } });
    if (!existing) {
      return res.status(404).json({ error: 'Année scolaire non trouvée' });
    }

    await prisma.anneeScolaire.updateMany({
      where: { tenantId },
      data: { actif: false },
    });

    const annee = await prisma.anneeScolaire.update({
      where: { id },
      data: { actif: true },
    });

    await logAudit(req, 'annee_scolaire_activated', 'AnneeScolaire', id, { libelle: existing.libelle });

    res.json(annee);
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId, id: req.params.id }, 'Activate anneeScolaire error');
    res.status(500).json({ error: 'Internal server error' });
  }
};
