import bcrypt from 'bcryptjs';
import { prisma, rawPrisma } from '../utils/prisma.js';
import { uploadLogo as cloudUploadLogo, uploadImage, uploadVideo } from '../utils/cloudinary.js';
import { createLogger } from '../utils/logger.js';
import { logAudit } from '../utils/auditLogger.js';
import { generateRandomPassword } from '../utils/password.js';
import { sendStaffWelcomeEmail } from '../services/email.service.js';
import { buildTenantUrl } from '../utils/tenantUrl.js';
import {
  CRITICAL_MODULES,
  MODULES_BY_PLAN,
  enforceModuleConstraints,
  moduleFlagsForPlan,
} from '../config/v1Modules.js';
import { cacheDel, CacheKeys } from '../utils/cache.js';

async function invalidateTenantConfigCache(tenantId) {
  if (!tenantId) return;
  const tenant = await rawPrisma.tenant.findUnique({
    where: { id: tenantId },
    select: { slug: true },
  });
  if (tenant?.slug) await cacheDel(CacheKeys.tenantConfig(tenant.slug));
}

const VALID_CONFIG_FIELDS = new Set([
  'nomApp', 'nom', 'sloganApp', 'descriptionAbout', 'anneeCreation', 'rccm',
  'logoUrl', 'footerLogoUrl', 'faviconUrl', 'pwaIconUrl', 'backgroundImageUrl', 'heroImageUrl',
  'featuresImageUrl', 'aboutImageUrl', 'heroVideoUrl', 'featuresVideoUrl', 'aboutVideoUrl',
  'ogImageUrl', 'loaderUrl',
  'couleurPrimaire', 'couleurSecondaire', 'couleurTexte', 'couleurAlerte', 'couleurErreur', 'couleurSucces',
  'darkModeDefault', 'police', 'devise',
  'adresse', 'telephone', 'email', 'numeroAutorisation', 'numeroTVA', 'nomDirecteur',
  'facebookUrl', 'instagramUrl', 'whatsappUrl', 'telegramUrl', 'googleMapsUrl', 'latitude', 'longitude',
  'horaireOuverture', 'messageAccueil',
  'metaTitle', 'metaDescription', 'metaKeywords',
  'notationSur', 'seuilReussite', 'nombrePeriodes', 'fraisInscriptionDefault', 'fraisScolariteDefault',
  'emailAlertes', 'dureeSessionMinutes', 'ipWhitelist', 'forcer2FA',
  'privacyPolicyUrl', 'termsOfServiceUrl', 'cookiePolicyUrl', 'cookieBannerText', 'cookieBannerEnabled', 'analyticsEnabled',
  'moduleEleves', 'moduleClasses', 'moduleNotes', 'moduleBulletins', 'modulePaiements',
  'moduleEmploiDuTemps', 'modulePresences', 'moduleSanctions', 'moduleActualites', 'modulePersonnel',
  'moduleRapports', 'moduleInscriptions', 'moduleParents', 'moduleCertificats',
  'moduleBiblio', 'moduleCantine', 'moduleTransport',
]);

const isValidUrl = (value) => {
  if (!value) return false;
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
};

const sanitizeConfigBody = (body) => {
  const config = {};
  for (const key of Object.keys(body)) {
    if (!VALID_CONFIG_FIELDS.has(key)) continue;
    const value = body[key];
    if (value === '' || value === null || value === undefined) {
      config[key] = value === '' ? null : value;
      continue;
    }
    if (key === 'notationSur' || key === 'nombrePeriodes') {
      const num = parseInt(value, 10);
      config[key] = isNaN(num) ? 0 : num;
    } else if (key === 'seuilReussite' || key === 'fraisInscriptionDefault' || key === 'fraisScolariteDefault') {
      const num = parseFloat(value);
      config[key] = isNaN(num) ? 0 : num;
    } else if (key === 'anneeCreation' || key === 'dureeSessionMinutes') {
      const num = parseInt(value, 10);
      config[key] = isNaN(num) ? 0 : num;
    } else if (key === 'latitude' || key === 'longitude') {
      const num = parseFloat(value);
      config[key] = isNaN(num) ? null : num;
    } else if (['horaireOuverture', 'modesPaiement', 'ipWhitelist'].includes(key)) {
      if (typeof value === 'object' && value !== null) {
        config[key] = value;
      } else if (typeof value === 'string') {
        try {
          config[key] = JSON.parse(value);
        } catch {
          config[key] = null;
        }
      } else {
        config[key] = null;
      }
    } else if (['facebookUrl', 'instagramUrl', 'whatsappUrl', 'telegramUrl', 'googleMapsUrl', 'ogImageUrl', 'loaderUrl', 'faviconUrl', 'pwaIconUrl', 'footerLogoUrl', 'privacyPolicyUrl', 'termsOfServiceUrl', 'cookiePolicyUrl'].includes(key)) {
      config[key] = isValidUrl(value) ? value : null;
    } else if (['cookieBannerEnabled', 'analyticsEnabled', 'forcer2FA'].includes(key)) {
      config[key] = value === true || value === 'true' || value === 1 || value === '1';
    } else {
      config[key] = value;
    }
  }
  return { config, ipWhitelist: body.ipWhitelist };
};

