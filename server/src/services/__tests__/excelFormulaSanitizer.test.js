import { describe, it, expect } from 'vitest';
import { sanitizeExcelFormula, unescapeExcelFormula } from '../evaluations.excel.service.js';
import { safeOrderBy } from '../../utils/formatters.js';

describe('Sécurité Défensive — Sanitisation et Whitelist', () => {
  describe('Sanitisation Formules Excel (CWE-1236)', () => {
    it('neutralise les cellules commençant par =, +, -, @, \\t, \\r avec une apostrophe', () => {
      expect(sanitizeExcelFormula('=SUM(A1:A10)')).toBe("'=SUM(A1:A10)");
      expect(sanitizeExcelFormula('+cmd|')).toBe("'+cmd|");
      expect(sanitizeExcelFormula('-1+1')).toBe("'-1+1");
      expect(sanitizeExcelFormula('@SUM')).toBe("'@SUM");
      expect(sanitizeExcelFormula('\tmalicious')).toBe("'\tmalicious");
    });

    it('laisse intactes les chaînes ordinaires inoffensives', () => {
      expect(sanitizeExcelFormula('MOUKOKO')).toBe('MOUKOKO');
      expect(sanitizeExcelFormula('Très bon travail.')).toBe('Très bon travail.');
      expect(sanitizeExcelFormula('')).toBe('');
      expect(sanitizeExcelFormula(null)).toBe('');
    });

    it('déséchappe proprement les valeurs lors du réimport', () => {
      expect(unescapeExcelFormula("'=SUM(A1:A10)")).toBe('=SUM(A1:A10)');
      expect(unescapeExcelFormula("Très bon travail.")).toBe('Très bon travail.');
      expect(unescapeExcelFormula(null)).toBeNull();
    });
  });

  describe('Tri sécurisé (safeOrderBy)', () => {
    const allowed = ['nom', 'matricule', 'createdAt'];

    it('retourne le champ demandé s il fait partie de la whitelist', () => {
      expect(safeOrderBy('nom', 'asc', allowed)).toEqual({ nom: 'asc' });
      expect(safeOrderBy('matricule', 'desc', allowed)).toEqual({ matricule: 'desc' });
    });

    it('se replie sur le champ par défaut en cas de tentative d injection ou nom invalide', () => {
      expect(safeOrderBy('admin;DROP TABLE "User";', 'asc', allowed, 'nom', 'asc')).toEqual({ nom: 'asc' });
      expect(safeOrderBy('unknown_col', 'desc', allowed, 'createdAt', 'desc')).toEqual({ createdAt: 'desc' });
      expect(safeOrderBy(null, null, allowed, 'nom', 'asc')).toEqual({ nom: 'asc' });
    });
  });
});
