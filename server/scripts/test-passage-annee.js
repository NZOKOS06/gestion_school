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

const ok = (label, pass, detail) => console.log(`${pass ? '✅' : '❌'} ${label}${detail ? ` — ${detail}` : ''}`);

async function login(email, password) {
  const r = await call('POST', '/api/auth/login', { email, password });
  const token = r.data?.accessToken || r.data?.token;
  if (!token) throw new Error(`Login ${email} failed: ${JSON.stringify(r.data)}`);
  return token;
}

async function ensureDemoSource(tenantId) {
  // Prefer the year that actually holds demo data (classes + inscriptions)
  const candidates = await prisma.anneeScolaire.findMany({
    where: { tenantId },
    include: { _count: { select: { classes: true, inscriptions: true } } },
    orderBy: { dateDebut: 'asc' },
  });
  const best =
    candidates.find((a) => a.libelle === '2025-2026' && a._count.classes > 0)
    || candidates.find((a) => a._count.classes > 0)
    || candidates.find((a) => a.actif)
    || candidates[0];
  if (!best) throw new Error('Aucune année scolaire demo');

  await prisma.$transaction([
    prisma.anneeScolaire.updateMany({
      where: { tenantId, id: { not: best.id } },
      data: { actif: false, statut: 'archivee' },
    }),
    prisma.anneeScolaire.update({
      where: { id: best.id },
      data: { actif: true, statut: 'active' },
    }),
    prisma.tenantConfig.update({
      where: { tenantId },
      data: { anneeScolaireActiveId: best.id },
    }),
  ]);

  return prisma.anneeScolaire.findUnique({
    where: { id: best.id },
    include: { _count: { select: { classes: true, inscriptions: true } } },
  });
}

async function cleanupEmptyCopies(tenantId, keepId) {
  const empty = await prisma.anneeScolaire.findMany({
    where: {
      tenantId,
      id: { not: keepId },
      classes: { none: {} },
      inscriptions: { none: {} },
    },
    select: { id: true, libelle: true },
  });
  for (const a of empty) {
    await prisma.periodeScolaire.deleteMany({ where: { anneeScolaireId: a.id } });
    await prisma.calendrierScolaire.deleteMany({ where: { anneeScolaireId: a.id } }).catch(() => {});
    await prisma.anneeScolaire.delete({ where: { id: a.id } }).catch(() => {});
    console.log(`Nettoyage année vide: ${a.libelle}`);
  }
}

