import { prisma } from '../utils/prisma.js';
import { syncInscriptionSolde, monthsInRange, libelleMois, categorieEcheance, periodesCantine } from './echeances.service.js';

/**
 * Tarification d'une inscription.
 *
 * Ordre de résolution des frais d'entrée :
 * - réinscription (élève déjà inscrit une autre année dans l'école) :
 *   classe.fraisReinscription → config.fraisReinscriptionDefault → frais d'inscription ci-dessous
 * - inscription : classe.fraisInscription → config.fraisInscriptionDefault
 * Scolarité : classe.fraisScolarite → config.fraisScolariteDefault
 *   (régime mi-temps, si activé par l'école : classe.fraisScolariteMiTemps)
 * Cantine (option école) : config.tarifCantine par période (mois ou trimestre)
 *
 * Les montants peuvent être modifiés pour un élève (tarif spécial, cas sociaux) :
 * un motif est alors obligatoire et l'inscription est marquée `tarifSpecial`.
 */

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export class FraisError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

/** Vrai si l'élève a déjà une inscription (non annulée) sur une autre année de l'école. */
export async function estReinscription(db, tenantId, eleveId, anneeScolaireId) {
  if (!eleveId) return false;
  const prev = await (db || prisma).inscription.findFirst({
    where: {
      tenantId,
      eleveId,
      statut: { not: 'annulee' },
      ...(anneeScolaireId ? { anneeScolaireId: { not: anneeScolaireId } } : {}),
    },
    select: { id: true },
  });
  return Boolean(prev);
}

/**
 * Calcule le tarif par défaut (sans dérogation).
 * `typeFrais` peut être forcé ('inscription' | 'reinscription') ; sinon il est détecté.
 */
export async function resolveFees(tenantId, classeId, {
  eleveId = null, anneeScolaireId = null, typeFrais = null, regime = null, cantine = false, db = null,
} = {}) {
  const client = db || prisma;
  const [classe, config] = await Promise.all([
    client.classe.findFirst({ where: { id: classeId, tenantId } }),
    client.tenantConfig.findUnique({ where: { tenantId } }),
  ]);

  const regimesActifs = Boolean(config?.regimesActifs);
  const regimeRetenu = regimesActifs && regime === 'mi_temps' ? 'mi_temps' : 'plein_temps';
  const scolaritePleinTemps = num(classe?.fraisScolarite ?? config?.fraisScolariteDefault);
  const scolariteMiTemps = num(classe?.fraisScolariteMiTemps);
  if (regimeRetenu === 'mi_temps' && scolariteMiTemps <= 0) {
    throw new FraisError("Le tarif mi-temps de cette classe n'est pas renseigné");
  }
  const fraisScolarite = regimeRetenu === 'mi_temps' ? scolariteMiTemps : scolaritePleinTemps;

  const cantineActive = Boolean(config?.cantineActive);
  const tarifCantine = num(config?.tarifCantine);
  if (cantine && (!cantineActive || tarifCantine <= 0)) {
    throw new FraisError("La cantine n'est pas activée ou son tarif n'est pas renseigné");
  }

  const type = typeFrais === 'inscription' || typeFrais === 'reinscription'
    ? typeFrais
    : (await estReinscription(client, tenantId, eleveId, anneeScolaireId || classe?.anneeScolaireId))
      ? 'reinscription'
      : 'inscription';

  const candidats = [];
  if (type === 'reinscription') {
    candidats.push(
      { montant: num(classe?.fraisReinscription), source: 'classe_reinscription' },
      { montant: num(config?.fraisReinscriptionDefault), source: 'ecole_reinscription' },
    );
  }
  candidats.push(
    { montant: num(classe?.fraisInscription), source: 'classe_inscription' },
    { montant: num(config?.fraisInscriptionDefault), source: 'ecole_inscription' },
  );
  const retenu = candidats.find((c) => c.montant > 0) || { montant: 0, source: 'aucun' };

  return {
    classe,
    config,
    typeFrais: type,
    fraisInscription: retenu.montant,
    sourceFraisInscription: retenu.source,
    fraisScolarite,
    regime: regimeRetenu,
    regimesActifs,
    cantine: Boolean(cantine),
    cantineActive,
    tarifCantine,
    cantinePeriodicite: config?.cantinePeriodicite === 'trimestrielle' ? 'trimestrielle' : 'mensuelle',
  };
}

/**
 * Applique une éventuelle dérogation tarifaire envoyée par le formulaire.
 * body: { fraisInscription?, fraisScolarite?, motifTarifSpecial? }
 */
