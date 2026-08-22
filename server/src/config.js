import dotenv from 'dotenv';
dotenv.config();

const required = ['JWT_SECRET', 'JWT_REFRESH_SECRET', 'DATABASE_URL'];
for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Variable d'environnement manquante : ${key}`);
  }
}

const isProd = process.env.NODE_ENV === 'production';
const weakFragments = [
  'change-in-production',
  'your-super-secret',
  'ci-test-secret',
  'not-for-production',
];

if (isProd) {
  const jwt = process.env.JWT_SECRET || '';
  const jwtRefresh = process.env.JWT_REFRESH_SECRET || '';
  if (jwt.length < 32 || jwtRefresh.length < 32) {
    throw new Error('JWT_SECRET / JWT_REFRESH_SECRET doivent faire au moins 32 caractères en production');
  }
  if (jwt === jwtRefresh) {
    throw new Error('JWT_SECRET et JWT_REFRESH_SECRET doivent être distincts');
  }
  for (const frag of weakFragments) {
    if (jwt.toLowerCase().includes(frag) || jwtRefresh.toLowerCase().includes(frag)) {
      throw new Error(`Secrets JWT trop faibles pour la production (motif: ${frag})`);
    }
  }
}

const cloudinaryVars = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'];
const missingCloudinary = cloudinaryVars.filter(k => !process.env[k]);
if (missingCloudinary.length > 0) {
  if (isProd) {
    console.warn(`⚠️  ATTENTION — Variables Cloudinary manquantes : ${missingCloudinary.join(', ')}. Les uploads d'images et PDF seront désactivés.`);
  } else {
    console.warn(`Variables Cloudinary manquantes : ${missingCloudinary.join(', ')}. Uploads désactivés en développement.`);
  }
}

export const config = {
  jwtSecret: process.env.JWT_SECRET,
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET,
  port: parseInt(process.env.PORT ?? '3000'),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  databaseUrl: process.env.DATABASE_URL,
  smtp: {
    host: process.env.SMTP_HOST || null,
    port: parseInt(process.env.SMTP_PORT ?? '587'),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || null,
    pass: process.env.SMTP_PASS || null,
    from: process.env.SMTP_FROM || 'noreply@gestschool.local',
  },
  brevo: {
    apiKey: process.env.BREVO_API_KEY || null,
  },
};