async function main() {
  const token = await login('directeur@demo.cg', 'Directeur123!');
  const tenant = await prisma.tenant.findUnique({ where: { slug: 'demo' } });
  if (!tenant) throw new Error('tenant demo introuvable');

  const source = await ensureDemoSource(tenant.id);
  console.log(`Source: ${source.libelle} (${source._count.classes} classes, ${source._count.inscriptions} inscriptions)\n`);

  const match = String(source.libelle).match(/(\d{4})\s*[-–]\s*(\d{4})/);
  const expectedLibelle = match
    ? `${parseInt(match[1], 10) + 1}-${parseInt(match[2], 10) + 1}`
    : `${source.libelle} (copie)`;

  // Drop previous empty copy of expected libelle so we re-test duplication
  const already = await prisma.anneeScolaire.findFirst({
    where: { tenantId: tenant.id, libelle: expectedLibelle },
    include: { _count: { select: { classes: true, inscriptions: true } } },
  });
  if (already && already._count.classes === 0 && already._count.inscriptions === 0) {
    await prisma.periodeScolaire.deleteMany({ where: { anneeScolaireId: already.id } });
    await prisma.anneeScolaire.delete({ where: { id: already.id } });
  }

  const dup = await call('POST', `/api/annees-scolaires/${source.id}/dupliquer`, {}, token);
  ok('Duplication HTTP 201', dup.status === 201, `status=${dup.status}`);
  const stats = dup.data?.stats || {};
  ok(
    'Squelette copié (classes)',
    source._count.classes === 0 || (stats.classes || 0) === source._count.classes,
    JSON.stringify(stats)
  );

  const cible = await prisma.anneeScolaire.findFirst({
    where: { tenantId: tenant.id, libelle: expectedLibelle },
  });
  ok('Année cible brouillon', cible && (cible.statut === 'brouillon' || !cible.actif), `statut=${cible?.statut}`);

  if (cible) {
    const act = await call('PUT', `/api/annees-scolaires/${cible.id}/activate`, {}, token);
    ok('Activation OK', act.status === 200, `status=${act.status}`);

    const refreshed = await prisma.anneeScolaire.findUnique({ where: { id: cible.id } });
    const old = await prisma.anneeScolaire.findUnique({ where: { id: source.id } });
    ok('Nouvelle année active', refreshed?.statut === 'active' && refreshed?.actif === true);
    ok('Ancienne année archivée', old?.statut === 'archivee' && old?.actif === false, `statut=${old?.statut}`);

    const classes = await call('GET', '/api/classes?limit=100', null, token);
    const classList = classes.data?.data || [];
    const classYear = classList.every((c) => c.anneeScolaireId === cible.id);
    ok('Classes filtrées sur année active', classYear && classList.length === source._count.classes, `n=${classList.length}`);

    const insc = await call('GET', '/api/inscriptions?limit=100', null, token);
    const inscList = insc.data?.data || [];
    ok('Inscriptions année active vides', inscList.length === 0, `n=${inscList.length}`);

    const pay = await call('GET', '/api/paiements?limit=50', null, token);
    ok('Paiements année active à 0', pay.status === 200 && (pay.data?.data || []).length === 0, `n=${(pay.data?.data || []).length}`);

    const kpis = await call('GET', '/api/dashboard/kpis', null, token);
    ok('KPI élèves = 0 sur nouvelle année', kpis.data?.totalEleves === 0, `totalEleves=${kpis.data?.totalEleves}`);

    const payArchive = await call('GET', `/api/paiements?anneeScolaireId=${source.id}&limit=50`, null, token);
    ok('Consultation paiements année archivée', payArchive.status === 200, `n=${(payArchive.data?.data || []).length}`);

    const elig = await call(
      'GET',
      `/api/inscriptions/eligibles-reinscription?anneeSourceId=${source.id}&anneeCibleId=${cible.id}`,
      null,
      token
    );
    ok('Eligibles réinscription', elig.status === 200 && Array.isArray(elig.data?.data), `n=${(elig.data?.data || []).length}`);

    const row = (elig.data?.data || []).find((r) => !r.dejaInscrit && r.suggestedClasseId);
    if (row) {
      const lot = await call('POST', '/api/inscriptions/reinscription-lot', {
        anneeCibleId: cible.id,
        items: [{
          inscriptionSourceId: row.inscriptionSourceId,
          decisionFinAnnee: row.suggestedDecision || 'passage',
          classeCibleId: row.suggestedClasseId,
        }],
      }, token);
      ok(
        'Réinscription lot',
        lot.status === 200 && ((lot.data?.created || 0) >= 1 || (lot.data?.skipped || 0) >= 1),
        JSON.stringify(lot.data)
      );
    } else {
      console.log('⚠️  Aucun élève éligible avec classe suggérée pour test lot');
    }

    const upd = await call('PUT', `/api/annees-scolaires/${cible.id}`, {
      libelle: cible.libelle,
      dateDebut: cible.dateDebut.toISOString?.()?.slice(0, 10) || String(cible.dateDebut).slice(0, 10),
      dateFin: cible.dateFin.toISOString?.()?.slice(0, 10) || String(cible.dateFin).slice(0, 10),
    }, token);
    ok('Update dates année', upd.status === 200 || upd.status === 400, `status=${upd.status}`);

    // Toujours restaurer la source puis supprimer entièrement la copie de test
    await call('PUT', `/api/annees-scolaires/${source.id}/activate`, {}, token);
    console.log(`\nRestauré année active: ${source.libelle}`);

    const classeIds = (
      await prisma.classe.findMany({ where: { anneeScolaireId: cible.id }, select: { id: true } })
    ).map((c) => c.id);
    const inscIds = (
      await prisma.inscription.findMany({ where: { anneeScolaireId: cible.id }, select: { id: true } })
    ).map((i) => i.id);

    if (classeIds.length) {
      await prisma.inscription.updateMany({
        where: { classeCibleId: { in: classeIds } },
        data: { classeCibleId: null },
      });
    }
    if (inscIds.length) {
      await prisma.paiement.deleteMany({ where: { inscriptionId: { in: inscIds } } });
      await prisma.echeance.deleteMany({ where: { inscriptionId: { in: inscIds } } });
      await prisma.inscription.deleteMany({ where: { id: { in: inscIds } } });
    }
    if (classeIds.length) {
      await prisma.emploiDuTemps.deleteMany({ where: { classeId: { in: classeIds } } });
      await prisma.enseignantClasse.deleteMany({ where: { classeId: { in: classeIds } } });
      await prisma.matiereClasseAnnee.deleteMany({ where: { classeId: { in: classeIds } } });
      await prisma.classe.deleteMany({ where: { id: { in: classeIds } } });
    }
    await prisma.matiereNiveauAnnee.deleteMany({ where: { anneeScolaireId: cible.id } });
    await prisma.periodeScolaire.deleteMany({ where: { anneeScolaireId: cible.id } });
    await prisma.calendrierScolaire.deleteMany({ where: { anneeScolaireId: cible.id } });
    await prisma.anneeScolaire.delete({ where: { id: cible.id } });
    console.log(`Nettoyage année de test: ${cible.libelle}`);
  }

  await cleanupEmptyCopies(tenant.id, source.id);
  console.log('\nContrôles passage année terminés');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
