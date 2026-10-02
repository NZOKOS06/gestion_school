import { rawPrisma } from '../utils/prisma.js';
import { createLogger } from '../utils/logger.js';
import { stats } from './groupes.controller.js';

const log = createLogger('GroupeEcoleController');
const include = { sites: { select: { id: true, nom: true, slug: true } } };

async function chargerGroupe(req) {
  const tenant = await rawPrisma.tenant.findUnique({ where: { id: req.tenantId }, select: { groupeId: true } });
  return tenant?.groupeId ? rawPrisma.groupeScolaire.findUnique({ where: { id: tenant.groupeId }, include }) : null;
}

/** Charge le groupe et vérifie que l'utilisateur en est le directeur (répond 403 sinon). */
async function groupeDuDirecteur(req, res) {
  const groupe = await chargerGroupe(req);
  if (!groupe || groupe.directeurStaffId !== req.user.id) {
    res.status(403).json({ message: 'Réservé au directeur de groupe' });
    return null;
  }
  return groupe;
}

/** GET /api/groupe — groupe de l'école courante + indicateur « directeur de groupe » */
export const monGroupe = async (req, res) => {
  try {
    const g = await chargerGroupe(req);
    res.json({ data: g ? { id: g.id, nom: g.nom, sites: g.sites, estDirecteurGroupe: g.directeurStaffId === req.user.id, tenantId: req.tenantId } : null });
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
