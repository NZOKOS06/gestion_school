import { prisma } from '../utils/prisma.js';
import {
  jsDateToJourSemaine,
  startOfDayUTC,
  computeDureeHeures,
  formatHHMM,
} from '../utils/pointageHelpers.js';

const sessionInclude = {
  enseignant: { select: { id: true, nom: true, prenom: true } },
  classe: { select: { id: true, nom: true } },
  matiere: { select: { id: true, nom: true, code: true } },
  salle: { select: { id: true, nom: true } },
  emploiDuTemps: { select: { id: true, heureDebut: true, heureFin: true, salle: true } },
};

export async function getTenantPointageConfig(tenantId) {
  const cfg = await prisma.tenantConfig.findUnique({
    where: { tenantId },
    select: { pointageToleranceMinutes: true },
  });
  return { toleranceMinutes: cfg?.pointageToleranceMinutes ?? 15 };
}

/** Genere les sessions manquantes pour une date a partir de l'EDT. */
export async function ensureSessionsForDate(tenantId, dateInput) {
  const day = startOfDayUTC(dateInput);
  const jourSemaine = jsDateToJourSemaine(day);

  const creneaux = await prisma.emploiDuTemps.findMany({
    where: { tenantId, jourSemaine },
    include: {
      enseignant: { select: { id: true, actif: true, role: true } },
    },
  });

  for (const c of creneaux) {
    if (!c.enseignant?.actif) continue;
    await prisma.pointageSession.upsert({
      where: {
        tenantId_emploiDuTempsId_date: {
          tenantId,
          emploiDuTempsId: c.id,
          date: day,
        },
      },
      create: {
        tenantId,
        emploiDuTempsId: c.id,
        enseignantId: c.enseignantId,
        classeId: c.classeId,
        matiereId: c.matiereId,
        salleId: c.salleId,
        date: day,
        heurePrevueDebut: c.heureDebut,
        heurePrevueFin: c.heureFin,
        statut: 'prevue',
      },
      update: {},
    });
  }

  return prisma.pointageSession.findMany({
    where: { tenantId, date: day },
    include: sessionInclude,
    orderBy: [{ heurePrevueDebut: 'asc' }],
  });
}

export async function upsertHeureFromSession(sessionId, tenantId) {
  const session = await prisma.pointageSession.findFirst({
    where: { id: sessionId, tenantId },
  });
  if (!session || session.statut !== 'terminee' || session.dureeHeures == null) return null;

  const heureDebut = session.heureArrivee ? formatHHMM(new Date(session.heureArrivee)) : session.heurePrevueDebut;
  const heureFin = session.heureDepart ? formatHHMM(new Date(session.heureDepart)) : session.heurePrevueFin;

  const existing = await prisma.heureEnseignee.findFirst({
    where: { pointageSessionId: session.id, tenantId },
  });

  const data = {
    tenantId,
    enseignantId: session.enseignantId,
    classeId: session.classeId,
    matiereId: session.matiereId,
    pointageSessionId: session.id,
    date: session.date,
    heureDebut,
    heureFin,
    dureeHeures: session.dureeHeures,
    validee: false,
  };

  if (existing) {
    return prisma.heureEnseignee.update({ where: { id: existing.id }, data });
  }
  return prisma.heureEnseignee.create({ data });
}

export async function closeSessionDepart(session, heureDepart, source, saisiParId, toleranceMinutes) {
  const dureeHeures = computeDureeHeures({
    heureArrivee: session.heureArrivee,
    heureDepart,
    heurePrevueDebut: session.heurePrevueDebut,
    heurePrevueFin: session.heurePrevueFin,
    date: session.date,
    toleranceMinutes,
  });

  const updated = await prisma.pointageSession.update({
    where: { id: session.id },
    data: {
      heureDepart,
      sourceDepart: source,
      saisiParId,
      statut: 'terminee',
      dureeHeures,
    },
    include: sessionInclude,
  });

  await upsertHeureFromSession(updated.id, session.tenantId);
  return updated;
}

/** Trouve la session EDT la plus proche pour un enseignant a un instant donne. */
export async function findBestSessionForScan(tenantId, enseignantId, at) {
  const day = startOfDayUTC(at);
  await ensureSessionsForDate(tenantId, day);
  const sessions = await prisma.pointageSession.findMany({
    where: {
      tenantId,
      enseignantId,
      date: day,
      statut: { in: ['prevue', 'en_cours'] },
    },
    orderBy: { heurePrevueDebut: 'asc' },
  });
  if (!sessions.length) return null;

  const atMs = at.getTime();
  let best = sessions[0];
  let bestDiff = Infinity;
  for (const s of sessions) {
    const start = new Date(day);
    const [sh, sm] = s.heurePrevueDebut.split(':').map(Number);
    start.setHours(sh, sm, 0, 0);
    const diff = Math.abs(atMs - start.getTime());
    if (diff < bestDiff) {
      bestDiff = diff;
      best = s;
    }
  }
  return best;
}
