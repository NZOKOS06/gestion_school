import { prisma } from '../utils/prisma.js';
import { createLogger } from '../utils/logger.js';
import { logAudit } from '../utils/auditLogger.js';
import { buildCalendrierTemplatesFromPeriodes } from '../data/referentielCongo.js';

const log = createLogger('ReferentielController');

export const listVersions = async (req, res) => {
  try {
    const versions = await prisma.referentielVersion.findMany({
      where: { tenantId: req.tenantId },
      include: {
        _count: { select: { niveaux: true, filieres: true, annees: true } },
      },
      orderBy: { code: 'asc' },
    });
    res.json({ data: versions });
  } catch (error) {
    log.error({ err: error }, 'listVersions');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const listNiveaux = async (req, res) => {
  try {
    const { referentielVersionId, anneeScolaireId, cycle } = req.query;
    let versionId = referentielVersionId;

    if (!versionId && anneeScolaireId) {
      const annee = await prisma.anneeScolaire.findFirst({
        where: { id: anneeScolaireId, tenantId: req.tenantId },
        select: { referentielVersionId: true },
      });
      versionId = annee?.referentielVersionId;
    }

    if (!versionId) {
      const active = await prisma.referentielVersion.findFirst({
        where: { tenantId: req.tenantId, actif: true },
      });
      versionId = active?.id;
    }

    if (!versionId) {
      return res.json({ data: [] });
    }

    const where = { tenantId: req.tenantId, referentielVersionId: versionId };
    if (cycle) where.cycle = cycle;

    const niveaux = await prisma.niveauOfficiel.findMany({
      where,
      orderBy: { ordre: 'asc' },
    });
    res.json({ data: niveaux, referentielVersionId: versionId });
  } catch (error) {
    log.error({ err: error }, 'listNiveaux');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const listFilieres = async (req, res) => {
  try {
    const { referentielVersionId, anneeScolaireId } = req.query;
    let versionId = referentielVersionId;

    if (!versionId && anneeScolaireId) {
      const annee = await prisma.anneeScolaire.findFirst({
        where: { id: anneeScolaireId, tenantId: req.tenantId },
        select: { referentielVersionId: true },
      });
      versionId = annee?.referentielVersionId;
    }

    if (!versionId) {
      const active = await prisma.referentielVersion.findFirst({
        where: { tenantId: req.tenantId, actif: true },
      });
      versionId = active?.id;
    }

    if (!versionId) return res.json({ data: [] });

    const filieres = await prisma.filiereOfficielle.findMany({
      where: { tenantId: req.tenantId, referentielVersionId: versionId },
      orderBy: { libelle: 'asc' },
    });
    res.json({ data: filieres, referentielVersionId: versionId });
  } catch (error) {
    log.error({ err: error }, 'listFilieres');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const listPeriodes = async (req, res) => {
  try {
    const { anneeScolaireId, cycle } = req.query;
    if (!anneeScolaireId) {
      return res.status(400).json({ error: 'anneeScolaireId requis' });
    }

    let periodes = await prisma.periodeScolaire.findMany({
      where: { tenantId: req.tenantId, anneeScolaireId },
      orderBy: { index: 'asc' },
    });
    if (cycle) {
      periodes = periodes.filter((p) => {
        const cycles = p.concerneCycles;
        if (!cycles || (Array.isArray(cycles) && cycles.length === 0)) return true;
        return Array.isArray(cycles) && cycles.includes(cycle);
      });
    }
    res.json({ data: periodes });
  } catch (error) {
    log.error({ err: error }, 'listPeriodes');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const upsertPeriode = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const {
      anneeScolaireId, index, libelle, dateDebut, dateFin,
      dateEvaluationDebut, dateEvaluationFin, poids, concerneCycles,
    } = req.body;
    const id = req.params.id || req.body.id;

    if (!anneeScolaireId || !index || !libelle || !dateDebut || !dateFin) {
      return res.status(400).json({ error: 'Champs obligatoires manquants' });
    }

    const annee = await prisma.anneeScolaire.findFirst({ where: { id: anneeScolaireId, tenantId } });
    if (!annee) return res.status(404).json({ error: 'Année scolaire introuvable' });

    const data = {
      libelle,
      dateDebut: new Date(dateDebut),
      dateFin: new Date(dateFin),
      dateEvaluationDebut: dateEvaluationDebut ? new Date(dateEvaluationDebut) : null,
      dateEvaluationFin: dateEvaluationFin ? new Date(dateEvaluationFin) : null,
      poids: poids != null ? parseFloat(poids) : null,
      concerneCycles: concerneCycles === undefined
        ? undefined
        : (Array.isArray(concerneCycles) && concerneCycles.length ? concerneCycles : null),
    };
    if (data.concerneCycles === undefined) delete data.concerneCycles;

    let periode;
    if (id) {
      const existing = await prisma.periodeScolaire.findFirst({ where: { id, tenantId } });
      if (!existing) return res.status(404).json({ error: 'Période introuvable' });
      periode = await prisma.periodeScolaire.update({ where: { id }, data });
    } else {
      periode = await prisma.periodeScolaire.upsert({
        where: { anneeScolaireId_index: { anneeScolaireId, index: parseInt(index, 10) } },
        update: data,
        create: {
          tenantId,
          anneeScolaireId,
          index: parseInt(index, 10),
          ...data,
        },
      });
    }

    await logAudit(req, 'periode_upserted', 'PeriodeScolaire', periode.id, { index, libelle });
    res.json(periode);
  } catch (error) {
    log.error({ err: error }, 'upsertPeriode');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deletePeriode = async (req, res) => {
  try {
    const existing = await prisma.periodeScolaire.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
    });
    if (!existing) return res.status(404).json({ error: 'Période introuvable' });
    await prisma.periodeScolaire.delete({ where: { id: existing.id } });
    await logAudit(req, 'periode_deleted', 'PeriodeScolaire', existing.id, {});
    res.json({ success: true });
  } catch (error) {
    log.error({ err: error }, 'deletePeriode');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const generateCalendrierFromPeriodes = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { anneeScolaireId } = req.body;
    if (!anneeScolaireId) return res.status(400).json({ error: 'anneeScolaireId requis' });

    const annee = await prisma.anneeScolaire.findFirst({ where: { id: anneeScolaireId, tenantId } });
    if (!annee) return res.status(404).json({ error: 'Année scolaire introuvable' });

    const periodes = await prisma.periodeScolaire.findMany({
      where: { tenantId, anneeScolaireId },
      orderBy: { index: 'asc' },
    });

    const templates = buildCalendrierTemplatesFromPeriodes(
      periodes.map((p) => ({
        index: p.index,
        libelle: p.libelle,
        dateDebut: p.dateDebut.toISOString().slice(0, 10),
        dateFin: p.dateFin.toISOString().slice(0, 10),
        dateEvaluationDebut: p.dateEvaluationDebut?.toISOString().slice(0, 10),
        dateEvaluationFin: p.dateEvaluationFin?.toISOString().slice(0, 10),
      })),
      annee.libelle,
    );

    const created = [];
    for (const ev of templates) {
      const exists = await prisma.calendrierScolaire.findFirst({
        where: {
          tenantId,
          anneeScolaireId,
          titre: ev.titre,
          type: ev.type,
        },
      });
      if (exists) continue;
      created.push(await prisma.calendrierScolaire.create({
        data: {
          tenantId,
          anneeScolaireId,
          titre: ev.titre,
          type: ev.type,
          dateDebut: new Date(ev.dateDebut),
          dateFin: ev.dateFin ? new Date(ev.dateFin) : null,
          description: ev.description,
        },
      }));
    }

    await logAudit(req, 'calendrier_templates_generated', 'CalendrierScolaire', anneeScolaireId, { count: created.length });
    res.json({ data: created, count: created.length });
  } catch (error) {
    log.error({ err: error }, 'generateCalendrierFromPeriodes');
    res.status(500).json({ error: 'Internal server error' });
  }
};
