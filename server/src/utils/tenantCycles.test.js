import { describe, it, expect } from 'vitest';
import {
  ALL_CYCLES,
  CYCLE_LABELS,
  resolveTenantCycles,
  isCycleAllowed,
  filterByTenantCycles,
} from './tenantCycles.js';

describe('tenantCycles utility', () => {
  it('contient les 4 cycles d\'enseignement valides', () => {
    expect(ALL_CYCLES).toEqual(['prescolaire', 'primaire', 'college', 'lycee']);
    expect(Object.keys(CYCLE_LABELS)).toHaveLength(4);
  });

  it('resolveTenantCycles retourne null pour null ou tableau vide (tous cycles)', () => {
    expect(resolveTenantCycles(null)).toBeNull();
    expect(resolveTenantCycles(undefined)).toBeNull();
    expect(resolveTenantCycles([])).toBeNull();
    expect(resolveTenantCycles(['invalide'])).toBeNull();
  });

  it('resolveTenantCycles conserve uniquement les cycles valides', () => {
    expect(resolveTenantCycles(['primaire', 'inconnu'])).toEqual(['primaire']);
    expect(resolveTenantCycles(['prescolaire', 'primaire'])).toEqual(['prescolaire', 'primaire']);
  });

  it('isCycleAllowed autorise tout si concerneCycles est null', () => {
    expect(isCycleAllowed('primaire', null)).toBe(true);
    expect(isCycleAllowed('lycee', null)).toBe(true);
    expect(isCycleAllowed('college', [])).toBe(true);
  });

  it('isCycleAllowed restreint strictement selon les cycles autorisés', () => {
    const cyclesPrimaire = ['primaire'];
    expect(isCycleAllowed('primaire', cyclesPrimaire)).toBe(true);
    expect(isCycleAllowed('prescolaire', cyclesPrimaire)).toBe(false);
    expect(isCycleAllowed('college', cyclesPrimaire)).toBe(false);
    expect(isCycleAllowed('lycee', cyclesPrimaire)).toBe(false);
  });

  it('filterByTenantCycles filtre correctement une liste d\'objets par cycle', () => {
    const items = [
      { id: '1', code: 'CP1', cycle: 'primaire' },
      { id: '2', code: 'CM2', cycle: 'primaire' },
      { id: '3', code: '6e', cycle: 'college' },
      { id: '4', code: 'Tle', cycle: 'lycee' },
    ];

    const resultPrimaire = filterByTenantCycles(items, ['primaire'], (x) => x.cycle);
    expect(resultPrimaire).toHaveLength(2);
    expect(resultPrimaire.map((x) => x.code)).toEqual(['CP1', 'CM2']);

    const resultSecondaire = filterByTenantCycles(items, ['college', 'lycee'], (x) => x.cycle);
    expect(resultSecondaire).toHaveLength(2);
    expect(resultSecondaire.map((x) => x.code)).toEqual(['6e', 'Tle']);

    const resultAll = filterByTenantCycles(items, null, (x) => x.cycle);
    expect(resultAll).toHaveLength(4);
  });
});
