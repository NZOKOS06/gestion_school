import { prisma } from '../utils/prisma.js';
import { decrementerStockFEFO, retourStock } from '../utils/stockFEFO.js';
import { emitNouvelleVente } from '../utils/pharmacyEvents.js';
import { createLogger } from '../utils/logger.js';
import { captureError } from '../utils/sentry.js';

const log = createLogger('VentesController');

export const getAll = async (req, res) => {
  const tenantId = req.tenantId;
  try {
    const { page = 1, limit = 20, statut, dateDebut, dateFin, search } = req.query;

    const where = { tenantId };

    if (statut) where.statut = statut;
    if (dateDebut || dateFin) {
      where.createdAt = {};
      if (dateDebut) where.createdAt.gte = new Date(dateDebut);
      if (dateFin) where.createdAt.lte = new Date(dateFin);
    }
    if (search) {
      where.OR = [
        { numeroVente: { equals: parseInt(search) || undefined } },
        { nomClient: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [ventes, total] = await Promise.all([
      prisma.vente.findMany({
        where,
        include: {
          staff: { select: { nom: true, prenom: true } },
          user: { select: { nom: true, prenom: true, telephone: true } },
          ordonnance: { select: { id: true, statut: true, nomMedecin: true } },
          lignes: {
            include: {
              medicament: { select: { dci: true, nomCommercial: true } }
            }
          },
          livraison: { select: { statut: true, adresse: true } }
        },
        skip: (page - 1) * limit,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' }
      }),
      prisma.vente.count({ where })
    ]);

    res.json({
      data: ventes,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    log.error({ err: error, tenantId }, 'Get all sales error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getMesVentes = async (req, res) => {
  const tenantId = req.tenantId;
  const staffId = req.user.id;
  try {
    const { page = 1, limit = 20, date = new Date().toISOString().split('T')[0] } = req.query;

    const dateDebut = new Date(date);
    dateDebut.setHours(0, 0, 0, 0);
    const dateFin = new Date(date);
    dateFin.setHours(23, 59, 59, 999);

    const [ventes, total] = await Promise.all([
      prisma.vente.findMany({
        where: {
          tenantId,
          staffId,
          createdAt: { gte: dateDebut, lte: dateFin }
        },
        include: {
          lignes: {
            include: {
              medicament: { select: { dci: true } }
            }
          }
        },
        skip: (page - 1) * limit,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' }
      }),
      prisma.vente.count({
        where: {
          tenantId,
          staffId,
          createdAt: { gte: dateDebut, lte: dateFin }
        }
      })
    ]);

    const stats = {
      totalVentes: total,
      montantTotal: ventes.reduce((sum, v) => sum + parseFloat(v.montantTotal), 0),
      finalisees: ventes.filter(v => v.statut === 'finalisee').length,
      enCours: ventes.filter(v => v.statut === 'en_cours').length
    };

    res.json({
      data: ventes,
      stats,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    log.error({ err: error, tenantId, staffId }, 'Get my sales error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getById = async (req, res) => {
  const tenantId = req.tenantId;
  try {
    const { id } = req.params;

    const vente = await prisma.vente.findFirst({
      where: { id, tenantId },
      include: {
        staff: { select: { nom: true, prenom: true, role: true } },
        user: { select: { nom: true, prenom: true, telephone: true, email: true } },
        ordonnance: {
          include: {
            lignes: {
              include: {
                medicament: { select: { dci: true, nomCommercial: true } }
              }
            }
          }
        },
        lignes: {
          include: {
            medicament: true,
            lotStock: { select: { numeroLot: true, datePeremption: true } }
          }
        },
        paiements: true,
        livraison: {
          include: {
            staff: { select: { nom: true, prenom: true, telephone: true } }
          }
        }
      }
    });

    if (!vente) {
      return res.status(404).json({ error: 'Vente non trouvée' });
    }

    res.json(vente);
  } catch (error) {
    log.error({ err: error, id, tenantId }, 'Get sale by ID error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const create = async (req, res) => {
  const tenantId = req.tenantId;
  const staffId = req.user.id;
  try {
    const { typeVente = 'comptoir', lignes, nomClient, telephoneClient, ordonnanceId } = req.body;

    let montantTotal = 0;
    const lignesVente = [];

    for (const ligne of lignes) {
      const medicament = await prisma.medicament.findFirst({
        where: { id: ligne.medicamentId, tenantId, actif: true }
      });

      if (!medicament) {
        return res.status(400).json({
          error: `Médicament ${ligne.medicamentId} non trouvé`
        });
      }

      if (medicament.ordonnanceRequise && !ordonnanceId) {
        return res.status(400).json({
          error: `Ordonnance requise pour ${medicament.nomCommercial} (${medicament.dci}). Associez une ordonnance à la vente.`
        });
      }

      // Note: La vérification de stock est maintenant faite atomiquement
      // dans decrementerStockFEFO avec verrou FOR UPDATE pour éviter
      // les race conditions sur les ventes simultanées

      const prixUnitaire = parseFloat(ligne.prixUnitaire || medicament.prixVente);
      const remise = parseFloat(ligne.remise || 0);
      const sousTotal = prixUnitaire * ligne.quantite * (1 - remise / 100);

      montantTotal += sousTotal;

      lignesVente.push({
        medicamentId: ligne.medicamentId,
        quantite: ligne.quantite,
        prixUnitaire,
        remise,
        sousTotal
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const lastVente = await tx.vente.findFirst({
        where: { tenantId },
        orderBy: { numeroVente: 'desc' },
        select: { numeroVente: true }
      });
      const numeroVente = (lastVente?.numeroVente || 0) + 1;

      const vente = await tx.vente.create({
        data: {
          tenantId,
          numeroVente,
          staffId,
          nomClient,
          telephoneClient,
          ordonnanceId,
          typeVente,
          montantTotal,
          statut: 'en_cours'
        }
      });

      const lignesCreees = [];
      for (const lv of lignesVente) {
        const result = await decrementerStockFEFO(
          tenantId,
          lv.medicamentId,
          lv.quantite,
          vente.id,
          staffId,
          tx
        );

        for (const lot of result.lignesLot) {
          const ligneCreee = await tx.ligneVente.create({
            data: {
              venteId: vente.id,
              medicamentId: lv.medicamentId,
              lotStockId: lot.lotStockId,
              quantite: lot.quantite,
              prixUnitaire: lv.prixUnitaire,
              remise: lv.remise,
              sousTotal: lv.prixUnitaire * lot.quantite * (1 - (lv.remise || 0) / 100)
            }
          });
          lignesCreees.push(ligneCreee);
        }
      }

      return { vente, lignes: lignesCreees };
    }, { isolationLevel: 'Serializable' });

    emitNouvelleVente(req.tenant.slug, result.vente);

    res.status(201).json(result);
  } catch (error) {
    if (error.message?.startsWith('Stock insuffisant')) {
      return res.status(400).json({ error: error.message });
    }
    captureError(error, {
      tenantId,
      tenantSlug: req.tenant?.slug,
      userId: staffId,
      action: 'createVente'
    });
    log.error({ err: error, tenantId, staffId, body: req.body }, 'Create sale error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const encaisser = async (req, res) => {
  const tenantId = req.tenantId;
  try {
    const { id } = req.params;
    const { modePaiement, montantRecu, reference } = req.body;

    const vente = await prisma.vente.findFirst({
      where: { id, tenantId }
    });

    if (!vente) {
      return res.status(404).json({ error: 'Vente non trouvée' });
    }

    if (vente.statut !== 'en_cours') {
      return res.status(400).json({ error: `Vente déjà ${vente.statut}` });
    }

    const montantTotal = parseFloat(vente.montantTotal);
    const recu = parseFloat(montantRecu);
    const monnaie = recu - montantTotal;

    if (monnaie < 0) {
      return res.status(400).json({ error: 'Montant reçu insuffisant' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const venteUpdated = await tx.vente.update({
        where: { id },
        data: {
          statut: 'finalisee',
          modePaiement,
          montantRecu: recu,
          monnaie
        }
      });

      await tx.paymentTransaction.create({
        data: {
          venteId: id,
          modePaiement,
          montant: montantTotal,
          reference,
          statut: 'valide'
        }
      });

      if (vente.ordonnanceId) {
        await tx.ordonnance.update({
          where: { id: vente.ordonnanceId },
          data: { statut: 'dispensee' }
        });
      }

      return venteUpdated;
    });

    res.json({
      success: true,
      vente: result,
      message: 'Vente encaissée avec succès'
    });
  } catch (error) {
    captureError(error, {
      tenantId,
      tenantSlug: req.tenant?.slug,
      userId: req.user?.id,
      action: 'encaisserVente'
    });
    log.error({ err: error, id, tenantId }, 'Encaisser sale error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const annuler = async (req, res) => {
  const tenantId = req.tenantId;
  const staffId = req.user.id;
  try {
    const { id } = req.params;
    const { motif } = req.body;

    const rolesAutorises = ['pharmacien', 'admin', 'caissier'];
    if (!rolesAutorises.includes(req.user.role)) {
      return res.status(403).json({ error: 'Accès refusé : rôle insuffisant pour annuler une vente' });
    }

    const vente = await prisma.vente.findFirst({
      where: { id, tenantId },
      include: { lignes: true }
    });

    if (!vente) {
      return res.status(404).json({ error: 'Vente non trouvée' });
    }

    if (vente.statut === 'annulee') {
      return res.status(400).json({ error: 'Vente déjà annulée' });
    }

    if (vente.statut === 'finalisee') {
      return res.status(400).json({ error: 'Impossible d\'annuler une vente déjà encaissée. Utilisez un remboursement.' });
    }

    await prisma.$transaction(async (tx) => {
      for (const ligne of vente.lignes) {
        if (ligne.lotStockId) {
          await retourStock(
            tenantId,
            ligne.medicamentId,
            ligne.lotStockId,
            ligne.quantite,
            `Annulation vente ${vente.numeroVente}`,
            staffId,
            tx
          );
        }
      }

      await tx.vente.update({
        where: { id },
        data: { statut: 'annulee' }
      });
    });

    res.json({ message: 'Vente annulée' });
  } catch (error) {
    log.error({ err: error, id, tenantId, staffId }, 'Cancel sale error');
    res.status(500).json({ error: 'Internal server error' });
  }
};
