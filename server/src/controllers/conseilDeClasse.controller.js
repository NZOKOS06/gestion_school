import { prisma } from '../utils/prisma.js';
import { createLogger } from '../utils/logger.js';
import { logAudit } from '../utils/auditLogger.js';

const log = createLogger('ConseilDeClasseController');

export const getAll = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { page = 1, limit = 20, classeId, anneeScolaireId, periodeIndex, cloture, sortBy = 'dateConseil', order = 'desc' } = req.query;
    const take = parseInt(limit);
    const skip = (parseInt(page) - 1) * take;

    const where = { tenantId };
    if (classeId) where.classeId = classeId;
    if (anneeScolaireId) where.anneeScolaireId = anneeScolaireId;
    if (periodeIndex !== undefined) where.periodeIndex = parseInt(periodeIndex);
    if (cloture !== undefined) where.cloture = cloture === 'true';

    const orderBy = {};
    orderBy[sortBy] = order;

    const [rows, total] = await Promise.all([
      prisma.conseilDeClasse.findMany({
        where,
        include: {
          classe: { select: { id: true, nom: true, cycle: true } },
          anneeScolaire: { select: { id: true, libelle: true } },
          president: { select: { id: true, nom: true, prenom: true } },
          participants: {
            include: {
              staff: { select: { id: true, nom: true, prenom: true, role: true } },
            },
          },
        },
        skip,
        take,
        orderBy,
      }),
      prisma.conseilDeClasse.count({ where }),
    ]);

    res.json({
      data: rows,
      pagination: { page: parseInt(page), limit: take, total, totalPages: Math.ceil(total / take) },
    });
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId }, 'Get all conseils error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getOne = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;

    const conseil = await prisma.conseilDeClasse.findFirst({
      where: { id, tenantId },
      include: {
        classe: true,
        anneeScolaire: { select: { id: true, libelle: true } },
        president: { select: { id: true, nom: true, prenom: true } },
        participants: {
          include: {
            staff: { select: { id: true, nom: true, prenom: true, role: true } },
          },
        },
      },
    });

    if (!conseil) {
      return res.status(404).json({ error: 'Conseil de classe non trouvé' });
    }

    res.json(conseil);
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId, id: req.params.id }, 'Get conseil error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const create = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { classeId, anneeScolaireId, periodeIndex, dateConseil, presidentId, participantIds } = req.body;

    // Check uniqueness
    const existing = await prisma.conseilDeClasse.findFirst({
      where: { tenantId, anneeScolaireId, classeId, periodeIndex: parseInt(periodeIndex) },
    });
    if (existing) {
      return res.status(400).json({ error: 'Un conseil de classe existe déjà pour cette classe et période' });
    }

    const conseil = await prisma.conseilDeClasse.create({
      data: {
        tenantId,
        classeId,
        anneeScolaireId,
        periodeIndex: parseInt(periodeIndex),
        dateConseil: dateConseil ? new Date(dateConseil) : new Date(),
        presidentId: presidentId || req.user.id,
        participants: participantIds?.length
          ? {
              create: participantIds.map(staffId => ({ staffId })),
            }
          : undefined,
      },
      include: {
        classe: { select: { nom: true } },
        participants: { include: { staff: { select: { nom: true, prenom: true } } } },
      },
    });

    await logAudit(req, 'conseil_classe_tenu', 'ConseilDeClasse', conseil.id, { classeId, periodeIndex });

    res.status(201).json(conseil);
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId }, 'Create conseil error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const update = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;
    const { compteRendu, cloture, dateConseil } = req.body;

    const existing = await prisma.conseilDeClasse.findFirst({ where: { id, tenantId } });
    if (!existing) {
      return res.status(404).json({ error: 'Conseil de classe non trouvé' });
    }

    const data = {};
    if (compteRendu !== undefined) data.compteRendu = compteRendu;
    if (cloture !== undefined) data.cloture = cloture;
    if (dateConseil !== undefined) data.dateConseil = new Date(dateConseil);

    const conseil = await prisma.conseilDeClasse.update({ where: { id }, data });

    res.json(conseil);
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId, id: req.params.id }, 'Update conseil error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const addParticipant = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;
    const { staffId, present, observations } = req.body;

    const existing = await prisma.conseilDeClasse.findFirst({ where: { id, tenantId } });
    if (!existing) {
      return res.status(404).json({ error: 'Conseil de classe non trouvé' });
    }

    const participant = await prisma.conseilParticipant.create({
      data: {
        conseilId: id,
        staffId,
        present: present !== false,
        observations: observations || null,
      },
    });

    res.status(201).json(participant);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Participant déjà ajouté' });
    }
    log.error({ err: error, tenantId: req.tenantId, id: req.params.id }, 'Add participant error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const remove = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;

    const existing = await prisma.conseilDeClasse.findFirst({ where: { id, tenantId } });
    if (!existing) {
      return res.status(404).json({ error: 'Conseil de classe non trouvé' });
    }

    await prisma.conseilDeClasse.delete({ where: { id } });

    res.json({ message: 'Conseil de classe supprimé' });
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId, id: req.params.id }, 'Delete conseil error');
    res.status(500).json({ error: 'Internal server error' });
  }
};
