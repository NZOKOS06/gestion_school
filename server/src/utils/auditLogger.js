import { rawPrisma } from './prisma.js';
import { createLogger } from './logger.js';

const log = createLogger('AuditLogger');

/**
 * Enregistre une action d'audit dans la base de données.
 * 
 * @param {Object} req - L'objet de requête Express (pour l'acteur, l'IP, etc.)
 * @param {string} action - L'action effectuée (enum AuditAction)
 * @param {string} [targetType] - Le type de l'entité ciblée (ex: "Staff", "Tenant", "Vente")
 * @param {string} [targetId] - L'ID de l'entité ciblée
 * @param {Object} [details] - Données additionnelles au format JSON
 */
export const logAudit = async (req, action, targetType = null, targetId = null, details = null) => {
  try {
    const actorId = req?.user?.id || req?.user?.userId || null;
    const actorRole = req?.user?.role || null;
    const tenantId = req?.tenant?.id || req?.user?.tenantId || null;
    const ipAddress = req?.ip || req?.headers?.['x-forwarded-for'] || null;
    const userAgent = req?.headers?.['user-agent'] || null;

    await rawPrisma.auditLog.create({
      data: {
        tenantId,
        actorId,
        actorRole,
        action,
        targetType,
        targetId,
        details,
        ipAddress,
        userAgent
      }
    });
  } catch (error) {
    log.error({ err: error, action, targetType, targetId }, 'Failed to write audit log');
  }
};

/**
 * Enregistre une action d'audit de manière autonome (sans objet Express req).
 */
export const logAuditDirect = async ({
  tenantId = null,
  actorId = null,
  actorRole = null,
  action,
  targetType = null,
  targetId = null,
  details = null,
  ipAddress = null,
  userAgent = null
}) => {
  try {
    await rawPrisma.auditLog.create({
      data: {
        tenantId,
        actorId,
        actorRole,
        action,
        targetType,
        targetId,
        details,
        ipAddress,
        userAgent
      }
    });
  } catch (error) {
    log.error({ err: error, action, targetType, targetId }, 'Failed to write audit log direct');
  }
};
