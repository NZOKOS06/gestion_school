import { prisma } from '../utils/prisma.js';
import { createLogger } from '../utils/logger.js';
import { getAnneeOperationnelle } from '../utils/anneeScolaire.js';

const log = createLogger('PaieController');

const MOIS_LABELS = [
  '', 'Janvier', 'Fevrier', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Aout', 'Septembre', 'Octobre', 'Novembre', 'Decembre',
];

function serializeBulletin(b) {
  return {
    ...b,
    montantFixe: Number(b.montantFixe),
    heuresValidees: Number(b.heuresValidees),
    montantHoraire: Number(b.montantHoraire),
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

async function getMethodePaie(tenantId) {
  const cfg = await prisma.tenantConfig.findUnique({
    where: { tenantId },
    select: { methodePaie: true },
  });
  return cfg?.methodePaie || 'mensuel';
}

export const listPeriodes = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { anneeScolaireId } = req.query;
    const anneeId = anneeScolaireId || (await getAnneeOperationnelle(tenantId))?.id;
    if (!anneeId) return res.json({ data: [] });

    const periodes = await prisma.periodePaie.findMany({
      where: { tenantId, anneeScolaireId: anneeId },
      include: { _count: { select: { bulletins: true } } },
      orderBy: [{ anneeCivile: 'desc' }, { mois: 'desc' }],
    });

    res.json({ data: periodes });
  } catch (error) {
    log.error({ err: error }, 'listPeriodes');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getOrCreatePeriode = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { mois, anneeCivile, anneeScolaireId } = req.body;

    const m = parseInt(mois, 10);
    const y = parseInt(anneeCivile, 10);
    if (!m || m < 1 || m > 12 || !y) {
      return res.status(400).json({ error: 'mois (1-12) et anneeCivile requis' });
    }

    const anneeId = anneeScolaireId || (await getAnneeOperationnelle(tenantId))?.id;
    if (!anneeId) return res.status(400).json({ error: 'Aucune annee scolaire active' });

    const periode = await prisma.periodePaie.upsert({
      where: {
        tenantId_anneeScolaireId_mois_anneeCivile: {
          tenantId,
          anneeScolaireId: anneeId,
          mois: m,
          anneeCivile: y,
        },
      },
      create: {
        tenantId,
        anneeScolaireId: anneeId,
        mois: m,
        anneeCivile: y,
        statut: 'ouverte',
      },
      update: {},
    });

    res.json(periode);
  } catch (error) {
    log.error({ err: error }, 'getOrCreatePeriode');
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

    const methode = await getMethodePaie(tenantId);
    const start = new Date(periode.anneeCivile, periode.mois - 1, 1);
    const end = new Date(periode.anneeCivile, periode.mois, 0, 23, 59, 59);

    const staffList = await prisma.staff.findMany({
      where: {
        tenantId,
        actif: true,
        role: { in: ['enseignant', 'directeur', 'directeur_etudes', 'surveillant'] },
      },
      select: {
        id: true,
        nom: true,
        prenom: true,
        email: true,
        role: true,
        salaireMensuel: true,
        tauxHoraire: true,
      },
    });

    const bulletins = [];

    for (const s of staffList) {
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

      const montantTotal = montantFixe + montantHoraire;

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
          montantTotal,
          statut: 'brouillon',
          detailJson: {
            methode,
            tauxHoraire: taux,
            lignes: heures.map((h) => ({
              date: h.date,
              heureDebut: h.heureDebut,
              heureFin: h.heureFin,
              dureeHeures: Number(h.dureeHeures),
            })),
          },
        },
        update: {
          montantFixe,
          heuresValidees,
          montantHoraire,
          montantTotal,
          detailJson: {
            methode,
            tauxHoraire: taux,
            lignes: heures.map((h) => ({
              date: h.date,
              heureDebut: h.heureDebut,
              heureFin: h.heureFin,
              dureeHeures: Number(h.dureeHeures),
            })),
          },
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

    res.json({
      periodeId: periode.id,
      methode,
      moisLabel: MOIS_LABELS[periode.mois],
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

    const data = {};
    if (montantFixe != null) data.montantFixe = parseFloat(montantFixe);
    if (montantHoraire != null) data.montantHoraire = parseFloat(montantHoraire);
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
