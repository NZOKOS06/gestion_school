import crypto from 'crypto';
import { prisma, rawPrisma } from '../utils/prisma.js';
import { hashPassword } from '../utils/password.js';
import { categorieEcheance } from './echeances.service.js';

/**
 * Portail parent.
 * - Le module « Parents » est activé par le super-admin, école par école.
 * - Chaque tuteur a son propre accès (User.portailActif), activé à l'inscription
 *   ou plus tard, avec un mot de passe provisoire à changer à la première connexion.
 * - Absences, sanctions, messages et annonces : toujours transmis.
 * - Notes et bulletins : seulement si la scolarité échue avant le mois en cours est
 *   réglée (les services optionnels ne comptent pas), sauf dérogation du directeur.
 */

/** Mot de passe provisoire lisible (dicté au téléphone, imprimé sur une fiche). */
export function genererMotDePasseProvisoire() {
  const lettres = 'ABCDEFGHJKMNPQRSTUVWXYZ'; // sans I, L, O ambigus
  const chiffres = '23456789';
  const pick = (set, n) => Array.from({ length: n }, () => set[crypto.randomInt(set.length)]).join('');
  return `${pick(lettres, 4)}-${pick(chiffres, 4)}`;
}

export async function moduleParentsActif(tenantId, db = null) {
  if (!tenantId) return false;
  const cfg = await (db || rawPrisma).tenantConfig.findUnique({
    where: { tenantId },
    select: { moduleParents: true },
  });
  return Boolean(cfg?.moduleParents);
}

/**
 * Active l'espace parent d'un tuteur : nouveau mot de passe provisoire.
 * Retourne { identifiant, motDePasse } à transmettre au parent (une seule fois).
 */
export async function activerPortailParent(tx, user) {
  const motDePasse = genererMotDePasseProvisoire();
  const updated = await tx.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(motDePasse),
      portailActif: true,
      mustChangePassword: true,
      actif: true,
    },
  });
  return {
    parentId: updated.id,
    nom: `${updated.prenom || ''} ${updated.nom || ''}`.trim(),
    identifiant: updated.telephone || updated.email,
    email: updated.email,
    telephone: updated.telephone,
    motDePasse,
  };
}

export async function desactiverPortailParent(tx, user) {
  return tx.user.update({ where: { id: user.id }, data: { portailActif: false } });
}

/** Le parent doit-il recevoir les notifications de l'école ? */
export async function parentJoignable(tenantId, userId, db = null) {
  if (!tenantId || !userId) return false;
  const client = db || rawPrisma;
  const [actif, user] = await Promise.all([
    moduleParentsActif(tenantId, client),
    client.user.findFirst({ where: { id: userId, tenantId }, select: { actif: true, portailActif: true } }),
  ]);
  return Boolean(actif && user?.actif && user?.portailActif);
}

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Inscription courante d'un élève (validée ou en attente, la plus récente). */
export async function inscriptionCourante(tenantId, eleveId, db = null) {
  return (db || prisma).inscription.findFirst({
    where: { tenantId, eleveId, statut: { in: ['validee', 'en_attente'] } },
    orderBy: { createdAt: 'desc' },
    include: {
      echeances: {
        where: { statut: { not: 'annulee' } },
        select: { libelle: true, categorie: true, souscriptionServiceId: true, montantAttendu: true, montantPaye: true, dateEcheance: true },
      },
    },
  });
}

/**
 * Montant de scolarité (frais d'inscription compris) échu avant le mois en cours et non réglé.
 * En novembre : tout ce qui était dû jusqu'à fin octobre.
 */
export function impayeMoisEcoule(echeances = [], maintenant = new Date()) {
  const debutMoisCourant = new Date(Date.UTC(maintenant.getUTCFullYear(), maintenant.getUTCMonth(), 1));
  return Math.round(echeances
    .filter((e) => categorieEcheance(e) !== 'service' && new Date(e.dateEcheance) < debutMoisCourant)
    .reduce((acc, e) => acc + Math.max(0, num(e.montantAttendu) - num(e.montantPaye)), 0) * 100) / 100;
}

/**
 * Accès aux notes / bulletins d'un élève pour ses parents.
 * Retourne { accessible, derogation, montantDu, message }.
 */
export async function situationNotes(tenantId, eleveId, { maintenant = new Date(), inscription = null, db = null } = {}) {
  const insc = inscription || await inscriptionCourante(tenantId, eleveId, db);
  if (!insc) return { accessible: true, derogation: false, montantDu: 0, message: null };
  if (insc.derogationNotes) return { accessible: true, derogation: true, montantDu: 0, message: null };
  const montantDu = impayeMoisEcoule(insc.echeances || [], maintenant);
  if (montantDu <= 0.01) return { accessible: true, derogation: false, montantDu: 0, message: null };
  return {
    accessible: false,
    derogation: false,
    montantDu,
    message: 'Les notes et bulletins seront disponibles après régularisation de la scolarité du mois écoulé.',
  };
}
