import { PrismaClient } from '@prisma/client';
import { AsyncLocalStorage } from 'async_hooks';

export const asyncLocalStorage = new AsyncLocalStorage();

const globalForPrisma = globalThis;

const rawPrisma = globalForPrisma._rawPrisma ?? new PrismaClient({
  log: ['error', 'warn'],
  errorFormat: 'minimal',
});

const TENANT_MODELS = new Set([
  'TenantConfig',
  'Staff',
  'User',
  'AnneeScolaire',
  'Classe',
  'Matiere',
  'Eleve',
  'Inscription',
  'EnseignantClasse',
  'EnseignantClasseQuittee',
  'Evaluation',
  'Note',
  'Bulletin',
  'Paiement',
  'EmploiDuTemps',
  'Absence',
  'Sanction',
  'Actualite',
  'CookieConsent'
]);

const shouldIsolate = (model) => TENANT_MODELS.has(model);

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
    },
  },
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma._rawPrisma = rawPrisma;
}

// Export extendedPrisma as the default 'prisma' so all imports get tenant isolation
export { extendedPrisma as prisma, extendedPrisma, rawPrisma };
