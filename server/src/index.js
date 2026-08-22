import { config } from './config.js';
import { initSentry, SentryExport } from './utils/sentry.js';
const sentryEnabled = initSentry();
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import os from 'os';
import { createServer } from 'http';
import { Server } from 'socket.io';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import { tenantMiddleware, optionalTenantMiddleware } from './middleware/tenantMiddleware.js';
import { requestLogger } from './middleware/requestLogger.js';
import { setupSocketRooms } from './utils/schoolEvents.js';
import { prisma, rawPrisma } from './utils/prisma.js';
import logger from './utils/logger.js';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './utils/swagger.js';
import { verifyCloudinary, isCloudinaryConfigured } from './utils/cloudinary.js';
import { verifySmtpConnection } from './services/email.service.js';
import jwt from 'jsonwebtoken';
import { config as appConfig } from './config.js';
import { authenticate, requireRole } from './middleware/authMiddleware.js';
import { initCache, getCacheBackend } from './utils/cache.js';
import { cacheControlMiddleware } from './utils/httpCache.js';

let dbConnected = false;

// Routes
import configRoutes from './routes/config.js';
import authRoutes from './routes/auth.js';
import elevesRoutes from './routes/eleves.js';
import classesRoutes from './routes/classes.js';
import anneesScolairesRoutes from './routes/anneesScolaires.js';
import matieresRoutes from './routes/matieres.js';
import inscriptionsRoutes from './routes/inscriptions.js';
import evaluationsRoutes from './routes/evaluations.js';
import bulletinsRoutes from './routes/bulletins.js';
import paiementsRoutes from './routes/paiements.js';
import depensesRoutes from './routes/depenses.js';
import emploisDuTempsRoutes from './routes/emploisDuTemps.js';
import absencesRoutes from './routes/absences.js';
import sanctionsRoutes from './routes/sanctions.js';
import actualitesRoutes from './routes/actualites.js';
import dashboardRoutes from './routes/dashboard.js';
import staffRoutes from './routes/staff.js';
import publicRoutes from './routes/public.js';
import superadminRoutes from './routes/superadmin.js';
import certificatsRoutes from './routes/certificats.js';
import cahierDeTextesRoutes from './routes/cahierDeTextes.js';
import conseilDeClasseRoutes from './routes/conseilDeClasse.js';
import sallesRoutes from './routes/salles.js';
import calendrierRoutes from './routes/calendrierScolaire.js';
import messagesRoutes from './routes/messages.js';
import rapportsRoutes from './routes/rapports.js';
import parentRoutes from './routes/parent.js';
import parentsRoutes from './routes/parents.js';
import enseignantRoutes from './routes/enseignant.js';
import referentielRoutes from './routes/referentiel.js';
import examensRoutes from './routes/examens.js';
import notificationsRoutes from './routes/notifications.js';

const app = express();
const httpServer = createServer(app);

// CORS dynamique pour multi-origins (Vercel, localhost, Render)
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:5173',
  'http://localhost:4173',
  'http://localhost:5175',
  /https:\/\/.*\.vercel\.app$/,
].filter(Boolean);

const corsOriginCallback = (origin, callback) => {
  if (!origin) return callback(null, true);
  const allowed = allowedOrigins.some(o =>
    o instanceof RegExp ? o.test(origin) : o === origin
  );
  if (allowed) return callback(null, true);
  callback(new Error(`CORS bloqué: ${origin}`));
};

const corsOptions = {
  origin: corsOriginCallback,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-Slug', 'X-Requested-With'],
};

// Socket.IO
export const io = new Server(httpServer, {
  cors: {
    origin: corsOriginCallback,
    credentials: true,
    methods: ['GET', 'POST'],
  }
});

// Socket.IO — authentification JWT au handshake
io.use((socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.headers?.cookie?.match(/accessToken=([^;]+)/)?.[1];
  if (!token) {
    return next(new Error('Authentification requise pour Socket.IO'));
  }
  try {
    const decoded = jwt.verify(token, appConfig.jwtSecret);
    socket.handshake.auth = {
      ...socket.handshake.auth,
      userId: decoded.userId,
      role: decoded.role,
      tenantId: decoded.tenantId,
    };
    next();
  } catch (err) {
    next(new Error('Token invalide ou expiré'));
  }
});

