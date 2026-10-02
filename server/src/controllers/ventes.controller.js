import { prisma } from '../utils/prisma.js';
import { createLogger } from '../utils/logger.js';
import { logAudit } from '../utils/auditLogger.js';
import { loadSchoolPdfMeta } from '../services/pdf/schoolMeta.js';
import { buildRecuPdf } from '../services/pdf/recu.pdf.js';
import { normalizeModePaiement } from '../services/echeances.service.js';
import {
  FinanceError,
  TYPES_CATEGORIE,
  assurerCategories,
  calculerVente,
} from '../services/finances.service.js';

const log = createLogger('VentesController');

const handle = (res, error, msg, req) => {
  if (error instanceof FinanceError) return res.status(error.status).json({ error: error.message });
  if (error?.code === 'P2002') return res.status(409).json({ error: 'Ce nom existe déjà' });
  log.error({ err: error, tenantId: req.tenantId }, msg);
  return res.status(500).json({ error: 'Internal server error' });
};

const r2 = (n) => Math.round(n * 100) / 100;

// ─── Catégories de recettes / dépenses ────────────────────────────────────────

/** GET /api/finances/categories?type=recette|depense */
export const listCategories = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    await assurerCategories(tenantId);
    const where = { tenantId };
    if (TYPES_CATEGORIE.includes(req.query.type)) where.type = req.query.type;
    if (req.query.actives) where.actif = true;
    const categories = await prisma.categorieFinance.findMany({
      where,
      orderBy: [{ type: 'asc' }, { ordre: 'asc' }, { nom: 'asc' }],
      include: { _count: { select: { depenses: true, lignes: true, articles: true } } },
    });
    res.json({
      data: categories.map(({ _count, ...c }) => ({
        ...c,
        utilisee: (_count?.depenses || 0) + (_count?.lignes || 0) + (_count?.articles || 0) > 0,
      })),
    });
  } catch (error) {
    handle(res, error, 'listCategories', req);
  }
};

export const createCategorie = async (req, res) => {
  try {
    const type = req.body.type;
    const nom = String(req.body.nom || '').trim().slice(0, 80);
    if (!TYPES_CATEGORIE.includes(type)) throw new FinanceError('Type invalide (recette ou dépense)');
    if (!nom) throw new FinanceError('Nom obligatoire');
    const categorie = await prisma.categorieFinance.create({ data: { tenantId: req.tenantId, type, nom } });
    await logAudit(req, 'categorie_finance_creee', 'CategorieFinance', categorie.id, { type, nom });
    res.status(201).json(categorie);
  } catch (error) {
    handle(res, error, 'createCategorie', req);
  }
};

export const updateCategorie = async (req, res) => {
  try {
    const existing = await prisma.categorieFinance.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!existing) return res.status(404).json({ error: 'Catégorie introuvable' });
    const data = {};
    if (req.body.nom !== undefined) {
      if (existing.systeme) throw new FinanceError('Cette catégorie est utilisée par le système et ne peut pas être renommée');
      data.nom = String(req.body.nom || '').trim().slice(0, 80);
      if (!data.nom) throw new FinanceError('Nom obligatoire');
    }
    if (req.body.actif !== undefined) {
      if (existing.systeme && !req.body.actif) throw new FinanceError('Cette catégorie système ne peut pas être désactivée');
      data.actif = req.body.actif === true || req.body.actif === 'true';
    }
    const categorie = await prisma.categorieFinance.update({ where: { id: existing.id }, data });
    // Le libellé texte des dépenses suit le renommage
    if (data.nom && existing.type === 'depense') {
      await prisma.depense.updateMany({ where: { tenantId: req.tenantId, categorieId: existing.id }, data: { categorie: data.nom } });
    }
    res.json(categorie);
  } catch (error) {
    handle(res, error, 'updateCategorie', req);
  }
};

