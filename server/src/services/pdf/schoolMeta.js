import { prisma } from '../../utils/prisma.js';

export async function loadSchoolPdfMeta(tenantId, req) {
  const [config, tenant] = await Promise.all([
    prisma.tenantConfig.findUnique({ where: { tenantId } }),
    prisma.tenant.findUnique({ where: { id: tenantId }, select: { pays: true, nom: true } }),
  ]);
  const adresse = config?.adresse || null;
  return {
    nomEcole: config?.nomEcole || req?.tenant?.nom || tenant?.nom || 'GestSchool',
    slogan: config?.slogan || null,
    adresse,
    telephone: config?.telephone || null,
    email: config?.email || null,
    devise: config?.devise || 'FCFA',
    pays: tenant?.pays || req?.tenant?.pays || 'CG',
    notationSur: config?.notationSur || 20,
    conventionPeriode: config?.conventionPeriode || 'trimestre',
    enteteOfficiel: { etat: config?.documentsConfig?.etat, devise: config?.documentsConfig?.devise, ministere: config?.documentsConfig?.ministere },
    formatRecu: config?.documentsConfig?.formatRecu || 'a4',
    ville: adresse ? String(adresse).split(',')[0].trim() : null,
  };
}