export function appliquerTarifSpecial(base, body = {}) {
  const parse = (v, label) => {
    if (v === undefined || v === null || v === '') return null;
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) {
      throw new FraisError(`${label} invalide`);
    }
    return Math.round(n * 100) / 100;
  };

  const fi = parse(body.fraisInscription, "Montant des frais d'inscription");
  const fs = parse(body.fraisScolarite, 'Montant de la scolarité');

  const fraisInscription = fi ?? base.fraisInscription;
  const fraisScolarite = fs ?? base.fraisScolarite;
  const tarifSpecial = Math.abs(fraisInscription - base.fraisInscription) > 0.009
    || Math.abs(fraisScolarite - base.fraisScolarite) > 0.009;

  const motif = String(body.motifTarifSpecial || '').trim();
  if (tarifSpecial && !motif) {
    throw new FraisError('Un motif est obligatoire pour un tarif spécial');
  }

  return {
    ...base,
    fraisInscription,
    fraisScolarite,
    tarifSpecial,
    motifTarifSpecial: tarifSpecial ? motif : null,
  };
}

/** Champs à poser sur Inscription.create */
export function champsTarifInscription(fees) {
  return {
    typeFrais: fees.typeFrais,
    fraisInscriptionApplique: fees.fraisInscription,
    fraisScolariteApplique: fees.fraisScolarite,
    tarifSpecial: Boolean(fees.tarifSpecial),
    motifTarifSpecial: fees.motifTarifSpecial || null,
    regime: fees.regime || 'plein_temps',
    cantine: Boolean(fees.cantine),
    tarifCantineApplique: fees.cantine ? fees.tarifCantine : null,
  };
}

/** Options cantine à passer à generateForInscription */
export function optionsCantine(fees) {
  return fees.cantine
    ? { montantParPeriode: fees.tarifCantine, periodicite: fees.cantinePeriodicite }
    : null;
}

const r2 = (n) => Math.round(n * 100) / 100;

/**
 * Modifie le tarif d'une inscription existante sans toucher aux montants déjà payés :
 * - échéance « frais d'(ré)inscription » : nouveau montant (≥ déjà payé) ;
 * - échéances de scolarité : le reste dû (nouvelle scolarité − déjà payé) est réparti
 *   sur les échéances non soldées.
 */
export async function modifierTarifInscription(tx, tenantId, inscription, { fraisInscription, fraisScolarite, motifTarifSpecial, tarifSpecial, regime = null }) {
  const echeances = (await tx.echeance.findMany({
    where: { tenantId, inscriptionId: inscription.id, statut: { not: 'annulee' } },
    orderBy: { dateEcheance: 'asc' },
  })).filter((e) => categorieEcheance(e) !== 'cantine');

  const now = new Date();
  const statutPour = (attendu, paye, due) => (
    paye >= attendu - 0.01 ? 'payee' : (due < now ? 'en_retard' : 'en_attente')
  );

  // 1. Frais d'entrée
  const entree = echeances.find((e) => categorieEcheance(e) === 'inscription');
  if (entree) {
    const paye = num(entree.montantPaye);
    if (fraisInscription < paye - 0.01) {
      throw new FraisError(`Les frais d'inscription ne peuvent pas être inférieurs au montant déjà payé (${paye})`);
    }
    await tx.echeance.update({
      where: { id: entree.id },
      data: { montantAttendu: fraisInscription, statut: statutPour(fraisInscription, paye, entree.dateEcheance) },
    });
  } else if (fraisInscription > 0) {
    const due = new Date();
    due.setDate(due.getDate() + 14);
    await tx.echeance.create({
      data: {
        tenantId,
        inscriptionId: inscription.id,
        libelle: inscription.typeFrais === 'reinscription' ? 'Frais de réinscription' : "Frais d'inscription",
        categorie: 'inscription',
        montantAttendu: fraisInscription,
        dateEcheance: due,
        montantPaye: 0,
        statut: 'en_attente',
      },
    });
  }

  // 2. Scolarité
  const scolarite = echeances.filter((e) => categorieEcheance(e) === 'scolarite');
  if (!scolarite.length && fraisScolarite > 0) {
    // Inscription créée sans scolarité : on génère les mensualités de l'année
    const annee = await tx.anneeScolaire.findUnique({ where: { id: inscription.anneeScolaireId } });
    const debut = annee?.dateDebut ? new Date(annee.dateDebut) : new Date();
    const fin = annee?.dateFin ? new Date(annee.dateFin) : new Date(debut.getTime() + 270 * 86400000);
    const months = monthsInRange(debut, fin);
    const monthly = r2(fraisScolarite / months.length);
    await tx.echeance.createMany({
      data: months.map((d, i) => ({
        tenantId,
        inscriptionId: inscription.id,
        libelle: libelleMois(d),
        categorie: 'scolarite',
        montantAttendu: i === months.length - 1 ? r2(fraisScolarite - monthly * (months.length - 1)) : monthly,
        dateEcheance: new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 5, 12, 0, 0)),
        montantPaye: 0,
        statut: 'en_attente',
      })),
    });
  } else if (scolarite.length) {
    const dejaPaye = scolarite.reduce((s, e) => s + num(e.montantPaye), 0);
    if (fraisScolarite < dejaPaye - 0.01) {
      throw new FraisError(`La scolarité ne peut pas être inférieure au montant déjà payé (${r2(dejaPaye)})`);
    }
    const ouvertes = scolarite.filter((e) => num(e.montantPaye) < num(e.montantAttendu) - 0.01);
    const cibles = ouvertes.length ? ouvertes : [scolarite[scolarite.length - 1]];
    const reste = r2(fraisScolarite - dejaPaye);
    const part = r2(reste / cibles.length);

    for (const e of scolarite) {
      const idx = cibles.indexOf(e);
      const paye = num(e.montantPaye);
      let attendu = paye;
      if (idx !== -1) {
        attendu = idx === cibles.length - 1
          ? r2(paye + reste - part * (cibles.length - 1))
          : r2(paye + part);
      }
      await tx.echeance.update({
        where: { id: e.id },
        data: { montantAttendu: attendu, statut: statutPour(attendu, paye, e.dateEcheance) },
      });
    }
  }

  await tx.inscription.update({
    where: { id: inscription.id },
    data: {
      fraisInscriptionApplique: fraisInscription,
      fraisScolariteApplique: fraisScolarite,
      tarifSpecial: Boolean(tarifSpecial),
      motifTarifSpecial: tarifSpecial ? motifTarifSpecial : null,
      ...(regime ? { regime } : {}),
    },
  });

  return syncInscriptionSolde(tx, tenantId, inscription.id);
}

