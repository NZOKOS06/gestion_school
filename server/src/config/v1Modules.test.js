import { describe, it, expect } from 'vitest';
import {
  CRITICAL_MODULES,
  V1_CORE_MODULES,
  V1_FROZEN_OFF,
  moduleFlagsForPlan,
  enforceModuleConstraints,
} from './v1Modules.js';

describe('v1Modules gel produit', () => {
  it('basique = cœur V1 uniquement', () => {
    const flags = moduleFlagsForPlan('basique');
    for (const m of V1_CORE_MODULES) {
      expect(flags[m], m).toBe(true);
    }
    for (const m of V1_FROZEN_OFF) {
      expect(flags[m], m).toBe(false);
    }
  });

  it('starter = critiques cash-flow seulement', () => {
    const flags = moduleFlagsForPlan('starter');
    for (const m of CRITICAL_MODULES) {
      expect(flags[m]).toBe(true);
    }
    expect(flags.moduleBulletins).toBe(false);
    expect(flags.moduleEmploiDuTemps).toBe(false);
  });

  it('enforceModuleConstraints force les critiques et coupe le hors-plan', () => {
    const out = enforceModuleConstraints(
      { moduleEleves: false, moduleEmploiDuTemps: true, moduleSanctions: true },
      'basique'
    );
    expect(out.moduleEleves).toBe(true);
    expect(out.modulePaiements).toBe(true);
    expect(out.moduleEmploiDuTemps).toBe(false);
    expect(out.moduleSanctions).toBe(false);
  });
});
