import { prisma } from '../utils/prisma.js';
import { createLogger } from '../utils/logger.js';
import { logAudit } from '../utils/auditLogger.js';

const log = createLogger('ClassesController');

export const getAll = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { page = 1, limit = 50, search, anneeScolaireId, sortBy = 'nom', order = 'asc' } = req.query;
    const take = parseInt(limit);
    const skip = (parseInt(page) - 1) * take;

    const where = {};
    if (search) {
      where.OR = [
        { nom: { contains: search, mode: 'insensitive' } },
        { niveau: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (anneeScolaireId) where.anneeScolaireId = anneeScolaireId;

    const orderBy = {};
    orderBy[sortBy] = order;

    const [rows, total] = await Promise.all([
      prisma.classe.findMany({
        where: { tenantId, ...where },
        include: {
          anneeScolaire: { select: { id: true, libelle: true, actif: true } },
          _count: {
            select: {
              inscriptions: { where: { statut: 'validee' } },
              enseignantClasses: true,
              emploisDuTemps: true,
            },
          },
        },
        skip,
        take,
        orderBy,
      }),
      prisma.classe.count({ where: { tenantId, ...where } }),
    ]);

    res.json({
      data: rows.map(r => ({
        ...r,
        effectif: r._count.inscriptions,
        nbEnseignants: r._count.enseignantClasses,
      })),
      pagination: {
        page: parseInt(page),
        limit: take,
        total,
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId }, 'Get all classes error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getById = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;

    const classe = await prisma.classe.findFirst({
      where: { id, tenantId },
      include: {
        anneeScolaire: true,
        inscriptions: {
          where: { statut: 'validee' },
          include: {
            eleve: { select: { id: true, matricule: true, nom: true, prenom: true, sexe: true, photoUrl: true } },
          },
        },
        enseignantClasses: {
          include: {
            enseignant: { select: { id: true, nom: true, prenom: true } },
            matiere: { select: { id: true, nom: true, code: true, coefficient: true } },
          },
        },
        emploisDuTemps: {
          include: {
            matiere: { select: { nom: true, code: true } },
            enseignant: { select: { nom: true, prenom: true } },
          },
          orderBy: { jourSemaine: 'asc' },
        },
      },
    });

    if (!classe) {
      return res.status(404).json({ error: 'Classe non trouvée' });
    }

    res.json(classe);
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId, id: req.params.id }, 'Get classe by ID error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const create = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { nom, niveau, anneeScolaireId, filiere, capacite, fraisScolarite } = req.body;

    const classe = await prisma.classe.create({
      data: {
        tenantId,
        nom,
        niveau,
        anneeScolaireId,
        filiere: filiere || null,
        capacite: capacite || null,
        fraisScolarite: fraisScolarite ? parseFloat(fraisScolarite) : null,
      },
    });

    await logAudit(req, 'classe_created', 'Classe', classe.id, { nom, niveau });

    res.status(201).json(classe);
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId }, 'Create classe error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const update = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;
    const { nom, niveau, filiere, capacite, fraisScolarite, actif } = req.body;

    const existing = await prisma.classe.findFirst({ where: { id, tenantId } });
    if (!existing) {
      return res.status(404).json({ error: 'Classe non trouvée' });
    }

    const data = {};
    if (nom !== undefined) data.nom = nom;
    if (niveau !== undefined) data.niveau = niveau;
    if (filiere !== undefined) data.filiere = filiere;
    if (capacite !== undefined) data.capacite = capacite;
    if (fraisScolarite !== undefined) data.fraisScolarite = fraisScolarite ? parseFloat(fraisScolarite) : null;
    if (actif !== undefined) data.actif = actif;

    const classe = await prisma.classe.update({ where: { id }, data });

    await logAudit(req, 'classe_updated', 'Classe', classe.id, { nom });

    res.json(classe);
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId, id: req.params.id }, 'Update classe error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const remove = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;

    const existing = await prisma.classe.findFirst({ where: { id, tenantId } });
    if (!existing) {
      return res.status(404).json({ error: 'Classe non trouvée' });
    }

    await prisma.classe.update({ where: { id }, data: { actif: false } });

    await logAudit(req, 'classe_deleted', 'Classe', id, { nom: existing.nom });

    res.json({ message: 'Classe désactivée' });
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId, id: req.params.id }, 'Delete classe error');
    res.status(500).json({ error: 'Internal server error' });
  }
};
