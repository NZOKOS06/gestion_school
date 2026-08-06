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

    const emploi = await prisma.emploiDuTemps.create({
      data: {
        tenantId,
        classeId,
        matiereId,
        enseignantId,
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