io.on('connection', (socket) => {
  setupSocketRooms(socket);
  socket.on('disconnect', () => {});
});

// ✅ 1. CORS EN PREMIER — avant helmet, rate limiter et tout le reste
app.use(cors(corsOptions));

// ✅ 2. Répondre 200 à toutes les requêtes OPTIONS (preflight cross-origin)
app.options('*', cors(corsOptions));

// ✅ 3. Sécurité Helmet (après CORS)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        process.env.NODE_ENV === 'development' ? "'unsafe-inline'" : null,
        process.env.NODE_ENV === 'development' ? "'unsafe-eval'" : null,
      ].filter(Boolean),
      styleSrc: [
        "'self'",
        "'unsafe-inline'",
        "https://fonts.googleapis.com",
      ],
      fontSrc: [
        "'self'",
        "https://fonts.gstatic.com",
        "data:",
      ],
      imgSrc: [
        "'self'",
        "data:",
        "blob:",
        "https://res.cloudinary.com",
        process.env.CDN_URL ?? null,
      ].filter(Boolean),
      mediaSrc: [
        "'self'",
        "https://res.cloudinary.com",
      ],
      connectSrc: [
        "'self'",
        process.env.NODE_ENV === 'development'
          ? "ws://localhost:*"
          : `wss://${process.env.DOMAIN ?? ''}`,
        process.env.FRONTEND_URL ?? "http://localhost:5173",
        "https://res.cloudinary.com",
        "https://*.sentry.io",
        "https://sentry.io",
      ].filter(Boolean),
      frameSrc: [
        "https://res.cloudinary.com",
      ],
      frameAncestors: ["'none'"],
      objectSrc: [
        "https://res.cloudinary.com",
      ],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      upgradeInsecureRequests:
        process.env.NODE_ENV === 'production' ? [] : null,
    },
    reportOnly: process.env.NODE_ENV === 'development',
  },
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  hsts: process.env.NODE_ENV === 'production'
    ? { maxAge: 31536000, includeSubDomains: true, preload: true }
    : false,
  dnsPrefetchControl: { allow: false },
  frameguard: { action: 'deny' },
  hidePoweredBy: true,
  ieNoOpen: true,
  noSniff: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  xssFilter: true,
}));

// ✅ 4. Rate limiting (après CORS pour ne pas bloquer les preflight)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 10000 : process.env.NODE_ENV === 'development' ? 100 : 10,
  message: { success: false, message: 'Trop de tentatives. Réessayez dans 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  message: { success: false, message: 'Trop de requêtes.' },
});

app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);
app.use('/api/auth/reset-password', authLimiter);
app.use('/api', apiLimiter);

// ✅ 5. Autres middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(SentryExport.Handlers.requestHandler());
app.use(SentryExport.Handlers.tracingHandler());
app.use(requestLogger);
app.use(cacheControlMiddleware);

// Static files — Cache-Control long (CDN/browser) pour logos/uploads locaux
app.use('/uploads', express.static('uploads', {
  maxAge: '1d',
  etag: true,
  lastModified: true,
  setHeaders(res) {
    res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
  },
}));

// Documentation API
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'GestSchool API Docs',
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
  },
}));

app.get('/api/docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.json(swaggerSpec);
});

// Infos réseau — réservé au super_admin
app.get('/api/network/info', authenticate, requireRole('super_admin'), (req, res) => {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push({ ip: iface.address, interface: name });
      }
    }
  }
  res.json({ addresses, hostname: os.hostname() });
});

// Routes publiques (sans tenant middleware)
app.use('/api/config', configRoutes);
app.use('/api/public', tenantMiddleware, publicRoutes);

