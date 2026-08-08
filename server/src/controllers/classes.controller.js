import { prisma } from '../utils/prisma.js';
import { createLogger } from '../utils/logger.js';
import { logAudit } from '../utils/auditLogger.js';

const log = createLogger('ClassesController');

export const getAll = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { page = 1, limit = 50, search, anneeScolaireId, cycle, sortBy = 'nom', order = 'asc' } = req.query;
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
    if (cycle) where.cycle = cycle;

    const orderBy = sortBy === 'nom'
      ? [{ niveauOfficiel: { ordre: 'asc' } }, { nom: 'asc' }]
      : { [sortBy]: order };

    const [rows, total] = await Promise.all([
      prisma.classe.findMany({
        where: { tenantId, ...where },
        include: {
          anneeScolaire: { select: { id: true, libelle: true, actif: true } },
          niveauOfficiel: { select: { id: true, code: true, libelle: true, cycle: true, ordre: true } },
          filiereOfficielle: { select: { id: true, code: true, libelle: true } },
          _count: {
            select: {
              inscriptions: { where: { statut: 'validee' } },
              enseignants: true,
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
        nbEnseignants: r._count.enseignants,
        nbAffectations: r._count.enseignants,
        nbMatieres: r._count.enseignants,
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
        enseignants: {
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
    const {
      nom, niveau, anneeScolaireId, filiere, capacite, fraisScolarite, cycle,
      niveauOfficielId, filiereOfficielleId,
    } = req.body;

    if (!nom || !anneeScolaireId) {
      return res.status(400).json({ error: 'nom et anneeScolaireId requis' });
    }

    let resolvedCycle = cycle || null;
    let resolvedNiveau = niveau || null;
    let resolvedFiliere = filiere || null;
    let niveauOfficiel = null;

    if (niveauOfficielId) {
      niveauOfficiel = await prisma.niveauOfficiel.findFirst({
        where: { id: niveauOfficielId, tenantId },
      });
      if (!niveauOfficiel) {
        return res.status(400).json({ error: 'Niveau officiel invalide' });
      }
      resolvedCycle = niveauOfficiel.cycle;
      resolvedNiveau = niveauOfficiel.code;
    }

    if (filiereOfficielleId) {
      const filiereOff = await prisma.filiereOfficielle.findFirst({
        where: { id: filiereOfficielleId, tenantId },
      });
      if (!filiereOff) {
        return res.status(400).json({ error: 'Filière officielle invalide' });
      }
      resolvedFiliere = filiereOff.libelle;
    }

    if (!resolvedCycle) {
      return res.status(400).json({ error: 'cycle requis (ou sélectionnez un niveau officiel)' });
    }
    if (!resolvedNiveau) {
      return res.status(400).json({ error: 'niveau requis' });
    }

    const annee = await prisma.anneeScolaire.findFirst({
      where: { id: anneeScolaireId, tenantId },
    });
    if (!annee) {
      return res.status(400).json({ error: 'Année scolaire invalide' });
    }

    const classe = await prisma.classe.create({
      data: {
        tenantId,
        nom,
        niveau: resolvedNiveau,
        cycle: resolvedCycle,
        anneeScolaireId,
        filiere: resolvedFiliere,
        niveauOfficielId: niveauOfficielId || null,
        filiereOfficielleId: filiereOfficielleId || null,
        capacite: capacite != null ? parseInt(capacite, 10) : 40,
        fraisScolarite: fraisScolarite != null ? parseFloat(fraisScolarite) : 0,
      },
      include: {
        niveauOfficiel: true,
        filiereOfficielle: true,
      },
    });

    await logAudit(req, 'classe_created', 'Classe', classe.id, { nom, niveau: resolvedNiveau, cycle: resolvedCycle });

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

export const getEleves = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;

    const classe = await prisma.classe.findFirst({ where: { id, tenantId } });
    if (!classe) return res.status(404).json({ error: 'Classe non trouvée' });

    if (req.user.role === 'enseignant') {
      const { assertEnseignantAssignedToClasse } = await import('../utils/ownership.js');
      const ok = await assertEnseignantAssignedToClasse(req, res, id);
      if (!ok) return;
    }

    const inscriptions = await prisma.inscription.findMany({
      where: { tenantId, classeId: id, statut: 'validee' },
      include: {
        eleve: {
          select: {
            id: true,
            matricule: true,
            prenom: true,
            nom: true,
            sexe: true,
            dateNaissance: true,
            actif: true,
          },
        },
      },
      orderBy: { eleve: { nom: 'asc' } },
    });

    res.json(
      inscriptions
        .filter((i) => i.eleve?.actif !== false)
        .map((i) => ({
          id: i.eleve.id,
          matricule: i.eleve.matricule,
          prenom: i.eleve.prenom,
          nom: i.eleve.nom,
          sexe: i.eleve.sexe,
          dateNaissance: i.eleve.dateNaissance,
        }))
    );
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId }, 'getEleves classe error');
    res.status(500).json({ error: 'Internal server error' });
  }
};
