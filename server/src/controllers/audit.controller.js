import { rawPrisma } from '../utils/prisma.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('AuditController');
const PAGE_SIZE = 50;

/**
 * Catégorise une action d'audit en grand flux métier
 */
function categorizeAction(action = '', targetType = '') {
  const act = (action || '').toLowerCase();
  const tgt = (targetType || '').toLowerCase();

  if (act === 'login' || act === 'logout' || act.includes('session') || act.includes('auth')) {
    return 'session';
  }
  if (act.includes('paiement') || act.includes('payment') || tgt.includes('paiement') || tgt.includes('caisse')) {
    return 'paiement';
  }
  if (act.includes('inscription') || act.includes('reinscription') || tgt.includes('inscription') || tgt.includes('eleve')) {
    return 'inscription';
  }
  if (act.includes('message') || act.includes('notification') || act.includes('relance') || tgt.includes('message')) {
    return 'communication';
  }
  if (act.includes('bulletin') || act.includes('evaluation') || act.includes('note') || tgt.includes('bulletin') || tgt.includes('evaluation')) {
    return 'note';
  }
  return 'action_admin';
}

/**
 * Libellé sous-type lisible
 */
function formatSubType(action = '') {
  const map = {
    login: 'Connexion',
    logout: 'Déconnexion',
    paiement_encaisse: 'Encaissement',
    paiement_deleted: 'Annulation paiement',
    payment_created: 'Création paiement',
    inscription_created: 'Inscription',
    inscription_created_avec_eleve: 'Nouvelle inscription',
    inscription_validated: 'Validation inscription',
    reinscription_lot: 'Réinscription en masse',
    bulletin_generated: 'Bulletin généré',
    bulletins_generated_masse: 'Génération masse',
    bulletins_published: 'Publication bulletins',
    evaluation_created: 'Création devoir',
    cahier_de_textes_saisi: 'Cahier de textes',
    conseil_classe_tenu: 'Conseil de classe',
    staff_created: 'Nouveau personnel',
    staff_updated: 'Mise à jour staff',
    affectation_created: 'Affectation classe',
    affectation_deleted: 'Retrait affectation',
    affectations_liberees: 'Libération affectations',
    annee_scolaire_activated: 'Activation année',
    annee_activee: 'Activation année',
    annee_scolaire_dupliquee: 'Duplication année',
    annee_dupliquee: 'Duplication année',
    annee_scolaire_updated: 'Mise à jour année',
    matiere_created: 'Création matière',
    emploi_du_temps_created: 'Emploi du temps',
    message_envoye: 'Message envoyé',
    certificat_genere: 'Certificat généré',
    calendrier_templates_generated: 'Calendrier scolaire',
    config_updated: 'Paramètres modifiés',
  };
  return map[action] || action.replace(/_/g, ' ');
}

/**
 * Déduit l'entité ciblée
 */
function formatEntity(logRow) {
  if (logRow.targetType) return logRow.targetType;
  const act = logRow.action || '';
  if (act.includes('bulletin')) return 'Bulletin';
  if (act.includes('paiement') || act.includes('payment')) return 'Paiement';
  if (act.includes('inscription') || act.includes('eleve')) return 'Élève / Inscription';
  if (act.includes('staff') || act.includes('affectation')) return 'Personnel';
  if (act.includes('annee')) return 'Année Scolaire';
  if (act.includes('message') || act.includes('notification')) return 'Communication';
  if (act.includes('conseil')) return 'Conseil de Classe';
  if (act.includes('cahier')) return 'Cahier de Textes';
  if (act === 'login' || act === 'logout') return 'Session';
  return 'Système';
}

/**
 * Déduit la référence métier (reçu, élève, matricule, classe...)
 */
function formatReference(logRow) {
  const d = logRow.details || {};
  if (d.numeroRecu) return d.numeroRecu;
  if (d.reference) return d.reference;
  if (d.matricule) return d.matricule;
  if (d.classeNom || d.classe) return d.classeNom || d.classe;
  if (d.email) return d.email;
  if (logRow.targetId) return logRow.targetId.length > 12 ? `${logRow.targetId.slice(0, 8)}...` : logRow.targetId;
  return '—';
}

