import { prisma } from '../utils/prisma.js';

/** Cycles où l'enseignant est titulaire de sa classe et couvre toutes les matières. */
export const CYCLES_TITULAIRE = ['prescolaire', 'primaire'];

const nomComplet = (s) => `${s?.prenom || ''} ${s?.nom || ''}`.trim() || 'Cet enseignant';

/**
 * Applique les règles d'affectation enseignant ↔ classe ↔ matière :
 *  - collège / lycée : une seule matière, mais autant de classes que nécessaire ;
 *  - préscolaire / primaire : titulaire d'une seule classe, toutes matières ;
 *  - une classe retirée par la direction est définitivement fermée à cet enseignant.
 *
 * Retourne soit { error, status }, soit le verdict d'acceptation avec les
 * affectations à libérer (réaffectation d'un titulaire).
 */
export const evaluerAffectation = async (tenantId, { enseignantId, classeId, matiereId }) => {
  const [enseignant, classe] = await Promise.all([
    prisma.staff.findFirst({
      where: { id: enseignantId, tenantId, role: 'enseignant' },
      select: { id: true, nom: true, prenom: true },
    }),
    prisma.classe.findFirst({
      where: { id: classeId, tenantId },
      select: { id: true, nom: true, cycle: true },
    }),
  ]);

  if (!enseignant) return { status: 404, error: 'Enseignant non trouvé' };
  if (!classe) return { status: 404, error: 'Classe non trouvée' };

  const quittee = await prisma.enseignantClasseQuittee.findFirst({
    where: { tenantId, enseignantId, classeId },
  });
  if (quittee) {
    return {
      status: 409,
      error: `${nomComplet(enseignant)} a déjà été retiré de la classe ${classe.nom} : le retour dans cette classe n'est plus autorisé.`,
    };
  }

  const affectations = await prisma.enseignantClasse.findMany({
    where: { tenantId, enseignantId },
    include: {
      classe: { select: { id: true, nom: true, cycle: true } },
      matiere: { select: { id: true, nom: true } },
    },
  });

  const estTitulaire =
    CYCLES_TITULAIRE.includes(classe.cycle) ||
    affectations.some((a) => CYCLES_TITULAIRE.includes(a.classe.cycle));

  const aLiberer = affectations.filter((a) => a.classeId !== classeId);

  if (estTitulaire) {
    // Titulaire : une seule classe à la fois, les précédentes sont fermées.
    return {
      mode: 'titulaire',
      classe,
      enseignant,
      affectationsALiberer: aLiberer,
      classesALiberer: [...new Map(aLiberer.map((a) => [a.classeId, a.classe])).values()],
    };
  }

  const autreMatiere = affectations.find((a) => a.matiereId !== matiereId);
  if (autreMatiere) {
    return {
      status: 409,
      error: `${nomComplet(enseignant)} enseigne déjà ${autreMatiere.matiere?.nom} : un enseignant du collège ou du lycée ne peut porter qu'une seule matière.`,
    };
  }

  return {
    mode: 'specialiste',
    classe,
    enseignant,
    affectationsALiberer: [],
    classesALiberer: [],
  };
};

/**
 * Retire l'enseignant de ses classes précédentes (affectations + créneaux) et
 * ferme définitivement le retour dans celles-ci.
 */
export const libererClassesPrecedentes = async (tenantId, enseignantId, affectations, motif) => {
  if (!affectations.length) return { affectationsSupprimees: 0, creneauxSupprimes: 0 };

  const classeIds = [...new Set(affectations.map((a) => a.classeId))];

  const affectationsSupprimees = await prisma.enseignantClasse.deleteMany({
    where: { tenantId, enseignantId, classeId: { in: classeIds } },
  });

  const creneauxSupprimes = await prisma.emploiDuTemps.deleteMany({
    where: { tenantId, enseignantId, classeId: { in: classeIds } },
  });

  for (const classeId of classeIds) {
    await prisma.enseignantClasseQuittee.upsert({
      where: { enseignantId_classeId: { enseignantId, classeId } },
      create: { tenantId, enseignantId, classeId, motif },
      update: { motif, dateSortie: new Date() },
    });
  }

  return {
    affectationsSupprimees: affectationsSupprimees.count,
    creneauxSupprimes: creneauxSupprimes.count,
    classeIds,
  };
};
