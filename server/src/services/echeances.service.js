import { prisma } from '../utils/prisma.js';

const MOIS_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

export function libelleMois(date) {
  const d = new Date(date);
  return `${MOIS_FR[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function monthsInRange(dateDebut, dateFin) {
  const start = new Date(dateDebut);
  const end = new Date(dateFin);
  let y = start.getUTCFullYear();
  let m = start.getUTCMonth();
  const yEnd = end.getUTCFullYear();
  const mEnd = end.getUTCMonth();
  const months = [];
  while (y < yEnd || (y === yEnd && m <= mEnd)) {
    months.push(new Date(Date.UTC(y, m, 1, 12, 0, 0)));
    m += 1;
    if (m > 11) {
      m = 0;
      y += 1;
    }
    if (months.length > 18) break;
  }
  return months;
}

function isTrancheLibelle(libelle) {
  return /^tranche\s*\d+/i.test(String(libelle || '').trim());
}

/**
 * Génère les échéances : frais d'inscription + un mois de scolarité
 * du début à la fin de l'année scolaire.
 */
export async function generateForInscription(txOrPrisma, inscription, opts = {}) {
  const db = txOrPrisma || prisma;
  const {
    fraisInscription = 0,
    fraisScolarite = 0,
    dateInscription = new Date(),
    dateDebut,
    dateFin,
  } = opts;

  const existing = await db.echeance.count({
    where: { inscriptionId: inscription.id },
  });
  if (existing > 0) {
    return { created: 0, solde: Number(inscription.soldeScolarite || 0) };
  }

  let debut = dateDebut ? new Date(dateDebut) : null;
  let fin = dateFin ? new Date(dateFin) : null;
  if (!debut || !fin) {
    const annee = inscription.anneeScolaireId
      ? await db.anneeScolaire.findUnique({ where: { id: inscription.anneeScolaireId } })
      : null;
    debut = debut || (annee?.dateDebut ? new Date(annee.dateDebut) : new Date(dateInscription));
    fin = fin || (annee?.dateFin ? new Date(annee.dateFin) : null);
    if (!fin) {
      fin = new Date(debut);
      fin.setMonth(fin.getMonth() + 9);
    }
  }

  const months = monthsInRange(debut, fin);
  const rows = [];

  if (fraisInscription > 0) {
    const d = new Date(debut);
    d.setDate(Math.min(15, d.getDate() + 14));
    rows.push({
      tenantId: inscription.tenantId,
      inscriptionId: inscription.id,
      libelle: "Frais d'inscription",
      montantAttendu: fraisInscription,
      dateEcheance: d,
      montantPaye: 0,
      statut: 'en_attente',
    });
  }

  if (fraisScolarite > 0 && months.length) {
    const monthly = Math.round((fraisScolarite / months.length) * 100) / 100;
    months.forEach((d, i) => {
      const attendu = i === months.length - 1
        ? Math.round((fraisScolarite - monthly * (months.length - 1)) * 100) / 100
        : monthly;
      const due = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 5, 12, 0, 0));
      rows.push({
        tenantId: inscription.tenantId,
        inscriptionId: inscription.id,
        libelle: libelleMois(d),
        montantAttendu: attendu,
        dateEcheance: due,
        montantPaye: 0,
        statut: 'en_attente',
      });
    });
  }

  if (rows.length) {
    await db.echeance.createMany({ data: rows });
  }

  const solde = rows.reduce((s, r) => s + Number(r.montantAttendu), 0);
  await db.inscription.update({
    where: { id: inscription.id },
    data: { soldeScolarite: solde },
  });

  return { created: rows.length, solde };
}

async function convertTranchesToMonthsIfNeeded(db, tenantId, inscriptionId) {
  const rows = await db.echeance.findMany({
    where: { tenantId, inscriptionId },
    orderBy: { dateEcheance: 'asc' },
  });
  if (!rows.some((r) => isTrancheLibelle(r.libelle))) return;

  const inscription = await db.inscription.findFirst({
    where: { id: inscriptionId, tenantId },
    include: { anneeScolaire: true },
  });
  const annee = inscription?.anneeScolaire;
  if (!annee?.dateDebut || !annee?.dateFin) {
    for (const r of rows) {
      if (isTrancheLibelle(r.libelle)) {
        await db.echeance.update({
          where: { id: r.id },
          data: { libelle: libelleMois(r.dateEcheance) },
        });
      }
    }
    return;
  }

  const scolarite = rows.filter((r) => !/inscription/i.test(r.libelle || ''));
  const totalAttendu = scolarite.reduce((s, r) => s + Number(r.montantAttendu), 0);
  const totalPaye = scolarite.reduce((s, r) => s + Number(r.montantPaye), 0);
  if (totalAttendu <= 0 || !scolarite.length) return;

  const months = monthsInRange(annee.dateDebut, annee.dateFin);
  if (!months.length) return;

  await db.echeance.deleteMany({ where: { id: { in: scolarite.map((r) => r.id) } } });

  const monthly = Math.round((totalAttendu / months.length) * 100) / 100;
  let remainingPaye = totalPaye;
  const now = new Date();
  const data = months.map((d, i) => {
    const attendu = i === months.length - 1
      ? Math.round((totalAttendu - monthly * (months.length - 1)) * 100) / 100
      : monthly;
    const paye = Math.min(remainingPaye, attendu);
    remainingPaye = Math.max(0, remainingPaye - attendu);
    const due = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 5, 12, 0, 0));
    return {
      tenantId,
      inscriptionId,
      libelle: libelleMois(d),
      montantAttendu: attendu,
      dateEcheance: due,
      montantPaye: paye,
      statut: paye >= attendu - 0.01 ? 'payee' : (due < now ? 'en_retard' : 'en_attente'),
    };
  });
  await db.echeance.createMany({ data });
}

export async function applyPaymentToEcheance(tx, echeanceId, montant) {
  if (!echeanceId) return null;
  const echeance = await tx.echeance.findUnique({ where: { id: echeanceId } });
  if (!echeance) return null;

  const montantPaye = Number(echeance.montantPaye) + Number(montant);
  const attendu = Number(echeance.montantAttendu);
  const statut = montantPaye >= attendu - 0.01 ? 'payee' : 'en_attente';

  return tx.echeance.update({
    where: { id: echeanceId },
    data: { montantPaye, statut },
  });
}

/**
 * Répartit un montant sur les échéances impayées (ordre chronologique).
 * Le reliquat après le dernier mois est enregistré comme avance (surpaiement).
 */
export async function applyPaymentCascade(tx, tenantId, inscriptionId, montant) {
  const echeances = await tx.echeance.findMany({
    where: { tenantId, inscriptionId },
    orderBy: { dateEcheance: 'asc' },
  });

  let remaining = Number(montant) || 0;
  const allocations = [];

  for (const ech of echeances) {
    if (remaining <= 0.01) break;
    const reste = Math.max(0, Number(ech.montantAttendu) - Number(ech.montantPaye));
    if (reste <= 0.01) continue;

    const toPay = Math.min(remaining, reste);
    const montantPaye = Number(ech.montantPaye) + toPay;
    const statut = montantPaye >= Number(ech.montantAttendu) - 0.01 ? 'payee' : ech.statut;

    await tx.echeance.update({
      where: { id: ech.id },
      data: { montantPaye, statut },
    });

    allocations.push({
      echeanceId: ech.id,
      libelle: ech.libelle,
      montant: toPay,
      statut,
    });
    remaining -= toPay;
  }

  if (remaining > 0.01 && echeances.length) {
    const last = echeances[echeances.length - 1];
    const current = await tx.echeance.findUnique({ where: { id: last.id } });
    await tx.echeance.update({
      where: { id: last.id },
      data: {
        montantPaye: Number(current.montantPaye) + remaining,
        statut: 'payee',
      },
    });
    const existing = allocations.find((a) => a.echeanceId === last.id);
    if (existing) {
      existing.montant += remaining;
      existing.avance = remaining;
      existing.statut = 'payee';
    } else {
      allocations.push({
        echeanceId: last.id,
        libelle: last.libelle,
        montant: remaining,
        avance: remaining,
        statut: 'payee',
      });
    }
    remaining = 0;
  }

  return { allocations, reliquat: Math.max(0, remaining) };
}

export async function markOverdue(tenantId) {
  const now = new Date();
  const result = await prisma.echeance.updateMany({
    where: {
      tenantId,
      statut: 'en_attente',
      dateEcheance: { lt: now },
      // remaining due
    },
    data: { statut: 'en_retard' },
  });
  // Only mark those with remaining balance
  const retards = await prisma.echeance.findMany({
    where: {
      tenantId,
      statut: { in: ['en_attente', 'en_retard'] },
      dateEcheance: { lt: now },
    },
  });
  for (const e of retards) {
    if (Number(e.montantPaye) < Number(e.montantAttendu) - 0.01 && e.statut !== 'en_retard') {
      await prisma.echeance.update({ where: { id: e.id }, data: { statut: 'en_retard' } });
    }
  }
  return result;
}

export async function listRetards(tenantId) {
  const now = new Date();
  const candidates = await prisma.echeance.findMany({
    where: {
      tenantId,
      statut: { in: ['en_attente', 'en_retard'] },
      dateEcheance: { lt: now },
    },
  });
  const overdueIds = candidates
    .filter((e) => Number(e.montantPaye) < Number(e.montantAttendu) - 0.01)
    .map((e) => e.id);
  if (overdueIds.length) {
    await prisma.echeance.updateMany({
      where: { id: { in: overdueIds } },
      data: { statut: 'en_retard' },
    });
  }

  const rows = await prisma.echeance.findMany({
    where: {
      tenantId,
      statut: 'en_retard',
    },
    include: {
      inscription: {
        include: {
          eleve: {
            select: {
              id: true,
              matricule: true,
              nom: true,
              prenom: true,
              parent: { select: { id: true, email: true, nom: true, prenom: true } },
            },
          },
          classe: { select: { id: true, nom: true } },
        },
      },
    },
    orderBy: { dateEcheance: 'asc' },
  });

  return rows
    .filter((e) => Number(e.montantPaye) < Number(e.montantAttendu) - 0.01)
    .map((e) => ({
      id: e.id,
      libelle: isTrancheLibelle(e.libelle) ? libelleMois(e.dateEcheance) : e.libelle,
      dateEcheance: e.dateEcheance,
      montantAttendu: Number(e.montantAttendu),
      montantPaye: Number(e.montantPaye),
      reste: Number(e.montantAttendu) - Number(e.montantPaye),
      statut: e.statut,
      elevePrenom: e.inscription?.eleve?.prenom,
      eleveNom: e.inscription?.eleve?.nom,
      matricule: e.inscription?.eleve?.matricule,
      classeNom: e.inscription?.classe?.nom,
      parentEmail: e.inscription?.eleve?.parent?.email || null,
      inscriptionId: e.inscriptionId,
    }));
}

export async function listByInscription(tenantId, inscriptionId) {
  await convertTranchesToMonthsIfNeeded(prisma, tenantId, inscriptionId);
  const rows = await prisma.echeance.findMany({
    where: { tenantId, inscriptionId },
    orderBy: { dateEcheance: 'asc' },
  });
  return rows.map((e) => ({
    id: e.id,
    libelle: isTrancheLibelle(e.libelle) ? libelleMois(e.dateEcheance) : e.libelle,
    dateEcheance: e.dateEcheance,
    montantAttendu: Number(e.montantAttendu),
    montantPaye: Number(e.montantPaye),
    reste: Math.max(0, Number(e.montantAttendu) - Number(e.montantPaye)),
    statut: e.statut,
  }));
}

export function normalizeModePaiement(mode) {
  if (!mode) return 'especes';
  const m = String(mode).toLowerCase().trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const map = {
    especes: 'especes',
    espece: 'especes',
    cash: 'especes',
    mobile_money: 'mobile_money',
    'mobile money': 'mobile_money',
    momo: 'mobile_money',
    carte: 'carte',
    cheque: 'cheque',
    virement: 'virement',
  };
  return map[m] || map[m.replace(/\s+/g, '_')] || 'especes';
}
