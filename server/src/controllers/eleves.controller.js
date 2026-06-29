import { prisma } from '../utils/prisma.js';
import { createLogger } from '../utils/logger.js';
import { logAudit } from '../utils/auditLogger.js';

const log = createLogger('ElevesController');

export const getAll = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { page = 1, limit = 20, search, classeId, sortBy = 'nom', order = 'asc' } = req.query;
    const take = parseInt(limit);
    const skip = (parseInt(page) - 1) * take;

    const where = { tenantId, actif: true };
    if (search) {
      where.OR = [
        { matricule: { contains: search, mode: 'insensitive' } },
        { nom: { contains: search, mode: 'insensitive' } },
        { prenom: { contains: search, mode: 'insensitive' } },
      ];
    }

    const orderBy = {};
    orderBy[sortBy] = order;

    const [rows, total] = await Promise.all([
      prisma.eleve.findMany({
        where,
        include: {
          parent: { select: { id: true, nom: true, prenom: true, email: true, telephone: true } },
          inscriptions: {
            where: { anneeScolaire: { actif: true } },
            select: { id: true, statut: true, classe: { select: { id: true, nom: true, niveau: true } } },
            take: 1,
          },
        },
        skip,
        take,
        orderBy,
      }),
      prisma.eleve.count({ where }),
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
    log.error({ err: error, tenantId: req.tenantId }, 'Get all eleves error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getById = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;

    const eleve = await prisma.eleve.findFirst({
      where: { id, tenantId },
      include: {
        parent: { select: { id: true, nom: true, prenom: true, email: true, telephone: true } },
        inscriptions: {
          include: {
            classe: { select: { id: true, nom: true, niveau: true } },
            anneeScolaire: { select: { id: true, libelle: true } },
          },
        },
      },
    });

    if (!eleve) {
      return res.status(404).json({ error: 'Élève non trouvé' });
    }

    res.json(eleve);
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId, id: req.params.id }, 'Get eleve by ID error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const create = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { matricule, nom, prenom, dateNaissance, sexe, lieuNaissance, adresse, parentId, photoUrl } = req.body;

    const existing = await prisma.eleve.findFirst({
      where: { tenantId, matricule },
    });
    if (existing) {
      return res.status(409).json({ error: 'Ce matricule existe déjà' });
    }

    const eleve = await prisma.eleve.create({
      data: {
        tenantId,
        matricule,
        nom,
        prenom,
        dateNaissance: new Date(dateNaissance),
        sexe,
        lieuNaissance: lieuNaissance || null,
        adresse: adresse || null,
        parentId: parentId || null,
        photoUrl: photoUrl || null,
      },
    });

    await logAudit(req, 'eleve_created', 'Eleve', eleve.id, { matricule, nom, prenom });

    res.status(201).json(eleve);
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId }, 'Create eleve error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const update = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;
    const { nom, prenom, dateNaissance, sexe, lieuNaissance, adresse, parentId, photoUrl, actif } = req.body;

    const existing = await prisma.eleve.findFirst({ where: { id, tenantId } });
    if (!existing) {
      return res.status(404).json({ error: 'Élève non trouvé' });
    }

    const data = {};
    if (nom !== undefined) data.nom = nom;
    if (prenom !== undefined) data.prenom = prenom;
    if (dateNaissance !== undefined) data.dateNaissance = new Date(dateNaissance);
    if (sexe !== undefined) data.sexe = sexe;
    if (lieuNaissance !== undefined) data.lieuNaissance = lieuNaissance;
    if (adresse !== undefined) data.adresse = adresse;
    if (parentId !== undefined) data.parentId = parentId || null;
    if (photoUrl !== undefined) data.photoUrl = photoUrl;
    if (actif !== undefined) data.actif = actif;

    const eleve = await prisma.eleve.update({ where: { id }, data });

    await logAudit(req, 'eleve_updated', 'Eleve', eleve.id, { nom, prenom });

    res.json(eleve);
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId, id: req.params.id }, 'Update eleve error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const remove = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;

    const existing = await prisma.eleve.findFirst({ where: { id, tenantId } });
    if (!existing) {
      return res.status(404).json({ error: 'Élève non trouvé' });
    }

    await prisma.eleve.update({ where: { id }, data: { actif: false } });

    await logAudit(req, 'eleve_deleted', 'Eleve', id, { matricule: existing.matricule, nom: existing.nom });

    res.json({ message: 'Élève désactivé' });
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId, id: req.params.id }, 'Delete eleve error');
    res.status(500).json({ error: 'Internal server error' });
  }
};
