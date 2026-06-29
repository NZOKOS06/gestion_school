import { prisma } from '../utils/prisma.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('FournisseursController');

// ========== FOURNISSEURS ==========

export const getAll = async (req, res) => {
  try {
    const { page = 1, limit = 20, search, actif = 'true' } = req.query;
    const tenantId = req.tenantId;

    const where = { tenantId, actif: actif === 'true' };

    if (search) {
      where.OR = [
        { nom: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [fournisseurs, total] = await Promise.all([
      prisma.fournisseur.findMany({
        where,
        skip: (page - 1) * limit,
        take: parseInt(limit),
        orderBy: { nom: 'asc' }
      }),
      prisma.fournisseur.count({ where })
    ]);

    res.json({
      data: fournisseurs,
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

    const fournisseur = await prisma.fournisseur.findFirst({
      where: { id, tenantId }
    });

    if (!fournisseur) {
      return res.status(404).json({ error: 'Fournisseur non trouvé' });
    }

    res.json(fournisseur);
  } catch (error) {
    log.error({ err: error }, 'getById error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const create = async (req, res) => {
  try {
    const { nom, telephone, email, adresse, contactPrincipal, contact, delaiLivraison } = req.body;
    const tenantId = req.tenantId;

    const fournisseur = await prisma.fournisseur.create({
      data: {
        tenantId,
        nom,
        telephone: telephone || null,
        email: email || null,
        adresse: adresse || null,
        contact: contactPrincipal || contact || null,
        delaiLivraison: delaiLivraison ? parseInt(delaiLivraison) : null
      }
    });

    res.status(201).json(fournisseur);
  } catch (error) {
    log.error({ err: error }, 'create error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const update = async (req, res) => {
  try {
    const { id } = req.params;
    const { nom, telephone, email, adresse, contactPrincipal, contact, delaiLivraison, actif } = req.body;
    const tenantId = req.tenantId;

    const fournisseur = await prisma.fournisseur.findFirst({
      where: { id, tenantId }
    });

    if (!fournisseur) {
      return res.status(404).json({ error: 'Fournisseur non trouvé' });
    }

    const updated = await prisma.fournisseur.update({
      where: { id },
      data: {
        ...(nom !== undefined && { nom }),
        ...(telephone !== undefined && { telephone: telephone || null }),
        ...(email !== undefined && { email: email || null }),
        ...(adresse !== undefined && { adresse: adresse || null }),
        ...((contactPrincipal !== undefined || contact !== undefined) && { contact: contactPrincipal || contact || null }),
        ...(delaiLivraison !== undefined && { delaiLivraison: delaiLivraison ? parseInt(delaiLivraison) : null }),
        ...(actif !== undefined && { actif })
      }
    });

    res.json(updated);
  } catch (error) {
    log.error({ err: error }, 'update error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const remove = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;

    const fournisseur = await prisma.fournisseur.findFirst({
      where: { id, tenantId }
    });

    if (!fournisseur) {
      return res.status(404).json({ error: 'Fournisseur non trouvé' });
    }

    await prisma.fournisseur.update({
      where: { id },
      data: { actif: false }
    });

    res.json({ message: 'Fournisseur désactivé' });
  } catch (error) {
    log.error({ err: error }, 'remove error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ========== COMMANDES FOURNISSEURS ==========

export const getCommandes = async (req, res) => {
  try {
    const { page = 1, limit = 20, statut, fournisseurId } = req.query;
    const tenantId = req.tenantId;

    const where = { tenantId };
    if (statut) where.statut = statut;
    if (fournisseurId) where.fournisseurId = fournisseurId;

    const [commandes, total] = await Promise.all([
      prisma.commandeFournisseur.findMany({
        where,
        include: {
          fournisseur: { select: { nom: true } },
          createdBy: { select: { nom: true, prenom: true } },
          receivedBy: { select: { nom: true, prenom: true } },
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
      prisma.commandeFournisseur.count({ where })
    ]);

    res.json({
      data: commandes,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    log.error({ err: error }, 'getCommandes error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getCommandeById = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;

    const commande = await prisma.commandeFournisseur.findFirst({
      where: { id, tenantId },
      include: {
        fournisseur: true,
        createdBy: { select: { nom: true, prenom: true } },
        receivedBy: { select: { nom: true, prenom: true } },
        lignes: { include: { medicament: true } }
      }
    });

    if (!commande) {
      return res.status(404).json({ error: 'Commande non trouvée' });
    }

    res.json(commande);
  } catch (error) {
    log.error({ err: error }, 'getCommandeById error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createCommande = async (req, res) => {
  try {
    const { fournisseurId, lignes, note } = req.body;
    const tenantId = req.tenantId;
    const staffId = req.user.id;

    const annee = new Date().getFullYear();
    const lastCmd = await prisma.commandeFournisseur.findFirst({
      where: { tenantId },
      orderBy: { numeroCommande: 'desc' }
    });
    const lastNum = lastCmd ? parseInt(lastCmd.numeroCommande.split('-')[2]) : 0;
    const numeroCommande = `CF-${annee}-${String(lastNum + 1).padStart(6, '0')}`;

    const montantTotal = lignes.reduce((sum, l) =>
      sum + (l.quantiteDemandee * parseFloat(l.prixUnitaire)), 0
    );

    const commande = await prisma.commandeFournisseur.create({
      data: {
        tenantId,
        fournisseurId,
        numeroCommande,
        montantTotal,
        note,
        createdById: staffId,
        lignes: {
          create: lignes.map(l => ({
            medicamentId: l.medicamentId,
            quantiteDemandee: l.quantiteDemandee,
            prixUnitaire: parseFloat(l.prixUnitaire)
          }))
        }
      },
      include: {
        fournisseur: true,
        lignes: { include: { medicament: true } }
      }
    });

    res.status(201).json(commande);
  } catch (error) {
    log.error({ err: error }, 'createCommande error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const envoyerCommande = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;

    const commande = await prisma.commandeFournisseur.findFirst({
      where: { id, tenantId }
    });

    if (!commande) {
      return res.status(404).json({ error: 'Commande non trouvée' });
    }

    if (commande.statut !== 'brouillon') {
      return res.status(400).json({ error: 'Commande déjà envoyée' });
    }

    const updated = await prisma.commandeFournisseur.update({
      where: { id },
      data: { statut: 'envoyee', dateCommande: new Date() }
    });

    res.json(updated);
  } catch (error) {
    log.error({ err: error }, 'envoyerCommande error');
    res.status(500).json({ error: 'Internal server error' });
  }
};
