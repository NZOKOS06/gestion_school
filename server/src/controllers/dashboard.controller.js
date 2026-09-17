import { prisma } from '../utils/prisma.js';
import { createLogger } from '../utils/logger.js';
import { resolveAnneeScolaireId } from '../utils/anneeScolaire.js';

const log = createLogger('DashboardController');

export const getKpis = async (req, res) => {
  const tenantId = req.tenantId;
  try {
    const isEnseignantView = req.query.enseignant === 'true' || req.user?.role === 'enseignant';

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (isEnseignantView) {
      const [mesClasses, mesEvaluations, mesAbsencesAujourdhui] = await Promise.all([
        req.user?.id ? prisma.staff.findUnique({
          where: { id: req.user.id },
          select: {
            enseignantClasses: {
              select: {
                classe: {
                  select: {
                    id: true, nom: true, niveau: true,
                    _count: { select: { inscriptions: { where: { statut: 'validee' } } } }
                  }
                }
              }
            }
          }
        }).catch(() => null) : Promise.resolve(null),
        prisma.evaluation.count({
          where: { tenantId, dateEvaluation: { gte: today, lt: tomorrow } }
        }).catch(() => 0),
        prisma.absence.count({
          where: { tenantId, dateAbsence: { gte: today, lt: tomorrow } }
        }).catch(() => 0)
      ]);

      const classesFormatted = (mesClasses?.enseignantClasses || [])
        .filter(ec => ec && ec.classe)
        .map(ec => ({
          id: ec.classe.id,
          nom: ec.classe.nom,
          niveau: ec.classe.niveau,
          effectif: ec.classe._count?.inscriptions || 0
        }));

      return res.json({
        mes_classes: classesFormatted,
        evaluations_aujourdhui: mesEvaluations || 0,
        absences_aujourdhui: mesAbsencesAujourdhui || 0
      });
    }

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startOfNextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);

    let anneeActiveId = null;
    try {
      anneeActiveId = await resolveAnneeScolaireId(tenantId, req.query.anneeScolaireId || null);
    } catch (anneeErr) {
      log.warn({ err: anneeErr, tenantId }, 'resolveAnneeScolaireId failed in KPIs');
    }

    const inscriptionWhere = {
      tenantId,
      statut: 'validee',
      ...(anneeActiveId ? { anneeScolaireId: anneeActiveId } : {}),
    };

    const [
      totalEleves,
      totalClasses,
      paiementsToday,
      paiementsMonth,
      inscriptionsEnAttente,
      absencesToday,
      objectifMoisAgg,
      echeancesStats,
      inscriptionsParClasse,
      dernieresAbsencesRaw,
      derniersPaiementsRaw,
    ] = await Promise.all([
      prisma.inscription.count({ where: inscriptionWhere }).catch(() => 0),
      prisma.classe.count({
        where: {
          tenantId,
          ...(anneeActiveId ? { anneeScolaireId: anneeActiveId } : {}),
        },
      }).catch(() => 0),
      prisma.paiement.aggregate({
        where: {
          tenantId,
          datePaiement: { gte: today, lt: tomorrow },
          ...(anneeActiveId ? { inscription: { anneeScolaireId: anneeActiveId } } : {}),
        },
        _sum: { montant: true },
        _count: { id: true }
      }).catch(() => ({ _sum: { montant: 0 }, _count: { id: 0 } })),
      prisma.paiement.aggregate({
        where: {
          tenantId,
          datePaiement: { gte: startOfMonth },
          ...(anneeActiveId ? { inscription: { anneeScolaireId: anneeActiveId } } : {}),
        },
        _sum: { montant: true },
        _count: { id: true }
      }).catch(() => ({ _sum: { montant: 0 }, _count: { id: 0 } })),
      prisma.inscription.count({
        where: {
          tenantId,
          statut: 'en_attente',
          ...(anneeActiveId ? { anneeScolaireId: anneeActiveId } : {}),
        },
      }).catch(() => 0),
      prisma.absence.count({
        where: {
          tenantId,
          dateAbsence: { gte: today, lt: tomorrow },
          typeAbsence: 'absent',
          justifiee: false,
        },
      }).catch(() => 0),
      prisma.echeance.aggregate({
        where: {
          tenantId,
          dateEcheance: { gte: startOfMonth, lt: startOfNextMonth },
          ...(anneeActiveId ? { inscription: { anneeScolaireId: anneeActiveId } } : {}),
        },
        _sum: { montantAttendu: true },
      }).catch(() => ({ _sum: { montantAttendu: 0 } })),
      prisma.echeance.findMany({
        where: {
          tenantId,
          statut: { in: ['en_attente', 'en_retard'] },
          ...(anneeActiveId ? { inscription: { anneeScolaireId: anneeActiveId } } : {}),
        },
        select: { statut: true, montantAttendu: true, montantPaye: true, dateEcheance: true },
      }).catch(() => []),
      prisma.inscription.findMany({
        where: inscriptionWhere,
        select: { classe: { select: { cycle: true } } },
      }).catch(() => []),
      prisma.absence.findMany({
        where: { tenantId, justifiee: false, typeAbsence: 'absent' },
        orderBy: { dateAbsence: 'desc' },
        take: 5,
        include: {
          eleve: {
            select: {
              nom: true,
              prenom: true,
              inscriptions: {
                where: { statut: 'validee', ...(anneeActiveId ? { anneeScolaireId: anneeActiveId } : {}) },
                take: 1,
                select: { classe: { select: { nom: true } } },
              },
            },
          },
        },
      }).catch(() => []),
      prisma.paiement.findMany({
        where: {
          tenantId,
          ...(anneeActiveId ? { inscription: { anneeScolaireId: anneeActiveId } } : {}),
        },
        orderBy: { datePaiement: 'desc' },
        take: 5,
        include: {
          inscription: {
            select: {
              eleve: { select: { nom: true, prenom: true } },
            },
          },
        },
      }).catch(() => []),
    ]);

    const recettesMois = Number(paiementsMonth?._sum?.montant || 0);
    const objectifMois = Number(objectifMoisAgg?._sum?.montantAttendu || 0);
    const echeancesList = Array.isArray(echeancesStats) ? echeancesStats : [];
    const totalReste = echeancesList.reduce((s, e) => s + Math.max(0, Number(e?.montantAttendu || 0) - Number(e?.montantPaye || 0)), 0);
    const resteRetard = echeancesList
      .filter((e) => e?.statut === 'en_retard' || (e?.dateEcheance && new Date(e.dateEcheance) < today))
      .reduce((s, e) => s + Math.max(0, Number(e?.montantAttendu || 0) - Number(e?.montantPaye || 0)), 0);
    const tauxImpayes = totalReste > 0 ? Math.round((resteRetard / totalReste) * 1000) / 10 : 0;
    const totalElevesCount = Number(totalEleves || 0);
    const tauxPresence = totalElevesCount > 0
      ? Math.round(((totalElevesCount - Math.min(absencesToday || 0, totalElevesCount)) / totalElevesCount) * 1000) / 10
      : 0;

    const cycleCounts = {};
    for (const row of (inscriptionsParClasse || [])) {
      const cycle = row?.classe?.cycle || 'autre';
      cycleCounts[cycle] = (cycleCounts[cycle] || 0) + 1;
    }
    const repartitionCycles = Object.entries(cycleCounts).map(([cycle, count]) => ({ cycle, count }));

    const dernieresAbsences = (dernieresAbsencesRaw || []).map((a) => ({
      id: a.id,
      dateAbsence: a.dateAbsence,
      eleveNom: a.eleve?.nom || '',
      elevePrenom: a.eleve?.prenom || '',
      classeNom: a.eleve?.inscriptions?.[0]?.classe?.nom || '—',
      statut: 'non_justifiee',
    }));

    const derniersPaiements = (derniersPaiementsRaw || []).map((p) => ({
      id: p.id,
      montant: Number(p.montant || 0),
      modePaiement: p.modePaiement,
      numeroRecu: p.numeroRecu,
      eleveNom: p.inscription?.eleve?.nom || '',
      elevePrenom: p.inscription?.eleve?.prenom || '',
    }));

    res.json({
      eleves: { total: totalElevesCount },
      totalEleves: totalElevesCount,
      tauxPresence,
      repartitionCycles,
      dernieresAbsences,
      derniersPaiements,
      classes: { total: totalClasses || 0 },
      paiements: {
        today: { count: paiementsToday?._count?.id || 0, montant: paiementsToday?._sum?.montant || 0 },
        month: { count: paiementsMonth?._count?.id || 0, montant: paiementsMonth?._sum?.montant || 0 }
      },
      alertes: {
        inscriptions_en_attente: inscriptionsEnAttente || 0,
        absences_aujourdhui: absencesToday || 0
      },
      recettesMois,
      objectifMois,
      tauxImpayes,
    });
  } catch (error) {
    log.error({ err: error, tenantId }, 'Get KPIs error');
    res.status(500).json({ error: 'Internal server error', message: error?.message });
  }
};