/**
 * Déduit la quantité / montant
 */
function formatQuantite(logRow) {
  const d = logRow.details || {};
  if (d.montant != null) {
    return `${Number(d.montant).toLocaleString('fr-FR')} FCFA`;
  }
  if (d.count != null) {
    return `${d.count}`;
  }
  return '—';
}

/**
 * Note explicative claire en français
 */
function formatNote(logRow, actorName = '') {
  const d = logRow.details || {};
  const act = logRow.action || '';

  if (act === 'login') {
    const ident = d.name || d.email || actorName || logRow.actorRole || 'Utilisateur';
    return `Connexion réussie de ${ident}`;
  }
  if (act === 'logout') {
    return `Déconnexion de la session`;
  }
  if (act === 'paiement_encaisse') {
    const mt = d.montant ? `${Number(d.montant).toLocaleString('fr-FR')} FCFA` : '';
    const el = d.eleveNom || d.eleve || '';
    return `Encaissement de ${mt} ${el ? 'pour ' + el : ''}`.trim();
  }
  if (act === 'paiement_deleted') {
    return `Suppression / Annulation d'un paiement`;
  }
  if (act === 'bulletins_generated_masse') {
    const cnt = d.count ? `${d.count} bulletin(s)` : 'bulletins';
    const cl = d.classeNom || d.classe ? ` (${d.classeNom || d.classe})` : '';
    return `Génération en masse de ${cnt}${cl}`;
  }
  if (act === 'bulletin_generated') {
    return `Génération individuelle d'un bulletin PDF`;
  }
  if (act === 'bulletins_published') {
    return `Validation et publication des bulletins officiels`;
  }
  if (act === 'inscription_created_avec_eleve' || act === 'inscription_created') {
    const name = d.eleve || d.name || '';
    return `Nouvelle inscription enregistrée ${name ? ': ' + name : ''}`.trim();
  }
  if (act === 'inscription_validated') {
    return `Validation définitive d'un dossier d'inscription`;
  }
  if (act === 'reinscription_lot') {
    return `Réinscription groupée (${d.count || ''} élèves)`;
  }
  if (act === 'staff_created') {
    return `Ajout d'un membre du personnel (${d.name || ''} - ${d.role || ''})`;
  }
  if (act === 'staff_updated') {
    return `Mise à jour des informations de ${d.name || 'personnel'}`;
  }
  if (act === 'affectation_created') {
    return `Attribution d'une classe ou d'une matière à un enseignant`;
  }
  if (act === 'affectation_deleted' || act === 'affectations_liberees') {
    return `Retrait d'affectation pédagogique`;
  }
  if (act === 'annee_scolaire_activated' || act === 'annee_activee') {
    return `Activation de la nouvelle année scolaire de référence`;
  }
  if (act === 'annee_scolaire_dupliquee' || act === 'annee_dupliquee') {
    return `Duplication des structures et configurations d'année scolaire`;
  }
  if (act === 'cahier_de_textes_saisi') {
    return `Enregistrement d'une séance dans le cahier de textes`;
  }
  if (act === 'conseil_classe_tenu') {
    return `Validation de la tenue du conseil de classe`;
  }
  if (act === 'message_envoye') {
    return `Envoi d'un message direct ou groupé`;
  }
  if (act === 'certificat_genere') {
    return `Édition et téléchargement d'un certificat de scolarité`;
  }
  if (act === 'calendrier_templates_generated') {
    return `Génération automatique du calendrier scolaire officiel`;
  }

  // Fallback lisible
  return `Action ${act.replace(/_/g, ' ')}`;
}

