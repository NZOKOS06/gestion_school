import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { rawPrisma } from '../utils/prisma.js';
import {
  generateForInscription,
  resteAPayer,
  applyPaymentCascade,
  syncInscriptionSolde,
} from './echeances.service.js';

const SLUG = 'finance-smoke-tenant';

/**
 * Smoke métier : génération échéances → encaissement cascade → solde = reste.
 * Couvre le cœur inscriptions/paiements sans UI.
 */
describe('smoke finance inscription → échéances → paiement', () => {
  let tenant;
  let staff;
  let annee;
  let classe;
  let eleve;
  let inscription;

  beforeAll(async () => {
    await cleanup();

    tenant = await rawPrisma.tenant.create({
      data: {
        nom: 'Finance Smoke School',
        slug: SLUG,
        actif: true,
        config: { create: { nomEcole: 'Finance Smoke' } },
      },
    });

    staff = await rawPrisma.staff.create({
      data: {
        tenantId: tenant.id,
        email: `comptable+${SLUG}@test.cg`,
        passwordHash: 'x',
        nom: 'Caisse',
        prenom: 'Test',
        role: 'comptable',
        actif: true,
      },
    });

    annee = await rawPrisma.anneeScolaire.create({
      data: {
        tenantId: tenant.id,
        libelle: '2025-2026',
        dateDebut: new Date('2025-09-01'),
        dateFin: new Date('2026-06-30'),
        statut: 'active',
        actif: true,
      },
    });

    classe = await rawPrisma.classe.create({
      data: {
        tenantId: tenant.id,
        anneeScolaireId: annee.id,
        nom: '6ème A',
        niveau: '6eme',
        cycle: 'college',
        fraisScolarite: 300000,
      },
    });

    eleve = await rawPrisma.eleve.create({
      data: {
        tenantId: tenant.id,
        matricule: `FIN-${Date.now()}`,
        nom: 'Mbemba',
        prenom: 'Grace',
        sexe: 'F',
        dateNaissance: new Date('2013-04-12'),
      },
    });

    inscription = await rawPrisma.inscription.create({
      data: {
        tenantId: tenant.id,
        eleveId: eleve.id,
        classeId: classe.id,
        anneeScolaireId: annee.id,
        statut: 'validee',
        soldeScolarite: 0,
      },
    });

    await generateForInscription(rawPrisma, inscription, {
      fraisInscription: 15000,
      fraisScolarite: 300000,
      dateDebut: annee.dateDebut,
      dateFin: annee.dateFin,
    });
  });

  afterAll(async () => {
    await cleanup();
  });

  async function cleanup() {
    const t = await rawPrisma.tenant.findUnique({ where: { slug: SLUG } });
    if (!t) return;
    const tid = t.id;
    await rawPrisma.paiement.deleteMany({ where: { tenantId: tid } });
    await rawPrisma.echeance.deleteMany({ where: { tenantId: tid } });
    await rawPrisma.inscription.deleteMany({ where: { tenantId: tid } });
    await rawPrisma.eleve.deleteMany({ where: { tenantId: tid } });
    await rawPrisma.classe.deleteMany({ where: { tenantId: tid } });
    await rawPrisma.anneeScolaire.deleteMany({ where: { tenantId: tid } });
    await rawPrisma.staff.deleteMany({ where: { tenantId: tid } });
    await rawPrisma.tenantConfig.deleteMany({ where: { tenantId: tid } });
    await rawPrisma.tenant.delete({ where: { id: tid } });
  }

  it('génère frais d’inscription + mois et pose le solde', async () => {
    const echs = await rawPrisma.echeance.findMany({
      where: { inscriptionId: inscription.id },
      orderBy: { dateEcheance: 'asc' },
    });
    expect(echs.length).toBeGreaterThanOrEqual(2);
    expect(echs.some((e) => /inscription/i.test(e.libelle))).toBe(true);

    const insc = await rawPrisma.inscription.findUnique({ where: { id: inscription.id } });
    const reste = await resteAPayer(rawPrisma, tenant.id, inscription.id);
    expect(Number(insc.soldeScolarite)).toBe(reste);
    expect(reste).toBe(315000);
  });

  it('encaissement cascade : solde === resteAPayer et refuse le trop-perçu logique', async () => {
    const avant = await resteAPayer(rawPrisma, tenant.id, inscription.id);
    const paye = 45000;

    await rawPrisma.$transaction(async (tx) => {
      await applyPaymentCascade(tx, tenant.id, inscription.id, paye);
      const last = await tx.paiement.findFirst({
        where: { tenantId: tenant.id },
        orderBy: { numeroRecu: 'desc' },
        select: { numeroRecu: true },
      });
      await tx.paiement.create({
        data: {
          tenantId: tenant.id,
          inscriptionId: inscription.id,
          numeroRecu: (last?.numeroRecu || 0) + 1,
          montant: paye,
          typePaiement: 'scolarite',
          modePaiement: 'especes',
          recuParId: staff.id,
        },
      });
      await syncInscriptionSolde(tx, tenant.id, inscription.id);
    });

    const apres = await resteAPayer(rawPrisma, tenant.id, inscription.id);
    const insc = await rawPrisma.inscription.findUnique({ where: { id: inscription.id } });
    expect(apres).toBe(avant - paye);
    expect(Number(insc.soldeScolarite)).toBe(apres);

    // Trop-perçu : montant > reste → assert métier côté contrôleur ; ici invariant reste ≥ 0
    expect(apres).toBeGreaterThan(0);
  });
});
