import { prisma } from '../utils/prisma.js';
import { createLogger } from '../utils/logger.js';
import { getEnseignantAssignments, todayJourSemaine } from '../utils/ownership.js';

const log = createLogger('EnseignantController');

const mapCours = (c) => ({
  id: c.id,
  classeId: c.classeId || c.classe?.id || null,
  matiereId: c.matiereId || c.matiere?.id || null,
  matiereNom: c.matiere?.nom || null,
  classeNom: c.classe?.nom || null,
  salle: c.salleRef?.nom || c.salle || null,
  heureDebut: c.heureDebut,
  heureFin: c.heureFin,
  jourSemaine: c.jourSemaine,
});

export const getDashboard = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const enseignantId = req.user.id;
    const assignments = await getEnseignantAssignments(tenantId, enseignantId);
    const classeIds = [...new Set(assignments.map((a) => a.classeId))];
    const matiereIds = [...new Set(assignments.map((a) => a.matiereId))];
    const jour = todayJourSemaine();

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const [coursAujourdhui, evaluations] = await Promise.all([
      prisma.emploiDuTemps.findMany({
        where: { tenantId, enseignantId, jourSemaine: jour },
        include: {
          matiere: { select: { id: true, nom: true } },
          classe: { select: { id: true, nom: true } },
          salleRef: { select: { nom: true } },
        },
        orderBy: { heureDebut: 'asc' },
      }),
      classeIds.length && matiereIds.length
        ? prisma.evaluation.findMany({
            where: {
              tenantId,
              classeId: { in: classeIds },
              matiereId: { in: matiereIds },
            },
            include: {
              matiere: { select: { nom: true } },
              classe: { select: { nom: true } },
              _count: { select: { notes: true } },
            },
            orderBy: { dateEvaluation: 'desc' },
            take: 10,
          })
        : [],
    ]);

    // effectif per evaluation class for saisie status
    const effectifs = {};
    for (const cid of classeIds) {
      effectifs[cid] = await prisma.inscription.count({
        where: { tenantId, classeId: cid, statut: 'validee' },
      });
    }

    const evaluationsACorriger = evaluations.filter(
      (e) => (e._count?.notes || 0) < (effectifs[e.classeId] || 0)
    ).length;

    res.json({
      nbClasses: classeIds.length,
      nbMatieres: matiereIds.length,
      evaluationsACorriger,
      coursAujourdhui: coursAujourdhui.map(mapCours),
      dernieresEvaluations: evaluations.map((e) => ({
        id: e.id,
        nom: e.nom,
        matiereNom: e.matiere?.nom,
        classeNom: e.classe?.nom,
        dateEvaluation: e.dateEvaluation,
        statut:
          (e._count?.notes || 0) >= (effectifs[e.classeId] || 0) && (effectifs[e.classeId] || 0) > 0
            ? 'saisie_terminee'
            : 'en_cours',
      })),
    });
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId }, 'enseignant dashboard error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getMesClasses = async (req, res) => {
  try {
    const assignments = await getEnseignantAssignments(req.tenantId, req.user.id);
    const byClasse = new Map();

    for (const a of assignments) {
      if (!byClasse.has(a.classeId)) {
        byClasse.set(a.classeId, {
          id: a.classe.id,
          nom: a.classe.nom,
          niveau: a.classe.niveau,
          filiere: a.classe.filiere,
          cycle: a.classe.cycle,
          anneeScolaireId: a.classe.anneeScolaireId,
          matieres: [],
        });
      }
      const entry = byClasse.get(a.classeId);
      if (a.matiere && !entry.matieres.some((m) => m.id === a.matiereId)) {
        entry.matieres.push({
          id: a.matiere.id,
          nom: a.matiere.nom,
          code: a.matiere.code,
        });
      }
    }

    const result = [];
    for (const c of byClasse.values()) {
      const effectif = await prisma.inscription.count({
        where: { tenantId: req.tenantId, classeId: c.id, statut: 'validee' },
      });
      result.push({
        id: c.id,
        nom: c.nom,
        niveau: c.niveau,
        filiere: c.filiere,
        cycle: c.cycle,
        anneeScolaireId: c.anneeScolaireId,
        effectif,
        nbMatieres: c.matieres.length,
        matieres: c.matieres,
      });
    }

    result.sort((a, b) => a.nom.localeCompare(b.nom));
    res.json(result);
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId }, 'mes-classes error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getEvaluations = async (req, res) => {
  try {
    const assignments = await getEnseignantAssignments(req.tenantId, req.user.id);
    if (!assignments.length) return res.json([]);

    const orFilters = assignments.map((a) => ({
      classeId: a.classeId,
      matiereId: a.matiereId,
    }));

    const evaluations = await prisma.evaluation.findMany({
      where: { tenantId: req.tenantId, OR: orFilters },
      include: {
        matiere: { select: { nom: true } },
        classe: { select: { nom: true } },
        _count: { select: { notes: true } },
      },
      orderBy: { dateEvaluation: 'desc' },
    });

    const effectifCache = {};
    const result = [];
    for (const e of evaluations) {
      if (effectifCache[e.classeId] === undefined) {
        effectifCache[e.classeId] = await prisma.inscription.count({
          where: { tenantId: req.tenantId, classeId: e.classeId, statut: 'validee' },
        });
      }
      const effectif = effectifCache[e.classeId];
      result.push({
        id: e.id,
        nom: e.nom,
        classeId: e.classeId,
        matiereId: e.matiereId,
        matiereNom: e.matiere?.nom,
        classeNom: e.classe?.nom,
        dateEvaluation: e.dateEvaluation,
        noteMaximale: Number(e.noteMaximale),
        statut:
          effectif > 0 && (e._count?.notes || 0) >= effectif ? 'saisie_terminee' : 'en_cours',
      });
    }

    res.json(result);
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId }, 'enseignant evaluations error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getCoursAujourdhui = async (req, res) => {
  try {
    const jour = todayJourSemaine();
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const cours = await prisma.emploiDuTemps.findMany({
      where: {
        tenantId: req.tenantId,
        enseignantId: req.user.id,
        jourSemaine: jour,
      },
      include: {
        matiere: { select: { id: true, nom: true } },
        classe: { select: { id: true, nom: true } },
        salleRef: { select: { nom: true } },
      },
      orderBy: { heureDebut: 'asc' },
    });

    const result = [];
    for (const c of cours) {
      const absCount = await prisma.absence.count({
        where: {
          tenantId: req.tenantId,
          emploiDuTempsId: c.id,
          dateAbsence: { gte: startOfDay, lte: endOfDay },
        },
      });
      result.push({
        ...mapCours(c),
        appelFait: absCount > 0,
      });
    }

    res.json(result);
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId }, 'cours-aujourdhui error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getEmploiDuTemps = async (req, res) => {
  try {
    const cours = await prisma.emploiDuTemps.findMany({
      where: { tenantId: req.tenantId, enseignantId: req.user.id },
      include: {
        matiere: { select: { id: true, nom: true } },
        classe: { select: { id: true, nom: true } },
        salleRef: { select: { nom: true } },
      },
      orderBy: [{ jourSemaine: 'asc' }, { heureDebut: 'asc' }],
    });

    res.json(cours.map(mapCours));
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId }, 'emploi-du-temps error');
    res.status(500).json({ error: 'Internal server error' });
  }
};
