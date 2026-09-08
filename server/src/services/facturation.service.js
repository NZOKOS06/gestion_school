import { prisma } from '../utils/prisma.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('FacturationService');

/**
 * Calcule les dates et libellés par défaut des tranches selon l'année scolaire et le nombre de tranches (1 à 10).
 */
export function calculerEcheancesTranches(dateDebut, dateFin, nbTranches = 3, montantTotal = 0) {
  const start = new Date(dateDebut || new Date());
  const end = new Date(dateFin || new Date(start.getTime() + 9 * 30 * 24 * 60 * 60 * 1000));
  const totalDuration = Math.max(1, end.getTime() - start.getTime());
  const interval = totalDuration / Math.max(1, nbTranches);

  const tranches = [];
  const trancheBase = Math.round((montantTotal / nbTranches) * 100) / 100;

  for (let i = 0; i < nbTranches; i++) {
    const dueDate = new Date(start.getTime() + i * interval);
    // Ajuster au 5 ou 10 du mois
    dueDate.setDate(5);

    const montant = i === nbTranches - 1
      ? Math.round((montantTotal - trancheBase * (nbTranches - 1)) * 100) / 100
      : trancheBase;

    tranches.push({
      libelle: `Tranche ${i + 1}`,
      dateEcheance: dueDate,
      montantAttendu: montant,
    });
  }

  return tranches;
}

/**
 * Prévisualisation du calcul de la facturation annuelle indexée.
 * Ne modifie rien en base de données.
 */
export async function previewFacturation({
  tenantId,
  anneeScolaireId,
  tauxIndexation = 0,
  nbTranches = 3,
}) {
  const annee = anneeScolaireId
    ? await prisma.anneeScolaire.findFirst({ where: { id: anneeScolaireId, tenantId } })
    : await prisma.anneeScolaire.findFirst({ where: { tenantId, actif: true } });

  if (!annee) {
    throw new Error('Année scolaire introuvable ou aucune année active.');
  }

  // Récupérer toutes les inscriptions validées de cette année
  const inscriptions = await prisma.inscription.findMany({
    where: {
      tenantId,
      anneeScolaireId: annee.id,
      statut: 'validee',
    },
    include: {
      classe: { select: { id: true, nom: true, niveau: true, cycle: true, fraisScolarite: true } },
      echeances: { select: { id: true, montantAttendu: true } },
    },
  });

  const indexRate = Number(tauxIndexation || 0) / 100;
  let totalElevesInscrits = inscriptions.length;
  let elevesDejaFactures = 0;
  let totalEstimeBase = 0;
  let totalEstimeIndexe = 0;

  const classesMap = new Map();

  for (const insc of inscriptions) {
    const dejaFacture = insc.echeances && insc.echeances.length > 0;
    if (dejaFacture) {
      elevesDejaFactures++;
    }

    const classe = insc.classe;
    const classeId = classe?.id || 'inconnue';
    const fraisBase = Number(classe?.fraisScolarite || 0);
    const fraisIndexe = Math.round(fraisBase * (1 + indexRate));

    if (!classesMap.has(classeId)) {
      classesMap.set(classeId, {
        classeId,
        classeNom: classe?.nom || 'Classe non assignée',
        cycle: classe?.cycle || '—',
        fraisBase,
        fraisIndexe,
        nbTotalInscrits: 0,
        nbAFacturer: 0,
        sousTotalPrevu: 0,
      });
    }

    const entry = classesMap.get(classeId);
    entry.nbTotalInscrits++;

    if (!dejaFacture) {
      entry.nbAFacturer++;
      entry.sousTotalPrevu += fraisIndexe;
      totalEstimeBase += fraisBase;
      totalEstimeIndexe += fraisIndexe;
    }
  }

  const elevesAFacturer = totalElevesInscrits - elevesDejaFactures;
  const tranchesExemple = calculerEcheancesTranches(
    annee.dateDebut,
    annee.dateFin,
    nbTranches,
    elevesAFacturer > 0 ? Math.round(totalEstimeIndexe / elevesAFacturer) : 0
  );

  return {
    anneeScolaire: {
      id: annee.id,
      libelle: annee.libelle,
      dateDebut: annee.dateDebut,
      dateFin: annee.dateFin,
    },
    tauxIndexation: Number(tauxIndexation || 0),
    nbTranches,
    statistiques: {
      totalElevesInscrits,
      elevesDejaFactures,
      elevesAFacturer,
      totalEstimeBase,
      totalEstimeIndexe,
      gainIndexation: totalEstimeIndexe - totalEstimeBase,
    },
    classesRepartition: Array.from(classesMap.values()),
    tranchesSimulationMoyenne: tranchesExemple,
  };
}