// Routes avec tenant middleware (auth en mode optionnel : super_admin n'a pas de tenant)
app.use('/api/auth', optionalTenantMiddleware, authRoutes);
app.use('/api/eleves', tenantMiddleware, elevesRoutes);
app.use('/api/classes', tenantMiddleware, classesRoutes);
app.use('/api/annees-scolaires', tenantMiddleware, anneesScolairesRoutes);
app.use('/api/referentiel', tenantMiddleware, referentielRoutes);
app.use('/api/examens', tenantMiddleware, examensRoutes);
app.use('/api/matieres', tenantMiddleware, matieresRoutes);
app.use('/api/inscriptions', tenantMiddleware, inscriptionsRoutes);
app.use('/api/evaluations', tenantMiddleware, evaluationsRoutes);
app.use('/api/bulletins', tenantMiddleware, bulletinsRoutes);
app.use('/api/paiements', tenantMiddleware, paiementsRoutes);
app.use('/api/depenses', tenantMiddleware, depensesRoutes);
app.use('/api/emplois-du-temps', tenantMiddleware, emploisDuTempsRoutes);
app.use('/api/absences', tenantMiddleware, absencesRoutes);
app.use('/api/sanctions', tenantMiddleware, sanctionsRoutes);
app.use('/api/actualites', tenantMiddleware, actualitesRoutes);
app.use('/api/dashboard', tenantMiddleware, dashboardRoutes);
app.use('/api/staff', tenantMiddleware, staffRoutes);
app.use('/api/personnel', tenantMiddleware, staffRoutes);
app.use('/api/certificats', tenantMiddleware, certificatsRoutes);
app.use('/api/cahier-de-textes', tenantMiddleware, cahierDeTextesRoutes);
app.use('/api/conseil-de-classe', tenantMiddleware, conseilDeClasseRoutes);
app.use('/api/salles', tenantMiddleware, sallesRoutes);
app.use('/api/calendrier', tenantMiddleware, calendrierRoutes);
app.use('/api/messages', tenantMiddleware, messagesRoutes);
app.use('/api/rapports', tenantMiddleware, rapportsRoutes);
app.use('/api/parent', tenantMiddleware, parentRoutes);
app.use('/api/parents', tenantMiddleware, parentsRoutes);
app.use('/api/enseignant', tenantMiddleware, enseignantRoutes);
app.use('/api/notifications', tenantMiddleware, notificationsRoutes);

// Super admin routes
app.use('/api/superadmin', superadminRoutes);

// Route racine
app.get('/', (req, res) => {
  res.json({
    service: 'GestSchool API',
    version: '1.0.0',
    status: 'running',
    note: "L'interface utilisateur est servie par le client (Vite) sur le port 5173."
  });
});

// Health checks
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    env: process.env.NODE_ENV,
    dbConnected,
    cloudinaryConfigured: isCloudinaryConfigured(),
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/health/smtp', async (req, res) => {
  const result = await verifySmtpConnection();
  const configured = !!(appConfig.brevo.apiKey || (appConfig.smtp.host && appConfig.smtp.user && appConfig.smtp.pass));
  res.json({
    ...result,
    configured,
    host: appConfig.smtp.host || null,
    port: appConfig.smtp.port || null,
    secure: appConfig.smtp.secure,
    from: appConfig.smtp.from || null,
    nodeEnv: appConfig.nodeEnv,
    timestamp: new Date().toISOString()
  });
});

// Sentry error handler
app.use(SentryExport.Handlers.errorHandler());

// Error handler global
app.use((err, req, res, next) => {
  // Erreurs Multer (upload) : fichier trop grand, mauvais champ, format refusé
  if (err.name === 'MulterError' || err.storageErrors !== undefined) {
    logger.warn({ err, url: req.url }, 'Upload error (Multer)');
    return res.status(400).json({ error: err.message || 'Erreur upload' });
  }
  logger.error({ err, url: req.url, method: req.method }, 'Unhandled error');
  res.status(500).json({ error: err.message || 'Internal server error' });
});

const PORT = config.port;

