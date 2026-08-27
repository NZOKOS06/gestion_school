import { prisma, rawPrisma, runInTenant } from '../utils/prisma.js';
import { createLogger } from '../utils/logger.js';
import { listRetards, markOverdue } from '../services/echeances.service.js';
import { sendRelanceEcheance } from '../services/email.service.js';
import { broadcastPaiementEchu } from '../utils/notifications.js';

const log = createLogger('RelancesJob');

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Run overdue marking + throttled email/socket relances for one or all tenants.
 */
export async function runRelancesBatch({ tenantId = null } = {}) {
  const tenants = tenantId
    ? await rawPrisma.tenant.findMany({ where: { id: tenantId, actif: true }, include: { config: true } })
    : await rawPrisma.tenant.findMany({ where: { actif: true }, include: { config: true } });

  let emailed = 0;
  let notified = 0;
  let overdueMarked = 0;

  for (const tenant of tenants) {
    try {
      await runInTenant(tenant.id, async () => {
      await markOverdue(tenant.id);
      const retards = await listRetards(tenant.id);
      overdueMarked += retards.length;

      const config = tenant.config;
      const now = Date.now();

      for (const row of retards) {
        const full = await prisma.echeance.findFirst({
          where: { id: row.id, tenantId: tenant.id },
          include: {
            inscription: {
              include: {
                eleve: { include: { parent: true } },
              },
            },
          },
        });
        if (!full) continue;

        const last = full.lastRelanceAt ? new Date(full.lastRelanceAt).getTime() : 0;
        if (last && now - last < ONE_DAY_MS) continue;

        const parent = full.inscription?.eleve?.parent;
        const parentId = full.inscription?.eleve?.parentId || parent?.id;
        const parentEmail = parent?.email || row.parentEmail;

        if (parentEmail) {
          try {
            await sendRelanceEcheance({
              to: parentEmail,
              nomApp: config?.nomEcole || tenant.nom || 'GestSchool',
              eleveNom: `${row.elevePrenom || ''} ${row.eleveNom || ''}`.trim(),
              libelle: row.libelle,
              montantReste: row.reste,
              devise: config?.devise || 'FCFA',
              dateEcheance: row.dateEcheance,
            });
            emailed += 1;
          } catch (emailErr) {
            log.warn({ err: emailErr, echeanceId: row.id }, 'Batch relance email failed');
          }
        }

        try {
          await broadcastPaiementEchu(tenant.slug, tenant.id, full, parentId);
          notified += 1;
        } catch { /* optional */ }

        await prisma.echeance.update({
          where: { id: row.id },
          data: { lastRelanceAt: new Date() },
        });
      }
      });
    } catch (err) {
      log.error({ err, tenantId: tenant.id }, 'Relances batch tenant failed');
    }
  }

  log.info({ emailed, notified, overdueMarked, tenants: tenants.length }, 'Relances batch done');
  return { emailed, notified, overdueMarked, tenants: tenants.length };
}

/**
 * Schedule daily batch around local midnight (+ small delay), and run once after boot delay.
 */
export function startRelancesCron() {
  const BOOT_DELAY_MS = 60_000;
  setTimeout(() => {
    runRelancesBatch().catch((err) => log.error({ err }, 'Initial relances batch failed'));
  }, BOOT_DELAY_MS);

  const scheduleNextMidnight = () => {
    const now = new Date();
    const next = new Date(now);
    next.setHours(24, 5, 0, 0); // 00:05 next day
    const delay = next.getTime() - now.getTime();
    setTimeout(async () => {
      try {
        await runRelancesBatch();
      } catch (err) {
        log.error({ err }, 'Nightly relances batch failed');
      }
      scheduleNextMidnight();
    }, delay);
    log.info({ nextRun: next.toISOString() }, 'Next relances cron scheduled');
  };

  scheduleNextMidnight();
}