/**
 * Exécute la génération de la facturation annuelle indexée en masse.
 * Idempotente : ne facture que les élèves n'ayant pas encore d'échéances.
 */
export async function genererFacturation({
  tenantId,
  anneeScolaireId,
  tauxIndexation = 0,
  nbTranches = 3,
  declenchePar = 'direction',
}) {
  const annee = anneeScolaireId
    ? await prisma.anneeScolaire.findFirst({ where: { id: anneeScolaireId, tenantId } })
    : await prisma.anneeScolaire.findFirst({ where: { tenantId, actif: true } });

  if (!annee) {
    throw new Error('Année scolaire introuvable ou aucune année active.');
  }

  const indexRate = Number(tauxIndexation || 0) / 100;

  // Récupérer les inscriptions éligibles (sans échéances)
  const inscriptions = await prisma.inscription.findMany({
    where: {
      tenantId,
      anneeScolaireId: annee.id,
      statut: 'validee',
      echeances: { none: {} },
    },
    include: {
      classe: { select: { id: true, nom: true, fraisScolarite: true } },
    },
  });

  if (inscriptions.length === 0) {
    return {
      message: 'Aucun nouvel élève à facturer pour cette année scolaire (déjà tous facturés).',
      nbElevesFactures: 0,
      totalGenere: 0,
    };
  }

  return await prisma.$transaction(async (tx) => {
    let totalGenere = 0;
    const echeancesToInsert = [];
    const updatesSolde = [];

    for (const insc of inscriptions) {
      const fraisBase = Number(insc.classe?.fraisScolarite || 0);
      const fraisIndexe = Math.round(fraisBase * (1 + indexRate));

      const tranches = calculerEcheancesTranches(
        annee.dateDebut,
        annee.dateFin,
        nbTranches,
        fraisIndexe
      );

      for (const t of tranches) {
        echeancesToInsert.push({
          tenantId,
          inscriptionId: insc.id,
          libelle: t.libelle,
          montantAttendu: t.montantAttendu,
          dateEcheance: t.dateEcheance,
          montantPaye: 0,
          statut: 'en_attente',
        });
      }

      totalGenere += fraisIndexe;
      updatesSolde.push(
        tx.inscription.update({
          where: { id: insc.id },
          data: { soldeScolarite: fraisIndexe },
        })
      );
    }

    // 1. Insertion en masse des échéances
    if (echeancesToInsert.length > 0) {
      await tx.echeance.createMany({ data: echeancesToInsert });
    }

    // 2. Mise à jour des soldes de scolarité
    await Promise.all(updatesSolde);

    // 3. Enregistrement du Job de facturation pour audit
    const job = await tx.facturationJob.create({
      data: {
        tenantId,
        anneeScolaireId: annee.id,
        tauxIndexation,
        nbEleves: inscriptions.length,
        totalGenere,
        declenchePar,
        statut: 'genere',
      },
    });

    log.info(
      { tenantId, jobId: job.id, nbEleves: inscriptions.length, totalGenere },
      'Facturation annuelle indexée générée avec succès'
    );

    return {
      jobId: job.id,
      nbElevesFactures: inscriptions.length,
      totalGenere,
      tauxIndexation,
      nbTranches,
      anneeScolaire: annee.libelle,
    };
  });
}

/**
 * Récupère l'historique d'audit des générations de facturation.
 */
export async function getHistoriqueFacturation(tenantId) {
  return await prisma.facturationJob.findMany({
    where: { tenantId },
    include: {
      anneeScolaire: { select: { libelle: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}