/** Suppression si jamais utilisée, sinon désactivation (historique conservé). */
export const deleteCategorie = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const existing = await prisma.categorieFinance.findFirst({
      where: { id: req.params.id, tenantId },
      include: { _count: { select: { depenses: true, lignes: true, articles: true } } },
    });
    if (!existing) return res.status(404).json({ error: 'Catégorie introuvable' });
    if (existing.systeme) throw new FinanceError('Cette catégorie système ne peut pas être supprimée');
    const usage = existing._count.depenses + existing._count.lignes + existing._count.articles;
    if (usage > 0) {
      await prisma.categorieFinance.update({ where: { id: existing.id }, data: { actif: false } });
      return res.json({ message: 'Catégorie désactivée (déjà utilisée, historique conservé)', desactivee: true });
    }
    await prisma.categorieFinance.delete({ where: { id: existing.id } });
    res.json({ message: 'Catégorie supprimée' });
  } catch (error) {
    handle(res, error, 'deleteCategorie', req);
  }
};

// ─── Catalogue d'articles ─────────────────────────────────────────────────────

const normaliserArticle = async (tenantId, body, partiel = false) => {
  const data = {};
  if (!partiel || body.nom !== undefined) {
    data.nom = String(body.nom || '').trim().slice(0, 120);
    if (!data.nom) throw new FinanceError("Nom de l'article obligatoire");
  }
  if (!partiel || body.prix !== undefined) {
    data.prix = r2(Number(body.prix));
    if (!Number.isFinite(data.prix) || data.prix < 0) throw new FinanceError('Prix invalide');
  }
  if (body.description !== undefined) data.description = String(body.description || '').trim().slice(0, 300) || null;
  if (body.categorieId !== undefined) {
    if (body.categorieId) {
      const cat = await prisma.categorieFinance.findFirst({ where: { id: body.categorieId, tenantId, type: 'recette' } });
      if (!cat) throw new FinanceError('Catégorie de recette introuvable');
    }
    data.categorieId = body.categorieId || null;
  }
  if (body.gereStock !== undefined) data.gereStock = body.gereStock === true || body.gereStock === 'true';
  if (body.stock !== undefined) {
    const stock = body.stock === null || body.stock === '' ? null : parseInt(body.stock, 10);
    if (stock !== null && (!Number.isInteger(stock) || stock < 0)) throw new FinanceError('Stock invalide');
    data.stock = stock;
  }
  if (body.actif !== undefined) data.actif = body.actif === true || body.actif === 'true';
  return data;
};

export const listArticles = async (req, res) => {
  try {
    const where = { tenantId: req.tenantId };
    if (req.query.actifs) where.actif = true;
    const articles = await prisma.articleCatalogue.findMany({
      where,
      include: { categorie: { select: { id: true, nom: true } } },
      orderBy: [{ ordre: 'asc' }, { nom: 'asc' }],
    });
    res.json({ data: articles.map((a) => ({ ...a, prix: Number(a.prix) })) });
  } catch (error) {
    handle(res, error, 'listArticles', req);
  }
};

export const createArticle = async (req, res) => {
  try {
    const data = await normaliserArticle(req.tenantId, req.body);
    const article = await prisma.articleCatalogue.create({ data: { tenantId: req.tenantId, ...data } });
    await logAudit(req, 'article_cree', 'ArticleCatalogue', article.id, { nom: article.nom, prix: data.prix });
    res.status(201).json(article);
  } catch (error) {
    handle(res, error, 'createArticle', req);
  }
};

export const updateArticle = async (req, res) => {
  try {
    const existing = await prisma.articleCatalogue.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!existing) return res.status(404).json({ error: 'Article introuvable' });
    const data = await normaliserArticle(req.tenantId, req.body, true);
    const article = await prisma.articleCatalogue.update({ where: { id: existing.id }, data });
    await logAudit(req, 'article_modifie', 'ArticleCatalogue', article.id, data);
    res.json(article);
  } catch (error) {
    handle(res, error, 'updateArticle', req);
  }
};

