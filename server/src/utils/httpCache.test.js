import { describe, it, expect } from 'vitest';
import { cdnImageUrl, withCdnImages } from './httpCache.js';
import { cacheGet, cacheSet, cacheDel, CacheKeys } from './cache.js';

describe('cdnImageUrl', () => {
  it('ajoute f_auto,q_auto,w_ sur Cloudinary', () => {
    const url = 'https://res.cloudinary.com/demo/image/upload/v1/logo.png';
    expect(cdnImageUrl(url, { width: 400 })).toContain('/upload/f_auto,q_auto,w_400/');
  });

  it('laisse intactes les URLs non-Cloudinary', () => {
    const url = 'https://example.com/logo.png';
    expect(cdnImageUrl(url)).toBe(url);
  });
});

describe('withCdnImages', () => {
  it('transforme logoUrl et backgroundImageUrl', () => {
    const out = withCdnImages({
      logoUrl: 'https://res.cloudinary.com/demo/image/upload/v1/a.png',
      backgroundImageUrl: 'https://res.cloudinary.com/demo/image/upload/v1/b.png',
    });
    expect(out.logoUrl).toContain('w_400');
    expect(out.backgroundImageUrl).toContain('w_1600');
  });
});

describe('cache mémoire', () => {
  it('set/get/del', async () => {
    const key = CacheKeys.tenantConfig('test-cache-unit');
    await cacheSet(key, { ok: true }, 30);
    expect(await cacheGet(key)).toEqual({ ok: true });
    await cacheDel(key);
    expect(await cacheGet(key)).toBeNull();
  });
});
