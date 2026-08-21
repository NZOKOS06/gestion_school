import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const API = process.env.API_URL || 'http://localhost:3004';
const HEADERS = { 'Content-Type': 'application/json', 'X-Tenant-Slug': 'demo' };

let token = null;

const call = async (method, path, body) => {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { ...HEADERS, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
};

const attendu = (label, ok, detail) => {
  console.log(`${ok ? '✅' : '❌'} ${label}${detail ? ` — ${detail}` : ''}`);
  return ok;
};

async function main() {
  const login = await call('POST', '/api/auth/login', {
    email: 'directeur@demo.cg',
    password: 'Directeur123!',
  });
  token = login.data?.accessToken || login.data?.token;
  if (!token) throw new Error(`Login échoué : ${JSON.stringify(login.data)}`);
  console.log('Connecté en tant que directeur\n');

  const tenant = await prisma.tenant.findUnique({ where: { slug: 'demo' } });
  const staff = await prisma.staff.findMany({ where: { tenantId: tenant.id, role: 'enseignant' } });
  const classes = await prisma.classe.findMany({ where: { tenantId: tenant.id } });
  const matieres = await prisma.matiere.findMany({ where: { tenantId: tenant.id } });

  const byEmail = (e) => staff.find((s) => s.email === e);
  const byClasse = (n) => classes.find((c) => c.nom === n);
  const byMatiere = (c) => matieres.find((m) => m.code === c);

  const profMath = byEmail('enseignant@demo.cg');
  const titulaireCm2 = byEmail('titulaire.cm2@demo.cg');

  // Règle 1 — le prof de maths ne peut pas prendre le français au collège
  const r1 = await call('POST', `/api/matieres/${byMatiere('FR').id}/affectations`, {
    enseignantId: profMath.id,
    classeId: byClasse('5ème B').id,
  });
  attendu('Règle 1 : 2e matière au collège refusée', r1.status === 409, r1.data.error);

  // Règle 1 bis — une classe de plus dans sa propre matière reste possible
  const profSvt = byEmail('prof.svt@demo.cg');
  const r1b = await call('POST', `/api/matieres/${byMatiere('SVT').id}/affectations`, {
    enseignantId: profSvt.id,
    classeId: byClasse('2nde A').id,
  });
  attendu('Règle 1 : classe supplémentaire dans sa matière acceptée', r1b.status === 201, r1b.data.error || 'créée');

  // Règle 3 — le titulaire CM2 déplacé en GS A perd CM2 A
  const r3 = await call('POST', `/api/matieres/${byMatiere('FR').id}/affectations`, {
    enseignantId: titulaireCm2.id,
    classeId: byClasse('GS A').id,
  });
  attendu(
    'Règle 3 : réaffectation libère la classe précédente',
    r3.status === 201 && r3.data.classesLiberees?.includes('CM2 A'),
    JSON.stringify(r3.data.classesLiberees || r3.data.error)
  );

  // Règle 3 bis — retour en CM2 A désormais impossible
  const r3b = await call('POST', `/api/matieres/${byMatiere('FR').id}/affectations`, {
    enseignantId: titulaireCm2.id,
    classeId: byClasse('CM2 A').id,
  });
  attendu('Règle 3 : retour dans la classe quittée refusé', r3b.status === 409, r3b.data.error);

  // Règle 2 — créneau qui chevauche un cours existant du même prof
  const r2 = await call('POST', '/api/emplois-du-temps', {
    classeId: byClasse('3ème A').id,
    matiereId: byMatiere('MATH').id,
    enseignantId: profMath.id,
    jourSemaine: 1,
    heureDebut: '08:00',
    heureFin: '10:00',
  });
  attendu('Règle 2 : chevauchement horaire refusé', r2.status === 409, r2.data.error);

  // Règle 2 bis — même jour, horaire disjoint
  const r2b = await call('POST', '/api/emplois-du-temps', {
    classeId: byClasse('3ème A').id,
    matiereId: byMatiere('MATH').id,
    enseignantId: profMath.id,
    jourSemaine: 1,
    heureDebut: '10:00',
    heureFin: '12:00',
  });
  attendu('Règle 2 : même jour, horaire disjoint accepté', r2b.status === 201, r2b.data.error || 'créé');

  console.log('\nNettoyage des données de test…');
  if (r2b.status === 201 && r2b.data?.id) {
    await prisma.emploiDuTemps.delete({ where: { id: r2b.data.id } });
  }
  if (r1b.status === 201) {
    await prisma.enseignantClasse.deleteMany({
      where: { tenantId: tenant.id, enseignantId: profSvt.id, classeId: byClasse('2nde A').id },
    });
  }
  await prisma.enseignantClasse.deleteMany({
    where: { tenantId: tenant.id, enseignantId: titulaireCm2.id },
  });
  await prisma.enseignantClasseQuittee.deleteMany({
    where: { tenantId: tenant.id, enseignantId: titulaireCm2.id },
  });
  for (const code of ['FR', 'MATH', 'HIST-GEO']) {
    await prisma.enseignantClasse.create({
      data: {
        tenantId: tenant.id,
        enseignantId: titulaireCm2.id,
        classeId: byClasse('CM2 A').id,
        matiereId: byMatiere(code).id,
      },
    });
  }
  console.log('✓ État démo restauré');
}

main()
  .catch((e) => {
    console.error('❌ Erreur :', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