export const deleteArticle = async (req, res) => {
  try {
    const existing = await prisma.articleCatalogue.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
      include: { _count: { select: { lignes: true } } },
    });
    if (!existing) return res.status(404).json({ error: 'Article introuvable' });
    if (existing._count.lignes > 0) {
      await prisma.articleCatalogue.update({ where: { id: existing.id }, data: { actif: false } });
      return res.json({ message: 'Article retiré du catalogue (déjà vendu, historique conservé)', desactive: true });
    }
    await prisma.articleCatalogue.delete({ where: { id: existing.id } });
    res.json({ message: 'Article supprimé' });
  } catch (error) {
    handle(res, error, 'deleteArticle', req);
  }
};

// ─── Ventes ───────────────────────────────────────────────────────────────────

const venteInclude = {
  lignes: { include: { categorie: { select: { id: true, nom: true } } } },
  vendeur: { select: { id: true, nom: true, prenom: true } },
  inscription: {
    select: {
      id: true,
      eleve: { select: { id: true, nom: true, prenom: true, matricule: true } },
      classe: { select: { nom: true } },
      anneeScolaire: { select: { libelle: true } },
    },
  },
};

const serialiserVente = (v) => ({
  ...v,
  montantTotal: Number(v.montantTotal),
  lignes: (v.lignes || []).map((l) => ({ ...l, prixUnitaire: Number(l.prixUnitaire), montant: Number(l.montant) })),
  acheteur: v.inscription?.eleve
    ? `${v.inscription.eleve.prenom} ${v.inscription.eleve.nom}`
    : (v.clientNom || null),
});

/** GET /api/ventes?dateDebut&dateFin&statut */
export const listVentes = async (req, res) => {
  try {
    const where = { tenantId: req.tenantId };
    if (req.query.statut) where.statut = req.query.statut;
    if (req.query.dateDebut || req.query.dateFin) {
      where.dateVente = {};
      if (req.query.dateDebut) where.dateVente.gte = new Date(req.query.dateDebut);
      if (req.query.dateFin) where.dateVente.lte = new Date(`${req.query.dateFin}T23:59:59`);
    }
    const ventes = await prisma.vente.findMany({
      where,
      include: venteInclude,
      orderBy: { dateVente: 'desc' },
      take: Math.min(parseInt(req.query.limit, 10) || 100, 500),
    });
    res.json({ data: ventes.map(serialiserVente) });
  } catch (error) {
    handle(res, error, 'listVentes', req);
  }
};

/**
 * POST /api/ventes
 * { lignes: [{ articleId, quantite } | { libelle, prixUnitaire, quantite, categorieId }],
 *   inscriptionId?, clientNom?, modePaiement, reference? }
 */
export const createVente = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const modePaiement = normalizeModePaiement(req.body.modePaiement || 'especes');
    const inscriptionId = req.body.inscriptionId || null;
    if (inscriptionId) {
      const insc = await prisma.inscription.findFirst({ where: { id: inscriptionId, tenantId } });
      if (!insc) throw new FinanceError('Élève introuvable');
    }

    await assurerCategories(tenantId);
    const lignesDemandees = Array.isArray(req.body.lignes) ? req.body.lignes : [];
    const articleIds = [...new Set(lignesDemandees.map((l) => l.articleId).filter(Boolean))];

    const vente = await prisma.$transaction(async (tx) => {
      const [articles, categories] = await Promise.all([
        tx.articleCatalogue.findMany({ where: { tenantId, id: { in: articleIds } } }),
        tx.categorieFinance.findMany({ where: { tenantId, type: 'recette', actif: true }, select: { id: true } }),
      ]);
      const calcul = calculerVente(lignesDemandees, {
        articles: new Map(articles.map((a) => [a.id, a])),
        categoriesIds: new Set(categories.map((c) => c.id)),
      });

      for (const m of calcul.mouvementsStock) {
        const maj = await tx.articleCatalogue.updateMany({
          where: { id: m.articleId, tenantId, stock: { gte: m.quantite } },
          data: { stock: { decrement: m.quantite } },
        });
        if (maj.count !== 1) throw new FinanceError('Stock insuffisant (modifié entre-temps)');
      }

      const [derniere, session] = await Promise.all([
        tx.vente.findFirst({ where: { tenantId }, orderBy: { numero: 'desc' }, select: { numero: true } }),
        tx.caisseSession.findFirst({ where: { tenantId, caissierId: req.user.id, statut: 'ouverte' }, select: { id: true } }),
      ]);

      return tx.vente.create({
        data: {
          tenantId,
          numero: (derniere?.numero || 0) + 1,
          inscriptionId,
          clientNom: inscriptionId ? null : (String(req.body.clientNom || '').trim().slice(0, 120) || null),
          montantTotal: calcul.total,
          modePaiement,
          reference: req.body.reference ? String(req.body.reference).slice(0, 120) : null,
          vendeurId: req.user.id,
          caisseSessionId: session?.id || null,
          lignes: { create: calcul.lignes.map((l) => ({ tenantId, ...l })) },
        },
        include: venteInclude,
      });
    });

    await logAudit(req, 'vente_enregistree', 'Vente', vente.id, { numero: vente.numero, montant: Number(vente.montantTotal) });
    res.status(201).json(serialiserVente(vente));
  } catch (error) {
    handle(res, error, 'createVente', req);
  }
};

