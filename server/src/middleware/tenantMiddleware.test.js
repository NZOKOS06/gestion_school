import { describe, it, expect } from 'vitest';
import { requireModule } from './tenantMiddleware.js';

describe('requireModule aliases (Phase 0)', () => {
  it('maps absences to modulePresences', () => {
    const mw = requireModule('absences');
    let nextCalled = false;
    const req = { tenant: { config: { modulePresences: true } } };
    const res = { status: () => ({ json: () => {} }) };
    mw(req, res, () => { nextCalled = true; });
    expect(nextCalled).toBe(true);
  });

  it('blocks when modulePresences is false', () => {
    const mw = requireModule('absences');
    let statusCode = null;
    const req = { tenant: { config: { modulePresences: false } } };
    const res = {
      status: (code) => {
        statusCode = code;
        return { json: () => {} };
      },
    };
    mw(req, res, () => {});
    expect(statusCode).toBe(403);
  });

  it('allows actualites when schema flag is absent', () => {
    const mw = requireModule('actualites');
    let nextCalled = false;
    const req = { tenant: { config: { moduleNotes: true } } };
    const res = { status: () => ({ json: () => {} }) };
    mw(req, res, () => { nextCalled = true; });
    expect(nextCalled).toBe(true);
  });
});
