import { prisma } from '../utils/prisma.js';
import { receptionCommande, ajustementStock, calculerQuantiteACommander } from '../utils/stockFEFO.js';
import { createLogger } from '../utils/logger.js';
import { captureError } from '../utils/sentry.js';

const log = createLogger('StockController');

export const getLots = async (req, res) => {
  const tenantId = req.tenantId;
  try {
    const { page = 1, limit = 20, medicamentId, perime = 'false', inclureArchives } = req.query;

    const where = { tenantId };

    if (inclureArchives !== 'true') where.archive = false;
    if (medicamentId) where.medicamentId = medicamentId;

    if (perime === 'true') {
      where.datePeremption = { lt: new Date() };
    } else if (perime === 'proche') {
      const config = req.tenant.config;
      where.datePeremption = {
        lt: new Date(Date.now() + (config?.joursAlertePeremption || 90) * 24 * 60 * 60 * 1000),
        gt: new Date()
      };
    }

    const [lots, total] = await Promise.all([
      prisma.lotStock.findMany({
        where,
        include: {
          medicament: { select: { dci: true, nomCommercial: true, formeGalenique: true, dosage: true } },
          fournisseur: { select: { nom: true } },
          recuPar: { select: { nom: true, prenom: true } }
        },
        skip: (page - 1) * limit,
        take: parseInt(limit),
        orderBy: { datePeremption: 'asc' }
      }),
      prisma.lotStock.count({ where })
    ]);

    res.json({
      data: lots,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    log.error({ err: error, tenantId }, 'Get lots error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const ajustement = async (req, res) => {
  const tenantId = req.tenantId;
  const staffId = req.user.id;
  try {
    const { medicamentId, lotStockId, quantiteAjustee, note } = req.body;

    if (!medicamentId || quantiteAjustee === undefined) {
      return res.status(400).json({ error: 'medicamentId et quantiteAjustee requis' });
    }

    let resolvedLotId = lotStockId;

    if (!resolvedLotId) {
      // Pas de lot fourni : chercher le premier lot actif du médicament
      const existingLot = await prisma.lotStock.findFirst({
        where: { medicamentId, tenantId, quantiteRestante: { gt: 0 } },
        orderBy: { datePeremption: 'asc' }
      });

      if (existingLot) {
        resolvedLotId = existingLot.id;
      } else {
        // Aucun lot actif → créer un lot générique pour permettre l'ajustement
        const medicament = await prisma.medicament.findFirst({ where: { id: medicamentId, tenantId } });
        if (!medicament) return res.status(404).json({ error: 'Médicament non trouvé' });

        const newLot = await prisma.lotStock.create({
          data: {
            tenantId,
            medicamentId,
            numeroLot: `ADJ-${Date.now()}`,
            quantiteInitiale: 0,
            quantiteRestante: 0,
            prixAchatLot: medicament.prixAchat,
            datePeremption: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
            recuParId: staffId
          }
        });
        resolvedLotId = newLot.id;
      }
    }

    const lot = await prisma.lotStock.findFirst({
      where: { id: resolvedLotId, tenantId, medicamentId }
    });

    if (!lot) {
      return res.status(404).json({ error: 'Lot non trouvé' });
    }

    const difference = quantiteAjustee - lot.quantiteRestante;

    const result = await ajustementStock(
      tenantId,
      medicamentId,
      resolvedLotId,
      quantiteAjustee,
      difference,
      staffId,
      note
    );

    res.json(result);
  } catch (error) {
    captureError(error, {
      tenantId,
      tenantSlug: req.tenant?.slug,
      userId: staffId,
      action: 'ajustementStock'
    });
    log.error({ err: error, tenantId, staffId, body: req.body }, 'Adjustment error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getMouvements = async (req, res) => {
  const tenantId = req.tenantId;
  try {
    const { page = 1, limit = 20, medicamentId, type, dateDebut, dateFin } = req.query;

    const where = { tenantId };

    if (medicamentId) where.medicamentId = medicamentId;
    if (type) where.type = type;
    if (dateDebut || dateFin) {
      where.createdAt = {};
      if (dateDebut) where.createdAt.gte = new Date(dateDebut);
      if (dateFin) where.createdAt.lte = new Date(dateFin);
    }

    const [mouvements, total] = await Promise.all([
      prisma.mouvementStock.findMany({
        where,
        include: {
          medicament: { select: { dci: true, nomCommercial: true } },
          lotStock: { select: { numeroLot: true, datePeremption: true } },
          staff: { select: { nom: true, prenom: true } }
        },
        skip: (page - 1) * limit,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' }
      }),
      prisma.mouvementStock.count({ where })
    ]);

    res.json({
      data: mouvements,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    log.error({ err: error, tenantId }, 'Get movements error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getSuggestionsCommande = async (req, res) => {
  const tenantId = req.tenantId;
  try {
    let delaiLivraison = parseInt(req.query.delai) || 7;

    if (req.query.fournisseurId) {
      const fournisseur = await prisma.fournisseur.findUnique({
        where: { id: req.query.fournisseurId },
        select: { delaiLivraison: true }
      });
      if (fournisseur?.delaiLivraison) {
        delaiLivraison = fournisseur.delaiLivraison;
      }
    }

    const medicamentsAlerte = await prisma.$queryRaw`
      SELECT * FROM "Medicament"
      WHERE "tenantId" = ${tenantId}::text
        AND "actif" = true
        AND "stockTotal" <= "seuilAlerte"
    `;

    const suggestions = await Promise.all(
      medicamentsAlerte.map(med =>
        calculerQuantiteACommander(tenantId, med.id, delaiLivraison)
      )
    );

    res.json(suggestions.filter(s => s && s.quantiteACommander > 0));
  } catch (error) {
    log.error({ err: error, tenantId }, 'Get order suggestions error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const reception = async (req, res) => {
  const tenantId = req.tenantId;
  const staffId = req.user.id;
  try {
    const { commandeId } = req.params;
    const { dateReception, lignes } = req.body;

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
      prixAchatLot: l.prixAchatLot || l.prixUnitaire || commande.lignes.find(cl => cl.id === l.ligneId)?.prixUnitaire || 0,
      fournisseurId: commande.fournisseurId
    })).filter(l => l.quantiteRecue > 0);

    const { lotsCrees, mouvements } = await receptionCommande(
      tenantId,
      commandeId,
      lignesLot,
      staffId
    );

    for (const l of lignes) {
      await prisma.ligneCommandeF.update({
        where: { id: l.ligneId },
        data: { quantiteRecue: { increment: l.quantiteRecue } }
      });
    }

    const lignesCommande = await prisma.ligneCommandeF.findMany({
      where: { commandeId }
    });

    const totalDemandee = lignesCommande.reduce((sum, l) => sum + l.quantiteDemandee, 0);
    const totalRecue = lignesCommande.reduce((sum, l) => sum + l.quantiteRecue, 0);

    let nouveauStatut = 'partielle';
    if (totalRecue >= totalDemandee) nouveauStatut = 'recue';

    await prisma.commandeFournisseur.update({
      where: { id: commandeId },
      data: {
        statut: nouveauStatut,
        dateReception: new Date(dateReception),
        receivedById: staffId
      }
    });

    res.json({
      lotsCrees,
      mouvements,
      statut: nouveauStatut
    });
  } catch (error) {
    captureError(error, {
      tenantId,
      tenantSlug: req.tenant?.slug,
      userId: staffId,
      action: 'receptionCommande'
    });
    log.error({ err: error, tenantId, commandeId, staffId }, 'Reception error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getAlertes = async (req, res) => {
  const tenantId = req.tenantId;
  try {
    const ruptures = await prisma.$queryRaw`
      SELECT id, dci, "nomCommercial", "stockTotal", "seuilAlerte"
      FROM "Medicament"
      WHERE "tenantId" = ${tenantId}::text
        AND "actif" = true
        AND "stockTotal" <= "seuilAlerte"
    `;

    const tenantConfig = await prisma.tenantConfig.findUnique({
      where: { tenantId },
      select: { joursAlertePeremption: true }
    });
    const joursAlerte = tenantConfig?.joursAlertePeremption ?? 90;

    const dateLimite = new Date();
    dateLimite.setDate(dateLimite.getDate() + joursAlerte);
    const lotsProches = await prisma.lotStock.findMany({
      where: {
        tenantId,
        quantiteRestante: { gt: 0 },
        datePeremption: {
          gt: new Date(),
          lt: dateLimite
        }
      },
      include: {
        medicament: { select: { id: true, dci: true, nomCommercial: true } }
      },
      orderBy: { datePeremption: 'asc' }
    });

    const peremptions_proches = lotsProches.map(l => ({
      id: l.id,
      medicament: l.medicament,
      numeroLot: l.numeroLot,
      datePeremption: l.datePeremption,
      quantiteRestante: l.quantiteRestante
    }));

    res.json({ ruptures, peremptions_proches });
  } catch (error) {
    log.error({ err: error, tenantId }, 'Get alerts error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateLot = async (req, res) => {
  const tenantId = req.tenantId;
  try {
    const { id } = req.params;
    const { numeroLot, datePeremption, prixAchatLot } = req.body;

    const lot = await prisma.lotStock.findFirst({
      where: { id, tenantId }
    });

    if (!lot) {
      return res.status(404).json({ error: 'Lot non trouvé' });
    }

    const updateData = {};
    if (numeroLot !== undefined) updateData.numeroLot = numeroLot;
    if (datePeremption !== undefined) updateData.datePeremption = new Date(datePeremption);
    if (prixAchatLot !== undefined) updateData.prixAchatLot = parseFloat(prixAchatLot);

    const updatedLot = await prisma.lotStock.update({
      where: { id },
      data: updateData,
      include: {
        medicament: { select: { dci: true, nomCommercial: true } },
        fournisseur: { select: { nom: true } }
      }
    });

    res.json(updatedLot);
  } catch (error) {
    log.error({ err: error, tenantId, id }, 'Update lot error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteLot = async (req, res) => {
  const tenantId = req.tenantId;
  try {
    const { id } = req.params;

    const lot = await prisma.lotStock.findFirst({
      where: { id, tenantId },
      include: { medicament: true }
    });

    if (!lot) {
      return res.status(404).json({ error: 'Lot non trouvé' });
    }

    if (lot.quantiteRestante > 0) {
      return res.status(400).json({ error: 'Impossible de supprimer un lot avec du stock restant' });
    }

    await prisma.lotStock.delete({
      where: { id }
    });

    res.json({ message: 'Lot supprimé avec succès' });
  } catch (error) {
    log.error({ err: error, tenantId, id }, 'Delete lot error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const archiverLot = async (req, res) => {
  const tenantId = req.tenantId;
  try {
    const { id } = req.params;

    const lot = await prisma.lotStock.findFirst({
      where: { id, tenantId },
      include: { medicament: { select: { dci: true } } }
    });

    if (!lot) {
      return res.status(404).json({ success: false, message: 'Lot introuvable' });
    }

    if (lot.archive) {
      return res.status(400).json({ success: false, message: 'Ce lot est déjà archivé' });
    }

    const estPerime = lot.datePeremption < new Date();
    const estEpuise = lot.quantiteRestante === 0;

    if (!estPerime && !estEpuise) {
      return res.status(400).json({
        success: false,
        message: 'Impossible d\'archiver un lot encore actif et non épuisé'
      });
    }

    const lotArchive = await prisma.lotStock.update({
      where: { id },
      data: {
        archive: true,
        dateArchive: new Date(),
      }
    });

    if (estPerime && lot.quantiteRestante > 0) {
      await prisma.mouvementStock.create({
        data: {
          tenantId,
          medicamentId: lot.medicamentId,
          lotStockId: lot.id,
          type: 'peremption',
          quantite: lot.quantiteRestante,
          reference: `Archivage lot ${lot.numeroLot}`,
          staffId: req.user.id,
          note: 'Lot périmé mis au rebut',
        }
      });
    }

    log.info({
      lotId: id,
      numeroLot: lot.numeroLot,
      medicament: lot.medicament.dci,
      tenantId,
    }, 'Lot archivé');

    return res.json({
      success: true,
      message: `Lot ${lot.numeroLot} archivé avec succès`,
      data: lotArchive
    });
  } catch (err) {
    log.error({ err, tenantId }, 'Archive lot error');
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};
