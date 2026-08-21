import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** Contrôle de cohérence des règles d'affectation sur le tenant démo. */
async function check() {
  const tenant = await prisma.tenant.findUnique({ where: { slug: 'demo' } });
  if (!tenant) return console.log('Tenant démo introuvable.');

  const affectations = await prisma.enseignantClasse.findMany({
    where: { tenantId: tenant.id },
    include: {
      enseignant: { select: { email: true } },
      classe: { select: { nom: true, cycle: true } },
      matiere: { select: { code: true } },
    },
  });

  const parProf = new Map();
  for (const a of affectations) {
    const key = a.enseignant.email;
    if (!parProf.has(key)) parProf.set(key, { matieres: new Set(), classes: new Map() });
    const entry = parProf.get(key);
    entry.matieres.add(a.matiere.code);
    entry.classes.set(a.classe.nom, a.classe.cycle);
  }

  console.log(`\n=== AFFECTATIONS (${affectations.length}) ===`);
  for (const [email, e] of parProf) {
    const cycles = [...new Set(e.classes.values())];
    const titulaire = cycles.some((c) => ['prescolaire', 'primaire'].includes(c));
    const flags = [];
    if (!titulaire && e.matieres.size > 1) flags.push('❌ plusieurs matières hors primaire');
    if (titulaire && e.classes.size > 1) flags.push('❌ titulaire sur plusieurs classes');
    console.log(
      `${email} — matières: ${[...e.matieres].join(', ')} | classes: ${[...e.classes.keys()].join(', ')} ${flags.join(' ') || '✅'}`
    );
  }

  const creneaux = await prisma.emploiDuTemps.findMany({
    where: { tenantId: tenant.id },
    include: {
      enseignant: { select: { email: true } },
      classe: { select: { nom: true } },
      matiere: { select: { code: true } },
    },
    orderBy: [{ jourSemaine: 'asc' }, { heureDebut: 'asc' }],
  });

  console.log(`\n=== EMPLOI DU TEMPS (${creneaux.length}) ===`);
  for (const c of creneaux) {
    console.log(`J${c.jourSemaine} ${c.heureDebut}-${c.heureFin} ${c.classe.nom} ${c.matiere.code} ${c.enseignant.email}`);
  }

  let chevauchements = 0;
  for (let i = 0; i < creneaux.length; i++) {
    for (let j = i + 1; j < creneaux.length; j++) {
      const a = creneaux[i];
      const b = creneaux[j];
      if (a.enseignantId !== b.enseignantId || a.jourSemaine !== b.jourSemaine) continue;
      if (a.heureDebut < b.heureFin && a.heureFin > b.heureDebut) {
        console.log(`❌ chevauchement ${a.enseignant.email} J${a.jourSemaine} ${a.heureDebut}-${a.heureFin} / ${b.heureDebut}-${b.heureFin}`);
        chevauchements++;
      }
    }
  }
  console.log(chevauchements ? `\n${chevauchements} chevauchement(s)` : '\n✅ aucun chevauchement enseignant');

  const quittees = await prisma.enseignantClasseQuittee.findMany({
    where: { tenantId: tenant.id },
    include: { enseignant: { select: { email: true } }, classe: { select: { nom: true } } },
  });
  console.log(`\n=== CLASSES FERMÉES (${quittees.length}) ===`);
  for (const q of quittees) {
    console.log(`${q.enseignant.email} ⛔ ${q.classe.nom} — ${q.motif || 'sans motif'}`);
  }
}

check()
  .catch((e) => {
    console.error('❌ Erreur :', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
