/**
 * Bootstrap unique : si aucun tenant en base, lance le seed.
 * Sinon ne fait rien (idempotent, sûr pour les redéploiements).
 *
 * Prod : exige SUPER_ADMIN_PASSWORD fort (≥12, ≠ SuperAdmin123!).
 */
import { PrismaClient } from '@prisma/client';
import { spawn } from 'child_process';

const prisma = new PrismaClient();

function runSeed() {
  return new Promise((resolve, reject) => {
    const child = spawn('node', ['prisma/seed.js'], {
      stdio: 'inherit',
      env: {
        ...process.env,
        ALLOW_PROD_SEED: 'true',
      },
    });
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`seed exit ${code}`));
    });
    child.on('error', reject);
  });
}

async function main() {
  const count = await prisma.tenant.count();
  if (count > 0) {
    console.log(`[bootstrap] ${count} tenant(s) déjà présents — seed ignoré`);
    return;
  }

  console.log('[bootstrap] Base vide — initialisation (tenant system + école démo + comptes)…');

  if (process.env.NODE_ENV === 'production') {
    const pwd = process.env.SUPER_ADMIN_PASSWORD || '';
    if (!pwd || pwd === 'SuperAdmin123!' || pwd.length < 12) {
      console.error(
        '[bootstrap] ERREUR: base vide mais SUPER_ADMIN_PASSWORD manquant ou trop faible.\n' +
          '  Sur Render → Environment, définir :\n' +
          '    SUPER_ADMIN_EMAIL=ton@email.com\n' +
          '    SUPER_ADMIN_PASSWORD=<mot de passe ≥12 caractères, ≠ SuperAdmin123!>\n' +
          '  Puis Manual Deploy.'
      );
      process.exit(1);
    }
  }

  await runSeed();
  console.log('[bootstrap] Seed initial terminé');
}

main()
  .catch((err) => {
    console.error('[bootstrap]', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
