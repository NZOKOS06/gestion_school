import { prisma } from '../utils/prisma.js';
import { createLogger } from '../utils/logger.js';
import { logAudit } from '../utils/auditLogger.js';
import { syncEvenementRentree } from './calendrierScolaire.controller.js';

const log = createLogger('AnneesScolairesController');

function addYears(date, years) {
  const d = new Date(date);
  d.setFullYear(d.getFullYear() + years);
  return d;
}

export const getAll = async (req, res) => {
  try {
    const tenantId = req.tenantId;

    const annees = await prisma.anneeScolaire.findMany({
      where: { tenantId },
      include: {
        periodes: { orderBy: { index: 'asc' } },
        referentielVersion: { select: { id: true, code: true, libelle: true, actif: true } },
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
        periodes: { orderBy: { index: 'asc' } },
        referentielVersion: true,
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
    const { libelle, dateDebut, dateFin, referentielVersionId } = req.body;

    if (new Date(dateDebut) >= new Date(dateFin)) {
      return res.status(400).json({ error: 'La date de début doit être antérieure à la date de fin' });
    }

    let versionId = referentielVersionId || null;
    if (!versionId) {
      const activeRef = await prisma.referentielVersion.findFirst({
        where: { tenantId, actif: true },
      });
      versionId = activeRef?.id || null;
    }

    const annee = await prisma.anneeScolaire.create({
      data: {
        tenantId,
        libelle,
        dateDebut: new Date(dateDebut),
        dateFin: new Date(dateFin),
        referentielVersionId: versionId,
      },
    });

    await syncEvenementRentree(tenantId, annee);
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
    const { libelle, dateDebut, dateFin, actif, referentielVersionId } = req.body;

    const existing = await prisma.anneeScolaire.findFirst({ where: { id, tenantId } });
    if (!existing) {
      return res.status(404).json({ error: 'Année scolaire non trouvée' });
    }

    const data = {};
    if (libelle !== undefined) data.libelle = libelle;
    if (dateDebut !== undefined) data.dateDebut = new Date(dateDebut);
    if (dateFin !== undefined) data.dateFin = new Date(dateFin);
    if (actif !== undefined) data.actif = actif;
    if (referentielVersionId !== undefined) data.referentielVersionId = referentielVersionId || null;

    const nextDebut = data.dateDebut || existing.dateDebut;
    const nextFin = data.dateFin || existing.dateFin;
    if (nextDebut >= nextFin) {
      return res.status(400).json({ error: 'La date de début doit être antérieure à la date de fin' });
    }

    const annee = await prisma.anneeScolaire.update({ where: { id }, data });

    if (data.dateDebut || data.libelle) {
      await syncEvenementRentree(tenantId, annee);
    }

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

export const dupliquer = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;

    const source = await prisma.anneeScolaire.findFirst({
      where: { id, tenantId },
      include: { periodes: { orderBy: { index: 'asc' } } },
    });
    if (!source) {
      return res.status(404).json({ error: 'Année scolaire non trouvée' });
    }

    const match = String(source.libelle).match(/(\d{4})\s*[-–]\s*(\d{4})/);
    let nouveauLibelle;
    if (match) {
      nouveauLibelle = `${parseInt(match[1], 10) + 1}-${parseInt(match[2], 10) + 1}`;
    } else {
      nouveauLibelle = `${source.libelle} (copie)`;
    }

    const existingLibelle = await prisma.anneeScolaire.findFirst({
      where: { tenantId, libelle: nouveauLibelle },
    });
    if (existingLibelle) {
      return res.status(409).json({ error: `L'année ${nouveauLibelle} existe déjà` });
    }

    const nouvelle = await prisma.$transaction(async (tx) => {
      const annee = await tx.anneeScolaire.create({
        data: {
          tenantId,
          libelle: nouveauLibelle,
          dateDebut: addYears(source.dateDebut, 1),
          dateFin: addYears(source.dateFin, 1),
          actif: false,
          referentielVersionId: source.referentielVersionId,
        },
      });

      for (const p of source.periodes) {
        await tx.periodeScolaire.create({
          data: {
            tenantId,
            anneeScolaireId: annee.id,
            index: p.index,
            libelle: p.libelle,
            dateDebut: addYears(p.dateDebut, 1),
            dateFin: addYears(p.dateFin, 1),
            dateEvaluationDebut: p.dateEvaluationDebut ? addYears(p.dateEvaluationDebut, 1) : null,
            dateEvaluationFin: p.dateEvaluationFin ? addYears(p.dateEvaluationFin, 1) : null,
            poids: p.poids,
            concerneCycles: p.concerneCycles ?? undefined,
          },
        });
      }

      return annee;
    });

    await syncEvenementRentree(tenantId, nouvelle);
    await logAudit(req, 'annee_scolaire_dupliquee', 'AnneeScolaire', nouvelle.id, {
      sourceId: id,
      libelle: nouveauLibelle,
    });

    const full = await prisma.anneeScolaire.findFirst({
      where: { id: nouvelle.id },
      include: { periodes: { orderBy: { index: 'asc' } }, referentielVersion: true },
    });

    res.status(201).json(full);
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId, id: req.params.id }, 'Dupliquer anneeScolaire error');
    res.status(500).json({ error: 'Internal server error' });
  }
};
