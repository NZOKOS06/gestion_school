import { prisma } from '../utils/prisma.js';
import { syncInscriptionSolde, periodesService, dureePeriodeMois, categorieEcheance, PERIODICITES } from './echeances.service.js';
import { FraisError } from './fraisInscription.service.js';

/**
 * Services optionnels payants (cantine, garderie, crèche, TD, transport…).
 * Chaque école gère son catalogue ; un élève peut cumuler plusieurs services en plus
 * de sa scolarité. Chaque souscription génère ses propres échéances (catégorie « service »).
 */

export const SERVICES_SUGGERES = [
  { nom: 'Cantine', periodicite: 'mensuelle' },
  { nom: 'Garderie', periodicite: 'mensuelle' },
  { nom: 'Crèche', periodicite: 'mensuelle' },
  { nom: 'TD', periodicite: 'mensuelle' },
];

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const r2 = (n) => Math.round(n * 100) / 100;

const asArray = (v) => (Array.isArray(v) ? v : null);

/** Le service est-il proposé à cette classe ? (cycles / classes ciblés, null = tous) */
export function serviceApplicable(service, classe) {
  if (!service?.actif) return false;
  const cycles = asArray(service.cycles);
  if (cycles?.length && !cycles.includes(classe?.cycle)) return false;
  const classeIds = asArray(service.classeIds);
  if (classeIds?.length && !classeIds.includes(classe?.id)) return false;
  return true;
}

/** Services actifs proposés à une classe. */
export async function servicesPourClasse(tenantId, classe, db = null) {
  const services = await (db || prisma).serviceOptionnel.findMany({
    where: { tenantId, actif: true },
    orderBy: [{ ordre: 'asc' }, { nom: 'asc' }],
  });
  return services.filter((s) => serviceApplicable(s, classe));
}

/**
 * Vérifie et charge les services demandés pour une classe.
 * Retourne [{ id, nom, tarif, periodicite }].
 */
export async function resolveServices(tenantId, classe, serviceIds = [], db = null) {
  const ids = [...new Set((serviceIds || []).filter(Boolean))];
  if (!ids.length) return [];
  const services = await (db || prisma).serviceOptionnel.findMany({
    where: { tenantId, id: { in: ids } },
  });
  return ids.map((id) => {
    const s = services.find((x) => x.id === id);
    if (!s) throw new FraisError('Service optionnel introuvable');
    if (!serviceApplicable(s, classe)) {
      throw new FraisError(`Le service « ${s.nom} » n'est pas proposé à cette classe`);
    }
    return { id: s.id, nom: s.nom, tarif: num(s.tarif), periodicite: s.periodicite };
  });
}

/**
 * Périodes encore à facturer à une date donnée : la période en cours
 * (mois courant, trimestre ou année déjà commencés) et les suivantes.
 */
export function periodesRestantes(periodes, periodicite, maintenant = new Date()) {
  const debutMoisCourant = Date.UTC(maintenant.getUTCFullYear(), maintenant.getUTCMonth(), 1);
  const duree = dureePeriodeMois(periodicite);
  return periodes.filter((p) => {
    const d = p.dateEcheance;
    const finPeriode = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + duree, 1);
    return finPeriode > debutMoisCourant;
  });
}

async function bornesAnnee(tx, inscription, maintenant) {
  const annee = inscription.anneeScolaireId
    ? await tx.anneeScolaire.findUnique({ where: { id: inscription.anneeScolaireId } })
    : null;
  const debut = annee?.dateDebut ? new Date(annee.dateDebut) : maintenant;
  const fin = annee?.dateFin ? new Date(annee.dateFin) : new Date(debut.getTime() + 270 * 86400000);
  return { debut, fin };
}

/** Total annuel d'un service (pour les aperçus). */
export function totalAnnuelService(service, debut, fin, maintenant = null) {
  let periodes = periodesService(debut, fin, service.periodicite, service.nom);
  if (maintenant) periodes = periodesRestantes(periodes, service.periodicite, maintenant);
  return { nbPeriodes: periodes.length, total: r2(periodes.length * num(service.tarif)) };
}

/**
 * Crée (ou réactive) la souscription et les échéances restantes de l'année.
 * À l'inscription comme en cours d'année, la facturation part de la période en cours.
 */
export async function souscrireService(tx, tenantId, inscription, service, {
  tarif = null, motifTarifSpecial = null, maintenant = new Date(),
} = {}) {
  const tarifApplique = r2(tarif ?? num(service.tarif));
  if (!(tarifApplique >= 0)) throw new FraisError('Tarif invalide');
  const tarifSpecial = Math.abs(tarifApplique - num(service.tarif)) > 0.009;
  if (tarifSpecial && !String(motifTarifSpecial || '').trim()) {
    throw new FraisError('Un motif est obligatoire pour un tarif spécial');
  }

  let souscription = await tx.souscriptionService.findFirst({
    where: { tenantId, inscriptionId: inscription.id, serviceId: service.id },
  });
  if (souscription?.actif) {
    throw new FraisError(`L'élève est déjà inscrit au service « ${service.nom} »`);
  }

  const data = {
    tarifApplique,
    tarifSpecial,
    motifTarifSpecial: tarifSpecial ? String(motifTarifSpecial).trim() : null,
    actif: true,
    dateDebut: maintenant,
    dateFin: null,
  };
  souscription = souscription
    ? await tx.souscriptionService.update({ where: { id: souscription.id }, data })
    : await tx.souscriptionService.create({
      data: { tenantId, inscriptionId: inscription.id, serviceId: service.id, ...data },
    });

  const { debut, fin } = await bornesAnnee(tx, inscription, maintenant);
  const periodes = periodesRestantes(periodesService(debut, fin, service.periodicite, service.nom), service.periodicite, maintenant);

  // Ne pas dupliquer une période déjà facturée (réabonnement après arrêt)
  const dejaFacturees = new Set((await tx.echeance.findMany({
    where: { tenantId, souscriptionServiceId: souscription.id, statut: { not: 'annulee' } },
    select: { libelle: true },
  })).map((e) => e.libelle));
  const aCreer = periodes.filter((p) => !dejaFacturees.has(p.libelle));

  if (aCreer.length && tarifApplique > 0) {
    await tx.echeance.createMany({
      data: aCreer.map((p) => ({
        tenantId,
        inscriptionId: inscription.id,
        souscriptionServiceId: souscription.id,
        libelle: p.libelle,
        categorie: 'service',
        montantAttendu: tarifApplique,
        dateEcheance: p.dateEcheance,
        montantPaye: 0,
        statut: 'en_attente',
      })),
    });
  }

  return souscription;
}

