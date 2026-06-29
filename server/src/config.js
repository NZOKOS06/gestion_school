import dotenv from 'dotenv';
dotenv.config();

const required = ['JWT_SECRET', 'JWT_REFRESH_SECRET', 'DATABASE_URL'];
for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Variable d'environnement manquante : ${key}`);
  }
}

const cloudinaryVars = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'];
const missingCloudinary = cloudinaryVars.filter(k => !process.env[k]);
if (missingCloudinary.length > 0) {
  if (process.env.NODE_ENV === 'production') {
    console.warn(`⚠️  ATTENTION — Variables Cloudinary manquantes : ${missingCloudinary.join(', ')}. Les uploads de fichiers seront désactivés.`);
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
