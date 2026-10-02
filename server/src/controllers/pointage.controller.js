import { prisma, rawPrisma } from '../utils/prisma.js';
import { createLogger } from '../utils/logger.js';
import { serializePointageSession, parseTimeOnDate, startOfDayUTC } from '../utils/pointageHelpers.js';
import {
  ensureSessionsForDate,
  getTenantPointageConfig,
  closeSessionDepart,
  findBestSessionForScan,
} from '../services/pointage.service.js';

const log = createLogger('PointageController');

const ROLES_POINTAGE = ['directeur', 'directeur_etudes', 'surveillant'];

export const getSessions = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { date, enseignantId, salleId, statut } = req.query;
    const day = startOfDayUTC(date || new Date());

    let sessions = await ensureSessionsForDate(tenantId, day);

    if (enseignantId) sessions = sessions.filter((s) => s.enseignantId === enseignantId);
    if (salleId) sessions = sessions.filter((s) => s.salleId === salleId);
    if (statut) sessions = sessions.filter((s) => s.statut === statut);

    res.json({
      date: day.toISOString().slice(0, 10),
      data: sessions.map(serializePointageSession),
    });
  } catch (error) {
    log.error({ err: error }, 'getSessions pointage');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getMesSessions = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const enseignantId = req.user.id;
    const { date, from, to } = req.query;

    const where = { tenantId, enseignantId };
    if (date) {
      where.date = startOfDayUTC(date);
    } else if (from || to) {
      where.date = {};
      if (from) where.date.gte = startOfDayUTC(from);
      if (to) where.date.lte = startOfDayUTC(to);
    } else {
      where.date = startOfDayUTC(new Date());
    }

    const sessions = await prisma.pointageSession.findMany({
      where,
      include: {
        classe: { select: { id: true, nom: true } },
        matiere: { select: { id: true, nom: true, code: true } },
        salle: { select: { id: true, nom: true } },
        emploiDuTemps: { select: { id: true, heureDebut: true, heureFin: true, salle: true } },
      },
      orderBy: [{ date: 'desc' }, { heurePrevueDebut: 'asc' }],
      take: 100,
    });

    res.json({ data: sessions.map(serializePointageSession) });
  } catch (error) {
    log.error({ err: error }, 'getMesSessions');
    res.status(500).json({ error: 'Internal server error' });
  }
};

async function loadSession(id, tenantId) {
  return prisma.pointageSession.findFirst({
    where: { id, tenantId },
    include: {
      enseignant: { select: { id: true, nom: true, prenom: true } },
      classe: { select: { id: true, nom: true } },
      matiere: { select: { id: true, nom: true, code: true } },
      salle: { select: { id: true, nom: true } },
      emploiDuTemps: { select: { id: true, heureDebut: true, heureFin: true, salle: true } },
    },
  });
}

export const arrivee = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;
    const { at, heure, commentaire } = req.body;

    const session = await loadSession(id, tenantId);
    if (!session) return res.status(404).json({ error: 'Session non trouvee' });
    if (session.statut === 'terminee' || session.statut === 'annulee') {
      return res.status(400).json({ error: 'Session deja cloturee' });
    }

    let heureArrivee = new Date();
    if (at) heureArrivee = new Date(at);
    else if (heure) heureArrivee = parseTimeOnDate(session.date, heure);

    const updated = await prisma.pointageSession.update({
      where: { id },
      data: {
        heureArrivee,
        sourceArrivee: 'manuel',
        saisiParId: req.user.id,
        statut: 'en_cours',
        commentaire: commentaire ?? session.commentaire,
      },
      include: {
        enseignant: { select: { id: true, nom: true, prenom: true } },
        classe: { select: { id: true, nom: true } },
        matiere: { select: { id: true, nom: true, code: true } },
        salle: { select: { id: true, nom: true } },
        emploiDuTemps: { select: { id: true, heureDebut: true, heureFin: true, salle: true } },
      },
    });

    res.json(serializePointageSession(updated));
  } catch (error) {
    log.error({ err: error }, 'arrivee pointage');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const depart = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;
    const { at, heure, commentaire } = req.body;

    const session = await loadSession(id, tenantId);
    if (!session) return res.status(404).json({ error: 'Session non trouvee' });
    if (!session.heureArrivee) {
      return res.status(400).json({ error: 'Pointez l\'arrivee avant le depart' });
    }

    let heureDepart = new Date();
    if (at) heureDepart = new Date(at);
    else if (heure) heureDepart = parseTimeOnDate(session.date, heure);

    const { toleranceMinutes } = await getTenantPointageConfig(tenantId);
    const updated = await closeSessionDepart(
      session,
      heureDepart,
      'manuel',
      req.user.id,
      toleranceMinutes
    );

    if (commentaire) {
      await prisma.pointageSession.update({
        where: { id },
        data: { commentaire },
      });
    }

    res.json(serializePointageSession(updated));
  } catch (error) {
    log.error({ err: error }, 'depart pointage');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const marquerAbsent = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;
    const { commentaire } = req.body;

    const session = await loadSession(id, tenantId);
    if (!session) return res.status(404).json({ error: 'Session non trouvee' });

    const updated = await prisma.pointageSession.update({
      where: { id },
      data: {
        statut: 'absente',
        saisiParId: req.user.id,
        commentaire: commentaire ?? null,
      },
      include: {
        enseignant: { select: { id: true, nom: true, prenom: true } },
        classe: { select: { id: true, nom: true } },
        matiere: { select: { id: true, nom: true, code: true } },
        salle: { select: { id: true, nom: true } },
        emploiDuTemps: { select: { id: true, heureDebut: true, heureFin: true, salle: true } },
      },
    });

    res.json(serializePointageSession(updated));
  } catch (error) {
    log.error({ err: error }, 'marquerAbsent');
    res.status(500).json({ error: 'Internal server error' });
  }
};