/** POST /api/ventes/:id/annuler { motif } — remet les articles en stock */
export const annulerVente = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const motif = String(req.body.motif || '').trim();
    if (motif.length < 5) throw new FinanceError("Motif d'annulation obligatoire (5 caractères minimum)");
    const vente = await prisma.vente.findFirst({ where: { id: req.params.id, tenantId }, include: { lignes: true } });
    if (!vente) return res.status(404).json({ error: 'Vente introuvable' });
    if (vente.statut === 'annulee') throw new FinanceError('Vente déjà annulée');

    await prisma.$transaction(async (tx) => {
      for (const l of vente.lignes) {
        if (!l.articleId) continue;
        await tx.articleCatalogue.updateMany({
          where: { id: l.articleId, tenantId, gereStock: true },
          data: { stock: { increment: l.quantite } },
        });
      }
      await tx.vente.update({ where: { id: vente.id }, data: { statut: 'annulee', motifAnnulation: motif } });
    });

    await logAudit(req, 'vente_annulee', 'Vente', vente.id, { numero: vente.numero, montant: Number(vente.montantTotal), motif });
    res.json({ message: `Vente n°${vente.numero} annulée` });
  } catch (error) {
    handle(res, error, 'annulerVente', req);
  }
};

/** GET /api/ventes/:id/recu-pdf?format=a4|thermique */
export const recuVentePdf = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const vente = await prisma.vente.findFirst({ where: { id: req.params.id, tenantId }, include: venteInclude });
    if (!vente) return res.status(404).json({ error: 'Vente introuvable' });
    const meta = await loadSchoolPdfMeta(tenantId, req);
    const eleve = vente.inscription?.eleve;
    const buffer = await buildRecuPdf({
      ...meta,
      numeroRecu: `V${String(vente.numero).padStart(4, '0')}`,
      datePaiement: vente.dateVente,
      montant: Number(vente.montantTotal),
      modePaiement: vente.modePaiement,
      reference: vente.reference,
      typePaiement: 'autre',
      motif: vente.statut === 'annulee' ? `VENTE ANNULÉE — ${vente.motifAnnulation || ''}` : null,
      eleve: eleve ? `${eleve.prenom} ${eleve.nom}` : (vente.clientNom || 'Client'),
      matricule: eleve?.matricule || null,
      classe: vente.inscription?.classe?.nom || null,
      anneeScolaire: vente.inscription?.anneeScolaire?.libelle || null,
      recuPar: vente.vendeur ? `${vente.vendeur.prenom} ${vente.vendeur.nom}` : null,
      lignes: vente.lignes.map((l) => ({
        designation: l.quantite > 1 ? `${l.libelle} × ${l.quantite}` : l.libelle,
        periode: l.categorie?.nom || '',
        montant: Number(l.montant),
      })),
    }, req.query.format || null);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="recu-vente-${vente.numero}.pdf"`);
    res.send(buffer);
  } catch (error) {
    handle(res, error, 'recuVentePdf', req);
  }
};
