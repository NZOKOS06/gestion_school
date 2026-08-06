import { prisma } from '../utils/prisma.js';
import { createLogger } from '../utils/logger.js';
import { logAudit } from '../utils/auditLogger.js';

const log = createLogger('ExamensController');

export const listSessions = async (req, res) => {
  try {
    const { anneeScolaireId, typeExamen } = req.query;
    const where = { tenantId: req.tenantId };
    if (anneeScolaireId) where.anneeScolaireId = anneeScolaireId;
    if (typeExamen) where.typeExamen = typeExamen;

    const sessions = await prisma.examenSession.findMany({
      where,
      include: {
        _count: { select: { candidatures: true } },
        anneeScolaire: { select: { id: true, libelle: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ data: sessions });
  } catch (error) {
    log.error({ err: error }, 'listSessions');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createSession = async (req, res) => {
  try {
    const { anneeScolaireId, typeExamen, libelle, dateDebut, dateFin, centre } = req.body;
    if (!anneeScolaireId || !typeExamen || !libelle) {
      return res.status(400).json({ error: 'anneeScolaireId, typeExamen et libelle requis' });
    }

    const session = await prisma.examenSession.create({
      data: {
        tenantId: req.tenantId,
        anneeScolaireId,
        typeExamen,
        libelle,
        dateDebut: dateDebut ? new Date(dateDebut) : null,
        dateFin: dateFin ? new Date(dateFin) : null,
        centre: centre || null,
      },
    });
    await logAudit(req, 'examen_session_created', 'ExamenSession', session.id, { typeExamen, libelle });
    res.status(201).json(session);
  } catch (error) {
    log.error({ err: error }, 'createSession');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const listCandidatures = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const candidatures = await prisma.examenCandidature.findMany({
      where: { tenantId: req.tenantId, sessionId },
      include: {
        eleve: { select: { id: true, matricule: true, nom: true, prenom: true } },
        resultat: true,
        notes: true,
      },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ data: candidatures });
  } catch (error) {
    log.error({ err: error }, 'listCandidatures');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const addCandidature = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { eleveId, serieFiliere, numeroCandidat } = req.body;
    if (!eleveId) return res.status(400).json({ error: 'eleveId requis' });

    const session = await prisma.examenSession.findFirst({
      where: { id: sessionId, tenantId: req.tenantId },
    });
    if (!session) return res.status(404).json({ error: 'Session introuvable' });

    const candidature = await prisma.examenCandidature.create({
      data: {
        tenantId: req.tenantId,
        sessionId,
        eleveId,
        serieFiliere: serieFiliere || null,
        numeroCandidat: numeroCandidat || null,
      },
      include: { eleve: true },
    });
    await logAudit(req, 'examen_candidature_created', 'ExamenCandidature', candidature.id, { eleveId });
    res.status(201).json(candidature);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Élève déjà candidat à cette session' });
    }
    log.error({ err: error }, 'addCandidature');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const setResultat = async (req, res) => {
  try {
    const { candidatureId } = req.params;
    const { statut, mention, numeroDiplome, moyenne, notes } = req.body;

    const candidature = await prisma.examenCandidature.findFirst({
      where: { id: candidatureId, tenantId: req.tenantId },
      include: { resultat: true },
    });
    if (!candidature) return res.status(404).json({ error: 'Candidature introuvable' });

    if (Array.isArray(notes) && notes.length) {
      await prisma.examenNote.deleteMany({ where: { candidatureId } });
      await prisma.examenNote.createMany({
        data: notes.map((n) => ({
          candidatureId,
          matiereLibelle: n.matiereLibelle,
          note: parseFloat(n.note),
          coefficient: n.coefficient != null ? parseFloat(n.coefficient) : 1,
        })),
      });
    }

    const resultat = await prisma.resultatExamen.upsert({
      where: { candidatureId },
      update: {
        statut: statut || 'en_attente',
        mention: mention || null,
        numeroDiplome: numeroDiplome || null,
        moyenne: moyenne != null ? parseFloat(moyenne) : null,
      },
      create: {
        tenantId: req.tenantId,
        candidatureId,
        statut: statut || 'en_attente',
        mention: mention || null,
        numeroDiplome: numeroDiplome || null,
        moyenne: moyenne != null ? parseFloat(moyenne) : null,
      },
    });

    await logAudit(req, 'examen_resultat_set', 'ResultatExamen', resultat.id, { statut });
    res.json(resultat);
  } catch (error) {
    log.error({ err: error }, 'setResultat');
    res.status(500).json({ error: 'Internal server error' });
  }
};
