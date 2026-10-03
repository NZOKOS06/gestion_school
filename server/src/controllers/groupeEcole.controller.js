import { rawPrisma } from '../utils/prisma.js';
import { createLogger } from '../utils/logger.js';
import { stats } from './groupes.controller.js';
import { issueSession } from './auth.controller.js';

const log = createLogger('GroupeEcoleController');
const include = { sites: { select: { id: true, nom: true, slug: true } } };

async function chargerGroupe(req) {
  const tenant = await rawPrisma.tenant.findUnique({ where: { id: req.tenantId }, select: { groupeId: true } });
  return tenant?.groupeId ? rawPrisma.groupeScolaire.findUnique({ where: { id: tenant.groupeId }, include }) : null;
}

/** Identité de la personne : son compte d'origine, même lorsqu'elle navigue sur un site via un compte miroir. */
const identite = (req) => req.user.origineStaffId || req.user.id;

/** Charge le groupe et vérifie que l'utilisateur en est le directeur (répond 403 sinon). */
async function groupeDuDirecteur(req, res) {
  const groupe = await chargerGroupe(req);
  if (!groupe || groupe.directeurStaffId !== identite(req)) {
    res.status(403).json({ message: 'Réservé au directeur de groupe' });
    return null;
  }
  return groupe;
}