/**
 * Périodes de cantine encore à facturer à une date donnée : la période en cours
 * (mois courant, ou trimestre dont le premier mois a commencé) et les suivantes.
 */
export function periodesRestantes(periodes, periodicite, maintenant = new Date()) {
  const debutMoisCourant = Date.UTC(maintenant.getUTCFullYear(), maintenant.getUTCMonth(), 1);
  const dureeMois = periodicite === 'trimestrielle' ? 3 : 1;
  return periodes.filter((p) => {
    const d = p.dateEcheance;
    const finPeriode = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + dureeMois, 1);
    return finPeriode > debutMoisCourant;
  });
}

/**
 * Souscription / résiliation de la cantine en cours d'année.
 * - souscription : échéances de cantine à partir de la période en cours ;
 * - résiliation : les périodes à venir non soldées sont arrêtées (le déjà payé reste acquis),
 *   les périodes passées restent dues.
 */
export async function changerCantine(tx, tenantId, inscription, { active, montantParPeriode, periodicite, maintenant = new Date() }) {
  const existantes = (await tx.echeance.findMany({
    where: { tenantId, inscriptionId: inscription.id, statut: { not: 'annulee' } },
    orderBy: { dateEcheance: 'asc' },
  })).filter((e) => categorieEcheance(e) === 'cantine');

  if (active) {
    if (existantes.length) throw new FraisError('Cet élève est déjà inscrit à la cantine');
    if (!(montantParPeriode > 0)) throw new FraisError('Tarif de cantine invalide');

    const annee = await tx.anneeScolaire.findUnique({ where: { id: inscription.anneeScolaireId } });
    const debut = annee?.dateDebut ? new Date(annee.dateDebut) : maintenant;
    const fin = annee?.dateFin ? new Date(annee.dateFin) : new Date(debut.getTime() + 270 * 86400000);
    const periodes = periodesRestantes(periodesCantine(debut, fin, periodicite), periodicite, maintenant);
    if (!periodes.length) throw new FraisError('Plus aucune période de cantine pour cette année scolaire');

    await tx.echeance.createMany({
      data: periodes.map((p) => ({
        tenantId,
        inscriptionId: inscription.id,
        libelle: p.libelle,
        categorie: 'cantine',
        montantAttendu: montantParPeriode,
        dateEcheance: p.dateEcheance,
        montantPaye: 0,
        statut: 'en_attente',
      })),
    });
    await tx.inscription.update({
      where: { id: inscription.id },
      data: { cantine: true, tarifCantineApplique: montantParPeriode },
    });
  } else {
    // On arrête les périodes qui commencent après le mois en cours
    const debutMoisSuivant = new Date(Date.UTC(maintenant.getUTCFullYear(), maintenant.getUTCMonth() + 1, 1));
    for (const e of existantes) {
      const paye = num(e.montantPaye);
      if (e.dateEcheance >= debutMoisSuivant && paye < num(e.montantAttendu) - 0.01) {
        await tx.echeance.update({
          where: { id: e.id },
          data: paye > 0
            ? { montantAttendu: paye, statut: 'payee' }
            : { montantAttendu: 0, statut: 'annulee' },
        });
      }
    }
    await tx.inscription.update({
      where: { id: inscription.id },
      data: { cantine: false },
    });
  }

  return syncInscriptionSolde(tx, tenantId, inscription.id);
}
