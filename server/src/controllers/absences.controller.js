import { prisma } from '../utils/prisma.js';
import { createLogger } from '../utils/logger.js';
import { logAudit } from '../utils/auditLogger.js';
import { emitNouvelleAbsence } from '../utils/schoolEvents.js';

const log = createLogger('AbsencesController');

export const getAll = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { page = 1, limit = 20, eleveId, classeId, dateDebut, dateFin, justifiee, typeAbsence, periode, sortBy = 'dateAbsence', order = 'desc' } = req.query;
    const take = parseInt(limit);
    const skip = (parseInt(page) - 1) * take;

    const where = { tenantId };
    if (eleveId) where.eleveId = eleveId;
    if (justifiee !== undefined) where.justifiee = justifiee === 'true';
    if (typeAbsence) where.typeAbsence = typeAbsence;
    if (dateDebut || dateFin) {
      where.dateAbsence = {};
      if (dateDebut) where.dateAbsence.gte = new Date(dateDebut);
      if (dateFin) where.dateAbsence.lte = new Date(dateFin);
    }
    if (periode) {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      if (periode === 'aujourdhui') {
        where.dateAbsence = { gte: startOfDay };
      } else if (periode === 'semaine') {
        const day = now.getDay() || 7;
        const startOfWeek = new Date(startOfDay);
        startOfWeek.setDate(startOfDay.getDate() - day + 1);
        where.dateAbsence = { gte: startOfWeek };
      } else if (periode === 'mois') {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        where.dateAbsence = { gte: startOfMonth };
      }
    }
    if (classeId) {
      where.eleve = {
        inscriptions: { some: { classeId, statut: 'validee' } },
      };
    }

    const orderBy = {};
    orderBy[sortBy] = order;

    const [rows, total] = await Promise.all([
      prisma.absence.findMany({
        where,
        include: {
          eleve: { select: { id: true, matricule: true, nom: true, prenom: true, photoUrl: true } },
          emploiDuTemps: {
            select: { id: true, matiere: { select: { nom: true } } },
          },
          saisiePar: { select: { id: true, nom: true, prenom: true } },
        },
        skip,
        take,
        orderBy,
      }),
      prisma.absence.count({ where }),
    ]);

    res.json({
      data: rows,
      pagination: {
        page: parseInt(page),
        limit: take,
        total,
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId }, 'Get all absences error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const create = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { eleveId, dateAbsence, justifiee, motifJustif, emploiDuTempsId, typeAbsence, pieceJustifUrl } = req.body;

    const absence = await prisma.absence.create({
      data: {
        tenantId,
        eleveId,
        dateAbsence: dateAbsence ? new Date(dateAbsence) : new Date(),
        typeAbsence: typeAbsence || 'absent',
        justifiee: justifiee || false,
        motifJustif: motifJustif || null,
        pieceJustifUrl: pieceJustifUrl || null,
        emploiDuTempsId: emploiDuTempsId || null,
        saisieParId: req.user.id,
      },
    });

    await logAudit(req, 'absence_created', 'Absence', absence.id, { eleveId });

    emitNouvelleAbsence(req.tenant.slug, absence);

    res.status(201).json(absence);
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId }, 'Create absence error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const update = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;
    const { justifiee, motifJustif, typeAbsence, pieceJustifUrl } = req.body;

    const existing = await prisma.absence.findFirst({ where: { id, tenantId } });
    if (!existing) {
      return res.status(404).json({ error: 'Absence non trouvée' });
    }

    const data = {};
    if (justifiee !== undefined) data.justifiee = justifiee;
    if (motifJustif !== undefined) data.motifJustif = motifJustif;
    if (typeAbsence !== undefined) data.typeAbsence = typeAbsence;
    if (pieceJustifUrl !== undefined) data.pieceJustifUrl = pieceJustifUrl;

    const absence = await prisma.absence.update({ where: { id }, data });

    await logAudit(req, 'absence_updated', 'Absence', absence.id, { justifiee });

    res.json(absence);
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId, id: req.params.id }, 'Update absence error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const remove = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;

    const existing = await prisma.absence.findFirst({ where: { id, tenantId } });
    if (!existing) {
      return res.status(404).json({ error: 'Absence non trouvée' });
    }

    await prisma.absence.delete({ where: { id } });

    await logAudit(req, 'absence_deleted', 'Absence', id, {});

    res.json({ message: 'Absence supprimée' });
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId, id: req.params.id }, 'Delete absence error');
    res.status(500).json({ error: 'Internal server error' });
  }
};
