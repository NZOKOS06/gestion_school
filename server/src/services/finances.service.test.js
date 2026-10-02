import { describe, it, expect } from 'vitest';
import { calculerVente, FinanceError } from './finances.service.js';

const maillot = { id: 'a1', nom: 'Maillot de sport', prix: 5000, actif: true, categorieId: 'c-uniformes', gereStock: true, stock: 3 };
const badge = { id: 'a2', nom: 'Badge', prix: 500, actif: true, categorieId: 'c-uniformes', gereStock: false, stock: null };
const retire = { id: 'a3', nom: 'Ancien article', prix: 100, actif: false };
const ctx = {
  articles: new Map([[maillot.id, maillot], [badge.id, badge], [retire.id, retire]]),
  categoriesIds: new Set(['c-uniformes', 'c-emulation']),
};

describe('calculerVente', () => {
  it('articles du catalogue : prix catalogue × quantité, mouvement de stock', () => {
    const v = calculerVente([{ articleId: 'a1', quantite: 2 }, { articleId: 'a2', quantite: 4 }], ctx);
    expect(v.total).toBe(12000);
    expect(v.lignes[0]).toMatchObject({ libelle: 'Maillot de sport', prixUnitaire: 5000, montant: 10000, categorieId: 'c-uniformes' });
    expect(v.mouvementsStock).toEqual([{ articleId: 'a1', quantite: 2 }]);
  });

  it('recette diverse : libellé, montant et catégorie de recette obligatoires', () => {
    const v = calculerVente([{ libelle: 'Participation émulation', prixUnitaire: 2500, quantite: 1, categorieId: 'c-emulation' }], ctx);
    expect(v.total).toBe(2500);
    expect(() => calculerVente([{ libelle: 'Don', prixUnitaire: 1000 }], ctx)).toThrow(FinanceError);
    expect(() => calculerVente([{ libelle: '', prixUnitaire: 1000, categorieId: 'c-emulation' }], ctx)).toThrow(FinanceError);
    expect(() => calculerVente([{ libelle: 'Don', prixUnitaire: 0, categorieId: 'c-emulation' }], ctx)).toThrow(FinanceError);
  });

  it('stock insuffisant (quantités cumulées sur plusieurs lignes)', () => {
    expect(() => calculerVente([{ articleId: 'a1', quantite: 2 }, { articleId: 'a1', quantite: 2 }], ctx)).toThrow(/Stock insuffisant/);
  });

  it('article retiré du catalogue, quantité invalide, vente vide', () => {
    expect(() => calculerVente([{ articleId: 'a3' }], ctx)).toThrow(FinanceError);
    expect(() => calculerVente([{ articleId: 'a2', quantite: 0 }], ctx)).toThrow(FinanceError);
    expect(() => calculerVente([], ctx)).toThrow(FinanceError);
  });
});
