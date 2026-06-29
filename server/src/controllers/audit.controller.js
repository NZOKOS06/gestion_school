import { rawPrisma } from '../utils/prisma.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('AuditController');

const PAGE_SIZE = 50;

export const getAuditLogs = async (req, res) => {
  try {
    const {
      page = 1,
      limit = PAGE_SIZE,
      tenantId,
      type,
      startDate,
      endDate,
      search
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.gte = startDate ? new Date(startDate) : undefined;
      dateFilter.lte = endDate ? new Date(endDate) : undefined;
    }

    const commonWhere = {};
    if (tenantId) commonWhere.tenantId = tenantId;
    if (startDate || endDate) commonWhere.createdAt = dateFilter;

    // Déterminer s'il faut charger chaque entité
    const loadAll = !type || type === 'all';
    const loadMouvements = loadAll || type === 'mouvement_stock';
    const loadVentes = loadAll || type === 'vente';
    const loadCommandes = loadAll || type === 'commande';
    const loadLivraisons = loadAll || type === 'livraison';
    const loadOrdonnances = loadAll || type === 'ordonnance';
    const loadAuditLogs = loadAll || type === 'action_admin' || type === 'session';

    // Récupération parallèle des différentes entités
    const [
      mouvements,
      ventes,
      commandes,
      livraisons,
      ordonnances,
      auditLogsRaw,
      totalMouvements,
      totalVentes,
      totalCommandes,
      totalLivraisons,
      totalOrdonnances,
      totalAuditLogsRaw
    ] = await Promise.all([
      // 1. Mouvements Stock
      loadMouvements ? rawPrisma.mouvementStock.findMany({
        where: commonWhere,
        include: {
          tenant: { select: { id: true, nom: true, slug: true } },
          medicament: { select: { id: true, dci: true, nomCommercial: true } },
          staff: { select: { id: true, nom: true, prenom: true, role: true } },
          lotStock: { select: { id: true, numeroLot: true } }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take
      }) : Promise.resolve([]),

      // 2. Ventes
      loadVentes ? rawPrisma.vente.findMany({
        where: commonWhere,
        include: {
          tenant: { select: { id: true, nom: true, slug: true } },
          staff: { select: { id: true, nom: true, prenom: true, role: true } },
          user: { select: { id: true, nom: true, prenom: true } },
          _count: { select: { lignes: true } }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take
      }) : Promise.resolve([]),

      // 3. Commandes Fournisseurs
      loadCommandes ? rawPrisma.commandeFournisseur.findMany({
        where: commonWhere,
        include: {
          tenant: { select: { id: true, nom: true, slug: true } },
          fournisseur: { select: { id: true, nom: true } },
          createdBy: { select: { id: true, nom: true, prenom: true, role: true } },
          _count: { select: { lignes: true } }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take
      }) : Promise.resolve([]),

      // 4. Livraisons
      loadLivraisons ? rawPrisma.livraison.findMany({
        where: commonWhere,
        include: {
          tenant: { select: { id: true, nom: true, slug: true } },
          vente: { select: { id: true, numeroVente: true, montantTotal: true } },
          staff: { select: { id: true, nom: true, prenom: true, role: true } }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take
      }) : Promise.resolve([]),

      // 5. Ordonnances
      loadOrdonnances ? rawPrisma.ordonnance.findMany({
        where: commonWhere,
        include: {
          tenant: { select: { id: true, nom: true, slug: true } },
          user: { select: { id: true, nom: true, prenom: true } },
          _count: { select: { lignes: true } }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take
      }) : Promise.resolve([]),

      // 6. AuditLogs (Connexions, créations de personnel, changements de rôle, etc.)
      loadAuditLogs ? rawPrisma.auditLog.findMany({
        where: {
          ...commonWhere,
          ...(type === 'session' ? { action: { in: ['login', 'logout'] } } : {}),
          ...(type === 'action_admin' ? { action: { notIn: ['login', 'logout'] } } : {})
        },
        include: {
          tenant: { select: { id: true, nom: true, slug: true } }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take
      }) : Promise.resolve([]),

      // Totaux
      loadMouvements ? rawPrisma.mouvementStock.count({ where: commonWhere }) : Promise.resolve(0),
      loadVentes ? rawPrisma.vente.count({ where: commonWhere }) : Promise.resolve(0),
      loadCommandes ? rawPrisma.commandeFournisseur.count({ where: commonWhere }) : Promise.resolve(0),
      loadLivraisons ? rawPrisma.livraison.count({ where: commonWhere }) : Promise.resolve(0),
      loadOrdonnances ? rawPrisma.ordonnance.count({ where: commonWhere }) : Promise.resolve(0),
      loadAuditLogs ? rawPrisma.auditLog.count({
        where: {
          ...commonWhere,
          ...(type === 'session' ? { action: { in: ['login', 'logout'] } } : {}),
          ...(type === 'action_admin' ? { action: { notIn: ['login', 'logout'] } } : {})
        }
      }) : Promise.resolve(0)
    ]);

    // Résoudre les acteurs pour les AuditLogs bruts de manière groupée (efficient)
    let auditLogs = [];
    if (auditLogsRaw.length > 0) {
      const actorIds = [...new Set(auditLogsRaw.map(a => a.actorId).filter(Boolean))];
      
      const [staffs, users] = await Promise.all([
        rawPrisma.staff.findMany({
          where: { id: { in: actorIds } },
          select: { id: true, nom: true, prenom: true, role: true }
        }),
        rawPrisma.user.findMany({
          where: { id: { in: actorIds } },
          select: { id: true, nom: true, prenom: true }
        })
      ]);

      const actorsMap = new Map();
      staffs.forEach(s => actorsMap.set(s.id, s));
      users.forEach(u => actorsMap.set(u.id, { ...u, role: 'client' }));

      auditLogs = auditLogsRaw.map(log => {
        const actor = actorsMap.get(log.actorId) || null;
        return {
          ...log,
          actor
        };
      });
    }

    // Normaliser les entrées en un format uniforme
    const normalizeMouvement = (m) => ({
      id: m.id,
      type: 'mouvement_stock',
      subType: m.type,
      tenant: m.tenant,
      actor: m.staff,
      entity: m.medicament ? `${m.medicament.dci} (${m.medicament.nomCommercial})` : 'Inconnu',
      reference: m.reference || `Lot ${m.lotStock?.numeroLot || 'N/A'}`,
      quantite: m.quantite,
      note: m.note,
      createdAt: m.createdAt,
      detailUrl: null,
      color: m.type === 'sortie' ? 'red' : m.type === 'entree' ? 'green' : m.type === 'ajustement' ? 'amber' : 'neutral'
    });

    const normalizeVente = (v) => ({
      id: v.id,
      type: 'vente',
      subType: v.statut,
      tenant: v.tenant,
      actor: v.staff,
      entity: v.user ? `${v.user.prenom} ${v.user.nom}` : v.nomClient || 'Client comptoir',
      reference: `Vente #${v.numeroVente}`,
      quantite: v._count?.lignes ?? 0,
      note: `${v.montantTotal} ${v.modePaiement ? `(${v.modePaiement})` : ''}`,
      createdAt: v.createdAt,
      detailUrl: null,
      color: v.statut === 'annulee' ? 'red' : v.statut === 'finalisee' ? 'green' : 'amber'
    });

    const normalizeCommande = (c) => ({
      id: c.id,
      type: 'commande',
      subType: c.statut,
      tenant: c.tenant,
      actor: c.createdBy,
      entity: c.fournisseur?.nom || 'Fournisseur inconnu',
      reference: c.numeroCommande,
      quantite: c._count?.lignes ?? 0,
      note: `Total: ${c.montantTotal}`,
      createdAt: c.createdAt,
      detailUrl: null,
      color: c.statut === 'recue' ? 'green' : c.statut === 'annulee' ? 'red' : 'blue'
    });

    const normalizeLivraison = (l) => ({
      id: l.id,
      type: 'livraison',
      subType: l.statut,
      tenant: l.tenant,
      actor: l.staff,
      entity: l.adresse,
      reference: `Livraison vente #${l.vente?.numeroVente || 'N/A'}`,
      quantite: null,
      note: l.motifEchec || null,
      createdAt: l.createdAt,
      detailUrl: null,
      color: l.statut === 'livree' ? 'green' : l.statut === 'echec' ? 'red' : 'blue'
    });

    const normalizeOrdonnance = (o) => ({
      id: o.id,
      type: 'ordonnance',
      subType: o.statut,
      tenant: o.tenant,
      actor: null,
      entity: o.user ? `${o.user.prenom} ${o.user.nom}` : 'Patient anonyme',
      reference: `Dr. ${o.nomMedecin}${o.numeroMedecin ? ` (${o.numeroMedecin})` : ''}`,
      quantite: o._count?.lignes ?? 0,
      note: null,
      createdAt: o.createdAt,
      detailUrl: null,
      color: o.statut === 'dispensee' ? 'green' : o.statut === 'refusee' ? 'red' : 'amber'
    });

    const normalizeAuditLog = (a) => {
      let label = a.action;
      let color = 'neutral';
      let entity = a.targetType || 'Système';

      if (a.action === 'login') {
        label = 'Connexion';
        color = 'green';
        entity = 'Session utilisateur';
      } else if (a.action === 'logout') {
        label = 'Déconnexion';
        color = 'neutral';
        entity = 'Session utilisateur';
      } else if (a.action === 'staff_created') {
        label = 'Création personnel';
        color = 'blue';
        entity = a.details?.name || 'Personnel';
      } else if (a.action === 'staff_updated') {
        label = 'Mise à jour personnel';
        color = 'amber';
        entity = a.details?.name || 'Personnel';
      } else if (a.action === 'staff_deleted') {
        label = 'Désactivation personnel';
        color = 'red';
        entity = a.details?.name || 'Personnel';
      } else if (a.action === 'staff_role_changed') {
        label = 'Changement de rôle';
        color = 'purple';
        entity = `${a.details?.name || 'Personnel'} (${a.details?.oldRole || ''} ➔ ${a.details?.newRole || ''})`;
      } else if (a.action === 'password_changed') {
        label = 'Mot de passe modifié / réinitialisé';
        color = 'pink';
        entity = a.details?.name || 'Personnel';
      }

      return {
        id: a.id,
        type: a.action === 'login' || a.action === 'logout' ? 'session' : 'action_admin',
        subType: label,
        tenant: a.tenant,
        actor: a.actor,
        entity,
        reference: a.ipAddress ? `IP: ${a.ipAddress}` : 'N/A',
        quantite: null,
        note: a.userAgent ? `Navigateur: ${a.userAgent.substring(0, 45)}...` : null,
        createdAt: a.createdAt,
        detailUrl: null,
        color
      };
    };

    let allLogs = [
      ...mouvements.map(normalizeMouvement),
      ...ventes.map(normalizeVente),
      ...commandes.map(normalizeCommande),
      ...livraisons.map(normalizeLivraison),
      ...ordonnances.map(normalizeOrdonnance),
      ...auditLogs.map(normalizeAuditLog)
    ];

    // Filtrage texte global
    if (search) {
      const s = search.toLowerCase();
      allLogs = allLogs.filter(l =>
        l.tenant?.nom?.toLowerCase().includes(s) ||
        l.entity?.toLowerCase().includes(s) ||
        l.reference?.toLowerCase().includes(s) ||
        l.actor?.nom?.toLowerCase().includes(s) ||
        l.actor?.prenom?.toLowerCase().includes(s) ||
        l.note?.toLowerCase().includes(s) ||
        l.type?.toLowerCase().includes(s) ||
        l.subType?.toLowerCase().includes(s)
      );
    }

    // Trier par date décroissante
    allLogs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Pagination côté mémoire après fusion
    const totalItems = totalMouvements + totalVentes + totalCommandes + totalLivraisons + totalOrdonnances + totalAuditLogsRaw;
    const paginatedLogs = allLogs.slice(0, take);

    res.json({
      data: paginatedLogs,
      stats: {
        totalMouvements,
        totalVentes,
        totalCommandes,
        totalLivraisons,
        totalOrdonnances,
        totalAuditLogs: totalAuditLogsRaw,
        totalItems
      },
      pagination: {
        page: parseInt(page),
        limit: take,
        total: totalItems,
        totalPages: Math.ceil(totalItems / take)
      }
    });
  } catch (error) {
    log.error({ err: error }, 'Get audit logs error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getAuditStats = async (req, res) => {
  try {
    const { tenantId, startDate, endDate } = req.query;
    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.gte = startDate ? new Date(startDate) : undefined;
      dateFilter.lte = endDate ? new Date(endDate) : undefined;
    }

    const where = { ...(tenantId && { tenantId }), ...(startDate || endDate ? { createdAt: dateFilter } : {}) };

    // 1. Sessions actives (refresh tokens non expirés)
    const activeSessionsRaw = await rawPrisma.refreshToken.findMany({
      where: {
        expiresAt: { gte: new Date() }
      },
      select: {
        userId: true,
        createdAt: true
      }
    });

    const activeUserIds = [...new Set(activeSessionsRaw.map(s => s.userId))];

    // Trouver les staffs connectés
    const activeStaffs = await rawPrisma.staff.findMany({
      where: { id: { in: activeUserIds } },
      select: {
        id: true,
        nom: true,
        prenom: true,
        email: true,
        role: true,
        tenant: { select: { nom: true } }
      }
    });

    // Trouver les clients connectés
    const activeClients = await rawPrisma.user.findMany({
      where: { id: { in: activeUserIds } },
      select: {
        id: true,
        nom: true,
        prenom: true,
        email: true,
        tenant: { select: { nom: true } }
      }
    });

    const activeSessionsDetails = [
      ...activeStaffs.map(s => ({
        id: s.id,
        name: `${s.prenom} ${s.nom}`,
        email: s.email,
        role: s.role,
        pharmacy: s.tenant?.nom || 'SuperAdmin',
        type: 'Staff'
      })),
      ...activeClients.map(c => ({
        id: c.id,
        name: `${c.prenom} ${c.nom}`,
        email: c.email,
        role: 'Client',
        pharmacy: c.tenant?.nom,
        type: 'Client'
      }))
    ];

    const [
      mouvementsParType,
      ventesParStatut,
      topTenantsMouvements,
      topTenantsVentes,
      recentActivity,
      totalMouvements,
      totalVentes,
      totalCommandes,
      totalLivraisons,
      totalOrdonnances,
      totalAuditLogs
    ] = await Promise.all([
      rawPrisma.mouvementStock.groupBy({
        by: ['type'],
        where,
        _count: { id: true },
        _sum: { quantite: true }
      }),
      rawPrisma.vente.groupBy({
        by: ['statut'],
        where,
        _count: { id: true },
        _sum: { montantTotal: true }
      }),
      rawPrisma.mouvementStock.groupBy({
        by: ['tenantId'],
        where,
        _count: { id: true },
        take: 5,
        orderBy: { _count: { id: 'desc' } }
      }).then(async (rows) => {
        const tenants = await rawPrisma.tenant.findMany({
          where: { id: { in: rows.map(r => r.tenantId) } },
          select: { id: true, nom: true }
        });
        return rows.map(r => ({ ...r, tenant: tenants.find(t => t.id === r.tenantId) }));
      }),
      rawPrisma.vente.groupBy({
        by: ['tenantId'],
        where,
        _count: { id: true },
        _sum: { montantTotal: true },
        take: 5,
        orderBy: { _count: { id: 'desc' } }
      }).then(async (rows) => {
        const tenants = await rawPrisma.tenant.findMany({
          where: { id: { in: rows.map(r => r.tenantId) } },
          select: { id: true, nom: true }
        });
        return rows.map(r => ({ ...r, tenant: tenants.find(t => t.id === r.tenantId) }));
      }),
      rawPrisma.mouvementStock.findMany({
        where,
        include: {
          tenant: { select: { nom: true } },
          medicament: { select: { dci: true } },
          staff: { select: { nom: true, prenom: true } }
        },
        orderBy: { createdAt: 'desc' },
        take: 10
      }),
      rawPrisma.mouvementStock.count({ where }),
      rawPrisma.vente.count({ where }),
      rawPrisma.commandeFournisseur.count({ where }),
      rawPrisma.livraison.count({ where }),
      rawPrisma.ordonnance.count({ where }),
      rawPrisma.auditLog.count({ where })
    ]);

    res.json({
      totalMouvements,
      totalVentes,
      totalCommandes,
      totalLivraisons,
      totalOrdonnances,
      totalAuditLogs,
      activeSessionsCount: activeSessionsDetails.length,
      activeSessionsDetails,
      mouvementsParType,
      ventesParStatut,
      topTenantsMouvements,
      topTenantsVentes,
      recentActivity: recentActivity.map(m => ({
        id: m.id,
        type: m.type,
        tenant: m.tenant?.nom,
        medicament: m.medicament?.dci,
        actor: m.staff ? `${m.staff.prenom} ${m.staff.nom}` : null,
        quantite: m.quantite,
        createdAt: m.createdAt
      }))
    });
  } catch (error) {
    log.error({ err: error }, 'Get audit stats error');
    res.status(500).json({ error: 'Internal server error' });
  }
};
