import { prisma } from '../utils/prisma.js';
import { createLogger } from '../utils/logger.js';
import { logAudit } from '../utils/auditLogger.js';
import { broadcastNote } from '../utils/notifications.js';

const log = createLogger('EvaluationsController');

export const getAll = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { page = 1, limit = 20, classeId, matiereId, anneeScolaireId, sortBy = 'dateEvaluation', order = 'desc' } = req.query;
    const take = parseInt(limit);
    const skip = (parseInt(page) - 1) * take;

    const where = { tenantId };
    if (classeId) where.classeId = classeId;
    if (matiereId) where.matiereId = matiereId;
    if (anneeScolaireId) where.anneeScolaireId = anneeScolaireId;

    const orderBy = {};
    orderBy[sortBy] = order;

    const [rows, total] = await Promise.all([
      prisma.evaluation.findMany({
        where,
        include: {
          classe: { select: { id: true, nom: true, niveau: true } },
          matiere: { select: { id: true, nom: true, code: true, coefficient: true } },
          anneeScolaire: { select: { id: true, libelle: true } },
          _count: { select: { notes: true } },
        },
        skip,
        take,
        orderBy,
      }),
      prisma.evaluation.count({ where }),
    ]);

    res.json({
      data: rows,
      pagination: {
        page: parseInt(page),
        limit: take,
        total,
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId }, 'Get all evaluations error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getById = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;

    const evaluation = await prisma.evaluation.findFirst({
      where: { id, tenantId },
      include: {
        classe: { select: { id: true, nom: true, niveau: true } },
        matiere: { select: { id: true, nom: true, code: true, coefficient: true } },
        anneeScolaire: { select: { id: true, libelle: true } },
        notes: {
          include: {
            eleve: { select: { id: true, matricule: true, nom: true, prenom: true } },
          },
        },
      },
    });

    if (!evaluation) {
      return res.status(404).json({ error: 'Évaluation non trouvée' });
    }

    res.json(evaluation);
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId, id: req.params.id }, 'Get evaluation by ID error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const create = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { classeId, matiereId, anneeScolaireId, periodeIndex, nom, type, dateEvaluation, coefficient, noteMaximale } = req.body;

    if (req.user.role === 'enseignant') {
      const { assertEnseignantAssignedToClasseMatiere } = await import('../utils/ownership.js');
      const ok = await assertEnseignantAssignedToClasseMatiere(req, res, classeId, matiereId);
      if (!ok) return;
    }

    const evaluation = await prisma.evaluation.create({
      data: {
        tenantId,
        classeId,
        matiereId,
        anneeScolaireId,
        periodeIndex,
        nom,
        type: type || 'devoir',
        dateEvaluation: new Date(dateEvaluation),
        coefficient: coefficient || 1,
        noteMaximale: noteMaximale ? parseFloat(noteMaximale) : 20,
      },
    });

    await logAudit(req, 'evaluation_created', 'Evaluation', evaluation.id, { nom, classeId });

    res.status(201).json(evaluation);
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId }, 'Create evaluation error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const update = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;
    const { nom, type, dateEvaluation, coefficient, noteMaximale } = req.body;

    const existing = await prisma.evaluation.findFirst({ where: { id, tenantId } });
    if (!existing) {
      return res.status(404).json({ error: 'Évaluation non trouvée' });
    }

    const data = {};
    if (nom !== undefined) data.nom = nom;
    if (type !== undefined) data.type = type;
    if (dateEvaluation !== undefined) data.dateEvaluation = new Date(dateEvaluation);
    if (coefficient !== undefined) data.coefficient = coefficient;
    if (noteMaximale !== undefined) data.noteMaximale = parseFloat(noteMaximale);

    const evaluation = await prisma.evaluation.update({ where: { id }, data });

    await logAudit(req, 'evaluation_updated', 'Evaluation', evaluation.id, { nom });

    res.json(evaluation);
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId, id: req.params.id }, 'Update evaluation error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const remove = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;

    const existing = await prisma.evaluation.findFirst({ where: { id, tenantId } });
    if (!existing) {
      return res.status(404).json({ error: 'Évaluation non trouvée' });
    }

    await prisma.evaluation.delete({ where: { id } });

    await logAudit(req, 'evaluation_deleted', 'Evaluation', id, { nom: existing.nom });

    res.json({ message: 'Évaluation supprimée' });
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId, id: req.params.id }, 'Delete evaluation error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const saveNotes = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;
    const { notes } = req.body;

    if (!Array.isArray(notes)) {
      return res.status(400).json({ error: 'notes doit être un tableau' });
    }

    const evaluation = await prisma.evaluation.findFirst({ where: { id, tenantId } });
    if (!evaluation) {
      return res.status(404).json({ error: 'Évaluation non trouvée' });
    }

    if (req.user.role === 'enseignant') {
      const { assertEnseignantAssignedToClasseMatiere } = await import('../utils/ownership.js');
      const ok = await assertEnseignantAssignedToClasseMatiere(
        req,
        res,
        evaluation.classeId,
        evaluation.matiereId
      );
      if (!ok) return;

      // Anti-fraude : Vérifier si la saisie des notes est ouverte par la direction
      const cfg = await prisma.tenantConfig.findUnique({
        where: { tenantId },
        select: { saisieNotesOuverte: true },
      });
      if (cfg?.saisieNotesOuverte === false) {
        return res.status(403).json({
          error: 'La saisie des notes est actuellement fermée par la direction de l’établissement.',
        });
      }
    }

    const now = Date.now();
    const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

    await prisma.$transaction(async (tx) => {
      for (const note of notes) {
        const existing = await tx.note.findFirst({
          where: { evaluationId: id, eleveId: note.eleveId },
        });

        if (existing) {
          // Anti-fraude : Vérifier le délai de 2h si enseignant
          if (req.user.role === 'enseignant') {
            const ageMs = now - new Date(existing.createdAt).getTime();
            if (ageMs > TWO_HOURS_MS) {
              const err = new Error('DELAI_MODIFICATION_EXPIRE');
              err.statusCode = 403;
              throw err;
            }
          }

          await tx.note.update({
            where: { id: existing.id },
            data: {
              valeur: parseFloat(note.valeur),
              appreciation: note.appreciation || null,
              saisiParId: req.user.id,
            },
          });
        } else {
          await tx.note.create({
            data: {
              tenantId,
              evaluationId: id,
              eleveId: note.eleveId,
              valeur: parseFloat(note.valeur),
              appreciation: note.appreciation || null,
              saisiParId: req.user.id,
            },
          });
        }
      }
    });

    await logAudit(req, 'notes_saved', 'Evaluation', id, { count: notes.length });

    const slug = req.tenant?.slug;
    for (const note of notes) {
      try {
        await broadcastNote(slug, tenantId, {
          id: note.id || id,
          eleveId: note.eleveId,
          evaluationId: id,
          valeur: note.valeur,
        });
      } catch { /* optional */ }
    }

    res.json({ message: 'Notes enregistrées', count: notes.length });
  } catch (error) {
    if (error.message === 'DELAI_MODIFICATION_EXPIRE') {
      return res.status(403).json({
        error: 'Délai de modification dépassé (> 2h). Seule la direction peut modifier ces notes.',
      });
    }
    log.error({ err: error, tenantId: req.tenantId, id: req.params.id }, 'Save notes error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getNotes = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;

    const evaluation = await prisma.evaluation.findFirst({ where: { id, tenantId } });
    if (!evaluation) {
      return res.status(404).json({ error: 'Évaluation non trouvée' });
    }

    if (req.user.role === 'enseignant') {
      const { assertEnseignantAssignedToClasseMatiere } = await import('../utils/ownership.js');
      const ok = await assertEnseignantAssignedToClasseMatiere(
        req,
        res,
        evaluation.classeId,
        evaluation.matiereId
      );
      if (!ok) return;
    }

    const cfg = await prisma.tenantConfig.findUnique({
      where: { tenantId },
      select: { saisieNotesOuverte: true },
    });
    const saisieNotesOuverte = cfg?.saisieNotesOuverte !== false;

    const inscriptions = await prisma.inscription.findMany({
      where: { tenantId, classeId: evaluation.classeId, statut: 'validee' },
      include: {
        eleve: { select: { id: true, prenom: true, nom: true, matricule: true, actif: true } },
      },
      orderBy: { eleve: { nom: 'asc' } },
    });

    const notes = await prisma.note.findMany({
      where: { tenantId, evaluationId: id },
    });
    const byEleve = new Map(notes.map((n) => [n.eleveId, n]));

    const now = Date.now();
    const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
    const isTeacher = req.user.role === 'enseignant';

    const data = inscriptions
      .filter((i) => i.eleve?.actif !== false)
      .map((i) => {
        const n = byEleve.get(i.eleve.id);
        const ageMs = n?.createdAt ? now - new Date(n.createdAt).getTime() : 0;
        const verrouillee = isTeacher && Boolean(n?.createdAt && ageMs > TWO_HOURS_MS);

        return {
          eleveId: i.eleve.id,
          elevePrenom: i.eleve.prenom,
          eleveNom: i.eleve.nom,
          matricule: i.eleve.matricule,
          valeur: n ? Number(n.valeur) : null,
          appreciation: n?.appreciation || null,
          createdAt: n?.createdAt || null,
          verrouillee,
        };
      });

    res.json({
      data,
      saisieNotesOuverte,
    });
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId }, 'getNotes error');
    res.status(500).json({ error: 'Internal server error' });
  }
};
