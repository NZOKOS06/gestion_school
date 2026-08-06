import { prisma } from '../utils/prisma.js';

/**
 * Generate default échéances for an inscription (inscription fee + N scolarité tranches).
 * Sets inscription.soldeScolarite to total dues if not already paid.
 */
export async function generateForInscription(txOrPrisma, inscription, opts = {}) {
  const db = txOrPrisma || prisma;
  const {
    fraisInscription = 0,
    fraisScolarite = 0,
    nbTranches = 3,
    dateInscription = new Date(),
  } = opts;

  const existing = await db.echeance.count({
    where: { inscriptionId: inscription.id },
  });
  if (existing > 0) {
    return { created: 0, solde: Number(inscription.soldeScolarite || 0) };
  }

  const rows = [];
  if (fraisInscription > 0) {
    const d = new Date(dateInscription);
    d.setDate(d.getDate() + 14);
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

  const tranche = nbTranches > 0 ? fraisScolarite / nbTranches : fraisScolarite;
  for (let i = 0; i < nbTranches; i++) {
    if (tranche <= 0) break;
    const d = new Date(dateInscription);
    d.setMonth(d.getMonth() + (i + 1) * 2);
    rows.push({
      tenantId: inscription.tenantId,
      inscriptionId: inscription.id,
      libelle: `Tranche ${i + 1}`,
      montantAttendu: Math.round(tranche * 100) / 100,
      dateEcheance: d,
      montantPaye: 0,
      statut: 'en_attente',
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
      libelle: e.libelle,
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
  const rows = await prisma.echeance.findMany({
    where: { tenantId, inscriptionId },
    orderBy: { dateEcheance: 'asc' },
  });
  return rows.map((e) => ({
    id: e.id,
    libelle: e.libelle,
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
