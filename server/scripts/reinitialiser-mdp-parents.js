/**
 * Réinitialisation des comptes parents créés avec l'ancien mot de passe commun « Parent123! ».
 *
 * Ce mot de passe était attribué à tous les tuteurs créés à l'inscription : il est connu de
 * tous, un simple « changement obligatoire » ne suffit pas (n'importe qui pourrait le faire
 * à la place du parent). Le script révoque donc ces accès ; l'école redonne ensuite un
 * mot de passe provisoire (fiche inscription → Famille → « Activer l'espace parent »).
 *
 * Usage (une fois, après déploiement) :
 *   node scripts/reinitialiser-mdp-parents.js            # simulation : liste les comptes
 *   node scripts/reinitialiser-mdp-parents.js --appliquer
 */
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const ANCIEN = 'Parent123!';
const appliquer = process.argv.includes('--appliquer');

async function main() {
  const parents = await prisma.user.findMany({
    where: { passwordHash: { not: null } },
    select: {
      id: true, tenantId: true, nom: true, prenom: true, email: true, telephone: true, passwordHash: true,
      tenant: { select: { nom: true, slug: true } },
    },
  });
  console.log(`[reinit-parents] ${parents.length} compte(s) parent avec mot de passe à vérifier…`);

  const compromis = [];
  for (const p of parents) {
    // bcrypt est volontairement lent : quelques minutes pour des milliers de comptes
    if (await bcrypt.compare(ANCIEN, p.passwordHash)) compromis.push(p);
  }

  if (!compromis.length) {
    console.log('[reinit-parents] Aucun compte avec l\'ancien mot de passe commun. Rien à faire.');
    return;
  }

  const parEcole = new Map();
  for (const p of compromis) {
    const key = `${p.tenant?.nom || p.tenantId} (${p.tenant?.slug || '—'})`;
    if (!parEcole.has(key)) parEcole.set(key, []);
    parEcole.get(key).push(p);
  }
  for (const [ecole, liste] of parEcole) {
    console.log(`\n${ecole} — ${liste.length} compte(s) :`);
    for (const p of liste) console.log(`  - ${p.prenom} ${p.nom} · ${p.telephone || ''} · ${p.email}`);
  }

  if (!appliquer) {
    console.log('\n[reinit-parents] Simulation uniquement. Relancez avec --appliquer pour révoquer ces accès.');
    return;
  }

  const ids = compromis.map((p) => p.id);
  const res = await prisma.user.updateMany({
    where: { id: { in: ids } },
    data: { passwordHash: null, portailActif: false },
  });
  await prisma.auditLog.createMany({
    data: compromis.map((p) => ({
      tenantId: p.tenantId,
      actorId: null,
      actorRole: 'system',
      action: 'portail_parent_revoque_mdp_compromis',
      details: { userId: p.id, email: p.email },
    })),
  }).catch((err) => console.warn('[reinit-parents] Journal d\'audit non écrit :', err.message));

  console.log(`\n[reinit-parents] ${res.count} accès révoqué(s). Les écoles doivent réactiver ces espaces parents.`);
}

main()
  .catch((err) => {
    console.error('[reinit-parents] Erreur :', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