export const getCaisse = async (req, res) => {
  const tenantId = req.tenantId;
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [paiements, statsPaiement] = await Promise.all([
      prisma.paiement.findMany({
        where: { tenantId, datePaiement: { gte: today, lt: tomorrow } },
        include: {
          inscription: {
            select: {
              eleve: { select: { matricule: true, nom: true, prenom: true } },
              classe: { select: { nom: true } }
            }
          },
          recuPar: { select: { nom: true, prenom: true } }
        },
        orderBy: { datePaiement: 'desc' }
      }),
      prisma.paiement.groupBy({
        by: ['modePaiement'],
        where: { tenantId, datePaiement: { gte: today, lt: tomorrow } },
        _sum: { montant: true },
        _count: { id: true }
      })
    ]);

    const totalRecu = (paiements || []).reduce((sum, p) => sum + parseFloat(p?.montant || 0), 0);

    res.json({
      date: today.toISOString().split('T')[0],
      paiements: {
        count: (paiements || []).length,
        total: totalRecu,
        liste: paiements || []
      },
      parModePaiement: (statsPaiement || []).map(s => ({
        mode: s.modePaiement,
        count: s._count?.id || 0,
        montant: s._sum?.montant || 0
      }))
    });
  } catch (error) {
    log.error({ err: error, tenantId }, 'Get caisse error');
    res.status(500).json({ error: 'Internal server error', message: error?.message });
  }
};

export const getEvolution = async (req, res) => {
  const tenantId = req.tenantId;
  try {
    const { periode = '30' } = req.query;
    const jours = Math.min(90, Math.max(1, parseInt(periode, 10) || 30));
    let anneeId = null;
    try {
      anneeId = await resolveAnneeScolaireId(tenantId, req.query.anneeScolaireId || null);
    } catch {
      anneeId = null;
    }
    const yearFilter = anneeId ? { inscription: { anneeScolaireId: anneeId } } : {};

    const data = [];
    const today = new Date();

    for (let i = jours - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);

      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);

      const paiements = await prisma.paiement.aggregate({
        where: { tenantId, datePaiement: { gte: date, lt: nextDay }, ...yearFilter },
        _sum: { montant: true },
        _count: { id: true }
      }).catch(() => ({ _sum: { montant: 0 }, _count: { id: 0 } }));

      data.push({
        date: date.toISOString().split('T')[0],
        montant: Number(paiements?._sum?.montant || 0),
        count: Number(paiements?._count?.id || 0)
      });
    }

    res.json(data);
  } catch (error) {
    log.error({ err: error, tenantId, periode }, 'Get evolution error');
    res.status(500).json({ error: 'Internal server error' });
  }
};