const log = createLogger('SuperAdminController');

export const getTenants = async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const where = search ? {
      OR: [
        { nom: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } }
      ]
    } : {};

    const [tenants, total] = await Promise.all([
      prisma.tenant.findMany({
        where,
        include: { config: true, _count: { select: { staff: true, users: true, eleves: true, classes: true } } },
        skip: (page - 1) * limit,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' }
      }),
      prisma.tenant.count({ where })
    ]);

    res.json({ data: tenants, pagination: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / limit) } });
  } catch (error) {
    log.error({ err: error, search, page, limit }, 'Get tenants error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getTenantById = async (req, res) => {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.params.id },
      include: { config: true, _count: { select: { staff: true, users: true, eleves: true, classes: true, anneesScolaires: true } } }
    });
    if (!tenant) return res.status(404).json({ error: 'Tenant non trouvé' });
    res.json(tenant);
  } catch (error) {
    log.error({ err: error, id: req.params.id }, 'Get tenant by ID error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createTenant = async (req, res) => {
  try {
    const { nom, slug, plan = 'basique', numeroAutorisation, contact } = req.body;
    if (await rawPrisma.tenant.findUnique({ where: { slug } })) {
      return res.status(409).json({ error: 'Ce slug est déjà utilisé' });
    }

    const moduleDefaults = {
      ...moduleFlagsForPlan(plan),
      ...enforceModuleConstraints({}, plan),
    };
    const tenant = await rawPrisma.tenant.create({
      data: {
        nom,
        slug,
        plan,
        numeroAutorisation,
        contact,
        config: { create: { nomApp: nom, nom, ...moduleDefaults } }
      },
      include: { config: true }
    });

    await logAudit(req, 'tenant_created', 'Tenant', tenant.id, {
      nom: tenant.nom,
      slug: tenant.slug
    });

    res.status(201).json(tenant);
  } catch (error) {
    log.error({ err: error, body: req.body }, 'Create tenant error');
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
};

export const updateTenant = async (req, res) => {
  try {
    const tenantId = req.params.id;
    const { nom, slug, plan, actif, modeMaintenance, domainePersonnalise, numeroAutorisation, contact } = req.body;

    const existing = await rawPrisma.tenant.findUnique({ where: { id: tenantId }, include: { config: true } });
    if (!existing) return res.status(404).json({ error: 'Tenant non trouvé' });

    const data = {};
    if (nom !== undefined) data.nom = nom;
    if (slug !== undefined) data.slug = slug;
    if (plan !== undefined) data.plan = plan;
    if (actif !== undefined) data.actif = actif;
    if (modeMaintenance !== undefined) data.modeMaintenance = modeMaintenance;
    if (domainePersonnalise !== undefined) data.domainePersonnalise = domainePersonnalise;
    if (numeroAutorisation !== undefined) data.numeroAutorisation = numeroAutorisation;
    if (contact !== undefined) data.contact = contact;

    const tenant = await rawPrisma.tenant.update({ where: { id: tenantId }, data, include: { config: true } });

    // Si le plan a changé, réajuster les modules
    if (plan && plan !== existing.plan && tenant.config) {
      const adjusted = enforceModuleConstraints({}, plan);
      await rawPrisma.tenantConfig.update({ where: { tenantId }, data: adjusted });
    }

    await logAudit(req, 'tenant_updated', 'Tenant', tenant.id, {
      nom: tenant.nom,
      slug: tenant.slug,
      plan: tenant.plan,
      actif: tenant.actif
    });

    res.json(tenant);
  } catch (error) {
    log.error({ err: error, id: req.params.id }, 'Update tenant error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateTenantConfig = async (req, res) => {
  try {
    const tenantId = req.params.id;
    let { config: configData, ipWhitelist } = sanitizeConfigBody(req.body);

    const tenant = await rawPrisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) return res.status(404).json({ error: 'Tenant non trouvé' });

    // Synchroniser le nom de l'école
    if (configData.nom && configData.nom !== tenant.nom) {
      await rawPrisma.tenant.update({ where: { id: tenantId }, data: { nom: configData.nom } });
    }

    // Appliquer les contraintes de modules
    configData = enforceModuleConstraints(configData, tenant.plan);

    const updatePayload = { ...configData };
    if (ipWhitelist !== undefined) {
      updatePayload.ipWhitelist = {
        deleteMany: {},
        create: Array.isArray(ipWhitelist) ? ipWhitelist.map(ip => ({ ip })) : []
      };
    }

    const config = await rawPrisma.tenantConfig.upsert({
      where: { tenantId },
      update: updatePayload,
      create: { tenantId, ...updatePayload },
      include: { ipWhitelist: true }
    });

    await invalidateTenantConfigCache(tenantId);
    res.json(config);
  } catch (error) {
    log.error({ err: error, id: req.params.id, body: req.body }, 'Update tenant config error');
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
};

export const deleteTenant = async (req, res) => {
  try {
    const tenant = await prisma.tenant.update({ where: { id: req.params.id }, data: { actif: false } });

    await cacheDel(CacheKeys.tenantConfig(tenant.slug));
    // Enregistrer dans les logs d'audit
    await logAudit(req, 'tenant_deleted', 'Tenant', tenant.id, {
      nom: tenant.nom,
      slug: tenant.slug
    });

    res.json({ message: 'Tenant désactivé' });
  } catch (error) {
    log.error({ err: error, id: req.params.id }, 'Delete tenant error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createTenantStaff = async (req, res) => {
  try {
    const { email, nom, prenom, role = 'directeur' } = req.body;
    const tenantId = req.params.id;
    if (await prisma.staff.findFirst({ where: { email, tenantId } })) {
      return res.status(409).json({ error: 'Email déjà utilisé' });
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { config: true }
    });
    if (!tenant) {
      return res.status(404).json({ error: 'École introuvable' });
    }

    const defaultPassword = generateRandomPassword();
    const passwordHash = await bcrypt.hash(defaultPassword, 12);
    const staff = await prisma.staff.create({
      data: { tenantId, email, passwordHash, nom, prenom, role, mustChangePassword: true }
    });

    // Enregistrer dans les logs d'audit
    await logAudit(req, 'staff_created', 'Staff', staff.id, {
      email: staff.email,
      role: staff.role,
      name: `${staff.prenom} ${staff.nom}`
    });

    // Envoyer l'email de création de compte
    const nomApp = tenant.config?.nomApp || tenant.nom || 'GestSchool';
    const loginUrl = buildTenantUrl(tenant, { path: '/login' });
    try {
      await sendStaffWelcomeEmail({
        to: email,
        password: defaultPassword,
        loginUrl,
        nomApp,
        tenantName: tenant.nom
      });
    } catch (emailError) {
      log.error({ err: emailError, email, tenantId }, 'Failed to send staff welcome email');
    }

    res.status(201).json({
      ...staff,
      motDePasseProvisoire: defaultPassword
    });
  } catch (error) {
    log.error({ err: error, tenantId: req.params.id, body: req.body }, 'Create tenant staff error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getTenantStaff = async (req, res) => {
  try {
    const tenantId = req.params.id;
    const staff = await prisma.staff.findMany({
      where: { tenantId },
      select: {
        id: true,
        email: true,
        nom: true,
        prenom: true,
        role: true,
        telephone: true,
        actif: true,
        mustChangePassword: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(staff);
  } catch (error) {
    log.error({ err: error, tenantId: req.params.id }, 'Get tenant staff error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getStats = async (req, res) => {
  try {
    const stats = await Promise.all([
      prisma.tenant.count(),
      prisma.tenant.count({ where: { actif: true } }),
      prisma.staff.count(),
      prisma.user.count(),
      prisma.eleve.count(),
      prisma.classe.count()
    ]);
    res.json({
      totalTenants: stats[0],
      tenantsActifs: stats[1],
      totalStaff: stats[2],
      totalParents: stats[3],
      totalEleves: stats[4],
      totalClasses: stats[5]
    });
  } catch (error) {
    log.error({ err: error }, 'Get stats error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const uploadLogo = async (req, res) => {
  try {
    cloudUploadLogo.single('logo')(req, res, async (err) => {
      if (err) {
        log.error({ err, tenantId: req.params.id }, 'Upload logo multer error');
        return res.status(400).json({ error: err.message || 'Erreur lors de l\'upload' });
      }
      if (!req.file) {
        log.warn({ tenantId: req.params.id, headers: req.headers['content-type'] }, 'Upload logo: aucun fichier reçu');
        return res.status(400).json({ error: 'Aucun fichier fourni' });
      }
      
      const logoUrl = req.file.path;
      await prisma.tenantConfig.upsert({
        where: { tenantId: req.params.id },
        update: { logoUrl },
        create: { tenantId: req.params.id, logoUrl }
      });

      await invalidateTenantConfigCache(req.params.id);
      res.json({ logoUrl });
    });
  } catch (error) {
    log.error({ err: error, id: req.params.id }, 'Upload logo error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const uploadBackgroundImage = async (req, res) => {
  try {
    uploadImage.single('background')(req, res, async (err) => {
      if (err) {
        log.error({ err, tenantId: req.params.id }, 'Upload background multer error');
        return res.status(400).json({ error: err.message || 'Erreur lors de l\'upload' });
      }
      if (!req.file) {
        log.warn({ tenantId: req.params.id, headers: req.headers['content-type'] }, 'Upload background: aucun fichier reçu');
        return res.status(400).json({ error: 'Aucun fichier fourni' });
      }
      
      const backgroundImageUrl = req.file.path;
      await prisma.tenantConfig.upsert({
        where: { tenantId: req.params.id },
        update: { backgroundImageUrl },
        create: { tenantId: req.params.id, backgroundImageUrl }
      });

      await invalidateTenantConfigCache(req.params.id);
      res.json({ backgroundImageUrl });
    });
  } catch (error) {
    log.error({ err: error, id: req.params.id }, 'Upload background image error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const uploadHeroImage = async (req, res) => {
  try {
    uploadImage.single('hero')(req, res, async (err) => {
      if (err) {
        log.error({ err, tenantId: req.params.id }, 'Upload hero multer error');
        return res.status(400).json({ error: err.message || 'Erreur lors de l\'upload' });
      }
      if (!req.file) {
        log.warn({ tenantId: req.params.id, headers: req.headers['content-type'] }, 'Upload hero: aucun fichier reçu');
        return res.status(400).json({ error: 'Aucun fichier fourni' });
      }
      
      const heroImageUrl = req.file.path;
      await prisma.tenantConfig.upsert({
        where: { tenantId: req.params.id },
        update: { heroImageUrl },
        create: { tenantId: req.params.id, heroImageUrl }
      });

      await invalidateTenantConfigCache(req.params.id);
      res.json({ heroImageUrl });
    });
  } catch (error) {
    log.error({ err: error, id: req.params.id }, 'Upload hero image error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const uploadFeaturesImage = async (req, res) => {
  try {
    uploadImage.single('features')(req, res, async (err) => {
      if (err) {
        log.error({ err, tenantId: req.params.id }, 'Upload features multer error');
        return res.status(400).json({ error: err.message || 'Erreur lors de l\'upload' });
      }
      if (!req.file) {
        log.warn({ tenantId: req.params.id, headers: req.headers['content-type'] }, 'Upload features: aucun fichier reçu');
        return res.status(400).json({ error: 'Aucun fichier fourni' });
      }
      
      const featuresImageUrl = req.file.path;
      await prisma.tenantConfig.upsert({
        where: { tenantId: req.params.id },
        update: { featuresImageUrl },
        create: { tenantId: req.params.id, featuresImageUrl }
      });

      await invalidateTenantConfigCache(req.params.id);
      res.json({ featuresImageUrl });
    });
  } catch (error) {
    log.error({ err: error, id: req.params.id }, 'Upload features image error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const uploadAboutImage = async (req, res) => {
  try {
    uploadImage.single('about')(req, res, async (err) => {
      if (err) {
        log.error({ err, tenantId: req.params.id }, 'Upload about multer error');
        return res.status(400).json({ error: err.message || 'Erreur lors de l\'upload' });
      }
      if (!req.file) {
        log.warn({ tenantId: req.params.id, headers: req.headers['content-type'] }, 'Upload about: aucun fichier reçu');
        return res.status(400).json({ error: 'Aucun fichier fourni' });
      }

      const aboutImageUrl = req.file.path;
      await prisma.tenantConfig.upsert({
        where: { tenantId: req.params.id },
        update: { aboutImageUrl },
        create: { tenantId: req.params.id, aboutImageUrl }
      });

      await invalidateTenantConfigCache(req.params.id);
      res.json({ aboutImageUrl });
    });
  } catch (error) {
    log.error({ err: error, id: req.params.id }, 'Upload about image error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const uploadHeroVideo = async (req, res) => {
  try {
    uploadVideo.single('hero-video')(req, res, async (err) => {
      if (err) {
        log.error({ err, tenantId: req.params.id }, 'Upload hero video multer error');
        return res.status(400).json({ error: err.message || 'Erreur lors de l\'upload' });
      }
      if (!req.file) {
        log.warn({ tenantId: req.params.id, headers: req.headers['content-type'] }, 'Upload hero video: aucun fichier reçu');
        return res.status(400).json({ error: 'Aucun fichier fourni' });
      }

      const heroVideoUrl = req.file.path;
      await prisma.tenantConfig.upsert({
        where: { tenantId: req.params.id },
        update: { heroVideoUrl },
        create: { tenantId: req.params.id, heroVideoUrl }
      });

      await invalidateTenantConfigCache(req.params.id);
      res.json({ heroVideoUrl });
    });
  } catch (error) {
    log.error({ err: error, id: req.params.id }, 'Upload hero video error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const uploadFeaturesVideo = async (req, res) => {
  try {
    uploadVideo.single('features-video')(req, res, async (err) => {
      if (err) {
        log.error({ err, tenantId: req.params.id }, 'Upload features video multer error');
        return res.status(400).json({ error: err.message || 'Erreur lors de l\'upload' });
      }
      if (!req.file) {
        log.warn({ tenantId: req.params.id, headers: req.headers['content-type'] }, 'Upload features video: aucun fichier reçu');
        return res.status(400).json({ error: 'Aucun fichier fourni' });
      }

      const featuresVideoUrl = req.file.path;
      await prisma.tenantConfig.upsert({
        where: { tenantId: req.params.id },
        update: { featuresVideoUrl },
        create: { tenantId: req.params.id, featuresVideoUrl }
      });

      await invalidateTenantConfigCache(req.params.id);
      res.json({ featuresVideoUrl });
    });
  } catch (error) {
    log.error({ err: error, id: req.params.id }, 'Upload features video error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const uploadAboutVideo = async (req, res) => {
  try {
    uploadVideo.single('about-video')(req, res, async (err) => {
      if (err) {
        log.error({ err, tenantId: req.params.id }, 'Upload about video multer error');
        return res.status(400).json({ error: err.message || 'Erreur lors de l\'upload' });
      }
      if (!req.file) {
        log.warn({ tenantId: req.params.id, headers: req.headers['content-type'] }, 'Upload about video: aucun fichier reçu');
        return res.status(400).json({ error: 'Aucun fichier fourni' });
      }

      const aboutVideoUrl = req.file.path;
      await prisma.tenantConfig.upsert({
        where: { tenantId: req.params.id },
        update: { aboutVideoUrl },
        create: { tenantId: req.params.id, aboutVideoUrl }
      });

      await invalidateTenantConfigCache(req.params.id);
      res.json({ aboutVideoUrl });
    });
  } catch (error) {
    log.error({ err: error, id: req.params.id }, 'Upload about video error');
    res.status(500).json({ error: 'Internal server error' });
  }
};
