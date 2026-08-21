import { prisma } from '../utils/prisma.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('CalendrierScolaireController');

const TYPE_LABELS = {
  rentree: 'Rentrée',
  vacances: 'Vacances',
  examen: 'Examen',
  jour_ferie: 'Jour férié',
  conseil_classe: 'Conseil de classe',
  evenement_scolaire: 'Événement',
  composition: 'Composition',
  reprise_cours: 'Reprise des cours',
};

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function formatFr(d) {
  return new Date(d).toLocaleDateString('fr-FR');
}

/**
 * Validate event dates against the school year window.
 * Returns { error, status } or { annee, dateDebut, dateFin }.
 */
export async function validerDatesEvenement({
  tenantId,
  anneeScolaireId,
  dateDebut,
  dateFin,
  type,
  allowRentree = false,
}) {
  if (!allowRentree && type === 'rentree') {
    return {
      error: 'La rentrée est générée automatiquement depuis la date de début de l\'année scolaire. Modifiez l\'année pour la déplacer.',
      status: 400,
    };
  }

  const annee = await prisma.anneeScolaire.findFirst({
    where: { id: anneeScolaireId, tenantId },
  });
  if (!annee) {
    return { error: 'Année scolaire introuvable', status: 404 };
  }

  const debut = startOfDay(dateDebut);
  const finAnnee = endOfDay(annee.dateFin);
  const debutAnnee = startOfDay(annee.dateDebut);

  if (debut < debutAnnee || debut > finAnnee) {
    return {
      error: `La date de début doit être comprise entre le ${formatFr(annee.dateDebut)} et le ${formatFr(annee.dateFin)} (année ${annee.libelle})`,
      status: 400,
    };
  }

  let fin = null;
  if (dateFin) {
    fin = startOfDay(dateFin);
    if (fin < debut) {
      return { error: 'La date de fin doit être postérieure ou égale à la date de début', status: 400 };
    }
    if (fin < debutAnnee || fin > finAnnee) {
      return {
        error: `La date de fin doit être comprise entre le ${formatFr(annee.dateDebut)} et le ${formatFr(annee.dateFin)} (année ${annee.libelle})`,
        status: 400,
      };
    }
  }

  return { annee, dateDebut: debut, dateFin: fin };
}

/** Sync or create the automatic "rentree" event for a school year. */
export async function syncEvenementRentree(tenantId, annee) {
  const titre = `Rentrée scolaire ${annee.libelle}`;
  const existing = await prisma.calendrierScolaire.findFirst({
    where: { tenantId, anneeScolaireId: annee.id, type: 'rentree' },
  });

  if (existing) {
    return prisma.calendrierScolaire.update({
      where: { id: existing.id },
      data: {
        titre,
        dateDebut: startOfDay(annee.dateDebut),
        dateFin: null,
        description: 'Événement généré automatiquement depuis la date de début de l\'année scolaire',
      },
    });
  }

  return prisma.calendrierScolaire.create({
    data: {
      tenantId,
      anneeScolaireId: annee.id,
      titre,
      type: 'rentree',
      dateDebut: startOfDay(annee.dateDebut),
      dateFin: null,
      description: 'Événement généré automatiquement depuis la date de début de l\'année scolaire',
    },
  });
}

