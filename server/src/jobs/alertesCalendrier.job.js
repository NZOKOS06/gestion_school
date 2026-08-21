import { prisma } from '../utils/prisma.js';
import { createLogger } from '../utils/logger.js';
import { notifyStaff } from '../utils/notifications.js';
import { sendAlerteEvenement } from '../services/email.service.js';

const log = createLogger('AlertesCalendrierJob');

const TYPE_LABELS = {
  composition: 'Composition',
  examen: 'Examen',
  conseil_classe: 'Conseil de classe',
  reprise_cours: 'Reprise des cours',
  vacances: 'Vacances',
};

const TYPES_ALERTE = Object.keys(TYPE_LABELS);
const JOURS_AVANT = 14;

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/**
 * Daily job: alert staff 14 days before calendar events (compositions, etc.).
 */
export async function runAlertesCalendrierBatch({ tenantId = null } = {}) {
  const tenants = tenantId
    ? await prisma.tenant.findMany({ where: { id: tenantId, actif: true }, include: { config: true } })
    : await prisma.tenant.findMany({ where: { actif: true }, include: { config: true } });

  let emailed = 0;
  let notified = 0;
  let eventsHandled = 0;

  const today = startOfDay(new Date());
  const horizon = new Date(today);
  horizon.setDate(horizon.getDate() + JOURS_AVANT);
  horizon.setHours(23, 59, 59, 999);

  for (const tenant of tenants) {
    try {
      const events = await prisma.calendrierScolaire.findMany({
        where: {
          tenantId: tenant.id,
          type: { in: TYPES_ALERTE },
          alerteEnvoyeeAt: null,
          dateDebut: { gte: today, lte: horizon },
        },
      });

      if (!events.length) continue;

      const nomApp = tenant.config?.nomEcole || tenant.nom || 'GestSchool';

      for (const ev of events) {
        const joursRestants = Math.ceil((startOfDay(ev.dateDebut) - today) / (24 * 60 * 60 * 1000));
        const typeLabel = TYPE_LABELS[ev.type] || ev.type;
        const titre = `Alerte : ${typeLabel} proche`;
        const contenu = `${typeLabel} « ${ev.titre} » le ${new Date(ev.dateDebut).toLocaleDateString('fr-FR')}${
          joursRestants > 0 ? ` (dans ${joursRestants} jour${joursRestants > 1 ? 's' : ''})` : " (aujourd'hui)"
        }.`;

        const destinataires = await collectDestinataires(tenant.id, ev);
        const emailsSent = new Set();

        for (const staff of destinataires) {
          await notifyStaff({
            tenantId: tenant.id,
            staffId: staff.id,
            type: 'evenement',
            titre,
            contenu,
            lien: '/admin/calendrier',
            tenantSlug: tenant.slug,
          });
          notified += 1;

          if (staff.email && !emailsSent.has(staff.email.toLowerCase())) {
            emailsSent.add(staff.email.toLowerCase());
            try {
              await sendAlerteEvenement({
                to: staff.email,
                nomApp,
                typeLabel,
                titre: ev.titre,
                dateDebut: ev.dateDebut,
                joursRestants,
              });
              emailed += 1;
            } catch (emailErr) {
              log.warn({ err: emailErr, eventId: ev.id, staffId: staff.id }, 'Alerte email failed');
            }
          }
        }

        await prisma.calendrierScolaire.update({
          where: { id: ev.id },
          data: { alerteEnvoyeeAt: new Date() },
        });
        eventsHandled += 1;
      }
    } catch (err) {
      log.error({ err, tenantId: tenant.id }, 'Alertes calendrier tenant failed');
    }
  }

  log.info({ emailed, notified, eventsHandled, tenants: tenants.length }, 'Alertes calendrier batch done');
  return { emailed, notified, eventsHandled, tenants: tenants.length };
}

async function collectDestinataires(tenantId, event) {
  const directeurs = await prisma.staff.findMany({
    where: {
      tenantId,
      actif: true,
      role: { in: ['directeur', 'directeur_etudes'] },
    },
    select: { id: true, email: true, role: true },
  });

  const cycles = Array.isArray(event.concerneCycles) && event.concerneCycles.length
    ? event.concerneCycles
    : null;

  const enseignants = await prisma.staff.findMany({
    where: {
      tenantId,
      actif: true,
      role: 'enseignant',
      enseignantClasses: cycles
        ? { some: { classe: { cycle: { in: cycles } } } }
        : { some: {} },
    },
    select: { id: true, email: true, role: true },
  });

  const byId = new Map();
  for (const s of [...directeurs, ...enseignants]) {
    byId.set(s.id, s);
  }
  return [...byId.values()];
}

export function startAlertesCalendrierCron() {
  const BOOT_DELAY_MS = 90_000;
  setTimeout(() => {
    runAlertesCalendrierBatch().catch((err) => log.error({ err }, 'Initial alertes calendrier failed'));
  }, BOOT_DELAY_MS);

  const scheduleNext = () => {
    const now = new Date();
    const next = new Date(now);
    next.setHours(24, 10, 0, 0); // 00:10 next day
    const delay = next.getTime() - now.getTime();
    setTimeout(async () => {
      try {
        await runAlertesCalendrierBatch();
      } catch (err) {
        log.error({ err }, 'Nightly alertes calendrier failed');
      }
      scheduleNext();
    }, delay);
    log.info({ nextRun: next.toISOString() }, 'Next alertes calendrier cron scheduled');
  };

  scheduleNext();
}
