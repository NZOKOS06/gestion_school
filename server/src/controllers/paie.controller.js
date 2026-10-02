import { prisma } from '../utils/prisma.js';
import { createLogger } from '../utils/logger.js';
import { logAudit } from '../utils/auditLogger.js';
import { getAnneeOperationnelle } from '../utils/anneeScolaire.js';
import {
  MOIS_LABELS,
  prochainePeriode,
  recapPointageStaff,
  calculerRetenue,
} from '../services/paie.service.js';
import { resoudreCategorieDepense } from '../services/finances.service.js';

const log = createLogger('PaieController');

const STATUTS_MODIFIABLES = ['ouverte', 'calculee'];

function serializeBulletin(b) {
  return {
    ...b,
    montantFixe: Number(b.montantFixe),
    heuresValidees: Number(b.heuresValidees),
    montantHoraire: Number(b.montantHoraire),
    montantRetenues: Number(b.montantRetenues || 0),
    montantTotal: Number(b.montantTotal),
    staff: b.staff ? {
      id: b.staff.id,
      nom: b.staff.nom,
      prenom: b.staff.prenom,
      email: b.staff.email,
      role: b.staff.role,
    } : undefined,
  };
}

export const listPeriodes = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { anneeScolaireId } = req.query;
    const anneeId = anneeScolaireId || (await getAnneeOperationnelle(tenantId))?.id;
    if (!anneeId) return res.json({ data: [] });

    const periodes = await prisma.periodePaie.findMany({
      where: { tenantId, anneeScolaireId: anneeId },
      include: {
        _count: { select: { bulletins: true } },
        ouvertePar: { select: { nom: true, prenom: true } },
      },
      orderBy: [{ anneeCivile: 'desc' }, { mois: 'desc' }],
    });

    res.json({ data: periodes });
  } catch (error) {
    log.error({ err: error }, 'listPeriodes');
    res.status(500).json({ error: 'Internal server error' });
  }
};

async function chargerConfigPaie(tenantId) {
  return prisma.tenantConfig.findUnique({
    where: { tenantId },
    select: {
      paieJour: true,
      paieRappelJours: true,
      methodePaie: true,
      pointageToleranceMinutes: true,
      heureDebut: true,
      heureFin: true,
      retenuesActives: true,
      retenueMode: true,
      retenueForfaitRetard: true,
      retenueForfaitAbsence: true,
      retenueAbsencesJustifiees: true,
      joursEcole: { select: { jour: true } },
    },
  });
}

/**
 * GET /api/paie/prochaine
 * Mois à ouvrir (le mois écoulé), date d'ouverture, compte à rebours, et périodes en cours.
 */
