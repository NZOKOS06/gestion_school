import { prisma } from '../utils/prisma.js';
import { createLogger } from '../utils/logger.js';
import { logAudit } from '../utils/auditLogger.js';
import { emitPaiementEncaisse } from '../utils/schoolEvents.js';

const log = createLogger('PaiementsController');

export const getAll = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { page = 1, limit = 20, search, inscriptionId, typePaiement, modePaiement, dateDebut, dateFin, sortBy = 'datePaiement', order = 'desc' } = req.query;
    const take = parseInt(limit);
    const skip = (parseInt(page) - 1) * take;

    const where = { tenantId };
    if (inscriptionId) where.inscriptionId = inscriptionId;
    if (typePaiement) where.typePaiement = typePaiement;
    if (modePaiement) where.modePaiement = modePaiement;
    if (dateDebut || dateFin) {
      where.datePaiement = {};
      if (dateDebut) where.datePaiement.gte = new Date(dateDebut);
      if (dateFin) where.datePaiement.lte = new Date(dateFin);
    }
    if (search) {
      where.inscription = {
        eleve: {
          OR: [
            { matricule: { contains: search, mode: 'insensitive' } },
            { nom: { contains: search, mode: 'insensitive' } },
            { prenom: { contains: search, mode: 'insensitive' } },
          ],
        },
      };
    }

    const orderBy = {};
    orderBy[sortBy] = order;

    const [rows, total] = await Promise.all([
      prisma.paiement.findMany({
        where,
        include: {
          inscription: {
            select: {
              id: true,
              eleve: { select: { id: true, matricule: true, nom: true, prenom: true } },
              classe: { select: { id: true, nom: true } },
              anneeScolaire: { select: { id: true, libelle: true } },
            },
          },
          recuPar: { select: { id: true, nom: true, prenom: true } },
        },
        skip,
        take,
        orderBy,
      }),
      prisma.paiement.count({ where }),
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
    log.error({ err: error, tenantId: req.tenantId }, 'Get all paiements error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getById = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;

    const paiement = await prisma.paiement.findFirst({
      where: { id, tenantId },
      include: {
        inscription: {
          include: {
            eleve: { select: { id: true, matricule: true, nom: true, prenom: true } },
            classe: { select: { id: true, nom: true } },
            anneeScolaire: { select: { id: true, libelle: true } },
          },
        },
        recuPar: { select: { id: true, nom: true, prenom: true } },
      },
    });

    if (!paiement) {
      return res.status(404).json({ error: 'Paiement non trouvé' });
    }

    res.json(paiement);
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId, id: req.params.id }, 'Get paiement by ID error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const create = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { inscriptionId, montant, typePaiement, modePaiement, reference, motif } = req.body;

    const inscription = await prisma.inscription.findFirst({
      where: { id: inscriptionId, tenantId },
    });
    if (!inscription) {
      return res.status(404).json({ error: 'Inscription non trouvée' });
    }

    const lastPaiement = await prisma.paiement.findFirst({
      where: { tenantId },
      orderBy: { numeroRecu: 'desc' },
      select: { numeroRecu: true },
    });
    const numeroRecu = (lastPaiement?.numeroRecu || 0) + 1;

    const paiement = await prisma.paiement.create({
      data: {
        tenantId,
        inscriptionId,
        numeroRecu,
        montant: parseFloat(montant),
        typePaiement: typePaiement || 'scolarite',
        modePaiement,
        reference: reference || null,
        motif: motif || null,
        recuParId: req.user.id,
      },
      include: {
        inscription: {
          select: {
            eleve: { select: { matricule: true, nom: true, prenom: true } },
            classe: { select: { nom: true } },
          },
        },
      },
    });

    await logAudit(req, 'paiement_created', 'Paiement', paiement.id, {
      montant,
      modePaiement,
      inscriptionId,
    });

    emitPaiementEncaisse(req.tenant.slug, paiement);

    res.status(201).json(paiement);
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId }, 'Create paiement error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getRecu = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;

    const paiement = await prisma.paiement.findFirst({
      where: { id, tenantId },
      include: {
        inscription: {
          include: {
            eleve: { select: { matricule: true, nom: true, prenom: true } },
            classe: { select: { nom: true } },
            anneeScolaire: { select: { libelle: true } },
          },
        },
        recuPar: { select: { nom: true, prenom: true } },
      },
    });

    if (!paiement) {
      return res.status(404).json({ error: 'Paiement non trouvé' });
    }

    res.json({
      recu: {
        numeroRecu: paiement.numeroRecu,
        datePaiement: paiement.datePaiement,
        montant: paiement.montant,
        typePaiement: paiement.typePaiement,
        modePaiement: paiement.modePaiement,
        reference: paiement.reference,
        eleve: `${paiement.inscription.eleve.prenom} ${paiement.inscription.eleve.nom}`,
        matricule: paiement.inscription.eleve.matricule,
        classe: paiement.inscription.classe.nom,
        anneeScolaire: paiement.inscription.anneeScolaire.libelle,
        recuPar: paiement.recuPar ? `${paiement.recuPar.prenom} ${paiement.recuPar.nom}` : null,
      },
    });
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId, id: req.params.id }, 'Get recu error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const remove = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;

    const existing = await prisma.paiement.findFirst({ where: { id, tenantId } });
    if (!existing) {
      return res.status(404).json({ error: 'Paiement non trouvé' });
    }

    await prisma.paiement.delete({ where: { id } });

    await logAudit(req, 'paiement_deleted', 'Paiement', id, { montant: existing.montant });

    res.json({ message: 'Paiement supprimé' });
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId, id: req.params.id }, 'Delete paiement error');
    res.status(500).json({ error: 'Internal server error' });
  }
};
