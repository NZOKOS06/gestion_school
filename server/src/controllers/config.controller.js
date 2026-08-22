import { prisma, rawPrisma } from '../utils/prisma.js';
import { uploadLogo as cloudUploadLogo } from '../utils/cloudinary.js';
import { createLogger } from '../utils/logger.js';
import { derivePalette } from '../utils/themeEngine.js';
import { cacheGet, cacheSet, cacheDel, CacheKeys } from '../utils/cache.js';
import { withCdnImages } from '../utils/httpCache.js';

const log = createLogger('ConfigController');
const CONFIG_CACHE_TTL = 120;
const SCHEMA_CONFIG_FIELDS = new Set([
  'nomEcole', 'slogan', 'logoUrl', 'faviconUrl', 'backgroundImageUrl', 'loaderUrl',
  'couleurPrimaire', 'couleurSecondaire', 'couleurTexte', 'couleurAlerte', 'couleurErreur', 'couleurSucces',
  'darkModeDefault', 'police',
  'adresse', 'telephone', 'email', 'devise', 'messageAccueil',
  'anneeScolaireActiveId', 'notationSur', 'seuilReussite', 'nombrePeriodes', 'conventionPeriode',
  'joursEcole', 'heureDebut', 'heureFin',
  'fraisInscriptionDefault', 'fraisScolariteDefault',
  'moduleNotes', 'moduleBulletins', 'modulePresences', 'modulePaiements',
  'moduleEmploiDuTemps', 'moduleParents', 'moduleEleves', 'moduleSanctions',
  'moduleBiblio', 'moduleCantine', 'moduleTransport', 'moduleCertificats',
  'moduleClasses', 'moduleInscriptions', 'modulePersonnel', 'moduleRapports',
  'dureeSessionMinutes', 'ipWhitelist', 'forcer2FA',
  'privacyPolicyUrl', 'termsOfServiceUrl', 'cookiePolicyUrl', 'cookieBannerText',
  'cookieBannerEnabled', 'analyticsEnabled',
]);

/** Map UI / legacy keys to Prisma TenantConfig fields */
const mapConfigAliases = (body) => {
  const mapped = { ...body };

  if (mapped.nomApp && !mapped.nomEcole) mapped.nomEcole = mapped.nomApp;
  if (mapped.nom && !mapped.nomEcole) mapped.nomEcole = mapped.nom;

  if (mapped.moduleAbsences !== undefined && mapped.modulePresences === undefined) {
    mapped.modulePresences = mapped.moduleAbsences;
  }
  // Fields without schema columns are ignored after sanitization
  delete mapped.moduleAbsences;
  delete mapped.moduleActualites;
  delete mapped.moduleMatieres;
  delete mapped.nomApp;
  delete mapped.nom;
  delete mapped.numeroAutorisation;
  delete mapped.nomDirecteur;
  delete mapped.horaireOuverture;
  delete mapped.tauxTVA;

  return mapped;
};

const sanitizeConfigBody = (body) => {
  const aliased = mapConfigAliases(body);
  const config = {};
  for (const key of Object.keys(aliased)) {
    if (!SCHEMA_CONFIG_FIELDS.has(key)) continue;
    const value = aliased[key];
    if (value === '' || value === null || value === undefined) {
      config[key] = value === '' ? null : value;
      continue;
    }
    if (typeof value === 'boolean' || value === 'true' || value === 'false') {
      if (key.startsWith('module') || ['darkModeDefault', 'forcer2FA', 'cookieBannerEnabled', 'analyticsEnabled'].includes(key)) {
        config[key] = value === true || value === 'true' || value === 1 || value === '1';
        continue;
      }
    }
    if (['notationSur', 'nombrePeriodes', 'dureeSessionMinutes'].includes(key)) {
      const num = parseInt(value, 10);
      config[key] = Number.isNaN(num) ? undefined : num;
      if (config[key] === undefined) delete config[key];
      continue;
    }
    if (['seuilReussite', 'fraisInscriptionDefault', 'fraisScolariteDefault'].includes(key)) {
      const num = parseFloat(value);
      config[key] = Number.isNaN(num) ? undefined : num;
      if (config[key] === undefined) delete config[key];
      continue;
    }
    config[key] = value;
  }
  return { config, joursEcole: aliased.joursEcole, ipWhitelist: aliased.ipWhitelist };
};