export const getAll = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { anneeScolaireId, type, dateDebut, dateFin, sortBy = 'dateDebut', order = 'asc' } = req.query;

    const where = { tenantId };
    if (anneeScolaireId) where.anneeScolaireId = anneeScolaireId;
    if (type) where.type = type;
    if (dateDebut || dateFin) {
      where.dateDebut = {};
      if (dateDebut) where.dateDebut.gte = new Date(dateDebut);
      if (dateFin) where.dateDebut.lte = new Date(dateFin);
    }

    const orderBy = {};
    orderBy[sortBy] = order;

    const events = await prisma.calendrierScolaire.findMany({
      where,
      include: {
        anneeScolaire: { select: { id: true, libelle: true, dateDebut: true, dateFin: true } },
      },
      orderBy,
    });

    res.json({ data: events });
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId }, 'Get all calendrier error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getAlertes = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const jours = Math.max(1, parseInt(req.query.jours || '14', 10) || 14);
    const today = startOfDay(new Date());
    const horizon = new Date(today);
    horizon.setDate(horizon.getDate() + jours);
    horizon.setHours(23, 59, 59, 999);

    const typesAlerte = ['composition', 'examen', 'conseil_classe', 'reprise_cours', 'vacances'];

    const events = await prisma.calendrierScolaire.findMany({
      where: {
        tenantId,
        type: { in: typesAlerte },
        dateDebut: { gte: today, lte: horizon },
      },
      include: {
        anneeScolaire: { select: { id: true, libelle: true } },
      },
      orderBy: { dateDebut: 'asc' },
    });

    const data = events.map((ev) => {
      const joursRestants = Math.ceil((startOfDay(ev.dateDebut) - today) / (24 * 60 * 60 * 1000));
      const typeLabel = TYPE_LABELS[ev.type] || ev.type;
      const mois = new Date(ev.dateDebut).toLocaleDateString('fr-FR', { month: 'long' });
      return {
        id: ev.id,
        titre: ev.titre,
        type: ev.type,
        typeLabel,
        dateDebut: ev.dateDebut,
        dateFin: ev.dateFin,
        joursRestants,
        message: `${typeLabel} « ${ev.titre} » approche : le ${formatFr(ev.dateDebut)}${joursRestants > 0 ? ` (dans ${joursRestants} jour${joursRestants > 1 ? 's' : ''})` : ' (aujourd\'hui)'} — ${mois}`,
        anneeScolaire: ev.anneeScolaire,
      };
    });

    res.json({ data, jours });
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId }, 'Get alertes calendrier error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const create = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { titre, type, dateDebut, dateFin, description, anneeScolaireId, concerneCycles } = req.body;

    if (!titre || !type || !dateDebut || !anneeScolaireId) {
      return res.status(400).json({ error: 'Titre, type, dateDebut et anneeScolaireId requis' });
    }

    const check = await validerDatesEvenement({
      tenantId,
      anneeScolaireId,
      dateDebut,
      dateFin,
      type,
    });
    if (check.error) return res.status(check.status).json({ error: check.error });

    const event = await prisma.calendrierScolaire.create({
      data: {
        tenantId,
        anneeScolaireId,
        titre,
        type,
        dateDebut: check.dateDebut,
        dateFin: check.dateFin,
        description: description || null,
        concerneCycles: concerneCycles || null,
      },
    });

    res.status(201).json(event);
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId }, 'Create calendrier event error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const update = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;
    const { titre, type, dateDebut, dateFin, description, concerneCycles } = req.body;

    const existing = await prisma.calendrierScolaire.findFirst({ where: { id, tenantId } });
    if (!existing) {
      return res.status(404).json({ error: 'Événement non trouvé' });
    }

    if (existing.type === 'rentree') {
      return res.status(400).json({
        error: 'La rentrée ne peut pas être modifiée ici. Changez la date de début de l\'année scolaire.',
      });
    }

    const nextType = type !== undefined ? type : existing.type;
    const nextDebut = dateDebut !== undefined ? dateDebut : existing.dateDebut;
    const nextFin = dateFin !== undefined ? dateFin : existing.dateFin;

    const check = await validerDatesEvenement({
      tenantId,
      anneeScolaireId: existing.anneeScolaireId,
      dateDebut: nextDebut,
      dateFin: nextFin,
      type: nextType,
    });
    if (check.error) return res.status(check.status).json({ error: check.error });

    const data = {};
    if (titre !== undefined) data.titre = titre;
    if (type !== undefined) data.type = type;
    if (dateDebut !== undefined) data.dateDebut = check.dateDebut;
    if (dateFin !== undefined) data.dateFin = check.dateFin;
    if (description !== undefined) data.description = description;
    if (concerneCycles !== undefined) data.concerneCycles = concerneCycles;

    const event = await prisma.calendrierScolaire.update({ where: { id }, data });

    res.json(event);
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId, id: req.params.id }, 'Update calendrier event error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const remove = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;

    const existing = await prisma.calendrierScolaire.findFirst({ where: { id, tenantId } });
    if (!existing) {
      return res.status(404).json({ error: 'Événement non trouvé' });
    }

    if (existing.type === 'rentree') {
      return res.status(400).json({
        error: 'La rentrée ne peut pas être supprimée. Elle suit la date de début de l\'année scolaire.',
      });
    }

    await prisma.calendrierScolaire.delete({ where: { id } });

    res.json({ message: 'Événement supprimé' });
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId, id: req.params.id }, 'Delete calendrier event error');
    res.status(500).json({ error: 'Internal server error' });
  }
};
