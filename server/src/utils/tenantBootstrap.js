import { NIVEAUX_CG_ACTUEL, FILIERES_CG_ACTUEL, PERIODES_2025_2026 } from '../data/referentielCongo.js';
import { getTenantCyclesConfig, isCycleAllowed } from './tenantCycles.js';
import { createLogger } from './logger.js';

const log = createLogger('TenantBootstrap');

/**
 * Matières de base officielles du Congo avec codes et coefficients par défaut.
 */
export const MATIERES_BASE_CONGO = [
  { nom: 'Français', code: 'FR', coefficient: 3, description: 'Langue française, grammaire et expression écrite' },
  { nom: 'Mathématiques', code: 'MATH', coefficient: 4, description: 'Calcul, algèbre, géométrie et raisonnement' },
  { nom: 'Histoire-Géographie', code: 'HIST-GEO', coefficient: 2, description: 'Histoire générale et géographie du Congo et du monde' },
  { nom: 'Sciences de la Vie et de la Terre', code: 'SVT', coefficient: 2, description: 'Biologie, géologie et environnement' },
  { nom: 'Physique-Chimie', code: 'PHY', coefficient: 3, description: 'Sciences physiques et chimie' },
  { nom: 'Anglais', code: 'ANG', coefficient: 2, description: 'Langue vivante 1' },
  { nom: 'Éducation Civique et Morale', code: 'ECM', coefficient: 1, description: 'Citoyenneté et valeurs civiques' },
  { nom: 'Éducation Physique et Sportive', code: 'EPS', coefficient: 1, description: 'Activités sportives et motrices' },
  { nom: 'Philosophie', code: 'PHILO', coefficient: 3, description: 'Philosophie générale (terminales)' },
];

/**
 * Initialise le référentiel scolaire (programme national Congo),
 * les niveaux officiels, les filières, les matières de base et une année scolaire modèle
 * pour un établissement donné (idempotent).
 *
 * @param {string} tenantId - Identifiant du tenant
 * @param {import('@prisma/client').PrismaClient} prismaClient - Client Prisma (rawPrisma ou prisma)
 */
export async function bootstrapTenantReferentiel(tenantId, prismaClient) {
  try {
    if (!tenantId) return null;

    // 1. Version de référentiel actif (cg_actuel)
    let refActuel = await prismaClient.referentielVersion.findFirst({
      where: { tenantId, code: 'cg_actuel' },
    });

    if (!refActuel) {
      refActuel = await prismaClient.referentielVersion.create({
        data: {
          tenantId,
          code: 'cg_actuel',
          libelle: 'Programme Officiel Congo (actuel)',
          actif: true,
        },
      });
    }

    // Version réformée en ébauche (cg_reforme_2026)
    const refReforme = await prismaClient.referentielVersion.findFirst({
      where: { tenantId, code: 'cg_reforme_2026' },
    });
    if (!refReforme) {
      await prismaClient.referentielVersion.create({
        data: {
          tenantId,
          code: 'cg_reforme_2026',
          libelle: 'Réforme Curriculaire Congo 2026 (APC)',
          actif: false,
        },
      });
    }

    // 2. Niveaux officiels (16 niveaux : PS -> Tle)
    for (const n of NIVEAUX_CG_ACTUEL) {
      const existingNiveau = await prismaClient.niveauOfficiel.findFirst({
        where: {
          referentielVersionId: refActuel.id,
          code: n.code,
        },
      });

      if (!existingNiveau) {
        await prismaClient.niveauOfficiel.create({
          data: {
            tenantId,
            referentielVersionId: refActuel.id,
            code: n.code,
            libelle: n.libelle,
            cycle: n.cycle,
            ordre: n.ordre,
            ageIndicatif: n.ageIndicatif,
            typeExamenSortie: n.typeExamenSortie || null,
          },
        });
      }
    }

    // 3. Filières officielles (lycée)
    for (const f of FILIERES_CG_ACTUEL) {
      const existingFiliere = await prismaClient.filiereOfficielle.findFirst({
        where: {
          referentielVersionId: refActuel.id,
          code: f.code,
        },
      });

      if (!existingFiliere) {
        await prismaClient.filiereOfficielle.create({
          data: {
            tenantId,
            referentielVersionId: refActuel.id,
            code: f.code,
            libelle: f.libelle,
            cycle: f.cycle,
          },
        });
      }
    }

    // 4. Matières de base de l'école (si aucune matière n'existe)
    const existingMatieresCount = await prismaClient.matiere.count({ where: { tenantId } });
    if (existingMatieresCount === 0) {
      const tenantCycles = await getTenantCyclesConfig(tenantId, prismaClient);

      for (const m of MATIERES_BASE_CONGO) {
        // Filtrer les matières non pertinentes si l'école est primaire/maternelle uniquement
        const isPrimaireOnly = tenantCycles && !tenantCycles.includes('college') && !tenantCycles.includes('lycee');
        if (isPrimaireOnly && ['PHILO', 'PHY'].includes(m.code)) {
          continue; // Pas de philo ni physique en maternelle/primaire seul
        }

        await prismaClient.matiere.create({
          data: {
            tenantId,
            nom: m.nom,
            code: m.code,
            coefficient: m.coefficient,
            description: m.description,
            actif: true,
          },
        });
      }
    }

    // 5. Année scolaire par défaut (2025-2026) si aucune année n'existe
    const existingAnnee = await prismaClient.anneeScolaire.findFirst({ where: { tenantId } });
    if (!existingAnnee) {
      const tenantCycles = await getTenantCyclesConfig(tenantId, prismaClient);
      const isSecondaire = !tenantCycles || tenantCycles.includes('college') || tenantCycles.includes('lycee');
      const isPrimaire = !tenantCycles || tenantCycles.includes('primaire') || tenantCycles.includes('prescolaire');

      const nouvelleAnnee = await prismaClient.anneeScolaire.create({
        data: {
          tenantId,
          libelle: '2025-2026',
          dateDebut: new Date('2025-10-01'),
          dateFin: new Date('2026-07-15'),
          actif: true,
          statut: 'active',
          referentielVersionId: refActuel.id,
        },
      });

      // Synchroniser TenantConfig.anneeScolaireActiveId
      await prismaClient.tenantConfig.update({
        where: { tenantId },
        data: { anneeScolaireActiveId: nouvelleAnnee.id },
      });

      // Périodes scolaires adaptées aux cycles choisis
      await bootstrapPeriodesForAnnee(tenantId, nouvelleAnnee, prismaClient);
    }

    log.info({ tenantId }, 'Bootstrap tenant referentiel completed successfully');
    return { ok: true, referentielVersionId: refActuel.id };
  } catch (error) {
    log.error({ err: error, tenantId }, 'Failed to bootstrap tenant referentiel');
    return { ok: false, error: error.message };
  }
}