/**
 * Journal d'audit GestSchool
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
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    // Filtre intelligent par type d'opération
    if (type && type !== 'all') {
      if (type === 'session') {
        where.action = { in: ['login', 'logout', 'session_active'] };
      } else if (type === 'paiement') {
        where.OR = [
          { action: { contains: 'paiement', mode: 'insensitive' } },
          { action: { contains: 'payment', mode: 'insensitive' } },
          { targetType: { equals: 'Paiement', mode: 'insensitive' } },
        ];
      } else if (type === 'inscription') {
        where.OR = [
          { action: { contains: 'inscription', mode: 'insensitive' } },
          { action: { contains: 'reinscription', mode: 'insensitive' } },
          { targetType: { in: ['Inscription', 'Eleve'] } },
        ];
      } else if (type === 'communication') {
        where.OR = [
          { action: { contains: 'message', mode: 'insensitive' } },
          { action: { contains: 'notification', mode: 'insensitive' } },
          { action: { contains: 'relance', mode: 'insensitive' } },
          { targetType: { in: ['Message', 'Notification'] } },
        ];
      } else if (type === 'note') {
        where.OR = [
          { action: { contains: 'bulletin', mode: 'insensitive' } },
          { action: { contains: 'evaluation', mode: 'insensitive' } },
          { action: { contains: 'note', mode: 'insensitive' } },
          { targetType: { in: ['Bulletin', 'Evaluation', 'Note'] } },
        ];
      } else if (type === 'action_admin') {
        where.action = {
          notIn: ['login', 'logout'],
        };
      }
    }

    if (search && search.trim()) {
      const q = search.trim();
      const searchConditions = [
        { action: { contains: q, mode: 'insensitive' } },
        { targetType: { contains: q, mode: 'insensitive' } },
        { actorRole: { contains: q, mode: 'insensitive' } },
        { targetId: { contains: q, mode: 'insensitive' } },
        { ipAddress: { contains: q, mode: 'insensitive' } },
      ];
      if (where.OR) {
        where.AND = [{ OR: where.OR }, { OR: searchConditions }];
        delete where.OR;
      } else {
        where.OR = searchConditions;
      }
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

    // Résolution en lot des acteurs (Staff & User)
    const actorIds = [...new Set(logs.map((l) => l.actorId).filter(Boolean))];
    const [staffList, userList] = await Promise.all([
      actorIds.length
        ? rawPrisma.staff.findMany({
            where: { id: { in: actorIds } },
            select: { id: true, nom: true, prenom: true, role: true },
          })
        : [],
      actorIds.length
        ? rawPrisma.user.findMany({
            where: { id: { in: actorIds } },
            select: { id: true, nom: true, prenom: true, email: true },
          })
        : [],
    ]);

    const actorMap = new Map();
    for (const s of staffList) {
      actorMap.set(s.id, {
        nom: s.nom,
        prenom: s.prenom,
        role: s.role,
        fullName: `${s.prenom || ''} ${s.nom || ''}`.trim(),
      });
    }
    for (const u of userList) {
      if (!actorMap.has(u.id)) {
        actorMap.set(u.id, {
          nom: u.nom,
          prenom: u.prenom,
          role: 'parent',
          fullName: `${u.prenom || ''} ${u.nom || ''}`.trim() || u.email,
        });
      }
    }

    const items = logs.map((logRow) => {
      const category = categorizeAction(logRow.action, logRow.targetType);
      const subType = formatSubType(logRow.action);

      // Acteur
      const resolvedActor = logRow.actorId ? actorMap.get(logRow.actorId) : null;
      let actorName = resolvedActor?.fullName || logRow.details?.name || logRow.details?.userName;
      if (!actorName && logRow.details?.email) {
        actorName = logRow.details.email;
      }
      if (!actorName && logRow.actorRole) {
        actorName = logRow.actorRole === 'super_admin' ? 'Super Admin' : logRow.actorRole;
      }

      const actorObj = {
        id: logRow.actorId,
        nom: resolvedActor?.nom || actorName || '',
        prenom: resolvedActor?.prenom || '',
        role: logRow.actorRole || resolvedActor?.role || 'Utilisateur',
        displayName: actorName || 'Système',
      };

      const entity = formatEntity(logRow);
      const reference = formatReference(logRow);
      const quantite = formatQuantite(logRow);
      const note = formatNote(logRow, actorName);

      return {
        id: logRow.id,
        type: category,
        subType,
        action: logRow.action,
        color:
          category === 'session'
            ? 'info'
            : category === 'paiement'
            ? 'success'
            : category === 'inscription'
            ? 'primary'
            : category === 'note'
            ? 'purple'
            : category === 'communication'
            ? 'warning'
            : 'neutral',
        entity,
        reference,
        quantite,
        actor: actorObj,
        note,
        targetType: logRow.targetType,
        targetId: logRow.targetId,
        actorId: logRow.actorId,
        actorRole: logRow.actorRole,
        details: logRow.details,
        ipAddress: logRow.ipAddress,
        userAgent: logRow.userAgent,
        tenant: logRow.tenant,
        etablissement: logRow.tenant?.nom || (logRow.tenantId ? 'Établissement' : 'GestSchool System'),
        createdAt: logRow.createdAt,
      };
    });

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

/**
 * Statistiques d'audit complètes et parlantes
 */
