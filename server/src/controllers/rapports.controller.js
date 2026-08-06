import { prisma } from '../utils/prisma.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('RapportsController');

const resolvePeriod = (query) => {
  const { periode = '30j', dateDebut, dateFin } = query;
  const fin = new Date();
  fin.setHours(23, 59, 59, 999);
  let debut = new Date(fin);

  if (periode === 'custom' && dateDebut && dateFin) {
    debut = new Date(dateDebut);
    debut.setHours(0, 0, 0, 0);
    const finCustom = new Date(dateFin);
    finCustom.setHours(23, 59, 59, 999);
    return { debut, fin: finCustom };
  }

  const days = periode === '7j' ? 7 : periode === '90j' ? 90 : 30;
  debut.setDate(debut.getDate() - (days - 1));
  debut.setHours(0, 0, 0, 0);
  return { debut, fin };
};

const previousPeriod = (debut, fin) => {
  const durationMs = fin.getTime() - debut.getTime();
  const prevFin = new Date(debut.getTime() - 1);
  const prevDebut = new Date(prevFin.getTime() - durationMs);
  return { debut: prevDebut, fin: prevFin };
};

const pctChange = (current, previous) => {
  if (!previous) return current ? 100 : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
};

export const getRapports = async (req, res) => {
  const tenantId = req.tenantId;
  try {
    const { debut, fin } = resolvePeriod(req.query);
    const prev = previousPeriod(debut, fin);

    const [paiements, paiementsPrev, inscriptions] = await Promise.all([
      prisma.paiement.findMany({
        where: { tenantId, datePaiement: { gte: debut, lte: fin } },
        include: {
          inscription: {
            include: {
              classe: { select: { id: true, nom: true } },
              eleve: { select: { id: true } },
            },
          },
        },
        orderBy: { datePaiement: 'asc' },
      }),
      prisma.paiement.findMany({
        where: { tenantId, datePaiement: { gte: prev.debut, lte: prev.fin } },
        select: { montant: true },
      }),
      prisma.inscription.findMany({
        where: { tenantId, statut: { in: ['validee', 'en_attente'] } },
        select: {
          id: true,
          soldeScolarite: true,
          classeId: true,
          classe: { select: { id: true, nom: true } },
          eleveId: true,
          echeances: {
            select: { montantAttendu: true, montantPaye: true },
          },
        },
      }),
    ]);

    const caTotal = paiements.reduce((s, p) => s + Number(p.montant), 0);
    const caPrev = paiementsPrev.reduce((s, p) => s + Number(p.montant), 0);

    const totalAttendu = inscriptions.reduce((s, i) => {
      if (i.echeances?.length) {
        return s + i.echeances.reduce((es, e) => es + Number(e.montantAttendu), 0);
      }
      return s + Number(i.soldeScolarite || 0);
    }, 0);
    const totalPayeInscriptions = inscriptions.reduce((s, i) => {
      if (i.echeances?.length) {
        return s + i.echeances.reduce((es, e) => es + Number(e.montantPaye), 0);
      }
      return s;
    }, 0) || caTotal;
    const attendu = totalAttendu || totalPayeInscriptions;
    const tauxRecouvrement = attendu > 0
      ? Math.round((Math.min(totalPayeInscriptions || caTotal, attendu) / attendu) * 1000) / 10
      : (caTotal > 0 ? 100 : 0);

    // Paiements par jour
    const byDay = new Map();
    for (const p of paiements) {
      const key = p.datePaiement.toISOString().split('T')[0];
      const entry = byDay.get(key) || { date: key, montant: 0, nb: 0 };
      entry.montant += Number(p.montant);
      entry.nb += 1;
      byDay.set(key, entry);
    }
    const paiements_par_jour = [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date));

    // Répartition par mode
    const byMode = new Map();
    for (const p of paiements) {
      const mode = p.modePaiement || 'autre';
      const entry = byMode.get(mode) || { mode, montant: 0, nb: 0 };
      entry.montant += Number(p.montant);
      entry.nb += 1;
      byMode.set(mode, entry);
    }
    const repartition_paiement = [...byMode.values()];

    // Top classes by receipts in period
    const byClasse = new Map();
    for (const p of paiements) {
      const classe = p.inscription?.classe;
      if (!classe) continue;
      const entry = byClasse.get(classe.id) || {
        id: classe.id,
        nom: classe.nom,
        montant: 0,
        eleves: new Set(),
      };
      entry.montant += Number(p.montant);
      if (p.inscription?.eleve?.id) entry.eleves.add(p.inscription.eleve.id);
      byClasse.set(classe.id, entry);
    }

    // Enrich with expected totals per class from inscriptions
    const attenduByClasse = new Map();
    const elevesByClasse = new Map();
    for (const insc of inscriptions) {
      if (!insc.classeId) continue;
      const total = insc.echeances?.length
        ? insc.echeances.reduce((s, e) => s + Number(e.montantAttendu), 0)
        : Number(insc.soldeScolarite || 0);
      attenduByClasse.set(insc.classeId, (attenduByClasse.get(insc.classeId) || 0) + total);
      if (!elevesByClasse.has(insc.classeId)) elevesByClasse.set(insc.classeId, new Set());
      elevesByClasse.get(insc.classeId).add(insc.eleveId);
    }

    const top_classes = [...byClasse.values()]
      .map((c) => {
        const attenduClasse = attenduByClasse.get(c.id) || 0;
        const nbEleves = elevesByClasse.get(c.id)?.size || c.eleves.size;
        return {
          id: c.id,
          nom: c.nom,
          montant: Math.round(c.montant),
          nb_eleves: nbEleves,
          taux_recouvrement: attenduClasse > 0
            ? Math.round((c.montant / attenduClasse) * 1000) / 10
            : null,
        };
      })
      .sort((a, b) => b.montant - a.montant)
      .slice(0, 10);

    res.json({
      periode: { debut: debut.toISOString(), fin: fin.toISOString() },
      ca_total: Math.round(caTotal),
      total_paiements: Math.round(caTotal),
      ca_evolution_pct: pctChange(caTotal, caPrev),
      nb_paiements: paiements.length,
      nb_ventes: paiements.length,
      nb_ventes_evolution_pct: pctChange(paiements.length, paiementsPrev.length),
      total_attendu: Math.round(attendu),
      taux_recouvrement: tauxRecouvrement,
      paiements_par_jour,
      ventes_par_jour: paiements_par_jour,
      repartition_paiement,
      top_classes,
    });
  } catch (error) {
    log.error({ err: error, tenantId }, 'getRapports error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const exportRapports = async (req, res) => {
  const tenantId = req.tenantId;
  try {
    const format = (req.query.format || 'csv').toLowerCase();
    const { debut, fin } = resolvePeriod(req.query);

    const paiements = await prisma.paiement.findMany({
      where: { tenantId, datePaiement: { gte: debut, lte: fin } },
      include: {
        inscription: {
          include: {
            eleve: { select: { matricule: true, nom: true, prenom: true } },
            classe: { select: { nom: true } },
          },
        },
      },
      orderBy: { datePaiement: 'asc' },
    });

    if (format === 'pdf') {
      return res.status(501).json({
        error: 'Export PDF non disponible en Phase 0',
        message: 'Utilisez l\'export CSV pour le moment.',
      });
    }

    const header = ['date', 'numero_recu', 'matricule', 'eleve', 'classe', 'montant', 'mode', 'type', 'reference'];
    const lines = [header.join(';')];
    for (const p of paiements) {
      const eleve = p.inscription?.eleve;
      lines.push([
        p.datePaiement.toISOString().split('T')[0],
        p.numeroRecu,
        eleve?.matricule || '',
        eleve ? `${eleve.prenom} ${eleve.nom}` : '',
        p.inscription?.classe?.nom || '',
        Number(p.montant).toFixed(2),
        p.modePaiement || '',
        p.typePaiement || '',
        p.reference || '',
      ].join(';'));
    }

    const csv = '\uFEFF' + lines.join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="rapports-paiements.csv"`);
    res.send(csv);
  } catch (error) {
    log.error({ err: error, tenantId }, 'exportRapports error');
    res.status(500).json({ error: 'Internal server error' });
  }
};