export const getBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    const cacheKey = CacheKeys.tenantConfig(slug);

    const cached = await cacheGet(cacheKey);
    if (cached) {
      res.setHeader('X-Cache', 'HIT');
      return res.json(cached);
    }

    const tenant = await rawPrisma.tenant.findFirst({
      where: { slug, actif: true },
      include: { config: { include: { joursEcole: true, ipWhitelist: true } } },
    });

    if (!tenant) {
      return res.status(404).json({
        error: 'Tenant not found',
        message: 'École introuvable ou inactive.',
      });
    }

    const config = tenant.config || {};

    let periodesActives = [];
    let anneeActive = null;
    if (config.anneeScolaireActiveId) {
      anneeActive = await rawPrisma.anneeScolaire.findFirst({
        where: { id: config.anneeScolaireActiveId, tenantId: tenant.id },
        include: { periodes: { orderBy: { index: 'asc' } } },
      });
      periodesActives = anneeActive?.periodes || [];
    } else {
      anneeActive = await rawPrisma.anneeScolaire.findFirst({
        where: { tenantId: tenant.id, actif: true },
        include: { periodes: { orderBy: { index: 'asc' } } },
      });
      periodesActives = anneeActive?.periodes || [];
    }

    const payload = withCdnImages({
      id: tenant.id,
      slug: tenant.slug,
      nom: tenant.nom,
      numeroAutorisation: tenant.numeroAutorisation,
      modeMaintenance: tenant.modeMaintenance || false,
      customDomain: tenant.customDomain || null,
      ...config,
      joursEcole: config.joursEcole?.map(j => j.jour) || [],
      ipWhitelist: config.ipWhitelist?.map(i => i.ip) || [],
      conventionPeriode: config.conventionPeriode || 'trimestre',
      periodesScolaires: periodesActives,
      anneeScolaireActive: anneeActive
        ? { id: anneeActive.id, libelle: anneeActive.libelle, referentielVersionId: anneeActive.referentielVersionId }
        : null,
      nomApp: config.nomEcole || tenant.nom,
      moduleAbsences: config.modulePresences ?? true,
      moduleActualites: true,
      moduleMatieres: true,
      logoUrl: config.logoUrl || null,
      backgroundImageUrl: config.backgroundImageUrl || null,
      faviconUrl: config.faviconUrl || config.logoUrl || null,
      cssVariables: derivePalette({
        couleurPrimaire: config.couleurPrimaire,
        couleurSecondaire: config.couleurSecondaire,
        couleurTexte: config.couleurTexte,
        couleurAlerte: config.couleurAlerte,
        couleurErreur: config.couleurErreur,
        couleurSucces: config.couleurSucces,
        police: config.police,
      }),
      modules: {
        eleves: config.moduleEleves ?? true,
        classes: config.moduleClasses ?? true,
        notes: config.moduleNotes ?? true,
        bulletins: config.moduleBulletins ?? true,
        presences: config.modulePresences ?? true,
        absences: config.modulePresences ?? true,
        paiements: config.modulePaiements ?? true,
        emploiDuTemps: config.moduleEmploiDuTemps ?? true,
        parents: config.moduleParents ?? true,
        sanctions: config.moduleSanctions ?? true,
        certificats: config.moduleCertificats ?? true,
        personnel: config.modulePersonnel ?? true,
        rapports: config.moduleRapports ?? true,
        inscriptions: config.moduleInscriptions ?? true,
        actualites: true,
      },
    });

    await cacheSet(cacheKey, payload, CONFIG_CACHE_TTL);
    res.setHeader('X-Cache', 'MISS');
    res.json(payload);
  } catch (error) {
    log.error({ err: error }, 'getBySlug error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    const tenant = await rawPrisma.tenant.findFirst({
      where: { slug, actif: true },
    });

    if (!tenant) {
      return res.status(404).json({ error: 'École introuvable' });
    }

    // Directeur may only update their own tenant
    if (req.user.role !== 'super_admin' && req.user.tenantId !== tenant.id) {
      return res.status(403).json({ error: 'Accès refusé à cette école' });
    }

    const { config: configData, joursEcole, ipWhitelist } = sanitizeConfigBody(req.body);

    if (req.body.nom && typeof req.body.nom === 'string' && req.body.nom.trim()) {
      await rawPrisma.tenant.update({
        where: { id: tenant.id },
        data: { nom: req.body.nom.trim() },
      });
    }
    if (req.body.numeroAutorisation !== undefined) {
      await rawPrisma.tenant.update({
        where: { id: tenant.id },
        data: { numeroAutorisation: req.body.numeroAutorisation || null },
      });
    }

    const updatePayload = { ...configData };
    if (joursEcole !== undefined) {
      updatePayload.joursEcole = {
        deleteMany: {},
        create: Array.isArray(joursEcole) ? joursEcole.map(jour => ({ jour })) : []
      };
    }
    if (ipWhitelist !== undefined) {
      updatePayload.ipWhitelist = {
        deleteMany: {},
        create: Array.isArray(ipWhitelist) ? ipWhitelist.map(ip => ({ ip })) : []
      };
    }

    const config = await rawPrisma.tenantConfig.upsert({
      where: { tenantId: tenant.id },
      update: updatePayload,
      create: { tenantId: tenant.id, ...updatePayload },
      include: { joursEcole: true, ipWhitelist: true },
    });

    await cacheDel(CacheKeys.tenantConfig(slug));
    res.json(config);
  } catch (error) {
    log.error({ err: error, slug: req.params.slug, body: req.body }, 'updateBySlug error');
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
};

export const uploadLogoBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    const tenant = await rawPrisma.tenant.findFirst({
      where: { slug, actif: true },
    });

    if (!tenant) {
      return res.status(404).json({ error: 'École introuvable' });
    }

    if (req.user.role !== 'super_admin' && req.user.tenantId !== tenant.id) {
      return res.status(403).json({ error: 'Accès refusé à cette école' });
    }

    cloudUploadLogo.single('logo')(req, res, async (err) => {
      if (err) {
        log.error({ err, slug }, 'Upload logo multer error');
        return res.status(400).json({ error: err.message || 'Erreur lors de l\'upload' });
      }
      if (!req.file) {
        return res.status(400).json({ error: 'Aucun fichier fourni' });
      }

      const logoUrl = req.file.path;
      await prisma.tenantConfig.upsert({
        where: { tenantId: tenant.id },
        update: { logoUrl },
        create: { tenantId: tenant.id, logoUrl },
      });

      await cacheDel(CacheKeys.tenantConfig(slug));
      res.json({ logoUrl });
    });
  } catch (error) {
    log.error({ err: error, slug: req.params.slug }, 'uploadLogoBySlug error');
    res.status(500).json({ error: 'Internal server error' });
  }
};
