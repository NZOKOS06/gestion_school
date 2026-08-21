import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Remet à zéro les affectations enseignant ↔ classe ↔ matière et les créneaux
 * d'emploi du temps du tenant démo, avant un nouveau passage du seed.
 * Élèves, notes, bulletins et paiements sont conservés : les absences et le
 * cahier de textes perdent seulement leur lien vers le créneau (SetNull).
 */
async function resetAffectations() {
  const tenant = await prisma.tenant.findUnique({ where: { slug: 'demo' } });
  if (!tenant) {
    console.log('Tenant démo introuvable — rien à faire.');
    return;
  }

  const [quittees, creneaux, affectations] = await Promise.all([
    prisma.enseignantClasseQuittee.deleteMany({ where: { tenantId: tenant.id } }),
    prisma.emploiDuTemps.deleteMany({ where: { tenantId: tenant.id } }),
    prisma.enseignantClasse.deleteMany({ where: { tenantId: tenant.id } }),
  ]);

  console.log(`✓ ${affectations.count} affectations supprimées`);
  console.log(`✓ ${creneaux.count} créneaux d'emploi du temps supprimés`);
  console.log(`✓ ${quittees.count} classes fermées réouvertes`);
  console.log('\nRelancez `npm run db:seed` pour recréer des données conformes.');
}

resetAffectations()
  .catch((e) => {
    console.error('❌ Erreur durant le reset :', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
