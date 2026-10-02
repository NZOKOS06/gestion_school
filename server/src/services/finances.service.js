import { prisma } from '../utils/prisma.js';

/**
 * Catégories de recettes / dépenses gérées par chaque école, et ventes ponctuelles
 * (articles du catalogue ou recettes diverses saisies librement).
 */

export class FinanceError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

export const CATEGORIES_DEFAUT = {
  depense: [
    { nom: 'Salaires', systeme: true },
    { nom: 'Loyer' },
    { nom: 'Électricité / Eau' },
    { nom: 'Fournitures' },
    { nom: 'Entretien' },
    { nom: 'Communication' },
    { nom: 'Transport' },
    { nom: 'Alimentation (cantine)' },
    { nom: 'Frais bancaires' },
    { nom: 'Autre' },
  ],
  recette: [
    { nom: 'Uniformes & tenues' },
    { nom: 'Fournitures scolaires' },
    { nom: 'Émulation & événements' },
    { nom: 'Sorties & activités' },
    { nom: 'Dons & subventions' },
    { nom: 'Location de locaux' },
    { nom: 'Autres recettes' },
  ],
};

export const TYPES_CATEGORIE = ['recette', 'depense'];

const r2 = (n) => Math.round(n * 100) / 100;

/**
 * Crée les catégories par défaut d'une école (une seule fois) et rattache les
 * dépenses existantes saisies en texte libre à la catégorie du même nom.
 */
export async function assurerCategories(tenantId, db = null) {
  const client = db || prisma;
  const existantes = await client.categorieFinance.count({ where: { tenantId } });
  if (existantes === 0) {
    const data = [];
    for (const type of TYPES_CATEGORIE) {
      CATEGORIES_DEFAUT[type].forEach((c, ordre) => data.push({ tenantId, type, nom: c.nom, systeme: Boolean(c.systeme), ordre }));
    }
    await client.categorieFinance.createMany({ data, skipDuplicates: true });
  }
  // Catégorie « Salaires » indispensable à la paie
  await client.categorieFinance.upsert({
    where: { tenantId_type_nom: { tenantId, type: 'depense', nom: 'Salaires' } },
    create: { tenantId, type: 'depense', nom: 'Salaires', systeme: true },
    update: {},
  });
  // Dépenses historiques (texte libre) → catégorie du même nom
  const depensesSansCategorie = await client.depense.findMany({
    where: { tenantId, categorieId: null },
    select: { categorie: true },
    distinct: ['categorie'],
  });
  for (const { categorie } of depensesSansCategorie) {
    const nom = String(categorie || '').trim();
    if (!nom) continue;
    const cat = await client.categorieFinance.upsert({
      where: { tenantId_type_nom: { tenantId, type: 'depense', nom } },
      create: { tenantId, type: 'depense', nom },
      update: {},
    });
    await client.depense.updateMany({ where: { tenantId, categorie, categorieId: null }, data: { categorieId: cat.id } });
  }
}

/** Catégorie d'une dépense : par identifiant, sinon par nom (créée si nouvelle). */
export async function resoudreCategorieDepense(tenantId, { categorieId, categorie }, db = null) {
  const client = db || prisma;
  if (categorieId) {
    const cat = await client.categorieFinance.findFirst({ where: { id: categorieId, tenantId, type: 'depense' } });
    if (!cat) throw new FinanceError('Catégorie de dépense introuvable');
    return cat;
  }
  const nom = String(categorie || '').trim().slice(0, 80);
  if (!nom) throw new FinanceError('Catégorie obligatoire');
  return client.categorieFinance.upsert({
    where: { tenantId_type_nom: { tenantId, type: 'depense', nom } },
    create: { tenantId, type: 'depense', nom },
    update: {},
  });
}

/**
 * Calcule les lignes d'une vente.
 * lignes : [{ articleId, quantite }] (prix du catalogue) ou [{ libelle, prixUnitaire, quantite, categorieId }] (recette diverse)
 * articles : articles du catalogue chargés (id → article), categoriesIds : Set des catégories de recette valides
 * Retourne { lignes: [...], total, mouvementsStock: [{ articleId, quantite }] }
 */
export function calculerVente(lignesDemandees = [], { articles = new Map(), categoriesIds = new Set() } = {}) {
  if (!Array.isArray(lignesDemandees) || !lignesDemandees.length) throw new FinanceError('Ajoutez au moins une ligne');
  if (lignesDemandees.length > 50) throw new FinanceError('50 lignes maximum par vente');

  const lignes = [];
  const parArticle = new Map();
  for (const [i, l] of lignesDemandees.entries()) {
    const quantite = parseInt(l.quantite ?? 1, 10);
    if (!Number.isInteger(quantite) || quantite < 1 || quantite > 10000) {
      throw new FinanceError(`Ligne ${i + 1} : quantité invalide`);
    }
    if (l.articleId) {
      const article = articles.get(l.articleId);
      if (!article || !article.actif) throw new FinanceError(`Ligne ${i + 1} : article introuvable ou retiré du catalogue`);
      const prixUnitaire = r2(Number(article.prix));
      lignes.push({
        articleId: article.id,
        categorieId: article.categorieId || null,
        libelle: article.nom,
        quantite,
        prixUnitaire,
        montant: r2(prixUnitaire * quantite),
      });
      if (article.gereStock) parArticle.set(article.id, (parArticle.get(article.id) || 0) + quantite);
    } else {
      const libelle = String(l.libelle || '').trim().slice(0, 150);
      const prixUnitaire = r2(Number(l.prixUnitaire));
      if (!libelle) throw new FinanceError(`Ligne ${i + 1} : libellé obligatoire`);
      if (!Number.isFinite(prixUnitaire) || prixUnitaire <= 0) throw new FinanceError(`Ligne ${i + 1} : montant invalide`);
      if (!l.categorieId || !categoriesIds.has(l.categorieId)) {
        throw new FinanceError(`Ligne ${i + 1} : choisissez une catégorie de recette`);
      }
      lignes.push({ articleId: null, categorieId: l.categorieId, libelle, quantite, prixUnitaire, montant: r2(prixUnitaire * quantite) });
    }
  }

  for (const [articleId, quantite] of parArticle) {
    const article = articles.get(articleId);
    if ((article.stock ?? 0) < quantite) {
      throw new FinanceError(`Stock insuffisant pour « ${article.nom} » (reste ${article.stock ?? 0})`);
    }
  }

  return {
    lignes,
    total: r2(lignes.reduce((acc, l) => acc + l.montant, 0)),
    mouvementsStock: [...parArticle].map(([articleId, quantite]) => ({ articleId, quantite })),
  };
}
