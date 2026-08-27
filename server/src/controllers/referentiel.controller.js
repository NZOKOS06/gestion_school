import { prisma } from '../utils/prisma.js';
import { createLogger } from '../utils/logger.js';
import { logAudit } from '../utils/auditLogger.js';
import { filterByTenantCycles, getTenantCyclesConfig, isCycleAllowed } from '../utils/tenantCycles.js';
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

    let niveaux = await prisma.niveauOfficiel.findMany({
      where,
      orderBy: { ordre: 'asc' },
    });

    const tenantCycles = await getTenantCyclesConfig(req.tenantId, prisma);
    niveaux = filterByTenantCycles(niveaux, tenantCycles, (n) => n.cycle);

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

    const tenantCycles = await getTenantCyclesConfig(req.tenantId, prisma);
    if (!isCycleAllowed('lycee', tenantCycles)) {
      return res.json({ data: [], referentielVersionId: versionId });
    }

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

    if (!anneeScolaireId || index == null || !libelle || !dateDebut || !dateFin) {
      return res.status(400).json({ error: 'Champs obligatoires manquants' });
    }

    const annee = await prisma.anneeScolaire.findFirst({ where: { id: anneeScolaireId, tenantId } });
    if (!annee) return res.status(404).json({ error: 'Année scolaire introuvable' });

    const check = validerPeriodeDates({
      annee,
      dateDebut,
      dateFin,
      dateEvaluationDebut,
      dateEvaluationFin,
    });
    if (check.error) return res.status(400).json({ error: check.error });

    const overlap = await detecterChevauchement({
      tenantId,
      anneeScolaireId,
      dateDebut: check.dateDebut,
      dateFin: check.dateFin,
      excludeId: id || null,
    });
    if (overlap) {
      return res.status(400).json({
        error: `Chevauchement avec la période « ${overlap.libelle} » (${overlap.dateDebut.toLocaleDateString('fr-FR')} → ${overlap.dateFin.toLocaleDateString('fr-FR')})`,
      });
    }

    const data = {
      libelle,
      dateDebut: check.dateDebut,
      dateFin: check.dateFin,
      dateEvaluationDebut: check.dateEvaluationDebut,
      dateEvaluationFin: check.dateEvaluationFin,
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

export const upsertPeriodesBatch = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { anneeScolaireId, periodes } = req.body;
    if (!anneeScolaireId || !Array.isArray(periodes)) {
      return res.status(400).json({ error: 'anneeScolaireId et periodes[] requis' });
    }

    const annee = await prisma.anneeScolaire.findFirst({ where: { id: anneeScolaireId, tenantId } });
    if (!annee) return res.status(404).json({ error: 'Année scolaire introuvable' });

    const validated = [];
    for (const p of periodes) {
      if (!p.libelle || !p.dateDebut || !p.dateFin || p.index == null) {
        return res.status(400).json({ error: `Période incomplète (index ${p.index ?? '?'})` });
      }
      const check = validerPeriodeDates({
        annee,
        dateDebut: p.dateDebut,
        dateFin: p.dateFin,
        dateEvaluationDebut: p.dateEvaluationDebut,
        dateEvaluationFin: p.dateEvaluationFin,
      });
      if (check.error) {
        return res.status(400).json({ error: `${p.libelle} : ${check.error}` });
      }
      validated.push({ ...p, ...check });
    }

    // Chevauchements internes
    const sorted = [...validated].sort((a, b) => a.dateDebut - b.dateDebut);
    for (let i = 1; i < sorted.length; i += 1) {
      if (sorted[i].dateDebut <= sorted[i - 1].dateFin) {
        return res.status(400).json({
          error: `Chevauchement entre « ${sorted[i - 1].libelle} » et « ${sorted[i].libelle} »`,
        });
      }
    }

    const saved = await prisma.$transaction(async (tx) => {
      const results = [];
      for (const p of validated) {
        const data = {
          libelle: p.libelle,
          dateDebut: p.dateDebut,
          dateFin: p.dateFin,
          dateEvaluationDebut: p.dateEvaluationDebut,
          dateEvaluationFin: p.dateEvaluationFin,
          poids: p.poids != null ? parseFloat(p.poids) : null,
          concerneCycles: Array.isArray(p.concerneCycles) && p.concerneCycles.length ? p.concerneCycles : null,
        };
        if (p.id) {
          const existing = await tx.periodeScolaire.findFirst({ where: { id: p.id, tenantId } });
          if (!existing) throw Object.assign(new Error(`Période ${p.id} introuvable`), { status: 404 });
          results.push(await tx.periodeScolaire.update({ where: { id: p.id }, data }));
        } else {
          results.push(await tx.periodeScolaire.upsert({
            where: { anneeScolaireId_index: { anneeScolaireId, index: parseInt(p.index, 10) } },
            update: data,
            create: {
              tenantId,
              anneeScolaireId,
              index: parseInt(p.index, 10),
              ...data,
            },
          }));
        }
      }
      return results;
    });

    await logAudit(req, 'periodes_batch_upserted', 'PeriodeScolaire', anneeScolaireId, { count: saved.length });
    res.json({ data: saved, count: saved.length });
  } catch (error) {
    if (error.status === 404) return res.status(404).json({ error: error.message });
    log.error({ err: error }, 'upsertPeriodesBatch');
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
    const updated = [];
    for (const ev of templates) {
      const exists = await prisma.calendrierScolaire.findFirst({
        where: {
          tenantId,
          anneeScolaireId,
          titre: ev.titre,
          type: ev.type,
        },
      });
      if (exists) {
        updated.push(await prisma.calendrierScolaire.update({
          where: { id: exists.id },
          data: {
            dateDebut: new Date(ev.dateDebut),
            dateFin: ev.dateFin ? new Date(ev.dateFin) : null,
            description: ev.description,
            // Reset alert if date moved forward
            alerteEnvoyeeAt: null,
          },
        }));
        continue;
      }
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

    // Ensure rentree exists
    const { syncEvenementRentree } = await import('./calendrierScolaire.controller.js');
    await syncEvenementRentree(tenantId, annee);

    await logAudit(req, 'calendrier_templates_generated', 'CalendrierScolaire', anneeScolaireId, {
      created: created.length,
      updated: updated.length,
    });
    res.json({ data: [...created, ...updated], count: created.length + updated.length, created: created.length, updated: updated.length });
  } catch (error) {
    log.error({ err: error }, 'generateCalendrierFromPeriodes');
    res.status(500).json({ error: 'Internal server error' });
  }
};

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function formatFr(d) {
  return new Date(d).toLocaleDateString('fr-FR');
}

