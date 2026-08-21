process.env.NODE_ENV = 'test';

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const API = 'http://localhost:3004';
const HEADERS = { 'Content-Type': 'application/json', 'X-Tenant-Slug': 'demo' };

const call = async (method, path, body, token) => {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      ...HEADERS,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
};

const attendu = (label, ok, detail) => console.log(`${ok ? '✅' : '❌'} ${label}${detail ? ` — ${detail}` : ''}`);

async function login(email, password) {
  const r = await call('POST', '/api/auth/login', { email, password });
  const token = r.data?.accessToken || r.data?.token;
  if (!token) throw new Error(`Login ${email} échoué: ${JSON.stringify(r.data)}`);
  return token;
}

async function main() {
  const { runAlertesCalendrierBatch } = await import('../src/jobs/alertesCalendrier.job.js');
  const { syncEvenementRentree } = await import('../src/controllers/calendrierScolaire.controller.js');

  const tokenDir = await login('directeur@demo.cg', 'Directeur123!');
  const tokenSec = await login('secretaire@demo.cg', 'Secretaire123!');
  console.log('Connectés directeur + secrétaire\n');

  // 1. Dashboard KPI
  const kpis = await call('GET', '/api/dashboard/kpis', null, tokenDir);
  attendu(
    'KPI totalEleves > 0',
    Number(kpis.data?.totalEleves) > 0,
    `totalEleves=${kpis.data?.totalEleves}`
  );
  attendu('KPI tauxPresence présent', kpis.data?.tauxPresence != null, `tauxPresence=${kpis.data?.tauxPresence}`);
  attendu('KPI repartitionCycles', Array.isArray(kpis.data?.repartitionCycles));

  const tenant = await prisma.tenant.findUnique({ where: { slug: 'demo' } });
  const annee = await prisma.anneeScolaire.findFirst({
    where: { tenantId: tenant.id, actif: true },
  });
  if (!annee) throw new Error('Aucune année active');

  await syncEvenementRentree(tenant.id, annee);

  // 2. Date hors année refusée
  const horsAnnee = await call('POST', '/api/calendrier', {
    titre: 'Composition hors année',
    type: 'composition',
    dateDebut: '2020-01-15',
    anneeScolaireId: annee.id,
  }, tokenDir);
  attendu('Composition hors année refusée', horsAnnee.status === 400, horsAnnee.data?.error);

  const tropLoin = await call('POST', '/api/calendrier', {
    titre: 'Composition trop lointaine',
    type: 'composition',
    dateDebut: '2035-01-15',
    anneeScolaireId: annee.id,
  }, tokenDir);
  attendu('Composition après fin d\'année refusée', tropLoin.status === 400, tropLoin.data?.error);

  // 3. Rentrée manuelle refusée
  const rentreeManuelle = await call('POST', '/api/calendrier', {
    titre: 'Rentrée manuelle',
    type: 'rentree',
    dateDebut: annee.dateDebut.toISOString().slice(0, 10),
    anneeScolaireId: annee.id,
  }, tokenDir);
  attendu('Rentrée manuelle refusée', rentreeManuelle.status === 400, rentreeManuelle.data?.error);

  // 4. Secrétaire bloquée en écriture
  const okDate = new Date(annee.dateDebut);
  okDate.setDate(okDate.getDate() + 30);
  const dateOk = okDate.toISOString().slice(0, 10);
  const secWrite = await call('POST', '/api/calendrier', {
    titre: 'Tentative secrétaire',
    type: 'composition',
    dateDebut: dateOk,
    anneeScolaireId: annee.id,
  }, tokenSec);
  attendu('Secrétaire bloquée en écriture calendrier', secWrite.status === 403 || secWrite.status === 401, `status=${secWrite.status}`);

  // 5. Reprise des cours acceptée
  const reprise = await call('POST', '/api/calendrier', {
    titre: 'Reprise après Noël',
    type: 'reprise_cours',
    dateDebut: dateOk,
    anneeScolaireId: annee.id,
  }, tokenDir);
  attendu('Reprise des cours acceptée', reprise.status === 201, `status=${reprise.status}`);
  if (reprise.data?.id) {
    await call('DELETE', `/api/calendrier/${reprise.data.id}`, null, tokenDir);
  }

  // 6. Période incohérente refusée
  const periodeBad = await call('POST', '/api/referentiel/periodes', {
    anneeScolaireId: annee.id,
    index: 99,
    libelle: 'Période test invalide',
    dateDebut: '2020-01-01',
    dateFin: '2020-02-01',
  }, tokenDir);
  attendu('Période hors année refusée', periodeBad.status === 400, periodeBad.data?.error);

  const periodeSec = await call('POST', '/api/referentiel/periodes', {
    anneeScolaireId: annee.id,
    index: 98,
    libelle: 'Période secrétaire',
    dateDebut: dateOk,
    dateFin: dateOk,
  }, tokenSec);
  attendu('Secrétaire bloquée sur périodes', periodeSec.status === 403 || periodeSec.status === 401, `status=${periodeSec.status}`);

  // 7. Alertes endpoint
  const alertes = await call('GET', '/api/calendrier/alertes?jours=14', null, tokenDir);
  attendu('Endpoint alertes OK', alertes.status === 200 && Array.isArray(alertes.data?.data), `count=${alertes.data?.data?.length}`);

  // 8. Job alerte J-14 + idempotence
  // Place the event 10 days ahead of "now" (bypass year bounds — job only checks the 14-day window)
  const dateAlerte = new Date();
  dateAlerte.setHours(12, 0, 0, 0);
  dateAlerte.setDate(dateAlerte.getDate() + 10);

  const evAlerte = await prisma.calendrierScolaire.create({
    data: {
      tenantId: tenant.id,
      anneeScolaireId: annee.id,
      titre: 'Composition test alerte',
      type: 'composition',
      dateDebut: dateAlerte,
      alerteEnvoyeeAt: null,
    },
  });

  const batch1 = await runAlertesCalendrierBatch({ tenantId: tenant.id });
  const after1 = await prisma.calendrierScolaire.findUnique({ where: { id: evAlerte.id } });
  attendu('Job alerte marque alerteEnvoyeeAt', !!after1.alerteEnvoyeeAt, `notified=${batch1.notified}`);

  const notifs = await prisma.notification.count({
    where: { tenantId: tenant.id, type: 'evenement', contenu: { contains: 'Composition test alerte' } },
  });
  attendu('Notifications staff créées', notifs > 0, `count=${notifs}`);

  const batch2 = await runAlertesCalendrierBatch({ tenantId: tenant.id });
  attendu('Job idempotent (pas de re-traitement)', batch2.eventsHandled === 0, `eventsHandled=${batch2.eventsHandled}`);

  await prisma.notification.deleteMany({
    where: { tenantId: tenant.id, type: 'evenement', contenu: { contains: 'Composition test alerte' } },
  });
  await prisma.calendrierScolaire.delete({ where: { id: evAlerte.id } });

  console.log('\nContrôles terminés');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
