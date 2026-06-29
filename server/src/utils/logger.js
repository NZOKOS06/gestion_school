import pino from 'pino';

const isDev = process.env.NODE_ENV !== 'production';

const logger = pino({
  level: process.env.LOG_LEVEL ?? (isDev ? 'debug' : 'info'),

  // En dev : format lisible coloré
  // En prod : JSON brut pour parsing par Datadog/CloudWatch/etc.
  transport: isDev ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'dd/MM/yyyy HH:mm:ss',
      ignore: 'pid,hostname',
      messageFormat: '[{context}] {msg}',
    }
  } : undefined,

  // Champs de base ajoutés à chaque log
  base: {
    app: 'gestschool',
    version: '1.0.0',
    env: process.env.NODE_ENV,
  },

  // Sérialiser les erreurs correctement
  serializers: {
    err: pino.stdSerializers.err,
    error: pino.stdSerializers.err,
    req: (req) => ({
      method: req.method,
      url: req.url,
      tenantSlug: req.tenant?.slug,
      userRole: req.user?.role,
    }),
    res: (res) => ({
      statusCode: res.statusCode,
    }),
  },
});

// Logger enfant avec contexte
export function createLogger(context) {
  return logger.child({ context });
}

export default logger;
