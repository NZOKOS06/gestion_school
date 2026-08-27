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
