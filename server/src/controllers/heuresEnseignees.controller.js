import { prisma } from '../utils/prisma.js';
import { createLogger } from '../utils/logger.js';
import { formatHHMM } from '../utils/pointageHelpers.js';

const log = createLogger('HeuresEnseigneesController');

function serializeHeure(h) {
  return {
    ...h,
    dureeHeures: h.dureeHeures != null ? Number(h.dureeHeures) : 0,
    enseignant: h.enseignant ? {
      id: h.enseignant.id,
      nom: h.enseignant.nom,
      prenom: h.enseignant.prenom,
    } : undefined,
    classe: h.classe ? { id: h.classe.id, nom: h.classe.nom } : undefined,
    matiere: h.matiere ? { id: h.matiere.id, nom: h.matiere.nom } : undefined,
  };
}

export const getAll = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { validee, enseignantId, mois, annee } = req.query;

    const where = { tenantId };
    if (validee === 'true' || validee === 'false') where.validee = validee === 'true';
    if (enseignantId) where.enseignantId = enseignantId;
    if (mois && annee) {
      const m = parseInt(mois, 10);
      const y = parseInt(annee, 10);
      const start = new Date(y, m - 1, 1);
      const end = new Date(y, m, 0, 23, 59, 59);
      where.date = { gte: start, lte: end };
    }

    const rows = await prisma.heureEnseignee.findMany({
      where,
      include: {
        enseignant: { select: { id: true, nom: true, prenom: true, tauxHoraire: true } },
        classe: { select: { id: true, nom: true } },
        matiere: { select: { id: true, nom: true, code: true } },
        pointageSession: { select: { id: true, statut: true, commentaire: true } },
      },
      orderBy: [{ date: 'desc' }, { heureDebut: 'asc' }],
      take: 500,
    });

    res.json({ data: rows.map(serializeHeure) });
  } catch (error) {
    log.error({ err: error }, 'getAll heuresEnseignees');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const valider = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;

    const existing = await prisma.heureEnseignee.findFirst({ where: { id, tenantId } });
    if (!existing) return res.status(404).json({ error: 'Heure non trouvee' });

    const updated = await prisma.heureEnseignee.update({
      where: { id },
      data: { validee: true },
      include: {
        enseignant: { select: { id: true, nom: true, prenom: true } },
        classe: { select: { id: true, nom: true } },
        matiere: { select: { id: true, nom: true, code: true } },
      },
    });

    res.json(serializeHeure(updated));
  } catch (error) {
    log.error({ err: error }, 'valider heure');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const validerLot = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { ids } = req.body;
    if (!Array.isArray(ids) || !ids.length) {
      return res.status(400).json({ error: 'ids requis' });
    }

    await prisma.heureEnseignee.updateMany({
      where: { tenantId, id: { in: ids } },
      data: { validee: true },
    });

    res.json({ message: `${ids.length} heure(s) validee(s)` });
  } catch (error) {
    log.error({ err: error }, 'validerLot');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const rejeter = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;

    const existing = await prisma.heureEnseignee.findFirst({ where: { id, tenantId } });
    if (!existing) return res.status(404).json({ error: 'Heure non trouvee' });

    await prisma.heureEnseignee.update({
      where: { id },
      data: { validee: false },
    });

    res.json({ message: 'Heure rejetee' });
  } catch (error) {
    log.error({ err: error }, 'rejeter heure');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const ajuster = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;
    const { dureeHeures, heureDebut, heureFin } = req.body;

    const existing = await prisma.heureEnseignee.findFirst({ where: { id, tenantId } });
    if (!existing) return res.status(404).json({ error: 'Heure non trouvee' });

    const data = {};
    if (dureeHeures != null) data.dureeHeures = parseFloat(dureeHeures);
    if (heureDebut) data.heureDebut = heureDebut;
    if (heureFin) data.heureFin = heureFin;

    const updated = await prisma.heureEnseignee.update({
      where: { id },
      data,
      include: {
        enseignant: { select: { id: true, nom: true, prenom: true } },
        classe: { select: { id: true, nom: true } },
        matiere: { select: { id: true, nom: true, code: true } },
      },
    });

    res.json(serializeHeure(updated));
  } catch (error) {
    log.error({ err: error }, 'ajuster heure');
    res.status(500).json({ error: 'Internal server error' });
  }
};
