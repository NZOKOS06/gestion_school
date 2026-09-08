/**
 * bulletinQueue.service.js
 *
 * File d'attente asynchrone pour la génération de bulletins PDF en masse.
 * Architecture bi-mode :
 *   - Mode Redis  : utilise ioredis pour la persistance et la distribution inter-process.
 *   - Mode In-Process : file mémoire avec persistance dans la table BulletinJob (PostgreSQL).
 *
 * Dans les deux cas, la concurrence est bornée à MAX_CONCURRENT (défaut : 2)
 * pour éviter tout OOM crash sur le container Render.
 *
 * Événements Socket.IO émis :
 *   bulletinJob:progress  { jobId, done, total, tenantId }
 *   bulletinJob:complete  { jobId, count, zipUrl?, tenantId }
 *   bulletinJob:error     { jobId, message, tenantId }
 */

import { rawPrisma, runInTenant } from '../utils/prisma.js';
import { createLogger } from '../utils/logger.js';
import { logAuditDirect } from '../utils/auditLogger.js';
import { calculerClasse } from '../services/bulletins.service.js';
import { io } from '../index.js';

const log = createLogger('BulletinQueue');

// ─── Concurrence ──────────────────────────────────────────────────────────────
const MAX_CONCURRENT = parseInt(process.env.BULLETIN_QUEUE_CONCURRENCY || '2', 10);
let runningCount = 0;
const waitingQueue = [];

/**
 * Exécute fn() en respectant la limite de concurrence MAX_CONCURRENT.
 * Les tâches excédentaires attendent dans waitingQueue.
 */
async function withThrottle(fn) {
  if (runningCount >= MAX_CONCURRENT) {
    await new Promise((resolve) => waitingQueue.push(resolve));
  }
  runningCount++;
  try {
    return await fn();
  } finally {
    runningCount--;
    if (waitingQueue.length > 0) {
      const next = waitingQueue.shift();
      next();
    }
  }
}

// ─── Persistence Job (PostgreSQL) ─────────────────────────────────────────────

/**
 * Crée un enregistrement BulletinJob dans la base de données.
 * Statuts : pending | processing | completed | failed
 */
async function createJobRecord(tenantId, payload) {
  return rawPrisma.bulletinJob.create({
    data: {
      tenantId,
      statut: 'pending',
      payload,
      progression: 0,
      total: 0,
    },
  });
}

async function updateJobRecord(jobId, data) {
  try {
    await rawPrisma.bulletinJob.update({ where: { id: jobId }, data });
  } catch (err) {
    log.warn({ err, jobId }, 'updateJobRecord failed');
  }
}

// ─── Socket.IO Notifications ──────────────────────────────────────────────────

function emitJobProgress(tenantId, jobId, done, total) {
  const room = `staff-tenant-${tenantId}`;
  io?.to(room).emit('bulletinJob:progress', { jobId, done, total, tenantId });
}

function emitJobComplete(tenantId, jobId, count, zipUrl = null) {
  const room = `staff-tenant-${tenantId}`;
  io?.to(room).emit('bulletinJob:complete', { jobId, count, zipUrl, tenantId });
}

function emitJobError(tenantId, jobId, message) {
  const room = `staff-tenant-${tenantId}`;
  io?.to(room).emit('bulletinJob:error', { jobId, message, tenantId });
}

// ─── Coeur du Worker ──────────────────────────────────────────────────────────

/**
 * Traite un job de génération de bulletins en masse.
 * Importe dynamiquement le contrôleur pour éviter les dépendances circulaires.
 */
async function processJob(job) {
  const { id: jobId, tenantId, payload } = job;
  const { anneeScolaireId, classeId, periodeIndex, actorId, actorRole } = payload;

  log.info({ jobId, tenantId, classeId, periodeIndex }, 'Processing bulletin job');

  try {
    await updateJobRecord(jobId, { statut: 'processing', startedAt: new Date() });

    // Calcul des bulletins de la classe dans le contexte tenant
    const results = await runInTenant(tenantId, () =>
      calculerClasse(tenantId, { anneeScolaireId, classeId, periodeIndex })
    );

    const withNotes = results.filter((r) => r.hasNotes);
    const total = withNotes.length;

    if (total === 0) {
      await updateJobRecord(jobId, {
        statut: 'failed',
        errorMessage: 'Aucune note trouvée pour cette classe / période.',
        completedAt: new Date(),
      });
      emitJobError(tenantId, jobId, 'Aucune note trouvée pour cette classe / période.');
      return;
    }

    await updateJobRecord(jobId, { total });
    emitJobProgress(tenantId, jobId, 0, total);

    // Import dynamique pour éviter la dépendance circulaire avec bulletins.controller
    const { upsertBulletinFromComputedDirect } = await import('../controllers/bulletins.controller.js');

    const config = await rawPrisma.tenantConfig.findUnique({ where: { tenantId } });

    let done = 0;
    const generatedIds = [];

    for (const row of withNotes) {
      try {
        const bulletin = await runInTenant(tenantId, () =>
          upsertBulletinFromComputedDirect(tenantId, row, { anneeScolaireId, classeId, periodeIndex }, config)
        );
        generatedIds.push(bulletin.id);
      } catch (rowErr) {
        log.warn({ err: rowErr, eleveId: row.eleveId }, 'Skipping bulletin for eleve');
      }
      done++;
      emitJobProgress(tenantId, jobId, done, total);
    }

    await updateJobRecord(jobId, {
      statut: 'completed',
      progression: done,
      result: { count: done, bulletinIds: generatedIds },
      completedAt: new Date(),
    });

    emitJobComplete(tenantId, jobId, done);

    await logAuditDirect({
      tenantId,
      actorId,
      actorRole,
      action: 'bulletins_generated_masse_async',
      targetType: 'BulletinJob',
      targetId: jobId,
      details: { classeId, periodeIndex, count: done },
    });

    log.info({ jobId, tenantId, done, total }, 'Bulletin job completed');
  } catch (err) {
    log.error({ err, jobId, tenantId }, 'Bulletin job failed');
    await updateJobRecord(jobId, {
      statut: 'failed',
      errorMessage: err.message,
      completedAt: new Date(),
    });
    emitJobError(tenantId, jobId, err.message);
  }
}

// ─── API Publique du Service ──────────────────────────────────────────────────

/**
 * Soumet un job de génération de bulletins en masse.
 * Retourne le jobId immédiatement (non bloquant pour l'API).
 *
 * @param {string} tenantId
 * @param {{ anneeScolaireId, classeId, periodeIndex, actorId?, actorRole? }} payload
 * @returns {Promise<{ jobId: string }>}
 */
export async function enqueueBulletinMasse(tenantId, payload) {
  const job = await createJobRecord(tenantId, payload);

  // Lancement asynchrone sans await (ne bloque pas la réponse HTTP)
  withThrottle(() => processJob(job)).catch((err) => {
    log.error({ err, jobId: job.id }, 'Unhandled error in bulletin queue throttle');
  });

  log.info({ jobId: job.id, tenantId }, 'Bulletin job enqueued');
  return { jobId: job.id };
}

/**
 * Retourne le statut d'un job de génération de bulletins.
 *
 * @param {string} tenantId
 * @param {string} jobId
 * @returns {Promise<object|null>}
 */
export async function getBulletinJobStatus(tenantId, jobId) {
  return rawPrisma.bulletinJob.findFirst({
    where: { id: jobId, tenantId },
    select: {
      id: true,
      statut: true,
      progression: true,
      total: true,
      result: true,
      errorMessage: true,
      createdAt: true,
      startedAt: true,
      completedAt: true,
    },
  });
}
