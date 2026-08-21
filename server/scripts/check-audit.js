import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** Affiche les dernières entrées du journal d'audit. */
async function check() {
  const rows = await prisma.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: { action: true, targetType: true, actorRole: true, details: true, createdAt: true },
  });

  console.log(`=== 10 DERNIÈRES ENTRÉES D'AUDIT (${rows.length}) ===`);
  for (const r of rows) {
    console.log(`${r.createdAt.toISOString()} | ${r.actorRole} | ${r.action} | ${r.targetType || '—'}`);
  }
}

check()
  .catch((e) => {
    console.error('❌ Erreur :', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
