import { prisma } from '../utils/prisma.js';
import { emitNouvelleOrdonnance } from '../utils/pharmacyEvents.js';
import { createLogger } from '../utils/logger.js';
import { captureError } from '../utils/sentry.js';

const log = createLogger('OrdonnancesController');

export const getAll = async (req, res) => {
  try {
    const { page = 1, limit = 20, statut, dateDebut, dateFin } = req.query;
    const tenantId = req.tenantId;

    const where = { tenantId };

    if (statut) where.statut = statut;
    if (dateDebut || dateFin) {
      where.createdAt = {};
      if (dateDebut) where.createdAt.gte = new Date(dateDebut);
      if (dateFin) where.createdAt.lte = new Date(dateFin);
    }

    const [ordonnances, total] = await Promise.all([
      prisma.ordonnance.findMany({
        where,
        include: {
          user: { select: { nom: true, prenom: true, telephone: true } },
          vente: { select: { id: true, numeroVente: true, statut: true, montantTotal: true } },
          lignes: {
            include: {
              medicament: { select: { dci: true, nomCommercial: true } }
            }
          }
        },
        skip: (page - 1) * limit,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' }
      }),
      prisma.ordonnance.count({ where })
    ]);

    res.json({
      data: ordonnances,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    log.error({ err: error, tenantId }, 'Get all prescriptions error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getById = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;
    const user = req.user;

    const where = { id, tenantId };

    if (user.role === 'client') {
      where.userId = user.id;
    }

    const ordonnance = await prisma.ordonnance.findFirst({
      where,
      include: {
        user: { select: { nom: true, prenom: true, telephone: true, email: true } },
        vente: {
          include: {
            lignes: {
              include: {
                medicament: { select: { dci: true, nomCommercial: true } }
              }
            }
          }
        },
        lignes: { include: { medicament: true } }
      }
    });

    if (!ordonnance) {
      return res.status(404).json({ error: 'Ordonnance non trouvée' });
    }

    res.json(ordonnance);
  } catch (error) {
    log.error({ err: error, id, tenantId }, 'Get prescription by ID error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const create = async (req, res) => {
  try {
    const { nomMedecin, numeroMedecin, dateOrdonnance, lignes, userId } = req.body;
    const tenantId = req.tenantId;
    const currentUser = req.user;

    const finalUserId = currentUser.role === 'client' ? currentUser.id : (userId || null);

    const imageUrl = req.file ? req.file.path : null;

    const ordonnance = await prisma.ordonnance.create({
      data: {
        tenantId,
        userId: finalUserId,
        nomMedecin,
        numeroMedecin,
        dateOrdonnance: dateOrdonnance ? new Date(dateOrdonnance) : new Date(),
        imageUrl,
        statut: 'en_attente'
      }
    });

    if (lignes && Array.isArray(lignes)) {
      for (const ligne of lignes) {
        await prisma.ligneOrdonnance.create({
          data: {
            ordonnanceId: ordonnance.id,
            medicamentId: ligne.medicamentId,
            posologie: ligne.posologie,
            duree: ligne.duree,
            quantitePrescrite: parseInt(ligne.quantitePrescrite)
          }
        });
      }
    }

    emitNouvelleOrdonnance(req.tenant.slug, ordonnance);

    const ordonnanceComplete = await prisma.ordonnance.findUnique({
      where: { id: ordonnance.id },
      include: {
        lignes: {
          include: {
            medicament: { select: { dci: true, nomCommercial: true } }
          }
        }
      }
    });

    res.status(201).json(ordonnanceComplete);
  } catch (error) {
    captureError(error, {
      tenantId,
      tenantSlug: req.tenant?.slug,
      userId: currentUser?.id,
      action: 'createOrdonnance'
    });
    log.error({ err: error, tenantId, userId }, 'Create prescription error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const valider = async (req, res) => {
  try {
    const { id } = req.params;
    const { lignesDelivrees } = req.body;
    const tenantId = req.tenantId;

    const ordonnance = await prisma.ordonnance.findFirst({
      where: { id, tenantId },
      include: { lignes: true }
    });

    if (!ordonnance) {
      return res.status(404).json({ error: 'Ordonnance non trouvée' });
    }

    if (ordonnance.statut !== 'en_attente') {
      return res.status(400).json({ error: 'Ordonnance déjà traitée' });
    }

    if (lignesDelivrees) {
      for (const ligne of lignesDelivrees) {
        await prisma.ligneOrdonnance.update({
          where: { id: ligne.id },
          data: { quantiteDelivree: ligne.quantiteDelivree }
        });
      }
    }

    const ordonnanceValidee = await prisma.ordonnance.update({
      where: { id },
      data: { statut: 'validee' }
    });

    res.json(ordonnanceValidee);
  } catch (error) {
    log.error({ err: error, id, tenantId }, 'Validate prescription error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const refuser = async (req, res) => {
  try {
    const { id } = req.params;
    const { motif } = req.body;
    const tenantId = req.tenantId;

    const ordonnance = await prisma.ordonnance.findFirst({
      where: { id, tenantId }
    });

    if (!ordonnance) {
      return res.status(404).json({ error: 'Ordonnance non trouvée' });
    }

    if (ordonnance.statut !== 'en_attente') {
      return res.status(400).json({ error: 'Ordonnance déjà traitée' });
    }

    const ordonnanceRefusee = await prisma.ordonnance.update({
      where: { id },
      data: { statut: 'refusee' }
    });

    res.json(ordonnanceRefusee);
  } catch (error) {
    log.error({ err: error, id, tenantId }, 'Refuse prescription error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const dispenser = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;

    const ordonnance = await prisma.ordonnance.findFirst({
      where: { id, tenantId }
    });

    if (!ordonnance) {
      return res.status(404).json({ error: 'Ordonnance non trouvée' });
    }

    if (ordonnance.statut !== 'validee') {
      return res.status(400).json({ error: 'Ordonnance doit être validée avant dispensation' });
    }

    const ordonnanceDispensee = await prisma.ordonnance.update({
      where: { id },
      data: { statut: 'dispensee' }
    });

    res.json(ordonnanceDispensee);
  } catch (error) {
    log.error({ err: error, id, tenantId }, 'Dispense prescription error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getMesOrdonnances = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const tenantId = req.tenantId;
    const userId = req.user.id;

    const [ordonnances, total] = await Promise.all([
      prisma.ordonnance.findMany({
        where: { tenantId, userId },
        include: {
          vente: { select: { id: true, numeroVente: true, statut: true } },
          lignes: {
            include: {
              medicament: { select: { dci: true, nomCommercial: true } }
            }
          }
        },
        skip: (page - 1) * limit,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' }
      }),
      prisma.ordonnance.count({ where: { tenantId, userId } })
    ]);

    res.json({
      data: ordonnances,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    log.error({ err: error, tenantId, userId }, 'Get my prescriptions error');
    res.status(500).json({ error: 'Internal server error' });
  }
};
