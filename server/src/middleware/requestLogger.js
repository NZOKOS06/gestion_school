import logger from '../utils/logger.js';

// Log chaque requête HTTP avec durée
export function requestLogger(req, res, next) {
  const start = Date.now();
  const reqLogger = logger.child({
    context: 'HTTP',
    method: req.method,
    url: req.url,
  });

  res.on('finish', () => {
    const duration = Date.now() - start;
    const level = res.statusCode >= 500 ? 'error'
                : res.statusCode >= 400 ? 'warn'
                : 'info';

    reqLogger[level]({
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      tenantSlug: req.tenant?.slug ?? 'unknown',
      userRole: req.user?.role ?? 'anonymous',
    }, `${req.method} ${req.url} ${res.statusCode}`);
  });

  next();
}