function validerPeriodeDates({ annee, dateDebut, dateFin, dateEvaluationDebut, dateEvaluationFin }) {
  const debut = startOfDay(dateDebut);
  const fin = startOfDay(dateFin);
  const debutAnnee = startOfDay(annee.dateDebut);
  const finAnnee = endOfDay(annee.dateFin);

  if (debut >= fin) {
    return { error: 'La date de début doit être antérieure à la date de fin' };
  }
  if (debut < debutAnnee || fin > finAnnee) {
    return {
      error: `Les dates doivent être comprises entre le ${formatFr(annee.dateDebut)} et le ${formatFr(annee.dateFin)}`,
    };
  }

  let dateEvaluationDebutParsed = null;
  let dateEvaluationFinParsed = null;
  if (dateEvaluationDebut) {
    dateEvaluationDebutParsed = startOfDay(dateEvaluationDebut);
    if (dateEvaluationDebutParsed < debut || dateEvaluationDebutParsed > fin) {
      return { error: 'La date de début d\'évaluation doit être dans la période' };
    }
  }
  if (dateEvaluationFin) {
    dateEvaluationFinParsed = startOfDay(dateEvaluationFin);
    if (dateEvaluationFinParsed < debut || dateEvaluationFinParsed > fin) {
      return { error: 'La date de fin d\'évaluation doit être dans la période' };
    }
  }
  if (dateEvaluationDebutParsed && dateEvaluationFinParsed && dateEvaluationDebutParsed > dateEvaluationFinParsed) {
    return { error: 'La fenêtre d\'évaluation est incohérente (début > fin)' };
  }

  return {
    dateDebut: debut,
    dateFin: fin,
    dateEvaluationDebut: dateEvaluationDebutParsed,
    dateEvaluationFin: dateEvaluationFinParsed,
  };
}

async function detecterChevauchement({ tenantId, anneeScolaireId, dateDebut, dateFin, excludeId }) {
  const others = await prisma.periodeScolaire.findMany({
    where: {
      tenantId,
      anneeScolaireId,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
  });
  return others.find((p) => dateDebut <= p.dateFin && dateFin >= p.dateDebut) || null;
}