export const getAuditStats = async (req, res) => {
  try {
    const { tenantId, startDate, endDate } = req.query;
    const where = {};
    if (tenantId) where.tenantId = tenantId;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    const tenantFilter = tenantId ? { tenantId } : {};

    const [
      totalAuditLogs,
      actionsParType,
      totalPaiements,
      paiementsSum,
      totalInscriptions,
      totalBulletins,
      totalMessages,
      totalNotifications,
      recentLogs,
      activeSessions,
    ] = await Promise.all([
      rawPrisma.auditLog.count({ where }),
      rawPrisma.auditLog.groupBy({
        by: ['action'],
        where,
        _count: { id: true },
      }),
      rawPrisma.paiement.count({ where: tenantFilter }),
      rawPrisma.paiement.aggregate({
        where: tenantFilter,
        _sum: { montant: true },
      }),
      rawPrisma.inscription.count({ where: tenantFilter }),
      rawPrisma.bulletin.count({ where: tenantFilter }),
      rawPrisma.message.count({ where: tenantFilter }),
      rawPrisma.notification.count({ where: tenantFilter }),
      rawPrisma.auditLog.findMany({
        where,
        include: { tenant: { select: { nom: true, slug: true } } },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      // Sessions récentes actives (connexions des dernières 2 heures)
      rawPrisma.auditLog.findMany({
        where: {
          action: 'login',
          createdAt: { gte: new Date(Date.now() - 2 * 60 * 60 * 1000) },
          ...(tenantId ? { tenantId } : {}),
        },
        include: { tenant: { select: { nom: true } } },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);

    const totalCommunications = totalMessages + totalNotifications;
    const totalMouvements = totalAuditLogs + totalPaiements + totalInscriptions;

    // Dédupliquer les sessions actives par actorId ou email
    const seenUsers = new Set();
    const activeSessionsDetails = [];
    for (const s of activeSessions) {
      const key = s.actorId || s.details?.email || s.id;
      if (!seenUsers.has(key)) {
        seenUsers.add(key);
        activeSessionsDetails.push({
          id: s.id,
          nom: s.details?.name || s.details?.email || s.actorRole || 'Utilisateur',
          email: s.details?.email || '—',
          role: s.actorRole || 'staff',
          etablissement: s.tenant?.nom || 'GestSchool',
          loginTime: s.createdAt,
          ip: s.ipAddress || '—',
        });
      }
    }

    res.json({
      totalMouvements,
      totalPaiements,
      totalPaiementsMontant: Number(paiementsSum._sum.montant || 0),
      totalInscriptions,
      totalBulletins,
      totalCommunications,
      activeSessionsCount: activeSessionsDetails.length,
      activeSessionsDetails,
      totalAuditLogs,
      actionsParType,
      recentActivity: recentLogs.map((l) => ({
        id: l.id,
        type: categorizeAction(l.action, l.targetType),
        action: l.action,
        etablissement: l.tenant?.nom || 'GestSchool',
        createdAt: l.createdAt,
      })),
    });
  } catch (error) {
    log.error({ err: error }, 'Get audit stats error');
    res.status(500).json({ error: 'Internal server error' });
  }
};