/**
 * Initialise les périodes scolaires officielles (Congolaises) pour une année donnée
 * si aucune période n'existe encore. S'adapte aux cycles autorisés de l'établissement
 * et ajuste les dates au millésime de l'année scolaire.
 *
 * @param {string} tenantId
 * @param {object} annee - Instance AnneeScolaire (avec id, dateDebut, libelle)
 * @param {import('@prisma/client').PrismaClient} prismaClient
 */
export async function bootstrapPeriodesForAnnee(tenantId, annee, prismaClient) {
  try {
    if (!tenantId || !annee?.id) return [];

    const existingCount = await prismaClient.periodeScolaire.count({
      where: { tenantId, anneeScolaireId: annee.id },
    });
    if (existingCount > 0) {
      return prismaClient.periodeScolaire.findMany({
        where: { tenantId, anneeScolaireId: annee.id },
        orderBy: { index: 'asc' },
      });
    }

    const tenantCycles = await getTenantCyclesConfig(tenantId, prismaClient);
    const isPrimaire = isCycleAllowed('prescolaire', tenantCycles) || isCycleAllowed('primaire', tenantCycles);
    const isSecondaire = isCycleAllowed('college', tenantCycles) || isCycleAllowed('lycee', tenantCycles);

    // Année de départ pour le calcul du décalage (base 2025 pour PERIODES_2025_2026)
    const baseYear = 2025;
    const anneeYear = annee.dateDebut ? new Date(annee.dateDebut).getFullYear() : baseYear;
    const yearDiff = anneeYear - baseYear;

    const shiftDate = (dateStr) => {
      if (!dateStr) return null;
      const d = new Date(dateStr);
      d.setFullYear(d.getFullYear() + yearDiff);
      return d;
    };

    const periodesToCreate = [];
    for (const p of PERIODES_2025_2026) {
      const concernsSec = p.concerneCycles?.some((c) => ['college', 'lycee'].includes(c));
      const concernsPrim = p.concerneCycles?.some((c) => ['prescolaire', 'primaire'].includes(c));

      // N'inclure que si le cycle est proposé par l'école (si aucun cycle configuré, tout inclure)
      if (concernsSec && !isSecondaire && isPrimaire) continue;
      if (concernsPrim && !isPrimaire && isSecondaire && p.index >= 10) continue;

      periodesToCreate.push({
        tenantId,
        anneeScolaireId: annee.id,
        index: p.index,
        libelle: p.libelle,
        dateDebut: shiftDate(p.dateDebut),
        dateFin: shiftDate(p.dateFin),
        dateEvaluationDebut: shiftDate(p.dateEvaluationDebut),
        dateEvaluationFin: shiftDate(p.dateEvaluationFin),
        poids: p.poids || 1,
        concerneCycles: p.concerneCycles || null,
      });
    }

    for (const data of periodesToCreate) {
      await prismaClient.periodeScolaire.create({ data });
    }

    log.info({ tenantId, anneeId: annee.id, count: periodesToCreate.length }, 'Périodes scolaires auto-générées pour l\'année');
    return prismaClient.periodeScolaire.findMany({
      where: { tenantId, anneeScolaireId: annee.id },
      orderBy: { index: 'asc' },
    });
  } catch (err) {
    log.error({ err, tenantId, anneeId: annee?.id }, 'Erreur lors du bootstrap des périodes de l\'année');
    return [];
  }
}
