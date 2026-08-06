import { prisma } from './prisma.js';

/**
 * Ensure the authenticated parent owns the given eleve.
 * Returns the eleve or throws via Express response.
 */
export const assertParentOwnsEleve = async (req, res, eleveId) => {
  const eleve = await prisma.eleve.findFirst({
    where: {
      id: eleveId,
      tenantId: req.tenantId,
      parentId: req.user.id,
    },
  });

  if (!eleve) {
    res.status(403).json({ error: 'Accès refusé', message: 'Cet élève ne vous est pas rattaché.' });
    return null;
  }
  return eleve;
};

/**
 * True if enseignant is assigned to classe (any matiere) via EnseignantClasse.
 */
export const isEnseignantAssignedToClasse = async (tenantId, enseignantId, classeId) => {
  const row = await prisma.enseignantClasse.findFirst({
    where: { tenantId, enseignantId, classeId },
    select: { id: true },
  });
  return !!row;
};

export const assertEnseignantAssignedToClasse = async (req, res, classeId) => {
  if (req.user.role === 'directeur' || req.user.role === 'secretaire') {
    return true;
  }
  const ok = await isEnseignantAssignedToClasse(req.tenantId, req.user.id, classeId);
  if (!ok) {
    res.status(403).json({ error: 'Accès refusé', message: 'Classe non assignée.' });
    return false;
  }
  return true;
};

/**
 * Enseignant must be assigned to this classe+matiere pair.
 */
export const assertEnseignantAssignedToClasseMatiere = async (req, res, classeId, matiereId) => {
  if (req.user.role === 'directeur' || req.user.role === 'secretaire') {
    return true;
  }
  const row = await prisma.enseignantClasse.findFirst({
    where: {
      tenantId: req.tenantId,
      enseignantId: req.user.id,
      classeId,
      matiereId,
    },
    select: { id: true },
  });
  if (!row) {
    res.status(403).json({ error: 'Accès refusé', message: 'Matière/classe non assignée.' });
    return false;
  }
  return true;
};

export const getEnseignantAssignments = async (tenantId, enseignantId) => {
  return prisma.enseignantClasse.findMany({
    where: { tenantId, enseignantId },
    include: {
      classe: true,
      matiere: true,
    },
  });
};

/** JS getDay(): 0=Sun … 6=Sat → schema jourSemaine 1=Mon … 7=Sun */
export const todayJourSemaine = () => {
  const d = new Date().getDay();
  return d === 0 ? 7 : d;
};
