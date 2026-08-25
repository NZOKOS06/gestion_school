/**
 * Aligne le super-admin (tenant system) sur SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD.
 * Exécuté à chaque démarrage : changer le mot de passe sur Render suffit, sans re-seed.
 */
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const BCRYPT_ROUNDS = 12;

async function main() {
  const email = (process.env.SUPER_ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.SUPER_ADMIN_PASSWORD || '';

  if (!email || !password) {
    console.log('[sync-super-admin] SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD absents — ignoré');
    return;
  }

  if (
    process.env.NODE_ENV === 'production' &&
    (password === 'SuperAdmin123!' || password.length < 12)
  ) {
    console.error(
      '[sync-super-admin] SUPER_ADMIN_PASSWORD trop faible en prod (≥12, ≠ SuperAdmin123!) — ignoré'
    );
    return;
  }

  let system = await prisma.tenant.findUnique({ where: { slug: 'system' } });
  if (!system) {
    system = await prisma.tenant.create({
      data: {
        nom: 'GestSchool System',
        slug: 'system',
        plan: 'systeme',
        actif: true,
        contact: { email },
      },
    });
    console.log('[sync-super-admin] Tenant system créé');
  } else if (!system.actif) {
    await prisma.tenant.update({ where: { id: system.id }, data: { actif: true } });
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const existing = await prisma.staff.findFirst({
    where: { tenantId: system.id, role: 'super_admin' },
  });

  if (existing) {
    await prisma.staff.update({
      where: { id: existing.id },
      data: {
        email,
        passwordHash,
        actif: true,
        mustChangePassword: false,
      },
    });
    console.log(`[sync-super-admin] Mot de passe / email synchronisés → ${email}`);
  } else {
    await prisma.staff.create({
      data: {
        tenantId: system.id,
        email,
        passwordHash,
        role: 'super_admin',
        nom: 'Super',
        prenom: 'Admin',
        actif: true,
        mustChangePassword: false,
      },
    });
    console.log(`[sync-super-admin] Super-admin créé → ${email}`);
  }
}

main()
  .catch((err) => {
    console.error('[sync-super-admin]', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
