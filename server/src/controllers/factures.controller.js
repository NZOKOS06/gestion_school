import { prisma } from '../utils/prisma.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('FacturesController');

// ── Helpers ──────────────────────────────────────────────────────────────────

function calculerEcartQuantite(lignes) {
  return lignes.reduce((sum, l) => sum + (l.quantiteRecue - l.quantiteDemandee), 0);
}

function effectuerRapprochement(factureMontantTTC, commande) {
  const montantBC = Number(commande.montantTotal);
  const montantFacture = factureMontantTTC;
  const toleranceEcart = 0.01;

  const ecartMontant = montantFacture - montantBC;
  const ecartQuantite = calculerEcartQuantite(commande.lignes);

  let statutRapprochement = 'conforme';

  if (Math.abs(ecartMontant) > toleranceEcart) {
    statutRapprochement = 'ecart_prix';
  }
  if (ecartQuantite !== 0) {
    statutRapprochement = ecartQuantite < 0
      ? 'ecart_quantite'
      : statutRapprochement;
  }
  if (ecartMontant === 0 && ecartQuantite === 0) {
    statutRapprochement = 'conforme';
  }

  return { statutRapprochement, ecartMontant, ecartQuantite };
}

// ── Controllers ───────────────────────────────────────────────────────────────

export const createFacture = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const staffId = req.user.id;
    const {
      commandeId,
      numeroFacture,
      dateFacture,
      dateEcheance,
      montantHT,
      montantTVA = 0,
      montantTTC,
    } = req.body;

    if (!commandeId || !numeroFacture || !dateFacture || montantHT === undefined || montantTTC === undefined) {
      return res.status(400).json({ error: 'Champs obligatoires manquants : commandeId, numeroFacture, dateFacture, montantHT, montantTTC' });
    }

    const commande = await prisma.commandeFournisseur.findFirst({
      where: { id: commandeId, tenantId },
      include: { lignes: true },
    });

    if (!commande) {
      return res.status(404).json({ error: 'Commande fournisseur introuvable' });
    }

    const dateRetentionLegale = new Date();
    dateRetentionLegale.setFullYear(dateRetentionLegale.getFullYear() + 3);

    const { statutRapprochement, ecartMontant, ecartQuantite } =
      effectuerRapprochement(Number(montantTTC), commande);

    const facture = await prisma.factureFournisseur.create({
      data: {
        tenantId,
        commandeId,
        fournisseurId: commande.fournisseurId,
        numeroFacture,
        dateFacture: new Date(dateFacture),
        dateEcheance: dateEcheance ? new Date(dateEcheance) : null,
        montantHT: Number(montantHT),
        montantTVA: Number(montantTVA),
        montantTTC: Number(montantTTC),
        statut: 'recue',
        statutRapprochement,
        ecartMontant,
        ecartQuantite,
        dateRapprochement: new Date(),
        rapprocheParId: staffId,
        dateRetentionLegale,
        createdById: staffId,
      },
      include: {
        commande: { select: { id: true, numeroCommande: true, montantTotal: true } },
        fournisseur: { select: { id: true, nom: true } },
        createdBy: { select: { id: true, nom: true, prenom: true } },
      },
    });

    res.status(201).json({
      ...facture,
      rapprochement: { statutRapprochement, ecartMontant, ecartQuantite },
    });
  } catch (error) {
    log.error({ err: error }, 'createFacture error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getFactures = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { statut, commandeId, page = 1, limit = 15 } = req.query;

    const where = { tenantId };
    if (statut) where.statut = statut;
    if (commandeId) where.commandeId = commandeId;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [factures, total] = await Promise.all([
      prisma.factureFournisseur.findMany({
        where,
        include: {
          commande: { select: { id: true, numeroCommande: true, statut: true } },
          fournisseur: { select: { id: true, nom: true } },
          createdBy: { select: { id: true, nom: true, prenom: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.factureFournisseur.count({ where }),
    ]);

    res.json({
      data: factures,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    log.error({ err: error }, 'getFactures error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getFacture = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;

    const facture = await prisma.factureFournisseur.findFirst({
      where: { id, tenantId },
      include: {
        commande: {
          include: {
            lignes: {
              include: {
                medicament: { select: { id: true, dci: true, nomCommercial: true } },
              },
            },
          },
        },
        fournisseur: true,
        createdBy: { select: { id: true, nom: true, prenom: true } },
        rapprochePar: { select: { id: true, nom: true, prenom: true } },
        payePar: { select: { id: true, nom: true, prenom: true } },
      },
    });

    if (!facture) {
      return res.status(404).json({ error: 'Facture introuvable' });
    }

    res.json(facture);
  } catch (error) {
    log.error({ err: error }, 'getFacture error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateFactureStatut = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;
    const staffId = req.user.id;
    const {
      statut,
      noteRapprochement,
      modePaiement,
      referencePaiement,
      datePaiement,
    } = req.body;

    const statutsValides = ['validee', 'litige', 'payee'];
    if (!statut || !statutsValides.includes(statut)) {
      return res.status(400).json({ error: `Statut invalide. Valeurs acceptées : ${statutsValides.join(', ')}` });
    }

    if (statut === 'litige' && !noteRapprochement) {
      return res.status(400).json({ error: 'noteRapprochement obligatoire pour un litige (motif requis)' });
    }

    const facture = await prisma.factureFournisseur.findFirst({
      where: { id, tenantId },
    });

    if (!facture) {
      return res.status(404).json({ error: 'Facture introuvable' });
    }

    const data = { statut };

    if (noteRapprochement !== undefined) data.noteRapprochement = noteRapprochement;
    if (statut === 'litige') data.statutRapprochement = 'litige';

    if (statut === 'payee') {
      data.datePaiement = datePaiement ? new Date(datePaiement) : new Date();
      data.payeParId = staffId;
      if (modePaiement) data.modePaiement = modePaiement;
      if (referencePaiement) data.referencePaiement = referencePaiement;
    }

    const updated = await prisma.factureFournisseur.update({
      where: { id },
      data,
      include: {
        commande: { select: { id: true, numeroCommande: true } },
        fournisseur: { select: { id: true, nom: true } },
        payePar: { select: { id: true, nom: true, prenom: true } },
      },
    });

    res.json(updated);
  } catch (error) {
    log.error({ err: error }, 'updateFactureStatut error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const uploadDocumentFacture = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;

    if (!req.file) {
      return res.status(400).json({ error: 'Aucun fichier fourni' });
    }

    const facture = await prisma.factureFournisseur.findFirst({
      where: { id, tenantId },
    });

    if (!facture) {
      return res.status(404).json({ error: 'Facture introuvable' });
    }

    const updated = await prisma.factureFournisseur.update({
      where: { id },
      data: {
        documentUrl: req.file.path,
        documentNom: req.file.originalname,
      },
    });

    res.json({ documentUrl: updated.documentUrl, documentNom: updated.documentNom });
  } catch (error) {
    log.error({ err: error }, 'uploadDocumentFacture error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getTableauRapprochement = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { periode = '30j' } = req.query;

    const joursMatch = periode.match(/^(\d+)j$/);
    const jours = joursMatch ? parseInt(joursMatch[1]) : 30;
    const dateDebut = new Date();
    dateDebut.setDate(dateDebut.getDate() - jours);

    const factures = await prisma.factureFournisseur.findMany({
      where: {
        tenantId,
        createdAt: { gte: dateDebut },
      },
      include: {
        commande: { select: { montantTotal: true } },
      },
    });

    const total = factures.length;
    const conformes = factures.filter(f => f.statutRapprochement === 'conforme').length;
    const ecarts = factures.filter(f =>
      f.statutRapprochement === 'ecart_prix' || f.statutRapprochement === 'ecart_quantite'
    ).length;
    const litiges = factures.filter(f => f.statutRapprochement === 'litige' || f.statut === 'litige').length;
    const enAttente = factures.filter(f => f.statutRapprochement === 'en_attente').length;

    const montantTotalBC = factures.reduce((sum, f) => sum + Number(f.commande?.montantTotal ?? 0), 0);
    const montantTotalFacture = factures.reduce((sum, f) => sum + f.montantTTC, 0);
    const ecartGlobal = montantTotalFacture - montantTotalBC;

    res.json({
      periode: `${jours} jours`,
      total,
      conformes,
      ecarts,
      litiges,
      enAttente,
      montantTotalBC,
      montantTotalFacture,
      ecartGlobal,
    });
  } catch (error) {
    log.error({ err: error }, 'getTableauRapprochement error');
    res.status(500).json({ error: 'Internal server error' });
  }
};
