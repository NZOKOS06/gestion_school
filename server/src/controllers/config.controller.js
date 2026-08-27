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
  'modulePointagePersonnel', 'modulePaie', 'methodePaie', 'pointageToleranceMinutes', 'paieJourCloture',
  'concerneCycles',
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
    if (['notationSur', 'nombrePeriodes', 'dureeSessionMinutes', 'pointageToleranceMinutes', 'paieJourCloture'].includes(key)) {
      const num = parseInt(value, 10);
      config[key] = Number.isNaN(num) ? undefined : num;
      if (config[key] === undefined) delete config[key];
      continue;
    }
    if (key === 'concerneCycles') {
      if (Array.isArray(value)) {
        config[key] = value.length ? value : null;
      } else {
        config[key] = null;
      }
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

    const cfg = tenant.config;
    const num = (v, fallback = 0) => (v == null ? fallback : Number(v));

    let periodesActives = [];
    let anneeActive = null;
    try {
      if (cfg?.anneeScolaireActiveId) {
        anneeActive = await rawPrisma.anneeScolaire.findFirst({
          where: { id: cfg.anneeScolaireActiveId, tenantId: tenant.id },
        });
      } else {
        anneeActive = await rawPrisma.anneeScolaire.findFirst({
          where: { tenantId: tenant.id, actif: true },
        });
      }
      if (anneeActive) {
        try {
          const rawPeriodes = await rawPrisma.periodeScolaire.findMany({
            where: { anneeScolaireId: anneeActive.id, tenantId: tenant.id },
            orderBy: { index: 'asc' },
            select: {
              id: true,
              index: true,
              libelle: true,
              dateDebut: true,
              dateFin: true,
              dateEvaluationDebut: true,
              dateEvaluationFin: true,
              poids: true,
              concerneCycles: true,
            },
          });
          periodesActives = rawPeriodes.map((p) => ({
            id: p.id,
            index: p.index,
            libelle: p.libelle,
            dateDebut: p.dateDebut,
            dateFin: p.dateFin,
            dateEvaluationDebut: p.dateEvaluationDebut,
            dateEvaluationFin: p.dateEvaluationFin,
            poids: p.poids != null ? Number(p.poids) : null,
            concerneCycles: p.concerneCycles,
          }));
        } catch {
          const rawPeriodes = await rawPrisma.periodeScolaire.findMany({
            where: { anneeScolaireId: anneeActive.id, tenantId: tenant.id },
            orderBy: { index: 'asc' },
            select: {
              id: true,
              index: true,
              libelle: true,
              dateDebut: true,
              dateFin: true,
              dateEvaluationDebut: true,
              dateEvaluationFin: true,
              poids: true,
            },
          });
          periodesActives = rawPeriodes.map((p) => ({
            id: p.id,
            index: p.index,
            libelle: p.libelle,
            dateDebut: p.dateDebut,
            dateFin: p.dateFin,
            dateEvaluationDebut: p.dateEvaluationDebut,
            dateEvaluationFin: p.dateEvaluationFin,
            poids: p.poids != null ? Number(p.poids) : null,
            concerneCycles: null,
          }));
        }
      }
    } catch (anneeErr) {
      log.warn({ err: anneeErr, slug }, 'getBySlug: année/périodes indisponibles');
      anneeActive = null;
      periodesActives = [];
    }

    const payload = withCdnImages({
      id: tenant.id,
      slug: tenant.slug,
      nom: tenant.nom,
      numeroAutorisation: tenant.numeroAutorisation,
      modeMaintenance: tenant.modeMaintenance || false,
      customDomain: tenant.customDomain || null,
      nomEcole: cfg?.nomEcole || tenant.nom,
      slogan: cfg?.slogan ?? null,
      logoUrl: cfg?.logoUrl || null,
      faviconUrl: cfg?.faviconUrl || cfg?.logoUrl || null,
      backgroundImageUrl: cfg?.backgroundImageUrl || null,
      loaderUrl: cfg?.loaderUrl || null,
      couleurPrimaire: cfg?.couleurPrimaire || '#1e3a8a',
      couleurSecondaire: cfg?.couleurSecondaire || '#0d9488',
      couleurTexte: cfg?.couleurTexte || '#1f2937',
      couleurAlerte: cfg?.couleurAlerte || '#f59e0b',
      couleurErreur: cfg?.couleurErreur || '#ef4444',
      couleurSucces: cfg?.couleurSucces || '#22c55e',
      darkModeDefault: cfg?.darkModeDefault ?? false,
      police: cfg?.police || 'Plus Jakarta Sans',
      adresse: cfg?.adresse ?? null,
      telephone: cfg?.telephone ?? null,
      email: cfg?.email ?? null,
      devise: cfg?.devise || 'FCFA',
      messageAccueil: cfg?.messageAccueil ?? null,
      anneeScolaireActiveId: cfg?.anneeScolaireActiveId ?? null,
      notationSur: cfg?.notationSur ?? 20,
      seuilReussite: num(cfg?.seuilReussite, 10),
      nombrePeriodes: cfg?.nombrePeriodes ?? 3,
      conventionPeriode: cfg?.conventionPeriode || 'trimestre',
      heureDebut: cfg?.heureDebut || '08:00',
      heureFin: cfg?.heureFin || '17:00',
      fraisInscriptionDefault: num(cfg?.fraisInscriptionDefault, 0),
      fraisScolariteDefault: num(cfg?.fraisScolariteDefault, 0),
      moduleNotes: cfg?.moduleNotes ?? true,
      moduleBulletins: cfg?.moduleBulletins ?? true,
      modulePresences: cfg?.modulePresences ?? false,
      modulePaiements: cfg?.modulePaiements ?? true,
      moduleEmploiDuTemps: cfg?.moduleEmploiDuTemps ?? false,
      moduleParents: cfg?.moduleParents ?? false,
      moduleEleves: cfg?.moduleEleves ?? true,
      moduleSanctions: cfg?.moduleSanctions ?? false,
      moduleBiblio: cfg?.moduleBiblio ?? false,
      moduleCantine: cfg?.moduleCantine ?? false,
      moduleTransport: cfg?.moduleTransport ?? false,
      moduleCertificats: cfg?.moduleCertificats ?? false,
      moduleClasses: cfg?.moduleClasses ?? true,
      moduleInscriptions: cfg?.moduleInscriptions ?? true,
      modulePersonnel: cfg?.modulePersonnel ?? true,
      moduleRapports: cfg?.moduleRapports ?? true,
      modulePointagePersonnel: cfg?.modulePointagePersonnel ?? false,
      modulePaie: cfg?.modulePaie ?? false,
      methodePaie: cfg?.methodePaie || 'mensuel',
      pointageToleranceMinutes: cfg?.pointageToleranceMinutes ?? 15,
      paieJourCloture: cfg?.paieJourCloture ?? 25,
      concerneCycles: cfg?.concerneCycles ?? null,
      dureeSessionMinutes: cfg?.dureeSessionMinutes ?? 480,
      forcer2FA: cfg?.forcer2FA ?? false,
      privacyPolicyUrl: cfg?.privacyPolicyUrl ?? null,
      termsOfServiceUrl: cfg?.termsOfServiceUrl ?? null,
      cookiePolicyUrl: cfg?.cookiePolicyUrl ?? null,
      cookieBannerText: cfg?.cookieBannerText ?? null,
      cookieBannerEnabled: cfg?.cookieBannerEnabled ?? true,
      analyticsEnabled: cfg?.analyticsEnabled ?? false,
      joursEcole: cfg?.joursEcole?.map((j) => j.jour) || [],
      ipWhitelist: cfg?.ipWhitelist?.map((i) => i.ip) || [],
      periodesScolaires: periodesActives,
      anneeScolaireActive: anneeActive
        ? { id: anneeActive.id, libelle: anneeActive.libelle, referentielVersionId: anneeActive.referentielVersionId }
        : null,
      nomApp: cfg?.nomEcole || tenant.nom,
      moduleAbsences: cfg?.modulePresences ?? true,
      moduleActualites: true,
      moduleMatieres: true,
      cssVariables: derivePalette({
        couleurPrimaire: cfg?.couleurPrimaire,
        couleurSecondaire: cfg?.couleurSecondaire,
        couleurTexte: cfg?.couleurTexte,
        couleurAlerte: cfg?.couleurAlerte,
        couleurErreur: cfg?.couleurErreur,
        couleurSucces: cfg?.couleurSucces,
        police: cfg?.police,
      }),
      modules: {
        eleves: cfg?.moduleEleves ?? true,
        classes: cfg?.moduleClasses ?? true,
        notes: cfg?.moduleNotes ?? true,
        bulletins: cfg?.moduleBulletins ?? true,
        presences: cfg?.modulePresences ?? true,
        absences: cfg?.modulePresences ?? true,
        paiements: cfg?.modulePaiements ?? true,
        emploiDuTemps: cfg?.moduleEmploiDuTemps ?? true,
        parents: cfg?.moduleParents ?? true,
        sanctions: cfg?.moduleSanctions ?? true,
        certificats: cfg?.moduleCertificats ?? true,
        personnel: cfg?.modulePersonnel ?? true,
        rapports: cfg?.moduleRapports ?? true,
        inscriptions: cfg?.moduleInscriptions ?? true,
        actualites: true,
        pointagePersonnel: cfg?.modulePointagePersonnel ?? false,
        paie: cfg?.modulePaie ?? false,
      },
    });

    try {
      await cacheSet(cacheKey, payload, CONFIG_CACHE_TTL);
    } catch (cacheErr) {
      log.warn({ err: cacheErr, slug }, 'getBySlug: cacheSet ignoré');
    }
    res.setHeader('X-Cache', 'MISS');
    res.json(payload);
  } catch (error) {
    log.error({ err: error, slug: req.params.slug }, 'getBySlug error');
    res.status(500).json({
      error: 'Internal server error',
      message: error?.message || String(error),
      code: error?.code || undefined,
    });
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
