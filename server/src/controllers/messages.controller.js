import { prisma } from '../utils/prisma.js';
import { createLogger } from '../utils/logger.js';
import { logAudit } from '../utils/auditLogger.js';

const log = createLogger('MessagesController');

const messagingRoles = ['directeur', 'directeur_etudes', 'secretaire', 'enseignant', 'surveillant', 'comptable', 'parent'];

export const getRecipients = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const role = req.user.role;

    if (role === 'parent') {
      const staff = await prisma.staff.findMany({
        where: { tenantId, actif: true, role: { not: 'super_admin' } },
        select: { id: true, nom: true, prenom: true, role: true },
        orderBy: [{ nom: 'asc' }, { prenom: 'asc' }],
        take: 200,
      });
      return res.json({ staff, parents: [] });
    }

    const [staff, parents] = await Promise.all([
      prisma.staff.findMany({
        where: { tenantId, actif: true, role: { not: 'super_admin' } },
        select: { id: true, nom: true, prenom: true, role: true },
        orderBy: [{ nom: 'asc' }, { prenom: 'asc' }],
        take: 200,
      }),
      prisma.user.findMany({
        where: { tenantId, actif: true },
        select: { id: true, nom: true, prenom: true, email: true },
        orderBy: [{ nom: 'asc' }, { prenom: 'asc' }],
        take: 200,
      }),
    ]);

    res.json({ staff, parents });
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId }, 'Get recipients error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getInbox = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { page = 1, limit = 20, nonLus, sortBy = 'createdAt', order = 'desc' } = req.query;
    const take = parseInt(limit);
    const skip = (parseInt(page) - 1) * take;

    const where = { tenantId };
    if (nonLus === 'true') where.lu = false;
    if (req.user.role === 'parent') {
      where.destinataireUserId = req.user.id;
    } else {
      where.destinataireStaffId = req.user.id;
    }

    const orderBy = {};
    orderBy[sortBy] = order;

    const [rows, total] = await Promise.all([
      prisma.message.findMany({
        where,
        include: {
          expediteur: { select: { id: true, nom: true, prenom: true, role: true } },
          expediteurUser: { select: { id: true, nom: true, prenom: true } },
        },
        skip,
        take,
        orderBy,
      }),
      prisma.message.count({ where }),
    ]);

    res.json({
      data: rows,
      pagination: { page: parseInt(page), limit: take, total, totalPages: Math.ceil(total / take) },
    });
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId }, 'Get inbox error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getSent = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { page = 1, limit = 20, sortBy = 'createdAt', order = 'desc' } = req.query;
    const take = parseInt(limit);
    const skip = (parseInt(page) - 1) * take;

    const where = { tenantId };
    if (req.user.role === 'parent') {
      where.expediteurUserId = req.user.id;
    } else {
      where.expediteurId = req.user.id;
    }

    const orderBy = {};
    orderBy[sortBy] = order;

    const [rows, total] = await Promise.all([
      prisma.message.findMany({
        where,
        include: {
          destinataireStaff: { select: { id: true, nom: true, prenom: true, role: true } },
          destinataireUser: { select: { id: true, nom: true, prenom: true } },
        },
        skip,
        take,
        orderBy,
      }),
      prisma.message.count({ where }),
    ]);

    res.json({
      data: rows,
      pagination: { page: parseInt(page), limit: take, total, totalPages: Math.ceil(total / take) },
    });
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId }, 'Get sent messages error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const send = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { destinataireStaffId, destinataireUserId, sujet, contenu } = req.body;
    const isParent = req.user.role === 'parent';

    if (!sujet || !contenu) {
      return res.status(400).json({ error: 'Sujet et contenu requis' });
    }

    if (!destinataireStaffId && !destinataireUserId) {
      return res.status(400).json({ error: 'Destinataire requis' });
    }

    if (isParent && !destinataireStaffId) {
      return res.status(400).json({ error: 'Un parent doit écrire à un membre du personnel' });
    }

    const message = await prisma.message.create({
      data: {
        tenantId,
        expediteurId: isParent ? null : req.user.id,
        expediteurUserId: isParent ? req.user.id : null,
        destinataireStaffId: destinataireStaffId || null,
        destinataireUserId: isParent ? null : (destinataireUserId || null),
        sujet,
        contenu,
      },
    });

    await logAudit(req, 'message_envoye', 'Message', message.id, { destinataireStaffId, destinataireUserId });

    res.status(201).json(message);
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId }, 'Send message error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;

    const message = await prisma.message.findFirst({ where: { id, tenantId } });
    if (!message) {
      return res.status(404).json({ error: 'Message non trouvé' });
    }

    const isRecipient =
      (req.user.role === 'parent' && message.destinataireUserId === req.user.id) ||
      (req.user.role !== 'parent' && message.destinataireStaffId === req.user.id);

    if (!isRecipient) {
      return res.status(403).json({ error: 'Vous n\'êtes pas destinataire de ce message' });
    }

    const updated = await prisma.message.update({
      where: { id },
      data: { lu: true, dateLecture: new Date() },
    });

    res.json(updated);
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId, id: req.params.id }, 'Mark as read error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const remove = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;

    const message = await prisma.message.findFirst({ where: { id, tenantId } });
    if (!message) {
      return res.status(404).json({ error: 'Message non trouvé' });
    }

    const canDelete =
      message.expediteurId === req.user.id ||
      message.expediteurUserId === req.user.id ||
      (req.user.role === 'parent' && message.destinataireUserId === req.user.id) ||
      (req.user.role !== 'parent' && message.destinataireStaffId === req.user.id);

    if (!canDelete) {
      return res.status(403).json({ error: 'Action non autorisée' });
    }

    await prisma.message.delete({ where: { id } });

    res.json({ message: 'Message supprimé' });
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId, id: req.params.id }, 'Delete message error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export { messagingRoles };
