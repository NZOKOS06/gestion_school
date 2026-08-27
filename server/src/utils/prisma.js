import { PrismaClient } from '@prisma/client';
import { AsyncLocalStorage } from 'async_hooks';

export const asyncLocalStorage = new AsyncLocalStorage();

const globalForPrisma = globalThis;

const rawPrisma = globalForPrisma._rawPrisma ?? new PrismaClient({
  log: ['error', 'warn'],
  errorFormat: 'minimal',
});

/**
 * Modèles isolés par tenantId via extendedPrisma.
 * Exclus volontairement :
 * - Tenant (racine)
 * - RefreshToken (pas de tenantId)
 * - PasswordResetToken / EmailVerificationToken (lookup par token, tenantId optionnel)
 * - BulletinDetail / ConseilParticipant / ExamenNote (enfants sans tenantId)
 *
 * rawPrisma contourne cette isolation — réservé à super-admin, auth bootstrap, jobs globaux.
 */
const TENANT_MODELS = new Set([
  'TenantConfig',
  'TenantJourEcole',
  'TenantIpWhitelist',
  'Staff',
  'User',
  'CookieConsent',
  'AnneeScolaire',
  'ReferentielVersion',
  'NiveauOfficiel',
  'FiliereOfficielle',
  'PeriodeScolaire',
  'Classe',
  'Matiere',
  'MatiereNiveauAnnee',
  'MatiereClasseAnnee',
  'Eleve',
  'EnseignantClasse',
  'EnseignantClasseQuittee',
  'Inscription',
  'Echeance',
  'Evaluation',
  'Note',
  'Bulletin',
  'EmploiDuTemps',
  'Absence',
  'Sanction',
  'Paiement',
  'Depense',
  'Certificat',
  'Notification',
  'Actualite',
  'AuditLog',
  'Salle',
  'CalendrierScolaire',
  'CahierDeTextes',
  'ConseilDeClasse',
  'HeureEnseignee',
  'PointageSession',
  'PeriodePaie',
  'BulletinPaie',
  'Message',
  'ExamenSession',
  'ExamenCandidature',
  'ResultatExamen',
]);

const shouldIsolate = (model) => TENANT_MODELS.has(model);

function prismaDelegate(model) {
  return rawPrisma[model.charAt(0).toLowerCase() + model.slice(1)];
}

/** Convertit un WhereUniqueInput (id ou email_tenantId: {…}) en filtre findFirst. */
function uniqueWhereToFilter(where) {
  if (!where || typeof where !== 'object') return {};
  const out = {};
  for (const [key, value] of Object.entries(where)) {
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      !(value instanceof Date) &&
      key.includes('_')
    ) {
      Object.assign(out, value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

// Extension Prisma pour assertions multi-tenant
const extendedPrisma = rawPrisma.$extends({
  query: {
    $allModels: {
      async findUnique({ model, operation, args, query }) {
        const tenantId = asyncLocalStorage.getStore()?.tenantId;
        if (tenantId && shouldIsolate(model) && args.where && !args.where.tenantId) {
          args.where.tenantId = tenantId;
        }
        return query(args);
      },
      async findFirst({ model, operation, args, query }) {
        const tenantId = asyncLocalStorage.getStore()?.tenantId;
        if (tenantId && shouldIsolate(model) && args.where) {
          args.where.tenantId = tenantId;
        }
        return query(args);
      },
      async findMany({ model, operation, args, query }) {
        const tenantId = asyncLocalStorage.getStore()?.tenantId;
        if (tenantId && shouldIsolate(model)) {
          args.where = { ...args.where, tenantId };
        }
        return query(args);
      },
      async create({ model, operation, args, query }) {
        const tenantId = asyncLocalStorage.getStore()?.tenantId;
        if (tenantId && shouldIsolate(model)) {
          args.data = { ...args.data, tenantId };
        }
        return query(args);
      },
      async createMany({ model, operation, args, query }) {
        const tenantId = asyncLocalStorage.getStore()?.tenantId;
        if (tenantId && shouldIsolate(model)) {
          args.data = args.data.map(d => ({ ...d, tenantId }));
        }
        return query(args);
      },
      async update({ model, operation, args, query }) {
        const tenantId = asyncLocalStorage.getStore()?.tenantId;
        if (tenantId && shouldIsolate(model)) {
          args.where = { ...args.where, tenantId };
        }
        return query(args);
      },
      async updateMany({ model, operation, args, query }) {
        const tenantId = asyncLocalStorage.getStore()?.tenantId;
        if (tenantId && shouldIsolate(model)) {
          args.where = { ...args.where, tenantId };
        }
        return query(args);
      },
      async delete({ model, operation, args, query }) {
        const tenantId = asyncLocalStorage.getStore()?.tenantId;
        if (tenantId && shouldIsolate(model)) {
          args.where = { ...args.where, tenantId };
        }
        return query(args);
      },
      async deleteMany({ model, operation, args, query }) {
        const tenantId = asyncLocalStorage.getStore()?.tenantId;
        if (tenantId && shouldIsolate(model)) {
          args.where = { ...args.where, tenantId };
        }
        return query(args);
      },
      async aggregate({ model, operation, args, query }) {
        const tenantId = asyncLocalStorage.getStore()?.tenantId;
        if (tenantId && shouldIsolate(model)) {
          args.where = { ...args.where, tenantId };
        }
        return query(args);
      },
      async groupBy({ model, operation, args, query }) {
        const tenantId = asyncLocalStorage.getStore()?.tenantId;
        if (tenantId && shouldIsolate(model)) {
          if (!args.where) args.where = {};
          args.where.tenantId = tenantId;
        }
        return query(args);
      },
      async count({ model, operation, args, query }) {
        const tenantId = asyncLocalStorage.getStore()?.tenantId;
        if (tenantId && shouldIsolate(model)) {
          args.where = { ...args.where, tenantId };
        }
        return query(args);
      },
      async upsert({ model, operation, args, query }) {
        const tenantId = asyncLocalStorage.getStore()?.tenantId;
        if (tenantId && shouldIsolate(model)) {
          if (args.create) args.create = { ...args.create, tenantId };
          if (args.update?.tenantId && args.update.tenantId !== tenantId) {
            delete args.update.tenantId;
          }
          if (args.where) {
            const delegate = prismaDelegate(model);
            if (typeof delegate?.findFirst === 'function') {
              const match = await delegate.findFirst({
                where: uniqueWhereToFilter(args.where),
                select: { tenantId: true },
              });
              if (match?.tenantId && match.tenantId !== tenantId) {
                throw new Error('Cross-tenant upsert blocked');
              }
            }
          }
        }
        const result = await query(args);
        if (tenantId && shouldIsolate(model) && result?.tenantId && result.tenantId !== tenantId) {
          throw new Error('Cross-tenant upsert blocked');
        }
        return result;
      },
    },
  },
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma._rawPrisma = rawPrisma;
}

// Export extendedPrisma as the default 'prisma' so all imports get tenant isolation
export { extendedPrisma as prisma, extendedPrisma, rawPrisma, TENANT_MODELS };

export function runInTenant(tenantId, fn) {
  return asyncLocalStorage.run({ tenantId }, fn);
}