/**
 * Arrête un service : les périodes qui commencent après le mois en cours et ne sont
 * pas soldées sont arrêtées (le déjà payé reste acquis) ; le passé reste dû.
 */
export async function arreterService(tx, tenantId, souscription, { maintenant = new Date() } = {}) {
  const debutMoisSuivant = new Date(Date.UTC(maintenant.getUTCFullYear(), maintenant.getUTCMonth() + 1, 1));
  const echeances = await tx.echeance.findMany({
    where: { tenantId, souscriptionServiceId: souscription.id, statut: { not: 'annulee' } },
  });
  for (const e of echeances) {
    const paye = num(e.montantPaye);
    if (e.dateEcheance >= debutMoisSuivant && paye < num(e.montantAttendu) - 0.01) {
      await tx.echeance.update({
        where: { id: e.id },
        data: paye > 0 ? { montantAttendu: paye, statut: 'payee' } : { montantAttendu: 0, statut: 'annulee' },
      });
    }
  }
  return tx.souscriptionService.update({
    where: { id: souscription.id },
    data: { actif: false, dateFin: maintenant },
  });
}

/**
 * Tarif spécial sur un service : s'applique aux périodes non soldées à partir du mois
 * en cours (jamais en dessous de ce qui est déjà payé).
 */
export async function modifierTarifService(tx, tenantId, souscription, service, { tarif, motifTarifSpecial, maintenant = new Date() }) {
  const nouveau = r2(num(tarif));
  if (nouveau < 0) throw new FraisError('Tarif invalide');
  const tarifSpecial = Math.abs(nouveau - num(service.tarif)) > 0.009;
  if (tarifSpecial && !String(motifTarifSpecial || '').trim()) {
    throw new FraisError('Un motif est obligatoire pour un tarif spécial');
  }
  const debutMoisCourant = new Date(Date.UTC(maintenant.getUTCFullYear(), maintenant.getUTCMonth(), 1));
  const echeances = await tx.echeance.findMany({
    where: { tenantId, souscriptionServiceId: souscription.id, statut: { not: 'annulee' } },
  });
  const now = maintenant;
  for (const e of echeances) {
    const paye = num(e.montantPaye);
    if (e.dateEcheance < debutMoisCourant || paye >= num(e.montantAttendu) - 0.01) continue;
    const attendu = Math.max(paye, nouveau);
    await tx.echeance.update({
      where: { id: e.id },
      data: {
        montantAttendu: attendu,
        statut: paye >= attendu - 0.01 ? 'payee' : (e.dateEcheance < now ? 'en_retard' : 'en_attente'),
      },
    });
  }
  return tx.souscriptionService.update({
    where: { id: souscription.id },
    data: {
      tarifApplique: nouveau,
      tarifSpecial,
      motifTarifSpecial: tarifSpecial ? String(motifTarifSpecial).trim() : null,
    },
  });
}

/** Valide et normalise le payload d'un service du catalogue. */
export function normaliserService(body = {}, { partiel = false } = {}) {
  const data = {};
  if (!partiel || body.nom !== undefined) {
    const nom = String(body.nom || '').trim().slice(0, 80);
    if (!nom) throw new FraisError('Le nom du service est obligatoire');
    data.nom = nom;
  }
  if (!partiel || body.tarif !== undefined) {
    const tarif = Number(body.tarif);
    if (!Number.isFinite(tarif) || tarif < 0) throw new FraisError('Tarif invalide');
    data.tarif = r2(tarif);
  }
  if (!partiel || body.periodicite !== undefined) {
    data.periodicite = PERIODICITES.includes(body.periodicite) ? body.periodicite : 'mensuelle';
  }
  if (body.description !== undefined) data.description = String(body.description || '').trim().slice(0, 300) || null;
  if (body.cycles !== undefined) data.cycles = Array.isArray(body.cycles) && body.cycles.length ? body.cycles : null;
  if (body.classeIds !== undefined) data.classeIds = Array.isArray(body.classeIds) && body.classeIds.length ? body.classeIds : null;
  if (body.actif !== undefined) data.actif = body.actif === true || body.actif === 'true';
  if (body.ordre !== undefined) data.ordre = parseInt(body.ordre, 10) || 0;
  return data;
}

export { categorieEcheance, syncInscriptionSolde };
