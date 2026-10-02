import { prisma } from '../utils/prisma.js';
import { createLogger } from '../utils/logger.js';
import { logAudit } from '../utils/auditLogger.js';
import { getAnneeOperationnelle } from '../utils/anneeScolaire.js';
import { notifyParent } from '../utils/notifications.js';
import { moduleParentsActif, impayeMoisEcoule } from '../services/portailParent.service.js';

const log = createLogger('AnnoncesController');

const CIBLES = ['tous', 'cycle', 'classe', 'impayes'];
const CYCLES = ['prescolaire', 'primaire', 'college', 'lycee'];

/**
 * Parents destinataires d'une annonce, parmi ceux qui ont accès au portail :
 * tous, un cycle, une classe, ou les familles avec une scolarité impayée du mois écoulé.
 */
export async function destinatairesAnnonce(tenantId, { cible, cibleValeur }, { maintenant = new Date() } = {}) {
  const annee = await getAnneeOperationnelle(tenantId);
  if (!annee) return [];

  const inscriptions = await prisma.inscription.findMany({
    where: {
      tenantId,
      anneeScolaireId: annee.id,
      statut: { in: ['validee', 'en_attente'] },
      ...(cible === 'classe' ? { classeId: cibleValeur } : {}),
      ...(cible === 'cycle' ? { classe: { cycle: cibleValeur } } : {}),
    },
    select: {
      eleve: { select: { parentId: true } },
      ...(cible === 'impayes'
        ? {
          echeances: {
            where: { statut: { not: 'annulee' } },
            select: { libelle: true, categorie: true, souscriptionServiceId: true, montantAttendu: true, montantPaye: true, dateEcheance: true },
          },
        }
        : {}),
    },
  });

  const parentIds = new Set(inscriptions
    .filter((i) => cible !== 'impayes' || impayeMoisEcoule(i.echeances, maintenant) > 0.01)
    .map((i) => i.eleve?.parentId)
    .filter(Boolean));
  if (!parentIds.size) return [];

  const parents = await prisma.user.findMany({
    where: { tenantId, id: { in: [...parentIds] }, actif: true, portailActif: true },
    select: { id: true },
  });
  return parents.map((p) => p.id);
}

/** GET /api/annonces */
export const list = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const annonces = await prisma.annonce.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        auteur: { select: { nom: true, prenom: true } },
        _count: { select: { destinataires: { where: { luLe: { not: null } } } } },
      },
    });
    res.json({
      data: annonces.map(({ _count, auteur, ...a }) => ({
        ...a,
        auteur: auteur ? `${auteur.prenom} ${auteur.nom}`.trim() : null,
        nbLus: _count?.destinataires || 0,
      })),
    });
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId }, 'List annonces error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

/** GET /api/annonces/apercu?cible=&cibleValeur= — nombre de parents qui recevraient l'annonce */
export const apercu = async (req, res) => {
  try {
    const cible = CIBLES.includes(req.query.cible) ? req.query.cible : 'tous';
    const ids = await destinatairesAnnonce(req.tenantId, { cible, cibleValeur: req.query.cibleValeur || null });
    res.json({ nbDestinataires: ids.length });
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId }, 'Apercu annonce error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

/** POST /api/annonces { titre, contenu, cible, cibleValeur } */
export const create = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    if (!(await moduleParentsActif(tenantId))) {
      return res.status(403).json({ error: "Le module Parents n'est pas activé pour l'établissement." });
    }
    const titre = String(req.body.titre || '').trim().slice(0, 150);
    const contenu = String(req.body.contenu || '').trim().slice(0, 5000);
    const cible = CIBLES.includes(req.body.cible) ? req.body.cible : 'tous';
    const cibleValeur = req.body.cibleValeur ? String(req.body.cibleValeur) : null;
    if (!titre || !contenu) return res.status(400).json({ error: 'Titre et message obligatoires' });
    if (cible === 'cycle' && !CYCLES.includes(cibleValeur)) return res.status(400).json({ error: 'Cycle invalide' });
    if (cible === 'classe') {
      const classe = await prisma.classe.findFirst({ where: { id: cibleValeur || '', tenantId } });
      if (!classe) return res.status(400).json({ error: 'Classe invalide' });
    }

    const parentIds = await destinatairesAnnonce(tenantId, { cible, cibleValeur });
    if (!parentIds.length) {
      return res.status(400).json({ error: "Aucun parent avec un espace actif ne correspond à cette cible." });
    }

    const annonce = await prisma.$transaction(async (tx) => {
      const a = await tx.annonce.create({
        data: { tenantId, titre, contenu, cible, cibleValeur, auteurId: req.user.id, nbDestinataires: parentIds.length },
      });
      await tx.annonceDestinataire.createMany({
        data: parentIds.map((userId) => ({ tenantId, annonceId: a.id, userId })),
        skipDuplicates: true,
      });
      return a;
    });

    // Notification immédiate (hors transaction)
    for (const userId of parentIds) {
      await notifyParent({
        tenantId,
        userId,
        type: 'annonce',
        titre,
        contenu: contenu.length > 200 ? `${contenu.slice(0, 197)}…` : contenu,
        lien: '/parent/annonces',
        tenantSlug: req.tenant?.slug,
      });
    }

    await logAudit(req, 'annonce_publiee', 'Annonce', annonce.id, { titre, cible, cibleValeur, nb: parentIds.length });
    res.status(201).json(annonce);
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId }, 'Create annonce error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

/** DELETE /api/annonces/:id — retire l'annonce des espaces parents */
export const remove = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const annonce = await prisma.annonce.findFirst({ where: { id: req.params.id, tenantId } });
    if (!annonce) return res.status(404).json({ error: 'Annonce introuvable' });
    if (annonce.auteurId !== req.user.id && req.user.role !== 'directeur') {
      return res.status(403).json({ error: "Seul l'auteur ou le directeur peut retirer cette annonce" });
    }
    await prisma.annonce.delete({ where: { id: annonce.id } });
    await logAudit(req, 'annonce_retiree', 'Annonce', annonce.id, { titre: annonce.titre });
    res.json({ message: 'Annonce retirée' });
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId }, 'Delete annonce error');
    res.status(500).json({ error: 'Internal server error' });
  }
};
