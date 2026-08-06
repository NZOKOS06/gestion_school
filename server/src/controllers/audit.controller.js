import { rawPrisma } from '../utils/prisma.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('AuditController');

const PAGE_SIZE = 50;

/**
 * Journal d'audit GestSchool — basé sur AuditLog + activité paiements récente.
 */
export const getAuditLogs = async (req, res) => {
  try {
    const {
      page = 1,
      limit = PAGE_SIZE,
      tenantId,
      type,
      startDate,
      endDate,
      search,
    } = req.query;

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const take = parseInt(limit, 10);

    const where = {};
    if (tenantId) where.tenantId = tenantId;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }
    if (type && type !== 'all') {
      where.action = type;
    }
    if (search) {
      where.OR = [
        { targetType: { contains: search, mode: 'insensitive' } },
        { actorRole: { contains: search, mode: 'insensitive' } },
        { targetId: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [logs, total] = await Promise.all([
      rawPrisma.auditLog.findMany({
        where,
        include: {
          tenant: { select: { id: true, nom: true, slug: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      rawPrisma.auditLog.count({ where }),
    ]);

    const items = logs.map((logRow) => ({
      id: logRow.id,
      type: 'action_admin',
      action: logRow.action,
      targetType: logRow.targetType,
      targetId: logRow.targetId,
      actorId: logRow.actorId,
      actorRole: logRow.actorRole,
      details: logRow.details,
      ipAddress: logRow.ipAddress,
      tenant: logRow.tenant,
      etablissement: logRow.tenant?.nom || null,
      createdAt: logRow.createdAt,
    }));

    res.json({
      data: items,
      pagination: {
        page: parseInt(page, 10),
        limit: take,
        total,
        totalPages: Math.max(1, Math.ceil(total / take)),
      },
    });
  } catch (error) {
    log.error({ err: error }, 'Get audit logs error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getAuditStats = async (req, res) => {
  try {
    const { tenantId, startDate, endDate } = req.query;
    const where = {};
    if (tenantId) where.tenantId = tenantId;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const paiementWhere = { ...(tenantId ? { tenantId } : {}) };
    if (startDate || endDate) {
      paiementWhere.datePaiement = {};
      if (startDate) paiementWhere.datePaiement.gte = new Date(startDate);
      if (endDate) paiementWhere.datePaiement.lte = new Date(endDate);
    }

    const [
      totalAuditLogs,
      actionsParType,
      totalPaiements,
      recentLogs,
      recentPaiements,
    ] = await Promise.all([
      rawPrisma.auditLog.count({ where }),
      rawPrisma.auditLog.groupBy({
        by: ['action'],
        where,
        _count: { id: true },
      }),
      rawPrisma.paiement.count({ where: paiementWhere }),
      rawPrisma.auditLog.findMany({
        where,
        include: { tenant: { select: { nom: true, slug: true } } },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      rawPrisma.paiement.findMany({
        where: paiementWhere,
        include: {
          tenant: { select: { nom: true } },
          recuPar: { select: { nom: true, prenom: true } },
        },
        orderBy: { datePaiement: 'desc' },
        take: 10,
      }),
    ]);

    res.json({
      totalAuditLogs,
      totalPaiements,
      actionsParType,
      recentActivity: [
        ...recentLogs.map((l) => ({
          id: l.id,
          type: 'audit',
          action: l.action,
          etablissement: l.tenant?.nom,
          createdAt: l.createdAt,
        })),
        ...recentPaiements.map((p) => ({
          id: p.id,
          type: 'paiement',
          action: 'paiement',
          etablissement: p.tenant?.nom,
          actor: p.recuPar ? `${p.recuPar.prenom} ${p.recuPar.nom}` : null,
          montant: p.montant,
          createdAt: p.datePaiement,
        })),
      ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 15),
    });
  } catch (error) {
    log.error({ err: error }, 'Get audit stats error');
    res.status(500).json({ error: 'Internal server error' });
  }
};
