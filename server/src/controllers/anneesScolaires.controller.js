import { prisma, rawPrisma } from '../utils/prisma.js';
import { createLogger } from '../utils/logger.js';
import { logAudit } from '../utils/auditLogger.js';
import { syncEvenementRentree } from './calendrierScolaire.controller.js';
import { ensureSingleActiveYear, syncActifFromStatut } from '../utils/anneeActive.js';

const log = createLogger('AnneesScolairesController');

function addYears(date, years) {
  const d = new Date(date);
  d.setFullYear(d.getFullYear() + years);
  return d;
}

export const getAll = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant required' });
    }

    // Requête minimale d'abord (évite un 500 si un include est incompatible en prod)
    const annees = await rawPrisma.anneeScolaire.findMany({
      where: { tenantId },
      orderBy: { dateDebut: 'desc' },
    });

    const data = [];
    for (const a of annees) {
      let periodes = [];
      let referentielVersion = null;
      let counts = { classes: 0, inscriptions: 0 };
      try {
        periodes = await rawPrisma.periodeScolaire.findMany({
          where: { anneeScolaireId: a.id, tenantId },
          orderBy: { index: 'asc' },
          select: {
            id: true,
            tenantId: true,
            anneeScolaireId: true,
            index: true,
            libelle: true,
            dateDebut: true,
            dateFin: true,
            dateEvaluationDebut: true,
            dateEvaluationFin: true,
            poids: true,
            concerneCycles: true,
            createdAt: true,
            updatedAt: true,
          },
        });
        periodes = periodes.map((p) => ({
          ...p,
          poids: p.poids != null ? Number(p.poids) : null,
        }));
      } catch (e) {
        // Schéma partiel (migration en retard) : retry sans concerneCycles
        try {
          periodes = await rawPrisma.periodeScolaire.findMany({
            where: { anneeScolaireId: a.id, tenantId },
            orderBy: { index: 'asc' },
            select: {
              id: true,
              tenantId: true,
              anneeScolaireId: true,
              index: true,
              libelle: true,
              dateDebut: true,
              dateFin: true,
              dateEvaluationDebut: true,
              dateEvaluationFin: true,
              poids: true,
              createdAt: true,
              updatedAt: true,
            },
          });
          periodes = periodes.map((p) => ({
            ...p,
            poids: p.poids != null ? Number(p.poids) : null,
            concerneCycles: null,
          }));
        } catch (e2) {
          log.warn({ err: e2, anneeId: a.id }, 'periodes indisponibles');
          periodes = [];
        }
      }
      try {
        if (a.referentielVersionId) {
          referentielVersion = await rawPrisma.referentielVersion.findFirst({
            where: { id: a.referentielVersionId },
            select: { id: true, code: true, libelle: true, actif: true },
          });
        }
      } catch (e) {
        log.warn({ err: e, anneeId: a.id }, 'referentielVersion indisponible');
      }
      try {
        const [classes, inscriptions] = await Promise.all([
          rawPrisma.classe.count({ where: { anneeScolaireId: a.id, tenantId } }),
          rawPrisma.inscription.count({ where: { anneeScolaireId: a.id, tenantId } }),
        ]);
        counts = { classes, inscriptions };
      } catch (e) {
        log.warn({ err: e, anneeId: a.id }, 'counts indisponibles');
      }
      data.push({
        ...a,
        periodes,
        referentielVersion,
        _count: counts,
      });
    }

    res.json({ data });
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId }, 'Get all anneesScolaires error');
    res.status(500).json({
      error: 'Internal server error',
      message: error?.message || String(error),
      code: error?.code || undefined,
    });
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
        statut: 'brouillon',
        actif: false,
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
    const { libelle, dateDebut, dateFin, actif, statut, referentielVersionId } = req.body;

    const existing = await prisma.anneeScolaire.findFirst({ where: { id, tenantId } });
    if (!existing) {
      return res.status(404).json({ error: 'Année scolaire non trouvée' });
    }

    const data = {};
    if (libelle !== undefined) data.libelle = libelle;
    if (dateDebut !== undefined) data.dateDebut = new Date(dateDebut);
    if (dateFin !== undefined) data.dateFin = new Date(dateFin);
    if (referentielVersionId !== undefined) data.referentielVersionId = referentielVersionId || null;

    if (statut !== undefined) {
      data.statut = statut;
      data.actif = syncActifFromStatut(statut);
    } else if (actif !== undefined) {
      data.actif = actif;
      data.statut = actif ? 'active' : (existing.statut === 'active' ? 'archivee' : existing.statut);
    }

    const nextDebut = data.dateDebut || existing.dateDebut;
    const nextFin = data.dateFin || existing.dateFin;
    if (nextDebut >= nextFin) {
      return res.status(400).json({ error: 'La date de début doit être antérieure à la date de fin' });
    }

    // Overlap check with other years
    const overlap = await prisma.anneeScolaire.findFirst({
      where: {
        tenantId,
        id: { not: id },
        dateDebut: { lte: nextFin },
        dateFin: { gte: nextDebut },
      },
    });
    if (overlap) {
      return res.status(400).json({
        error: `Chevauchement avec l'année ${overlap.libelle}`,
      });
    }

    const becomingActive =
      data.statut === 'active' || data.actif === true;

    const annee = becomingActive
      ? await prisma.$transaction(async (tx) => {
          const { actif: _a, statut: _s, ...rest } = data;
          if (Object.keys(rest).length > 0) {
            await tx.anneeScolaire.update({ where: { id }, data: rest });
          }
          return ensureSingleActiveYear(tx, tenantId, id);
        })
      : await prisma.anneeScolaire.update({ where: { id }, data });

    if (data.dateDebut || data.libelle) {
      await syncEvenementRentree(tenantId, annee);
    }

    await logAudit(req, 'annee_scolaire_updated', 'AnneeScolaire', annee.id, { libelle: annee.libelle });

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

    await prisma.anneeScolaire.update({
      where: { id },
      data: { actif: false, statut: 'archivee' },
    });

    await logAudit(req, 'annee_scolaire_deleted', 'AnneeScolaire', id, { libelle: existing.libelle });

    res.json({ message: 'Année scolaire archivée' });
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

    const annee = await prisma.$transaction(async (tx) =>
      ensureSingleActiveYear(tx, tenantId, id)
    );

    await logAudit(req, 'annee_activee', 'AnneeScolaire', id, { libelle: existing.libelle });

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
      include: {
        periodes: { orderBy: { index: 'asc' } },
        classes: {
          include: {
            matieresClasseAnnee: true,
            enseignants: true,
            emploisDuTemps: true,
          },
        },
      },
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

    const stats = { classes: 0, affectations: 0, creneaux: 0, matieres: 0 };

    const nouvelle = await prisma.$transaction(async (tx) => {
      const annee = await tx.anneeScolaire.create({
        data: {
          tenantId,
          libelle: nouveauLibelle,
          dateDebut: addYears(source.dateDebut, 1),
          dateFin: addYears(source.dateFin, 1),
          actif: false,
          statut: 'brouillon',
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

      const classeMap = new Map();

      for (const c of source.classes) {
        const created = await tx.classe.create({
          data: {
            tenantId,
            anneeScolaireId: annee.id,
            nom: c.nom,
            niveau: c.niveau,
            cycle: c.cycle,
            filiere: c.filiere,
            niveauOfficielId: c.niveauOfficielId,
            filiereOfficielleId: c.filiereOfficielleId,
            capacite: c.capacite,
            fraisScolarite: c.fraisScolarite,
          },
        });
        classeMap.set(c.id, created.id);
        stats.classes += 1;

        for (const m of c.matieresClasseAnnee) {
          await tx.matiereClasseAnnee.create({
            data: {
              tenantId,
              classeId: created.id,
              matiereId: m.matiereId,
              coefficient: m.coefficient,
              actif: m.actif,
            },
          });
          stats.matieres += 1;
        }

        for (const a of c.enseignants) {
          await tx.enseignantClasse.create({
            data: {
              tenantId,
              enseignantId: a.enseignantId,
              classeId: created.id,
              matiereId: a.matiereId,
            },
          });
          stats.affectations += 1;
        }

        for (const e of c.emploisDuTemps) {
          await tx.emploiDuTemps.create({
            data: {
              tenantId,
              classeId: created.id,
              matiereId: e.matiereId,
              enseignantId: e.enseignantId,
              salleId: e.salleId,
              jourSemaine: e.jourSemaine,
              heureDebut: e.heureDebut,
              heureFin: e.heureFin,
              salle: e.salle,
            },
          });
          stats.creneaux += 1;
        }
      }

      return annee;
    }, { timeout: 60000 });

    await syncEvenementRentree(tenantId, nouvelle);
    await logAudit(req, 'annee_dupliquee', 'AnneeScolaire', nouvelle.id, {
      sourceId: id,
      libelle: nouveauLibelle,
      ...stats,
    });

    const full = await prisma.anneeScolaire.findFirst({
      where: { id: nouvelle.id },
      include: {
        periodes: { orderBy: { index: 'asc' } },
        referentielVersion: true,
        _count: { select: { classes: true, inscriptions: true } },
      },
    });

    res.status(201).json({ annee: full, stats });
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId, id: req.params.id }, 'Dupliquer anneeScolaire error');
    res.status(500).json({ error: 'Internal server error' });
  }
};
