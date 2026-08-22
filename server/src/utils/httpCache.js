/**
 * Headers Cache-Control / CDN hints.
 * - Assets Cloudinary / uploads : longue durée (immutable-ish)
 * - Config publique : courte durée + stale-while-revalidate
 * - API authentifiée : no-store
 */
export function cacheControlMiddleware(req, res, next) {
  const path = req.path || '';

  if (path.startsWith('/uploads')) {
    res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
    return next();
  }

  if (path.startsWith('/api/config/') && req.method === 'GET') {
    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    return next();
  }

  if (path.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'private, no-store');
    return next();
  }

  next();
}

/**
 * Transforme une URL Cloudinary pour servir via CDN optimisé (f_auto, q_auto, w limité).
 */
export function cdnImageUrl(url, { width = 800, height } = {}) {
  if (!url || typeof url !== 'string') return url;
  if (!url.includes('res.cloudinary.com') && !url.includes('cloudinary.com')) {
    return url;
  }
  // Insert transformation after /upload/
  if (url.includes('/upload/') && !url.includes('/upload/f_auto')) {
    const parts = [];
    parts.push('f_auto', 'q_auto');
    if (width) parts.push(`w_${width}`);
    if (height) parts.push(`h_${height}`, 'c_limit');
    return url.replace('/upload/', `/upload/${parts.join(',')}/`);
  }
  return url;
}

export function withCdnImages(payload) {
  if (!payload || typeof payload !== 'object') return payload;
  const out = { ...payload };
  for (const key of [
    'logoUrl',
    'faviconUrl',
    'backgroundImageUrl',
    'loaderUrl',
    'heroImageUrl',
    'featuresImageUrl',
    'aboutImageUrl',
    'photoUrl',
  ]) {
    if (out[key]) out[key] = cdnImageUrl(out[key], { width: key === 'logoUrl' || key === 'faviconUrl' ? 400 : 1600 });
  }
  return out;
}
