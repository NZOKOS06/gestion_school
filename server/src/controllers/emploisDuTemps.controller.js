import { prisma } from '../utils/prisma.js';
import { createLogger } from '../utils/logger.js';
import { logAudit } from '../utils/auditLogger.js';
import { parsePlage, toMinutes, overlaps } from '../utils/horaires.js';

const log = createLogger('EmploisDuTempsController');

const JOURS = ['', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];

/**
 * Règles de conflit (même jour + chevauchement à la minute près) :
 * - une classe ne peut pas avoir deux cours en même temps ;
 * - un enseignant ne peut pas être dans deux cours en même temps (même classe ou non,
 *   même matière ou non) ;
 * - une salle ne peut pas accueillir deux cours en même temps.
 * Les mêmes horaires un autre jour ne sont jamais un conflit.
 * Retourne un message d'erreur ou null.
 */
async function findConflit(tenantId, { jourSemaine, debutMin, finMin, classeId, enseignantId, salleId, excludeId }) {
  const or = [{ classeId }, { enseignantId }];
  if (salleId) or.push({ salleId });

  const candidats = await prisma.emploiDuTemps.findMany({
    where: {
      tenantId,
      jourSemaine,
      OR: or,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    include: {
      classe: { select: { nom: true } },
      matiere: { select: { nom: true } },
      salleRef: { select: { nom: true } },
    },
  });

  const jour = JOURS[jourSemaine] || 'ce jour-là';
  for (const c of candidats) {
    const cDebut = toMinutes(c.heureDebut);
    const cFin = toMinutes(c.heureFin);
    if (cDebut === null || cFin === null || !overlaps(debutMin, finMin, cDebut, cFin)) continue;

    const plage = `${c.heureDebut} à ${c.heureFin}`;
    if (c.enseignantId === enseignantId) {
      return `Cet enseignant a déjà cours (${c.matiere?.nom || 'matière'}) en ${c.classe?.nom || 'une autre classe'} le ${jour} de ${plage}`;
    }
    if (c.classeId === classeId) {
      return `La classe a déjà un cours (${c.matiere?.nom || 'matière'}) le ${jour} de ${plage}`;
    }
    if (salleId && c.salleId === salleId) {
      return `La salle ${c.salleRef?.nom || ''} est déjà occupée par ${c.classe?.nom || 'une classe'} le ${jour} de ${plage}`;
    }
  }
  return null;
}

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

    const plage = parsePlage(heureDebut, heureFin);
    if (plage.error) {
      return res.status(400).json({ error: plage.error });
    }

    const jour = parseInt(jourSemaine, 10);
    if (!Number.isInteger(jour) || jour < 1 || jour > 7) {
      return res.status(400).json({ error: 'Jour de la semaine invalide' });
    }

    const conflit = await findConflit(tenantId, {
      jourSemaine: jour,
      debutMin: plage.debutMin,
      finMin: plage.finMin,
      classeId,
      enseignantId: resolvedEnseignantId,
      salleId: salleId || null,
    });
    if (conflit) {
      return res.status(409).json({ error: conflit });
    }

    const emploi = await prisma.emploiDuTemps.create({
      data: {
        tenantId,
        classeId,
        matiereId,
        enseignantId: resolvedEnseignantId,
        jourSemaine: jour,
        heureDebut: plage.debut,
        heureFin: plage.fin,
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
    const { jourSemaine, heureDebut, heureFin, salle, salleId, matiereId, enseignantId } = req.body;

    const existing = await prisma.emploiDuTemps.findFirst({ where: { id, tenantId } });
    if (!existing) {
      return res.status(404).json({ error: 'Cours non trouvé' });
    }

    // Valeurs finales (fusion payload + existant) pour revalider les conflits
    const jour = jourSemaine !== undefined ? parseInt(jourSemaine, 10) : existing.jourSemaine;
    if (!Number.isInteger(jour) || jour < 1 || jour > 7) {
      return res.status(400).json({ error: 'Jour de la semaine invalide' });
    }
    const plage = parsePlage(heureDebut ?? existing.heureDebut, heureFin ?? existing.heureFin);
    if (plage.error) {
      return res.status(400).json({ error: plage.error });
    }
    const finalEnseignantId = enseignantId || existing.enseignantId;
    const finalSalleId = salleId !== undefined ? (salleId || null) : existing.salleId;

    const conflit = await findConflit(tenantId, {
      jourSemaine: jour,
      debutMin: plage.debutMin,
      finMin: plage.finMin,
      classeId: existing.classeId,
      enseignantId: finalEnseignantId,
      salleId: finalSalleId,
      excludeId: id,
    });
    if (conflit) {
      return res.status(409).json({ error: conflit });
    }

    const data = {
      jourSemaine: jour,
      heureDebut: plage.debut,
      heureFin: plage.fin,
      enseignantId: finalEnseignantId,
      salleId: finalSalleId,
    };
    if (salle !== undefined) data.salle = salle || null;
    if (matiereId) data.matiereId = matiereId;

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