/** GET /api/groupe — groupe de l'école courante + indicateur « directeur de groupe » */
export const monGroupe = async (req, res) => {
  try {
    const g = await chargerGroupe(req);
    res.json({ data: g ? { id: g.id, nom: g.nom, sites: g.sites, estDirecteurGroupe: g.directeurStaffId === identite(req), peutNaviguer: Boolean(await roleSurAutresSites(g, identite(req))), tenantId: req.tenantId } : null });
  } catch (error) {
    log.error({ err: error }, 'monGroupe');
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

export const statsMonGroupe = async (req, res) => {
  const groupe = await groupeDuDirecteur(req, res);
  if (!groupe) return;
  req.params.id = groupe.id;
  return stats(req, res);
};

const CHAMPS_TARIF = ['fraisScolarite', 'fraisInscription', 'fraisReinscription', 'fraisMensuel', 'fraisMensuelMiTemps', 'fraisScolariteMiTemps', 'nombreMois'];

/**
 * POST /api/groupe/partager-tarifs { cibleTenantIds: [] }
 * Copie les tarifs des classes de l'école (année active) vers les classes de même nom des sites choisis.
 * Ne crée ni ne supprime de classe ; les inscriptions existantes (prix figés) ne changent pas.
 */
export const partagerTarifs = async (req, res) => {
  try {
    const groupe = await groupeDuDirecteur(req, res);
    if (!groupe) return;
    const valides = new Set(groupe.sites.map((s) => s.id));
    const cibles = (Array.isArray(req.body.cibleTenantIds) ? req.body.cibleTenantIds : []).filter((id) => valides.has(id) && id !== req.tenantId);
    if (!cibles.length) return res.status(400).json({ message: 'Aucun site cible valide' });

    const anneeSrc = await rawPrisma.anneeScolaire.findFirst({ where: { tenantId: req.tenantId, actif: true }, select: { id: true } });
    if (!anneeSrc) return res.status(400).json({ message: 'Aucune année active sur cette école' });
    const sources = await rawPrisma.classe.findMany({ where: { tenantId: req.tenantId, anneeScolaireId: anneeSrc.id } });

    const data = [];
    for (const cibleId of cibles) {
      const annee = await rawPrisma.anneeScolaire.findFirst({ where: { tenantId: cibleId, actif: true }, select: { id: true } });
      let classesMisesAJour = 0;
      if (annee) {
        for (const c of sources) {
          const r = await rawPrisma.classe.updateMany({
            where: { tenantId: cibleId, anneeScolaireId: annee.id, nom: c.nom },
            data: Object.fromEntries(CHAMPS_TARIF.map((k) => [k, c[k]])),
          });
          classesMisesAJour += r.count;
        }
      }
      data.push({ tenantId: cibleId, classesMisesAJour });
    }
    res.json({ message: 'Tarifs partagés', data });
  } catch (error) {
    log.error({ err: error }, 'partagerTarifs');
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

/**
 * POST /api/groupe/transferts { eleveId, cibleTenantId }
 * Copie la fiche élève (même matricule) sur le site d'accueil ; la fiche d'origine est archivée
 * (inactive, matricule suffixé) et ses inscriptions en cours annulées. L'historique reste à l'origine.
 */
export const transfererEleve = async (req, res) => {
  try {
    const groupe = await groupeDuDirecteur(req, res);
    if (!groupe) return;
    const { eleveId, cibleTenantId } = req.body;
    if (cibleTenantId === req.tenantId || !groupe.sites.some((s) => s.id === cibleTenantId)) {
      return res.status(400).json({ message: 'Site cible invalide' });
    }
    const e = await rawPrisma.eleve.findFirst({ where: { id: eleveId, tenantId: req.tenantId, actif: true } });
    if (!e) return res.status(404).json({ message: 'Élève introuvable' });

    const nouveau = await rawPrisma.$transaction(async (tx) => {
      await tx.inscription.updateMany({
        where: { eleveId: e.id, tenantId: req.tenantId, statut: { in: ['en_attente', 'validee'] } },
        data: { statut: 'annulee' },
      });
      await tx.eleve.update({ where: { id: e.id }, data: { actif: false, matricule: `${e.matricule}~T${Date.now().toString(36)}` } });
      return tx.eleve.create({
        data: {
          tenantId: cibleTenantId, matricule: e.matricule, nom: e.nom, prenom: e.prenom, dateNaissance: e.dateNaissance,
          lieuNaissance: e.lieuNaissance, sexe: e.sexe, adresse: e.adresse, photoUrl: e.photoUrl,
        },
      });
    });
    res.status(201).json({ message: "Élève transféré ; à inscrire dans une classe du site d'accueil", data: { id: nouveau.id } });
  } catch (error) {
    log.error({ err: error }, 'transfererEleve');
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// ---------- Navigation entre les sites du groupe ----------

const ROLES_DELEGABLES = ['directeur', 'directeur_etudes', 'secretaire', 'comptable', 'surveillant'];

/** Rôle exercé sur les autres sites : « directeur » pour le directeur de groupe, rôle accordé sinon, null si aucun accès. */
async function roleSurAutresSites(groupe, staffId) {
  if (groupe.directeurStaffId === staffId) return 'directeur';
  const acces = await rawPrisma.groupeAcces.findUnique({ where: { groupeId_staffId: { groupeId: groupe.id, staffId } } });
  return acces?.role || null;
}

/** GET /api/groupe/sites — sites où la personne peut aller (le site courant est signalé). */
export const mesSites = async (req, res) => {
  try {
    const g = await chargerGroupe(req);
    if (!g || !(await roleSurAutresSites(g, identite(req)))) return res.json({ data: [] });
    res.json({ data: g.sites.map((s) => ({ ...s, courant: s.id === req.tenantId })) });
  } catch (error) {
    log.error({ err: error }, 'mesSites');
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

/**
 * POST /api/groupe/changer-site { tenantId }
 * Ouvre une session sur un autre site du groupe. Sur chaque site visité la personne a un compte « miroir »
 * (créé au premier passage, même e-mail, rôle accordé) : audit, droits et filtrage par site restent ceux de l'école.
 */
export const changerSite = async (req, res) => {
  try {
    const g = await chargerGroupe(req);
    const moi = identite(req);
    const role = g ? await roleSurAutresSites(g, moi) : null;
    if (!role) return res.status(403).json({ message: 'Accès aux autres sites non autorisé' });

    const cible = g.sites.find((s) => s.id === req.body.tenantId);
    if (!cible) return res.status(400).json({ message: 'Site invalide' });

    const origine = await rawPrisma.staff.findUnique({ where: { id: moi } });
    if (!origine || !origine.actif) return res.status(403).json({ message: 'Compte indisponible' });

    let compte;
    if (origine.tenantId === cible.id) {
      compte = origine; // retour sur son école d'origine
    } else {
      compte = await rawPrisma.staff.findFirst({ where: { tenantId: cible.id, origineStaffId: moi } });
      if (!compte) {
        const doublon = await rawPrisma.staff.findFirst({ where: { tenantId: cible.id, email: origine.email } });
        if (doublon) {
          return res.status(409).json({ message: `Un compte avec l'e-mail ${origine.email} existe déjà sur ${cible.nom}. Changez l'e-mail de l'un des deux comptes.` });
        }
        compte = await rawPrisma.staff.create({
          data: {
            tenantId: cible.id, email: origine.email, passwordHash: origine.passwordHash, role,
            nom: origine.nom, prenom: origine.prenom, telephone: origine.telephone,
            mustChangePassword: false, origineStaffId: moi,
          },
        });
      } else if (!compte.actif || compte.role !== role) {
        compte = await rawPrisma.staff.update({ where: { id: compte.id }, data: { actif: true, role } });
      }
    }

    await issueSession(res, { userId: compte.id, role: compte.role, tenantId: cible.id });
    res.json({ message: `Vous êtes sur ${cible.nom}`, data: { slug: cible.slug, nom: cible.nom, role: compte.role } });
  } catch (error) {
    log.error({ err: error }, 'changerSite');
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

/** GET /api/groupe/acces — personnes autorisées + candidats (personnel des sites). Directeur de groupe seul. */
export const listerAcces = async (req, res) => {
  try {
    const g = await groupeDuDirecteur(req, res);
    if (!g) return;
    const ids = g.sites.map((x) => x.id);
    const [acces, candidats] = await Promise.all([
      rawPrisma.groupeAcces.findMany({
        where: { groupeId: g.id },
        include: { staff: { select: { id: true, nom: true, prenom: true, email: true, tenant: { select: { nom: true } } } } },
        orderBy: { createdAt: 'asc' },
      }),
      rawPrisma.staff.findMany({
        where: { tenantId: { in: ids }, actif: true, origineStaffId: null, role: { in: ROLES_DELEGABLES } },
        select: { id: true, nom: true, prenom: true, email: true, role: true, tenant: { select: { nom: true } } },
        orderBy: [{ nom: 'asc' }],
      }),
    ]);
    res.json({ data: acces, candidats: candidats.filter((c) => c.id !== g.directeurStaffId), roles: ROLES_DELEGABLES });
  } catch (error) {
    log.error({ err: error }, 'listerAcces');
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

/** POST /api/groupe/acces { staffId, role } — autorise une personne du groupe à naviguer entre les sites. */
export const accorderAcces = async (req, res) => {
  try {
    const g = await groupeDuDirecteur(req, res);
    if (!g) return;
    const { staffId, role } = req.body;
    if (!ROLES_DELEGABLES.includes(role)) return res.status(400).json({ message: 'Rôle invalide' });
    const staff = await rawPrisma.staff.findFirst({
      where: { id: staffId, actif: true, origineStaffId: null, role: { in: ROLES_DELEGABLES }, tenantId: { in: g.sites.map((x) => x.id) } },
      select: { id: true },
    });
    if (!staff) return res.status(404).json({ message: 'Personne introuvable dans ce groupe' });
    if (staff.id === g.directeurStaffId) return res.status(400).json({ message: 'Le directeur de groupe a déjà accès à tous les sites' });
    const acces = await rawPrisma.groupeAcces.upsert({
      where: { groupeId_staffId: { groupeId: g.id, staffId } },
      create: { groupeId: g.id, staffId, role },
      update: { role },
    });
    // Le rôle est réappliqué sur les comptes miroirs existants
    await rawPrisma.staff.updateMany({ where: { origineStaffId: staffId }, data: { role } });
    res.status(201).json({ data: acces });
  } catch (error) {
    log.error({ err: error }, 'accorderAcces');
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

/** DELETE /api/groupe/acces/:id — retire l'autorisation et désactive les comptes miroirs. */
export const retirerAcces = async (req, res) => {
  try {
    const g = await groupeDuDirecteur(req, res);
    if (!g) return;
    const acces = await rawPrisma.groupeAcces.findFirst({ where: { id: req.params.id, groupeId: g.id } });
    if (!acces) return res.status(404).json({ message: 'Autorisation introuvable' });
    await rawPrisma.$transaction([
      rawPrisma.groupeAcces.delete({ where: { id: acces.id } }),
      rawPrisma.staff.updateMany({ where: { origineStaffId: acces.staffId }, data: { actif: false } }),
    ]);
    res.json({ message: 'Autorisation retirée' });
  } catch (error) {
    log.error({ err: error }, 'retirerAcces');
    res.status(500).json({ message: 'Erreur serveur' });
  }
};