export const getProchaine = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const config = await chargerConfigPaie(tenantId);
    const prochaine = prochainePeriode(config || {});
    const [existante, enCours] = await Promise.all([
      prisma.periodePaie.findFirst({
        where: { tenantId, mois: prochaine.mois, anneeCivile: prochaine.anneeCivile },
        select: { id: true, statut: true, ouverteLe: true },
      }),
      // Périodes encore à traiter par la gestionnaire (jusqu'au décaissement)
      prisma.periodePaie.findMany({
        where: { tenantId, statut: { in: [...STATUTS_MODIFIABLES, 'validee'] } },
        select: { id: true, mois: true, anneeCivile: true, statut: true },
        orderBy: [{ anneeCivile: 'desc' }, { mois: 'desc' }],
      }),
    ]);
    res.json({
      ...prochaine,
      paieJour: config?.paieJour ?? 10,
      dejaOuverte: Boolean(existante),
      periodeExistante: existante,
      periodesEnCours: enCours.map((p) => ({ ...p, libelle: `${MOIS_LABELS[p.mois]} ${p.anneeCivile}` })),
    });
  } catch (error) {
    log.error({ err: error }, 'getProchaine');
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * POST /api/paie/periodes/ouvrir (directeur, secrétaire)
 * Ouvre la paie du mois écoulé, uniquement à partir du jour de paie.
 */
export const ouvrirPeriode = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const config = await chargerConfigPaie(tenantId);
    const prochaine = prochainePeriode(config || {});

    if (!prochaine.ouvrable) {
      const date = prochaine.dateOuverture.toLocaleDateString('fr-FR');
      return res.status(400).json({
        error: `La paie de ${prochaine.libelle} pourra être ouverte à partir du ${date} (dans ${prochaine.joursRestants} jour${prochaine.joursRestants > 1 ? 's' : ''}).`,
      });
    }

    const annee = await getAnneeOperationnelle(tenantId);
    if (!annee) return res.status(400).json({ error: 'Aucune année scolaire active' });

    const existante = await prisma.periodePaie.findFirst({
      where: { tenantId, mois: prochaine.mois, anneeCivile: prochaine.anneeCivile },
    });
    if (existante) {
      return res.status(409).json({ error: `La paie de ${prochaine.libelle} est déjà ouverte`, periode: existante });
    }

    const periode = await prisma.periodePaie.create({
      data: {
        tenantId,
        anneeScolaireId: annee.id,
        mois: prochaine.mois,
        anneeCivile: prochaine.anneeCivile,
        statut: 'ouverte',
        ouverteParId: req.user.id,
        ouverteLe: new Date(),
      },
    });

    await logAudit(req, 'paie_periode_ouverte', 'PeriodePaie', periode.id, { periode: prochaine.libelle });
    res.status(201).json(periode);
  } catch (error) {
    log.error({ err: error }, 'ouvrirPeriode');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const calculerPeriode = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { id } = req.params;

    const periode = await prisma.periodePaie.findFirst({
      where: { id, tenantId },
    });
    if (!periode) return res.status(404).json({ error: 'Periode non trouvee' });
    if (!STATUTS_MODIFIABLES.includes(periode.statut)) {
      return res.status(400).json({ error: 'Période validée : le calcul ne peut plus être modifié' });
    }

    const config = await chargerConfigPaie(tenantId);
    const methode = config?.methodePaie || 'mensuel';
    const joursEcole = (config?.joursEcole || []).map((j) => j.jour);
    const start = new Date(periode.anneeCivile, periode.mois - 1, 1);
    const end = new Date(periode.anneeCivile, periode.mois, 0, 23, 59, 59);

    // Tout le personnel actif de l'école (secrétariat et caisse compris)
    const staffList = await prisma.staff.findMany({
      where: {
        tenantId,
        actif: true,
        role: { not: 'super_admin' },
      },
      select: {
        id: true,
        nom: true,
        prenom: true,
        email: true,
        role: true,
        salaireMensuel: true,
        tauxHoraire: true,
        heureArriveePrevue: true,
        heureDepartPrevue: true,
      },
    });
    const dejaValides = new Set((await prisma.bulletinPaie.findMany({
      where: { tenantId, periodePaieId: periode.id, statut: { not: 'brouillon' } },
      select: { staffId: true },
    })).map((b) => b.staffId));

    const bulletins = [];

    for (const s of staffList) {
      // Bulletin déjà validé / décaissé : on n'y touche plus
      if (dejaValides.has(s.id)) continue;

      const heures = await prisma.heureEnseignee.findMany({
        where: {
          tenantId,
          enseignantId: s.id,
          validee: true,
          date: { gte: start, lte: end },
        },
      });

      const heuresValidees = heures.reduce((sum, h) => sum + Number(h.dureeHeures || 0), 0);
      const salaireFixe = Number(s.salaireMensuel || 0);
      const taux = Number(s.tauxHoraire || 0);

      let montantFixe = 0;
      let montantHoraire = 0;

      if (methode === 'mensuel') {
        montantFixe = salaireFixe;
      } else if (methode === 'horaire') {
        montantHoraire = Math.round(heuresValidees * taux);
      } else if (methode === 'mixte') {
        montantFixe = salaireFixe;
        montantHoraire = Math.round(heuresValidees * taux);
      }

      const brut = montantFixe + montantHoraire;

      // Retenues retards / absences (option école)
      let recapPointage = null;
      let retenue = null;
      if (config?.retenuesActives) {
        recapPointage = await recapPointageStaff(tenantId, s, {
          mois: periode.mois,
          anneeCivile: periode.anneeCivile,
          config,
          joursEcole,
        });
        retenue = calculerRetenue(recapPointage, {
          mode: config.retenueMode,
          montantFixe,
          brut,
          forfaitRetard: config.retenueForfaitRetard,
          forfaitAbsence: config.retenueForfaitAbsence,
          absencesJustifieesRetenues: config.retenueAbsencesJustifiees,
        });
      }
      const montantRetenues = retenue?.total || 0;
      const montantTotal = Math.max(0, brut - montantRetenues);
      const detailJson = {
        methode,
        tauxHoraire: taux,
        brut,
        recapPointage,
        retenue,
        lignes: heures.map((h) => ({
          date: h.date,
          heureDebut: h.heureDebut,
          heureFin: h.heureFin,
          dureeHeures: Number(h.dureeHeures),
        })),
      };

      const bulletin = await prisma.bulletinPaie.upsert({
        where: {
          periodePaieId_staffId: {
            periodePaieId: periode.id,
            staffId: s.id,
          },
        },
        create: {
          tenantId,
          periodePaieId: periode.id,
          staffId: s.id,
          montantFixe,
          heuresValidees,
          montantHoraire,
          montantRetenues,
          montantTotal,
          statut: 'brouillon',
          detailJson,
        },
        update: {
          montantFixe,
          heuresValidees,
          montantHoraire,
          montantRetenues,
          montantTotal,
          detailJson,
        },
        include: {
          staff: { select: { id: true, nom: true, prenom: true, email: true, role: true } },
        },
      });

      bulletins.push(serializeBulletin(bulletin));
    }

    await prisma.periodePaie.update({
      where: { id: periode.id },
      data: { statut: 'calculee' },
    });

    await logAudit(req, 'paie_periode_calculee', 'PeriodePaie', periode.id, {
      periode: `${MOIS_LABELS[periode.mois]} ${periode.anneeCivile}`,
      nbBulletins: bulletins.length,
      retenues: Boolean(config?.retenuesActives),
    });

    res.json({
      periodeId: periode.id,
      methode,
      moisLabel: MOIS_LABELS[periode.mois],
      retenuesActives: Boolean(config?.retenuesActives),
      data: bulletins,
    });
  } catch (error) {
    log.error({ err: error }, 'calculerPeriode');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const listBulletins = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { periodePaieId } = req.params;

    const bulletins = await prisma.bulletinPaie.findMany({
      where: { tenantId, periodePaieId },
      include: {
        staff: { select: { id: true, nom: true, prenom: true, email: true, role: true } },
        depense: { select: { id: true, montant: true, dateDepense: true } },
      },
      orderBy: [{ staff: { nom: 'asc' } }],
    });

    res.json({ data: bulletins.map(serializeBulletin) });
  } catch (error) {
    log.error({ err: error }, 'listBulletins');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateBulletin = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { id } = req.params;
    const { montantTotal, montantFixe, montantHoraire, commentaire } = req.body;

    const existing = await prisma.bulletinPaie.findFirst({ where: { id, tenantId } });
    if (!existing) return res.status(404).json({ error: 'Bulletin non trouve' });
    if (existing.statut !== 'brouillon') {
      return res.status(400).json({ error: 'Bulletin déjà validé : ajustement impossible' });
    }

    const data = {};
    if (montantFixe != null) data.montantFixe = parseFloat(montantFixe);
    if (montantHoraire != null) data.montantHoraire = parseFloat(montantHoraire);
    if (req.body.montantRetenues != null) data.montantRetenues = Math.max(0, parseFloat(req.body.montantRetenues) || 0);
    if (montantTotal != null) data.montantTotal = parseFloat(montantTotal);
    if (commentaire != null) {
      data.detailJson = { ...(existing.detailJson || {}), commentaire };
    }

    const updated = await prisma.bulletinPaie.update({
      where: { id },
      data,
      include: {
        staff: { select: { id: true, nom: true, prenom: true, email: true, role: true } },
      },
    });

    res.json(serializeBulletin(updated));
  } catch (error) {
    log.error({ err: error }, 'updateBulletin');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const validerBulletin = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { id } = req.params;

    const bulletin = await prisma.bulletinPaie.findFirst({
      where: { id, tenantId },
      include: {
        staff: true,
        periodePaie: true,
      },
    });
    if (!bulletin) return res.status(404).json({ error: 'Bulletin non trouve' });
    if (bulletin.statut === 'paye') {
      return res.status(400).json({ error: 'Bulletin deja paye' });
    }

    const moisLabel = MOIS_LABELS[bulletin.periodePaie.mois] || bulletin.periodePaie.mois;
    const motif = `Salaires — ${moisLabel} ${bulletin.periodePaie.anneeCivile} — ${bulletin.staff.prenom} ${bulletin.staff.nom}`;

    let depenseId = bulletin.depenseId;
    if (!depenseId && Number(bulletin.montantTotal) > 0) {
      const depense = await prisma.depense.create({
        data: {
          tenantId,
          anneeScolaireId: bulletin.periodePaie.anneeScolaireId,
          categorie: 'Salaires',
          categorieId: (await resoudreCategorieDepense(tenantId, { categorie: 'Salaires' })).id,
          montant: bulletin.montantTotal,
          motif,
          dateDepense: new Date(),
          saisieParId: req.user.id,
        },
      });
      depenseId = depense.id;
    }

    const updated = await prisma.bulletinPaie.update({
      where: { id },
      data: { statut: 'valide', depenseId },
      include: {
        staff: { select: { id: true, nom: true, prenom: true, email: true, role: true } },
        depense: true,
      },
    });

    res.json(serializeBulletin(updated));
  } catch (error) {
    log.error({ err: error }, 'validerBulletin');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const validerPeriode = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { id } = req.params;

    const periode = await prisma.periodePaie.findFirst({ where: { id, tenantId } });
    if (!periode) return res.status(404).json({ error: 'Periode non trouvee' });
    if (periode.statut !== 'calculee') {
      return res.status(400).json({ error: 'Calculez la période avant de la valider' });
    }

    const bulletins = await prisma.bulletinPaie.findMany({
      where: { periodePaieId: id, tenantId, statut: 'brouillon' },
      include: { staff: true, periodePaie: true },
    });

    const moisLabel = (m) => MOIS_LABELS[m] || m;

    for (const bulletin of bulletins) {
      if (Number(bulletin.montantTotal) <= 0) {
        await prisma.bulletinPaie.update({
          where: { id: bulletin.id },
          data: { statut: 'valide' },
        });
        continue;
      }
      const motif = `Salaires — ${moisLabel(bulletin.periodePaie.mois)} ${bulletin.periodePaie.anneeCivile} — ${bulletin.staff.prenom} ${bulletin.staff.nom}`;
      const depense = await prisma.depense.create({
        data: {
          tenantId,
          anneeScolaireId: bulletin.periodePaie.anneeScolaireId,
          categorie: 'Salaires',
          categorieId: (await resoudreCategorieDepense(tenantId, { categorie: 'Salaires' })).id,
          montant: bulletin.montantTotal,
          motif,
          dateDepense: new Date(),
          saisieParId: req.user.id,
        },
      });
      await prisma.bulletinPaie.update({
        where: { id: bulletin.id },
        data: { statut: 'valide', depenseId: depense.id },
      });
    }

    await prisma.periodePaie.update({
      where: { id },
      data: { statut: 'validee' },
    });

    res.json({ message: 'Periode validee' });
  } catch (error) {
    log.error({ err: error }, 'validerPeriode');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const marquerPayee = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { id } = req.params;

    const periode = await prisma.periodePaie.findFirst({ where: { id, tenantId } });
    if (!periode) return res.status(404).json({ error: 'Periode non trouvee' });

    await prisma.bulletinPaie.updateMany({
      where: { periodePaieId: id, tenantId },
      data: { statut: 'paye' },
    });

    await prisma.periodePaie.update({
      where: { id },
      data: { statut: 'payee' },
    });

    res.json({ message: 'Periode marquee payee' });
  } catch (error) {
    log.error({ err: error }, 'marquerPayee');
    res.status(500).json({ error: 'Internal server error' });
  }
};
