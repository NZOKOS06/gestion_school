import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

let sentryInitialized = false;

export function initSentry() {
  if (!process.env.SENTRY_DSN) {
    console.warn('[Sentry] SENTRY_DSN non défini — monitoring désactivé');
    return false;
  }

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV ?? 'development',
    release: `gestschool@${process.env.npm_package_version ?? '1.0.0'}`,

    integrations: [
      nodeProfilingIntegration(),
    ],

    // Capture 100% des transactions en dev, 10% en prod
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    profilesSampleRate: 1.0,

    // Ne pas logger les infos sensibles
    beforeSend(event) {
      // Supprimer les passwords des données capturés
      if (event.request?.data) {
        const data = event.request.data;
        if (data.password) data.password = '[FILTERED]';
        if (data.currentPassword) data.currentPassword = '[FILTERED]';
        if (data.newPassword) data.newPassword = '[FILTERED]';
      }
      return event;
    },
  });
  sentryInitialized = true;
  return true;
}

// Capturer une erreur manuellement avec contexte tenant
export function captureError(error, context = {}) {
  if (!sentryInitialized) return;
  Sentry.withScope(scope => {
    if (context.tenantId) scope.setTag('tenantId', context.tenantId);
    if (context.tenantSlug) scope.setTag('tenantSlug', context.tenantSlug);
    if (context.userId) scope.setUser({ id: context.userId });
    if (context.action) scope.setContext('action', { name: context.action });
    Sentry.captureException(error);
  });
}

// Handlers mock quand Sentry n'est pas initialisé
const mockHandlers = {
  requestHandler: () => (req, res, next) => next(),
  tracingHandler: () => (req, res, next) => next(),
  errorHandler: () => (err, req, res, next) => next(err),
};

// Export statique : utilise les vrais handlers Sentry si initialisé, sinon le mock
let activeHandlers = mockHandlers;

export function getSentryHandlers() {
  return activeHandlers;
}

// Proxy dynamique pour compatibilité
export const SentryExport = new Proxy({}, {
  get(_target, prop) {
    if (prop === 'Handlers') {
      return activeHandlers;
    }
    return undefined;
  }
});