async function verifyDatabaseConnection(maxAttempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await prisma.$connect();
      dbConnected = true;
      logger.info({ attempt }, 'Database connection established successfully');
      return;
    } catch (error) {
      lastError = error;
      dbConnected = false;
      logger.warn({ err: error, attempt, maxAttempts }, 'Database connection attempt failed');
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 1000 * attempt));
      }
    }
  }
  logger.error({ err: lastError }, 'Database connection failed after 3 attempts');
  throw lastError;
}

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

if (process.env.NODE_ENV !== 'test') httpServer.listen(PORT, '0.0.0.0', async () => {
  const lanIP = getLocalIP();
  const env = process.env.NODE_ENV || 'development';
  const clientUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

  logger.info({ port: PORT, env, lanIP, clientUrl }, 'GestSchool API server started');
  logger.info('API endpoints: /api/config, /api/auth, /api/eleves, /api/classes, /api/annees-scolaires, /api/matieres, /api/inscriptions, /api/evaluations, /api/bulletins, /api/paiements, /api/depenses, /api/emplois-du-temps, /api/absences, /api/sanctions, /api/actualites, /api/dashboard, /api/staff, /api/public, /api/superadmin, /api/certificats, /api/cahier-de-textes, /api/conseil-de-classe, /api/salles, /api/calendrier, /api/messages, /api/rapports, /api/parent, /api/enseignant');

  const cleanExpiredTokens = async () => {
    if (!dbConnected) {
      logger.warn('Skipping cleanup - database not connected');
      return;
    }
    try {
      const now = new Date();
      const [rt, prt, evt] = await Promise.all([
        prisma.refreshToken.deleteMany({ where: { expiresAt: { lt: now } } }),
        rawPrisma.passwordResetToken.deleteMany({ where: { expiresAt: { lt: now } } }),
        rawPrisma.emailVerificationToken.deleteMany({ where: { expiresAt: { lt: now } } }),
      ]);
      const total = rt.count + prt.count + evt.count;
      if (total > 0) logger.info({ refreshTokens: rt.count, passwordResetTokens: prt.count, emailVerifTokens: evt.count }, 'Expired tokens cleaned up');
    } catch (err) {
      logger.error({ err }, 'Error cleaning up expired tokens');
    }
  };

  try {
    const cacheInfo = await initCache();
    logger.info({ backend: cacheInfo.backend || getCacheBackend() }, 'Cache layer ready');
    await verifyDatabaseConnection(3);
    const cloudinaryOk = await verifyCloudinary();
    if (!cloudinaryOk) {
      logger.warn('⚠️  Cloudinary non configuré — les uploads d\'images et PDF seront rejetés. Vérifiez CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET dans le dashboard Render.');
    }
    cleanExpiredTokens();
    setInterval(cleanExpiredTokens, 24 * 60 * 60 * 1000);

    const { startRelancesCron } = await import('./jobs/relances.job.js');
    startRelancesCron();
    const { startAlertesCalendrierCron } = await import('./jobs/alertesCalendrier.job.js');
    startAlertesCalendrierCron();
  } catch (error) {
    logger.fatal({ err: error }, 'Cannot start without database connection');
    process.exit(1);
  }
});

httpServer.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    logger.error({ port: PORT }, 'Port already in use by another process');
    process.exit(1);
  }
  logger.error({ err }, 'HTTP server error');
  throw err;
});

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  logger.info({ signal }, 'Starting graceful shutdown');
  try {
    httpServer.close(() => {
      logger.info('HTTP server closed');
    });
    if (dbConnected) {
      await prisma.$disconnect();
      logger.info('Database disconnected');
    }
    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error({ err: error }, 'Error during shutdown');
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));


process.on('uncaughtException', (error) => {
  logger.fatal({ err: error }, 'Uncaught exception');
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});


process.on('unhandledRejection', (reason, promise) => {
  logger.fatal({ reason, promise }, 'Unhandled promise rejection');
  gracefulShutdown('UNHANDLED_REJECTION');
});

export { app }
export default app;
