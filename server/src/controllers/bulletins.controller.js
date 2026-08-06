import { prisma } from '../utils/prisma.js';
import { createLogger } from '../utils/logger.js';
import { logAudit } from '../utils/auditLogger.js';
import crypto from 'crypto';

const log = createLogger('BulletinsController');

export const getAll = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { page = 1, limit = 20, eleveId, classeId, anneeScolaireId, periodeIndex, sortBy = 'createdAt', order = 'desc' } = req.query;
    const take = parseInt(limit);
    const skip = (parseInt(page) - 1) * take;

    const where = { tenantId };
    if (eleveId) where.eleveId = eleveId;
    if (anneeScolaireId) where.anneeScolaireId = anneeScolaireId;
    if (periodeIndex) where.periodeIndex = parseInt(periodeIndex);
    if (classeId) where.classeId = classeId;

    const orderBy = {};
    orderBy[sortBy] = order;

    const [rows, total] = await Promise.all([
      prisma.bulletin.findMany({
        where,
        include: {
          eleve: { select: { id: true, matricule: true, nom: true, prenom: true } },
          classe: { select: { id: true, nom: true, niveau: true } },
          anneeScolaire: { select: { id: true, libelle: true } },
        },
        skip,
        take,
        orderBy,
      }),
      prisma.bulletin.count({ where }),
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
    log.error({ err: error, tenantId: req.tenantId }, 'Get all bulletins error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getById = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;

    const bulletin = await prisma.bulletin.findFirst({
      where: { id, tenantId },
      include: {
        eleve: { select: { id: true, matricule: true, nom: true, prenom: true, sexe: true, dateNaissance: true, photoUrl: true } },
        classe: { select: { id: true, nom: true, niveau: true, filiere: true } },
        anneeScolaire: { select: { id: true, libelle: true } },
      },
    });

    if (!bulletin) {
      return res.status(404).json({ error: 'Bulletin non trouvé' });
    }

    res.json(bulletin);
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId, id: req.params.id }, 'Get bulletin by ID error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const generate = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { eleveId, classeId, anneeScolaireId, periodeIndex } = req.body;

    const notes = await prisma.note.findMany({
      where: {
        tenantId,
        eleveId,
        evaluation: {
          classeId,
          anneeScolaireId,
          periodeIndex: parseInt(periodeIndex),
        },
      },
      include: {
        evaluation: {
          include: {
            matiere: { select: { id: true, nom: true, code: true, coefficient: true } },
          },
        },
      },
    });

    if (notes.length === 0) {
      return res.status(400).json({ error: 'Aucune note trouvée pour cette période' });
    }

    const matieresMap = new Map();
    for (const note of notes) {
      const matiereId = note.evaluation.matiereId;
      if (!matieresMap.has(matiereId)) {
        matieresMap.set(matiereId, {
          matiere: note.evaluation.matiere,
          notes: [],
        });
      }
      matieresMap.get(matiereId).notes.push({
        valeur: parseFloat(note.valeur),
        coefficient: note.evaluation.coefficient,
        noteMaximale: parseFloat(note.evaluation.noteMaximale),
      });
    }

    const matieresResult = [];
    let totalPoints = 0;
    let totalCoefficients = 0;

    for (const [matiereId, data] of matieresMap) {
      const moyennes = data.notes.map(n => (n.valeur / n.noteMaximale) * 20);
      const moyenneMatiere = moyennes.reduce((sum, m) => sum + m, 0) / moyennes.length;
      const coef = data.matiere.coefficient || 1;

      totalPoints += moyenneMatiere * coef;
      totalCoefficients += coef;

      matieresResult.push({
        matiere: data.matiere,
        moyenne: parseFloat(moyenneMatiere.toFixed(2)),
        coefficient: coef,
      });
    }

    const moyenneGenerale = totalCoefficients > 0 ? totalPoints / totalCoefficients : 0;

    const existing = await prisma.bulletin.findFirst({
      where: { tenantId, eleveId, classeId, anneeScolaireId, periodeIndex: parseInt(periodeIndex) },
    });

    let bulletin;
    if (existing) {
      bulletin = await prisma.bulletin.update({
        where: { id: existing.id },
        data: {
          moyenneGenerale: parseFloat(moyenneGenerale.toFixed(2)),
          detailsMatieres: matieresResult,
          statut: 'genere',
          qrCodeHash: crypto.createHash('sha256').update(`${tenantId}-${eleveId}-${classeId}-${anneeScolaireId}-${periodeIndex}-${Date.now()}`).digest('hex'),
        },
      });
    } else {
      bulletin = await prisma.bulletin.create({
        data: {
          tenantId,
          eleveId,
          classeId,
          anneeScolaireId,
          periodeIndex: parseInt(periodeIndex),
          moyenneGenerale: parseFloat(moyenneGenerale.toFixed(2)),
          detailsMatieres: matieresResult,
          statut: 'genere',
          qrCodeHash: crypto.createHash('sha256').update(`${tenantId}-${eleveId}-${classeId}-${anneeScolaireId}-${periodeIndex}-${Date.now()}`).digest('hex'),
        },
      });
    }

    await logAudit(req, 'bulletin_generated', 'Bulletin', bulletin.id, { eleveId, periodeIndex });

    res.status(201).json(bulletin);
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId }, 'Generate bulletin error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const update = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;
    const { appreciationGenerale, statut } = req.body;

    const existing = await prisma.bulletin.findFirst({ where: { id, tenantId } });
    if (!existing) {
      return res.status(404).json({ error: 'Bulletin non trouvé' });
    }

    const data = {};
    if (appreciationGenerale !== undefined) data.appreciationGenerale = appreciationGenerale;
    if (statut !== undefined) data.statut = statut;

    const bulletin = await prisma.bulletin.update({ where: { id }, data });

    await logAudit(req, 'bulletin_updated', 'Bulletin', bulletin.id, { statut });

    res.json(bulletin);
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId, id: req.params.id }, 'Update bulletin error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const remove = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;

    const existing = await prisma.bulletin.findFirst({ where: { id, tenantId } });
    if (!existing) {
      return res.status(404).json({ error: 'Bulletin non trouvé' });
    }

    await prisma.bulletin.delete({ where: { id } });

    await logAudit(req, 'bulletin_deleted', 'Bulletin', id, {});

    res.json({ message: 'Bulletin supprimé' });
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId, id: req.params.id }, 'Delete bulletin error');
    res.status(500).json({ error: 'Internal server error' });
  }
};
