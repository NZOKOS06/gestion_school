import { prisma } from '../utils/prisma.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('NotificationsController');

export const getMine = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const staffId = req.user?.id;
    if (!staffId) return res.status(401).json({ error: 'Non authentifié' });

    const notifications = await prisma.notification.findMany({
      where: { tenantId, staffId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    res.json({ data: notifications });
  } catch (error) {
    log.error({ err: error }, 'getMine notifications');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const markRead = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const staffId = req.user?.id;
    const { id } = req.params;

    const existing = await prisma.notification.findFirst({
      where: { id, tenantId, staffId },
    });
    if (!existing) return res.status(404).json({ error: 'Notification introuvable' });

    const updated = await prisma.notification.update({
      where: { id },
      data: { lu: true },
    });
    res.json(updated);
  } catch (error) {
    log.error({ err: error }, 'markRead notification');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const markAllRead = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const staffId = req.user?.id;

    await prisma.notification.updateMany({
      where: { tenantId, staffId, lu: false },
      data: { lu: true },
    });
    res.json({ success: true });
  } catch (error) {
    log.error({ err: error }, 'markAllRead notifications');
    res.status(500).json({ error: 'Internal server error' });
  }
};
