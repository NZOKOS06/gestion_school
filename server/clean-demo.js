import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Nettoyage des données...');

  // Delete students with single letter names or names matching 'e' or 'z' ignoring case
  const deleted = await prisma.eleve.deleteMany({
    where: {
      OR: [
        { nom: { equals: 'e', mode: 'insensitive' } },
        { nom: { equals: 'z', mode: 'insensitive' } },
        { nom: { equals: 'E', mode: 'insensitive' } },
        { nom: { equals: 'Z', mode: 'insensitive' } },
      ],
    },
  });

  console.log(`Supprimé ${deleted.count} élèves mal nommés (e, z).`);

  // Fix future birth dates (e.g., 2026 -> 2014)
  const futureEleves = await prisma.eleve.findMany({
    where: {
      dateNaissance: {
        gt: new Date('2025-01-01'),
      },
    },
  });

  for (const eleve of futureEleves) {
    const fixedDate = new Date(eleve.dateNaissance);
    fixedDate.setFullYear(2014); // Set to a realistic age (e.g., 10-11 years old)
    await prisma.eleve.update({
      where: { id: eleve.id },
      data: { dateNaissance: fixedDate },
    });
  }

  console.log(`Corrigé les dates de naissance de ${futureEleves.length} élèves.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
