import { prisma } from '../utils/prisma.js';
import { emitLivraisonMAJ, emitOrderUpdated } from '../utils/pharmacyEvents.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('LivraisonsController');

export const getAll = async (req, res) => {
  try {
    const { page = 1, limit = 20, statut } = req.query;
    const tenantId = req.tenantId;
    const user = req.user;

    const where = { tenantId };

    if (user.role === 'livreur') {
      where.staffId = user.id;
    }

    if (statut) where.statut = statut;

    const [livraisons, total] = await Promise.all([
      prisma.livraison.findMany({
        where,
        include: {
          vente: {
            include: {
              lignes: {
                include: {
                  medicament: { select: { dci: true, nomCommercial: true } }
                }
              },
              user: { select: { nom: true, prenom: true, telephone: true } }
            }
          },
          staff: { select: { nom: true, prenom: true, telephone: true } }
        },
        skip: (page - 1) * limit,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' }
      }),
      prisma.livraison.count({ where })
    ]);

    res.json({
      data: livraisons,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    log.error({ err: error }, 'getAll error');
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
      const livraison = await prisma.livraison.findFirst({
        where: { id, tenantId },
        include: { vente: true }
      });
      if (!livraison || livraison.vente.userId !== user.id) {
        return res.status(403).json({ error: 'Accès interdit' });
      }
    }

    const livraison = await prisma.livraison.findFirst({
      where,
      include: {
        vente: {
          include: {
            lignes: {
              include: {
                medicament: { select: { dci: true, nomCommercial: true } }
              }
            },
            user: { select: { nom: true, prenom: true, telephone: true } }
          }
        },
        staff: { select: { nom: true, prenom: true, telephone: true } }
      }
    });

    if (!livraison) {
      return res.status(404).json({ error: 'Livraison non trouvée' });
    }

    res.json(livraison);
  } catch (error) {
    log.error({ err: error }, 'getById error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const create = async (req, res) => {
  try {
    const { venteId, adresse, instructions, telephone, livreurId } = req.body;
    const tenantId = req.tenantId;

    const vente = await prisma.vente.findFirst({
      where: { id: venteId, tenantId }
    });

    if (!vente) {
      return res.status(404).json({ error: 'Vente non trouvée' });
    }

    if (vente.typeVente !== 'livraison') {
      return res.status(400).json({ error: 'La vente n\'est pas une livraison' });
    }

    const livraisonExiste = await prisma.livraison.findUnique({
      where: { venteId }
    });

    if (livraisonExiste) {
      return res.status(409).json({ error: 'Livraison déjà créée pour cette vente' });
    }

    const livraison = await prisma.livraison.create({
      data: {
        tenantId,
        venteId,
        adresse,
        instructions,
        telephone,
        staffId: livreurId || null,
        statut: livreurId ? 'assignee' : undefined
      },
      include: {
        vente: {
          include: {
            lignes: {
              include: {
                medicament: { select: { dci: true, nomCommercial: true } }
              }
            }
          }
        }
      }
    });

    res.status(201).json(livraison);
  } catch (error) {
    log.error({ err: error }, 'create error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateStatut = async (req, res) => {
  try {
    const { id } = req.params;
    const { statut, motifEchec } = req.body;
    const tenantId = req.tenantId;
    const user = req.user;

    const livraison = await prisma.livraison.findFirst({
      where: { id, tenantId }
    });

    if (!livraison) {
      return res.status(404).json({ error: 'Livraison non trouvée' });
    }

    if (user.role === 'livreur' && livraison.staffId !== user.id) {
      return res.status(403).json({ error: 'Cette livraison ne vous est pas assignée' });
    }

    const updateData = { statut };

    if (statut === 'en_route') {
      updateData.dateEnRoute = new Date();
    } else if (statut === 'livree') {
      updateData.dateLivraison = new Date();
    } else if (statut === 'echec') {
      updateData.motifEchec = motifEchec;
    }

    const updated = await prisma.livraison.update({
      where: { id },
      data: updateData,
      include: {
        vente: {
          include: {
            user: { select: { id: true, nom: true, prenom: true } }
          }
        }
      }
    });

    emitLivraisonMAJ(id, {
      statut,
      ...(statut === 'en_route' && { dateEnRoute: updateData.dateEnRoute }),
      ...(statut === 'livree' && { dateLivraison: updateData.dateLivraison }),
      ...(statut === 'echec' && { motifEchec }),
    });

    if (updated.vente?.id) {
      emitOrderUpdated(updated.vente.id, {
        statut: updated.vente.statut,
        livraison: {
          statut,
          dateEnRoute: updateData.dateEnRoute,
          dateLivraison: updateData.dateLivraison,
        },
      });
    }

    res.json(updated);
  } catch (error) {
    log.error({ err: error }, 'updateStatut error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const assigner = async (req, res) => {
  try {
    const { id } = req.params;
    const { livreurId } = req.body;
    const tenantId = req.tenantId;

    const livraison = await prisma.livraison.findFirst({
      where: { id, tenantId }
    });

    if (!livraison) {
      return res.status(404).json({ error: 'Livraison non trouvée' });
    }

    const updated = await prisma.livraison.update({
      where: { id },
      data: { staffId: livreurId, statut: 'assignee' },
      include: {
        vente: true,
        staff: { select: { nom: true, prenom: true, telephone: true } }
      }
    });

    if (updated.vente?.id) {
      emitOrderUpdated(updated.vente.id, {
        livraison: {
          statut: 'assignee',
          telephoneLivreur: updated.staff?.telephone,
          livreurNom: updated.staff ? `${updated.staff.prenom} ${updated.staff.nom}` : null,
        },
      });
    }

    res.json(updated);
  } catch (error) {
    log.error({ err: error }, 'assigner error');
    res.status(500).json({ error: 'Internal server error' });
  }
};