/** Stub biométrie V2 — token device via env POINTAGE_DEVICE_TOKEN */
export const deviceScan = async (req, res) => {
  try {
    const token = req.headers['x-pointage-device-token'] || req.body?.deviceToken;
    const expected = process.env.POINTAGE_DEVICE_TOKEN;
    if (!expected || token !== expected) {
      return res.status(401).json({ error: 'Device non autorise' });
    }

    const tenantId = req.tenantId;
    if (!tenantId) return res.status(400).json({ error: 'Tenant required (X-Tenant-Slug)' });

    const { biometricUserId, deviceId, event = 'arrivee', at } = req.body;
    if (!biometricUserId) {
      return res.status(400).json({ error: 'biometricUserId requis' });
    }

    const staff = await rawPrisma.staff.findFirst({
      where: { tenantId, deviceBiometricId: String(biometricUserId), actif: true },
    });
    if (!staff) {
      return res.status(404).json({ error: 'Enseignant non trouve pour cet ID biometrique' });
    }

    const when = at ? new Date(at) : new Date();
    const session = await findBestSessionForScan(tenantId, staff.id, when);
    if (!session) {
      return res.status(404).json({ error: 'Aucune session prevue pour cet enseignant' });
    }

    const { toleranceMinutes } = await getTenantPointageConfig(tenantId);

    if (event === 'depart') {
      if (!session.heureArrivee) {
        return res.status(400).json({ error: 'Arrivee non enregistree' });
      }
      const updated = await closeSessionDepart(session, when, 'biometrique', null, toleranceMinutes);
      return res.json({ ok: true, event: 'depart', deviceId, session: serializePointageSession(updated) });
    }

    const updated = await prisma.pointageSession.update({
      where: { id: session.id },
      data: {
        heureArrivee: when,
        sourceArrivee: 'biometrique',
        statut: 'en_cours',
      },
      include: {
        enseignant: { select: { id: true, nom: true, prenom: true } },
        classe: { select: { id: true, nom: true } },
        matiere: { select: { id: true, nom: true, code: true } },
        salle: { select: { id: true, nom: true } },
        emploiDuTemps: { select: { id: true, heureDebut: true, heureFin: true, salle: true } },
      },
    });

    res.json({ ok: true, event: 'arrivee', deviceId, session: serializePointageSession(updated) });
  } catch (error) {
    log.error({ err: error }, 'deviceScan');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export { ROLES_POINTAGE };

/** PUT /api/pointage/sessions/:id/justifier { justifiee, commentaire } — retard / absence justifié */
export const justifierSession = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const session = await prisma.pointageSession.findFirst({ where: { id: req.params.id, tenantId } });
    if (!session) return res.status(404).json({ error: 'Session non trouvee' });
    const justifiee = req.body.justifiee === true || req.body.justifiee === 'true';
    const updated = await prisma.pointageSession.update({
      where: { id: session.id },
      data: {
        justifiee,
        ...(req.body.commentaire !== undefined ? { commentaire: req.body.commentaire || null } : {}),
        saisiParId: req.user.id,
      },
    });
    res.json(serializePointageSession(updated));
  } catch (error) {
    log.error({ err: error }, 'justifierSession');
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ─── Pointage journalier du personnel hors enseignement ───────────────────────

const ROLES_JOURNALIER = ['directeur', 'directeur_etudes', 'secretaire', 'comptable', 'surveillant'];

const parseDateJour = (value) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
  if (!m) return null;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
};

const heureSurJour = (dateJour, hhmm) => {
  if (!hhmm) return null;
  if (!/^\d{1,2}:\d{2}$/.test(String(hhmm))) return undefined;
  return parseTimeOnDate(dateJour, hhmm);
};

/**
 * GET /api/pointage/journalier?date=YYYY-MM-DD
 * Personnel hors enseignement avec son pointage du jour et ses horaires attendus.
 */
export const getJournalier = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const dateJour = parseDateJour(req.query.date) || startOfDayUTC(new Date());
    const [config, staff, pointages] = await Promise.all([
      prisma.tenantConfig.findUnique({ where: { tenantId }, select: { heureDebut: true, heureFin: true, pointageToleranceMinutes: true } }),
      prisma.staff.findMany({
        where: { tenantId, actif: true, role: { in: ROLES_JOURNALIER } },
        select: { id: true, nom: true, prenom: true, role: true, heureArriveePrevue: true, heureDepartPrevue: true },
        orderBy: [{ nom: 'asc' }, { prenom: 'asc' }],
      }),
      prisma.pointageJournalier.findMany({ where: { tenantId, date: dateJour } }),
    ]);
    const parStaff = new Map(pointages.map((p) => [p.staffId, p]));
    res.json({
      date: dateJour,
      toleranceMinutes: config?.pointageToleranceMinutes ?? 15,
      data: staff.map((s) => ({
        ...s,
        heureArriveePrevue: s.heureArriveePrevue || config?.heureDebut || '08:00',
        heureDepartPrevue: s.heureDepartPrevue || config?.heureFin || '17:00',
        pointage: parStaff.get(s.id) || null,
      })),
    });
  } catch (error) {
    log.error({ err: error }, 'getJournalier');
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * PUT /api/pointage/journalier
 * { staffId, date: 'YYYY-MM-DD', statut: present|absent|conge, heureArrivee?: 'HH:MM', heureDepart?: 'HH:MM', justifie?, motif? }
 */
export const saveJournalier = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { staffId, statut = 'present', justifie = false, motif = null } = req.body;
    const dateJour = parseDateJour(req.body.date);
    if (!dateJour) return res.status(400).json({ error: 'Date invalide (AAAA-MM-JJ)' });
    if (!['present', 'absent', 'conge'].includes(statut)) return res.status(400).json({ error: 'Statut invalide' });

    const staff = await prisma.staff.findFirst({ where: { id: staffId, tenantId, role: { in: ROLES_JOURNALIER } } });
    if (!staff) return res.status(404).json({ error: 'Agent introuvable' });

    const heureArrivee = statut === 'present' ? heureSurJour(dateJour, req.body.heureArrivee) : null;
    const heureDepart = statut === 'present' ? heureSurJour(dateJour, req.body.heureDepart) : null;
    if (heureArrivee === undefined || heureDepart === undefined) {
      return res.status(400).json({ error: 'Heure invalide (HH:MM)' });
    }
    if (heureArrivee && heureDepart && heureDepart <= heureArrivee) {
      return res.status(400).json({ error: "L'heure de départ doit être après l'heure d'arrivée" });
    }

    const data = {
      statut,
      heureArrivee,
      heureDepart,
      justifie: justifie === true || justifie === 'true',
      motif: motif ? String(motif).slice(0, 300) : null,
      saisiParId: req.user.id,
    };
    const pointage = await prisma.pointageJournalier.upsert({
      where: { staffId_date: { staffId: staff.id, date: dateJour } },
      create: { tenantId, staffId: staff.id, date: dateJour, ...data },
      update: data,
    });
    res.json(pointage);
  } catch (error) {
    log.error({ err: error }, 'saveJournalier');
    res.status(500).json({ error: 'Internal server error' });
  }
};
