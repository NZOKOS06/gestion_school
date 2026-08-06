import { prisma } from '../utils/prisma.js';
import { createLogger } from '../utils/logger.js';
import { logAudit } from '../utils/auditLogger.js';

const log = createLogger('MessagesController');

// Get messages for current user (inbox)
export const getInbox = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { page = 1, limit = 20, nonLus, sortBy = 'createdAt', order = 'desc' } = req.query;
    const take = parseInt(limit);
    const skip = (parseInt(page) - 1) * take;

    const where = { tenantId, lu: nonLus === 'true' ? false : undefined };
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

// Get sent messages
export const getSent = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { page = 1, limit = 20, sortBy = 'createdAt', order = 'desc' } = req.query;
    const take = parseInt(limit);
    const skip = (parseInt(page) - 1) * take;

    const where = { tenantId, expediteurId: req.user.id };

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

    if (!sujet || !contenu) {
      return res.status(400).json({ error: 'Sujet et contenu requis' });
    }

    if (!destinataireStaffId && !destinataireUserId) {
      return res.status(400).json({ error: 'Destinataire requis' });
    }

    const message = await prisma.message.create({
      data: {
        tenantId,
        expediteurId: req.user.id,
        destinataireStaffId: destinataireStaffId || null,
        destinataireUserId: destinataireUserId || null,
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

    // Verify current user is a recipient
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

    // Only sender or recipient can delete
    const canDelete =
      message.expediteurId === req.user.id ||
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
