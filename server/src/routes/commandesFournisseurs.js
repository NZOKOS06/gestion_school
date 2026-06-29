import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/authMiddleware.js';
import { paginationValidator, idParamValidator, handleValidationErrors } from '../utils/validators.js';
import { prisma } from '../utils/prisma.js';
import { uploadDocument, requireCloudinary } from '../utils/cloudinary.js';

const router = Router();

// GET /api/commandes-fournisseurs - Liste paginée des commandes
router.get('/', authenticate, requireRole('pharmacien', 'admin', 'preparateur'), paginationValidator, async (req, res) => {
  try {
    const { page = 1, limit = 15, statut, fournisseurId } = req.query;
    const tenantId = req.tenantId;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = { tenantId };
    
    if (statut) where.statut = statut;
    if (fournisseurId) where.fournisseurId = fournisseurId;
    
    const [commandes, total] = await Promise.all([
      prisma.commandeFournisseur.findMany({
        where,
        include: {
          fournisseur: { select: { id: true, nom: true } },
          lignes: {
            include: {
              medicament: { select: { id: true, dci: true, nomCommercial: true } }
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.commandeFournisseur.count({ where })
    ]);
    
    res.json({
      data: commandes,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('[CommandesFournisseurs] GET error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/commandes-fournisseurs/:id - Détail d'une commande
router.get('/:id', authenticate, requireRole('pharmacien', 'admin', 'preparateur'), idParamValidator, handleValidationErrors, async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;
    
    const commande = await prisma.commandeFournisseur.findFirst({
      where: { id, tenantId },
      include: {
        fournisseur: true,
        lignes: {
          include: {
            medicament: { select: { id: true, dci: true, nomCommercial: true, formeGalenique: true, dosage: true } }
          }
        }
      }
    });
    
    if (!commande) {
      return res.status(404).json({ error: 'Commande non trouvée' });
    }
    
    res.json(commande);
  } catch (error) {
    console.error('[CommandesFournisseurs] GET by id error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/commandes-fournisseurs - Créer une commande
router.post('/', authenticate, requireRole('pharmacien', 'admin'), async (req, res) => {
  try {
    const { fournisseurId, lignes, notes } = req.body;
    const tenantId = req.tenantId;
    const staffId = req.user.id;
    
    if (!fournisseurId || !lignes || !Array.isArray(lignes) || lignes.length === 0) {
      return res.status(400).json({ error: 'Fournisseur et lignes requis' });
    }
    
    // Vérifier le fournisseur
    const fournisseur = await prisma.fournisseur.findFirst({
      where: { id: fournisseurId, tenantId }
    });
    
    if (!fournisseur) {
      return res.status(404).json({ error: 'Fournisseur non trouvé' });
    }
    
    // Générer un numéro de commande unique
    const dernierCommande = await prisma.commandeFournisseur.findFirst({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      select: { numeroCommande: true }
    });
    const num = dernierCommande?.numeroCommande
      ? parseInt(dernierCommande.numeroCommande.replace(/\D/g, '')) + 1
      : 1;
    const numeroCommande = `CF-${String(num).padStart(5, '0')}`;

    // Calculer le total
    const montantTotal = lignes.reduce((sum, ligne) => sum + (ligne.quantite * ligne.prixUnitaire), 0);
    
    // Créer la commande avec ses lignes
    const commande = await prisma.commandeFournisseur.create({
      data: {
        tenantId,
        fournisseurId,
        createdById: staffId,
        statut: 'brouillon',
        numeroCommande,
        montantTotal,
        note: notes,
        lignes: {
          create: lignes.map(l => ({
            medicamentId: l.medicamentId,
            quantiteDemandee: l.quantite,
            prixUnitaire: l.prixUnitaire
          }))
        }
      },
      include: {
        fournisseur: { select: { id: true, nom: true } },
        lignes: {
          include: {
            medicament: { select: { id: true, dci: true, nomCommercial: true } }
          }
        }
      }
    });
    
    res.status(201).json(commande);
  } catch (error) {
    console.error('[CommandesFournisseurs] POST error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/commandes-fournisseurs/:id/statut - Changer le statut d'une commande
router.put('/:id/statut', authenticate, requireRole('pharmacien', 'admin'), idParamValidator, handleValidationErrors, async (req, res) => {
  try {
    const { id } = req.params;
    const { statut } = req.body;
    const tenantId = req.tenantId;

    const commande = await prisma.commandeFournisseur.findFirst({
      where: { id, tenantId }
    });

    if (!commande) {
      return res.status(404).json({ error: 'Commande non trouvée' });
    }

    const updated = await prisma.commandeFournisseur.update({
      where: { id },
      data: { statut },
      include: {
        fournisseur: { select: { id: true, nom: true } },
        lignes: {
          include: {
            medicament: { select: { id: true, dci: true, nomCommercial: true } }
          }
        }
      }
    });

    res.json(updated);
  } catch (error) {
    console.error('[CommandesFournisseurs] PUT statut error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/commandes-fournisseurs/:id - Modifier une commande (si brouillon)
router.put('/:id', authenticate, requireRole('pharmacien', 'admin'), idParamValidator, handleValidationErrors, async (req, res) => {
  try {
    const { id } = req.params;
    const { statut, notes } = req.body;
    const tenantId = req.tenantId;
    
    const commande = await prisma.commandeFournisseur.findFirst({
      where: { id, tenantId }
    });
    
    if (!commande) {
      return res.status(404).json({ error: 'Commande non trouvée' });
    }
    
    // Si passage à "recue", créer automatiquement les lots de stock
    if (statut === 'recue' && commande.statut !== 'recue') {
      // Récupérer les lignes pour créer les lots
      const lignes = await prisma.ligneCommandeF.findMany({
        where: { commandeId: id }
      });
      
      // Créer les lots de stock pour chaque ligne
      for (const ligne of lignes) {
        await prisma.lotStock.create({
          data: {
            tenantId,
            medicamentId: ligne.medicamentId,
            numeroLot: `CMD-${id.slice(-6)}-${Date.now()}`,
            quantiteInitiale: ligne.quantiteDemandee,
            quantiteRestante: ligne.quantiteDemandee,
            prixAchatLot: ligne.prixUnitaire,
            datePeremption: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          }
        });
        
        // Mettre à jour le stock du médicament
        await prisma.medicament.update({
          where: { id: ligne.medicamentId },
          data: { stockTotal: { increment: ligne.quantiteDemandee } }
        });
      }
    }
    
    const updated = await prisma.commandeFournisseur.update({
      where: { id },
      data: { statut, note: notes },
      include: {
        fournisseur: { select: { id: true, nom: true } },
        lignes: {
          include: {
            medicament: { select: { id: true, dci: true, nomCommercial: true } }
          }
        }
      }
    });
    
    res.json(updated);
  } catch (error) {
    console.error('[CommandesFournisseurs] PUT error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/commandes-fournisseurs/:id/reception - Réceptionner une commande
router.post('/:id/reception', authenticate, requireRole('pharmacien', 'admin'), idParamValidator, handleValidationErrors, async (req, res) => {
  try {
    const commandeId = req.params.id;
    const { dateReception, lignes } = req.body;
    const tenantId = req.tenantId;
    const staffId = req.user.id;

    const commande = await prisma.commandeFournisseur.findFirst({
      where: { id: commandeId, tenantId },
      include: { lignes: true }
    });

    if (!commande) {
      return res.status(404).json({ error: 'Commande non trouvée' });
    }

    const lignesLot = lignes.map(l => ({
      medicamentId: commande.lignes.find(cl => cl.id === l.ligneId)?.medicamentId,
      numeroLot: l.numeroLot,
      datePeremption: l.datePeremption,
      quantiteRecue: l.quantiteRecue,
      prixAchatLot: l.prixAchatLot || commande.lignes.find(cl => cl.id === l.ligneId)?.prixUnitaire || 0,
      fournisseurId: commande.fournisseurId
    })).filter(l => l.quantiteRecue > 0 && l.medicamentId);

    const { receptionCommande } = await import('../utils/stockFEFO.js');
    const { lotsCrees, mouvements } = await receptionCommande(tenantId, commandeId, lignesLot, staffId);

    for (const l of lignes) {
      await prisma.ligneCommandeF.update({
        where: { id: l.ligneId },
        data: { quantiteRecue: { increment: l.quantiteRecue } }
      });
    }

    const lignesCommande = await prisma.ligneCommandeF.findMany({ where: { commandeId } });
    const totalDemandee = lignesCommande.reduce((sum, l) => sum + l.quantiteDemandee, 0);
    const totalRecue = lignesCommande.reduce((sum, l) => sum + l.quantiteRecue, 0);
    const nouveauStatut = totalRecue >= totalDemandee ? 'recue' : 'partielle';

    await prisma.commandeFournisseur.update({
      where: { id: commandeId },
      data: {
        statut: nouveauStatut,
        dateReception: dateReception ? new Date(dateReception) : new Date(),
        receivedById: staffId
      }
    });

    if (req.body.numeroBL || req.body.dateBL || req.body.noteReception) {
      await prisma.commandeFournisseur.update({
        where: { id: commandeId },
        data: {
          numeroBL: req.body.numeroBL ?? undefined,
          dateBL: req.body.dateBL ? new Date(req.body.dateBL) : undefined,
          noteReception: req.body.noteReception ?? undefined,
        }
      });
    }

    res.json({ lotsCrees, mouvements, statut: nouveauStatut });
  } catch (error) {
    console.error('[CommandesFournisseurs] reception error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/commandes-fournisseurs/:id - Supprimer une commande (si en_attente)
router.delete('/:id', authenticate, requireRole('pharmacien', 'admin'), idParamValidator, handleValidationErrors, async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;
    
    const commande = await prisma.commandeFournisseur.findFirst({
      where: { id, tenantId }
    });
    
    if (!commande) {
      return res.status(404).json({ error: 'Commande non trouvée' });
    }
    
    if (!['brouillon', 'en_attente'].includes(commande.statut)) {
      return res.status(400).json({ error: 'Seules les commandes en brouillon peuvent être supprimées' });
    }
    
    // Supprimer d'abord les lignes
    await prisma.ligneCommandeF.deleteMany({
      where: { commandeId: id }
    });
    
    // Puis la commande
    await prisma.commandeFournisseur.delete({
      where: { id }
    });
    
    res.json({ message: 'Commande supprimée' });
  } catch (error) {
    console.error('[CommandesFournisseurs] DELETE error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/commandes-fournisseurs/:id/document/bon-commande - Upload PDF bon de commande
router.put('/:id/document/bon-commande',
  authenticate, requireRole('pharmacien', 'admin'),
  requireCloudinary,
  uploadDocument.single('fichier'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.tenantId;
      const commande = await prisma.commandeFournisseur.findFirst({
        where: { id, tenantId }
      });
      if (!commande) {
        return res.status(404).json({ success: false, message: 'Commande introuvable' });
      }
      if (!req.file?.path) {
        return res.status(400).json({ success: false, message: 'Aucun fichier reçu' });
      }
      const updated = await prisma.commandeFournisseur.update({
        where: { id },
        data: { urlBonCommande: req.file.path }
      });
      res.json({ success: true, data: updated });
    } catch (error) {
      console.error('[CommandesFournisseurs] upload BC error:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }
);

// PUT /api/commandes-fournisseurs/:id/document/bon-livraison - Upload PDF bon de livraison
router.put('/:id/document/bon-livraison',
  authenticate, requireRole('pharmacien', 'admin'),
  requireCloudinary,
  uploadDocument.single('fichier'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.tenantId;
      const commande = await prisma.commandeFournisseur.findFirst({
        where: { id, tenantId }
      });
      if (!commande) {
        return res.status(404).json({ success: false, message: 'Commande introuvable' });
      }
      if (!req.file?.path) {
        return res.status(400).json({ success: false, message: 'Aucun fichier reçu' });
      }
      const updated = await prisma.commandeFournisseur.update({
        where: { id },
        data: { urlBonLivraison: req.file.path }
      });
      res.json({ success: true, data: updated });
    } catch (error) {
      console.error('[CommandesFournisseurs] upload BL error:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }
);

export default router;
