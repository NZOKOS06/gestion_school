import { prisma } from '../utils/prisma.js';
import { createLogger } from '../utils/logger.js';
import { logAudit } from '../utils/auditLogger.js';

const log = createLogger('EmploisDuTempsController');

export const getAll = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { classeId, enseignantId, jourSemaine } = req.query;

    const where = { tenantId };
    if (classeId) where.classeId = classeId;
    if (enseignantId) where.enseignantId = enseignantId;
    if (jourSemaine) where.jourSemaine = parseInt(jourSemaine);

    const emplois = await prisma.emploiDuTemps.findMany({
      where,
      include: {
        classe: { select: { id: true, nom: true, niveau: true } },
        matiere: { select: { id: true, nom: true, code: true } },
        enseignant: { select: { id: true, nom: true, prenom: true } },
        salleRef: { select: { id: true, nom: true, batiment: true } },
      },
      orderBy: [{ jourSemaine: 'asc' }, { heureDebut: 'asc' }],
    });

    res.json({ data: emplois });
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId }, 'Get all emploisDuTemps error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const create = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { classeId, matiereId, enseignantId, jourSemaine, heureDebut, heureFin, salle, salleId } = req.body;

    if (!classeId || !matiereId) {
      return res.status(400).json({ error: 'classeId et matiereId requis' });
    }

    // Primaire / préscolaire : enseignant optionnel → affectation matière, sinon titulaire de classe
    let resolvedEnseignantId = enseignantId || null;
    if (!resolvedEnseignantId) {
      const exact = await prisma.enseignantClasse.findFirst({
        where: { tenantId, classeId, matiereId },
      });
      const anyForClasse = exact || await prisma.enseignantClasse.findFirst({
        where: { tenantId, classeId },
      });
      resolvedEnseignantId = anyForClasse?.enseignantId || null;
    }

    if (!resolvedEnseignantId) {
      return res.status(400).json({
        error: 'Aucun enseignant fourni ni assigné à cette classe — assignez un titulaire ou sélectionnez un enseignant',
      });
    }

    const conflit = await prisma.emploiDuTemps.findFirst({
      where: {
        tenantId,
        classeId,
        jourSemaine: parseInt(jourSemaine),
        OR: [
          { heureDebut: { lte: heureDebut }, heureFin: { gt: heureDebut } },
          { heureDebut: { lt: heureFin }, heureFin: { gte: heureFin } },
        ],
      },
    });

    if (conflit) {
      return res.status(409).json({ error: 'Conflit d\'horaire pour cette classe' });
    }

    // Un enseignant peut cumuler les classes le même jour, mais pas sur des horaires qui se chevauchent
    const conflitEnseignant = await prisma.emploiDuTemps.findFirst({
      where: {
        tenantId,
        enseignantId: resolvedEnseignantId,
        jourSemaine: parseInt(jourSemaine),
        heureDebut: { lt: heureFin },
        heureFin: { gt: heureDebut },
      },
      include: { classe: { select: { nom: true } } },
    });

    if (conflitEnseignant) {
      return res.status(409).json({
        error: `Cet enseignant a déjà cours en ${conflitEnseignant.classe?.nom || 'une autre classe'} de ${conflitEnseignant.heureDebut} à ${conflitEnseignant.heureFin} ce jour-là`,
      });
    }

    const emploi = await prisma.emploiDuTemps.create({
      data: {
        tenantId,
        classeId,
        matiereId,
        enseignantId: resolvedEnseignantId,
        jourSemaine: parseInt(jourSemaine),
        heureDebut,
        heureFin,
        salle: salle || null,
        salleId: salleId || null,
      },
    });

    await logAudit(req, 'emploi_du_temps_created', 'EmploiDuTemps', emploi.id, { classeId });

    res.status(201).json(emploi);
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId }, 'Create emploiDuTemps error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const update = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;
    const { jourSemaine, heureDebut, heureFin, salle, salleId, actif } = req.body;

    const existing = await prisma.emploiDuTemps.findFirst({ where: { id, tenantId } });
    if (!existing) {
      return res.status(404).json({ error: 'Cours non trouvé' });
    }

    const data = {};
    if (jourSemaine !== undefined) data.jourSemaine = parseInt(jourSemaine);
    if (heureDebut !== undefined) data.heureDebut = heureDebut;
    if (heureFin !== undefined) data.heureFin = heureFin;
    if (salle !== undefined) data.salle = salle;
    if (salleId !== undefined) data.salleId = salleId || null;
    if (actif !== undefined) data.actif = actif;

    const emploi = await prisma.emploiDuTemps.update({ where: { id }, data });

    await logAudit(req, 'emploi_du_temps_updated', 'EmploiDuTemps', emploi.id, {});

    res.json(emploi);
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId, id: req.params.id }, 'Update emploiDuTemps error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const remove = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;

    const existing = await prisma.emploiDuTemps.findFirst({ where: { id, tenantId } });
    if (!existing) {
      return res.status(404).json({ error: 'Cours non trouvé' });
    }

    await prisma.emploiDuTemps.delete({ where: { id } });

    await logAudit(req, 'emploi_du_temps_deleted', 'EmploiDuTemps', id, {});

    res.json({ message: 'Cours supprimé' });
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId, id: req.params.id }, 'Delete emploiDuTemps error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getEleves = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;

    const cours = await prisma.emploiDuTemps.findFirst({ where: { id, tenantId } });
    if (!cours) return res.status(404).json({ error: 'Cours non trouvé' });

    if (req.user.role === 'enseignant' && cours.enseignantId !== req.user.id) {
      return res.status(403).json({ error: 'Ce cours ne vous est pas assigné' });
    }

    const inscriptions = await prisma.inscription.findMany({
      where: { tenantId, classeId: cours.classeId, statut: 'validee' },
      include: {
        eleve: {
          select: { id: true, prenom: true, nom: true, matricule: true, actif: true },
        },
      },
      orderBy: { eleve: { nom: 'asc' } },
    });

    res.json(
      inscriptions
        .filter((i) => i.eleve?.actif !== false)
        .map((i) => ({
          id: i.eleve.id,
          prenom: i.eleve.prenom,
          nom: i.eleve.nom,
          matricule: i.eleve.matricule,
        }))
    );
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId }, 'getEleves EDT error');
    res.status(500).json({ error: 'Internal server error' });
  }
};
