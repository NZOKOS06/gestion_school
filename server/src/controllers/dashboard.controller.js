import { prisma } from '../utils/prisma.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('DashboardController');

export const getKpis = async (req, res) => {
  const tenantId = req.tenantId;
  try {
    const isEnseignantView = req.query.enseignant === 'true' || req.user.role === 'enseignant';

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (isEnseignantView) {
      const [mesClasses, mesEvaluations, mesAbsencesAujourdhui] = await Promise.all([
        prisma.staff.findUnique({
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
        }),
        prisma.evaluation.count({
          where: { tenantId, dateEvaluation: { gte: today, lt: tomorrow } }
        }),
        prisma.absence.count({
          where: { tenantId, dateAbsence: { gte: today, lt: tomorrow } }
        })
      ]);

      return res.json({
        mes_classes: mesClasses?.enseignantClasses?.map(ec => ({
          id: ec.classe.id,
          nom: ec.classe.nom,
          niveau: ec.classe.niveau,
          effectif: ec.classe._count.inscriptions
        })) || [],
        evaluations_aujourdhui: mesEvaluations,
        absences_aujourdhui: mesAbsencesAujourdhui
      });
    }

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startOfNextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);

    const [totalEleves, totalClasses, paiementsToday, paiementsMonth, inscriptionsEnAttente, absencesToday, objectifMoisAgg, echeancesStats] = await Promise.all([
      prisma.eleve.count({ where: { tenantId, actif: true } }),
      prisma.classe.count({ where: { tenantId, anneeScolaire: { actif: true } } }),
      prisma.paiement.aggregate({
        where: { tenantId, datePaiement: { gte: today, lt: tomorrow } },
        _sum: { montant: true },
        _count: { id: true }
      }),
      prisma.paiement.aggregate({
        where: { tenantId, datePaiement: { gte: startOfMonth } },
        _sum: { montant: true },
        _count: { id: true }
      }),
      prisma.inscription.count({ where: { tenantId, statut: 'en_attente' } }),
      prisma.absence.count({ where: { tenantId, dateAbsence: { gte: today, lt: tomorrow } } }),
      prisma.echeance.aggregate({
        where: { tenantId, dateEcheance: { gte: startOfMonth, lt: startOfNextMonth } },
        _sum: { montantAttendu: true },
      }),
      prisma.echeance.findMany({
        where: { tenantId, statut: { in: ['en_attente', 'en_retard'] } },
        select: { statut: true, montantAttendu: true, montantPaye: true, dateEcheance: true },
      }),
    ]);

    const recettesMois = Number(paiementsMonth._sum.montant || 0);
    const objectifMois = Number(objectifMoisAgg._sum.montantAttendu || 0);
    const totalReste = echeancesStats.reduce((s, e) => s + Math.max(0, Number(e.montantAttendu) - Number(e.montantPaye)), 0);
    const resteRetard = echeancesStats
      .filter((e) => e.statut === 'en_retard' || e.dateEcheance < today)
      .reduce((s, e) => s + Math.max(0, Number(e.montantAttendu) - Number(e.montantPaye)), 0);
    const tauxImpayes = totalReste > 0 ? Math.round((resteRetard / totalReste) * 1000) / 10 : 0;

    res.json({
      eleves: { total: totalEleves },
      classes: { total: totalClasses },
      paiements: {
        today: { count: paiementsToday._count.id, montant: paiementsToday._sum.montant || 0 },
        month: { count: paiementsMonth._count.id, montant: paiementsMonth._sum.montant || 0 }
      },
      alertes: {
        inscriptions_en_attente: inscriptionsEnAttente,
        absences_aujourdhui: absencesToday
      },
      recettesMois,
      objectifMois,
      tauxImpayes,
    });
  } catch (error) {
    log.error({ err: error, tenantId }, 'Get KPIs error');
    res.status(500).json({ error: 'Internal server error' });
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

    const totalRecu = paiements.reduce((sum, p) => sum + parseFloat(p.montant), 0);

    res.json({
      date: today.toISOString().split('T')[0],
      paiements: {
        count: paiements.length,
        total: totalRecu,
        liste: paiements
      },
      parModePaiement: statsPaiement.map(s => ({
        mode: s.modePaiement,
        count: s._count.id,
        montant: s._sum.montant
      }))
    });
  } catch (error) {
    log.error({ err: error, tenantId }, 'Get caisse error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getEvolution = async (req, res) => {
  const tenantId = req.tenantId;
  try {
    const { periode = '30' } = req.query;
    const jours = parseInt(periode);

    const data = [];
    const today = new Date();

    for (let i = jours - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);

      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);

      const paiements = await prisma.paiement.aggregate({
        where: { tenantId, datePaiement: { gte: date, lt: nextDay } },
        _sum: { montant: true },
        _count: { id: true }
      });

      data.push({
        date: date.toISOString().split('T')[0],
        montant: paiements._sum.montant || 0,
        count: paiements._count.id
      });
    }

    res.json(data);
  } catch (error) {
    log.error({ err: error, tenantId, periode }, 'Get evolution error');
    res.status(500).json({ error: 'Internal server error' });
  }
};
