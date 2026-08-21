import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);
const SUPER_ADMIN_EMAIL = (process.env.SUPER_ADMIN_EMAIL || 'superadmin@gestschool.com').trim().toLowerCase();
const SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD || 'SuperAdmin123!';

async function main() {
  console.log('🌱 Démarrage du seed...\n');

  // ==================== TENANT SYSTÈME (héberge le super admin) ====================
  const systemTenant = await prisma.tenant.upsert({
    where: { slug: 'system' },
    update: {
      nom: 'GestSchool System',
      plan: 'systeme',
      actif: true,
      contact: {
        email: SUPER_ADMIN_EMAIL,
      },
    },
    create: {
      nom: 'GestSchool System',
      slug: 'system',
      plan: 'systeme',
      actif: true,
      contact: {
        email: SUPER_ADMIN_EMAIL,
      },
    },
  });
  console.log(`✓ Tenant système : ${systemTenant.slug}`);

  await prisma.tenantConfig.upsert({
    where: { tenantId: systemTenant.id },
    update: {
      nomEcole: 'GestSchool Admin',
      email: SUPER_ADMIN_EMAIL,
      moduleEleves: true,
      moduleNotes: true,
      moduleBulletins: true,
      modulePresences: true,
      modulePaiements: true,
      moduleEmploiDuTemps: true,
      moduleParents: true,
      moduleSanctions: true,
      moduleCertificats: true,
    },
    create: {
      tenantId: systemTenant.id,
      nomEcole: 'GestSchool Admin',
      email: SUPER_ADMIN_EMAIL,
      moduleEleves: true,
      moduleNotes: true,
      moduleBulletins: true,
      modulePresences: true,
      modulePaiements: true,
      moduleEmploiDuTemps: true,
      moduleParents: true,
      moduleSanctions: true,
      moduleCertificats: true,
    },
  });
  console.log('✓ Configuration système créée');

  // ==================== SUPER ADMIN ====================
  const superAdminHash = await bcrypt.hash(SUPER_ADMIN_PASSWORD, BCRYPT_ROUNDS);
  const superAdmin = await prisma.staff.upsert({
    where: { tenantId_email: { tenantId: systemTenant.id, email: SUPER_ADMIN_EMAIL } },
    update: { passwordHash: superAdminHash, actif: true },
    create: {
      tenantId: systemTenant.id,
      email: SUPER_ADMIN_EMAIL,
      passwordHash: superAdminHash,
      role: 'super_admin',
      nom: 'Super',
      prenom: 'Admin',
      mustChangePassword: false,
      actif: true,
    },
  });
  console.log(`✓ Super Admin : ${superAdmin.email}\n`);

  // ==================== ÉCOLE DÉMO ====================
  const demoTenant = await prisma.tenant.upsert({
    where: { slug: 'demo' },
    update: {},
    create: {
      nom: 'École Démo',
      slug: 'demo',
      plan: 'enterprise',
      actif: true,
      numeroAutorisation: 'AUT-2026-001',
      contact: {
        adresse: 'Avenue de la Paix, Brazzaville',
        telephone: '+242 06 000 0000',
        email: 'contact@ecole-demo.cg',
      },
    },
  });
  console.log(`✓ Tenant démo : ${demoTenant.slug}`);

  await prisma.tenantConfig.upsert({
    where: { tenantId: demoTenant.id },
    update: {
      nomEcole: 'École Démo',
      moduleEleves: true,
      moduleNotes: true,
      moduleBulletins: true,
      modulePresences: true,
      modulePaiements: true,
      moduleEmploiDuTemps: true,
      moduleParents: true,
      moduleSanctions: true,
      moduleCertificats: true,
      moduleClasses: true,
      moduleInscriptions: true,
      modulePersonnel: true,
      moduleRapports: true,
    },
    create: {
      tenantId: demoTenant.id,
      nomEcole: 'École Démo',
      couleurPrimaire: '#1e3a8a',
      couleurSecondaire: '#0d9488',
      devise: 'FCFA',
      adresse: 'Avenue de la Paix, Brazzaville',
      telephone: '+242 06 000 0000',
      email: 'contact@ecole-demo.cg',
      messageAccueil: 'L\'excellence éducative au service de votre avenir',
      notationSur: 20,
      seuilReussite: 10.0,
      nombrePeriodes: 3,
      fraisInscriptionDefault: 25000,
      fraisScolariteDefault: 150000,
      moduleEleves: true,
      moduleNotes: true,
      moduleBulletins: true,
      modulePresences: true,
      modulePaiements: true,
      moduleEmploiDuTemps: true,
      moduleParents: true,
      moduleSanctions: true,
      moduleCertificats: true,
      moduleClasses: true,
      moduleInscriptions: true,
      modulePersonnel: true,
      moduleRapports: true,
    },
  });
  console.log('✓ Configuration démo créée');

  // ==================== TENANT DEFAULT (fallback dev) ====================
  const defaultTenant = await prisma.tenant.upsert({
    where: { slug: 'default' },
    update: {},
    create: {
      nom: 'GestSchool Demo',
      slug: 'default',
      plan: 'starter',
      actif: true,
      contact: {},
    },
  });
  console.log(`✓ Tenant default : ${defaultTenant.slug}`);

  await prisma.tenantConfig.upsert({
    where: { tenantId: defaultTenant.id },
    update: {
      nomEcole: 'GestSchool',
      moduleEleves: true,
      moduleNotes: true,
      moduleBulletins: true,
      modulePresences: true,
      modulePaiements: true,
      moduleClasses: true,
      moduleInscriptions: true,
      modulePersonnel: true,
      moduleRapports: true,
    },
    create: {
      tenantId: defaultTenant.id,
      nomEcole: 'GestSchool',
      couleurPrimaire: '#1e3a8a',
      couleurSecondaire: '#0d9488',
      devise: 'FCFA',
      moduleEleves: true,
      moduleNotes: true,
      moduleBulletins: true,
      modulePresences: true,
      modulePaiements: true,
      moduleClasses: true,
      moduleInscriptions: true,
      modulePersonnel: true,
      moduleRapports: true,
    },
  });
  console.log('✓ Configuration default créée');

  // ==================== STAFF COMPLET (démo) ====================
  const staffDemo = [
    { email: 'directeur@demo.cg', password: 'Directeur123!', role: 'directeur', nom: 'Mbemba', prenom: 'Jean', typeContrat: 'titulaire' },
    { email: 'de@demo.cg', password: 'DirecteurEtudes123!', role: 'directeur_etudes', nom: 'Makosso', prenom: 'Claire', typeContrat: 'titulaire' },
    { email: 'secretaire@demo.cg', password: 'Secretaire123!', role: 'secretaire', nom: 'Ngoma', prenom: 'Marie', typeContrat: 'titulaire' },
    { email: 'enseignant@demo.cg', password: 'Enseignant123!', role: 'enseignant', nom: 'Kouassi', prenom: 'Paul', typeContrat: 'titulaire' },
    { email: 'surveillant@demo.cg', password: 'Surveillant123!', role: 'surveillant', nom: 'Moussa', prenom: 'Amadou', typeContrat: 'titulaire' },
    { email: 'comptable@demo.cg', password: 'Comptable123!', role: 'comptable', nom: 'Lingui', prenom: 'Sarah', typeContrat: 'titulaire' },
    { email: 'vacataire@demo.cg', password: 'Vacataire123!', role: 'enseignant', nom: 'Bouanga', prenom: 'Alain', typeContrat: 'vacataire', heuresHebdo: 12, tauxHoraire: 5000 },
    { email: 'titulaire.gs@demo.cg', password: 'TitulaireGS123!', role: 'enseignant', nom: 'Nkodia', prenom: 'Bernadette', typeContrat: 'titulaire' },
    { email: 'titulaire.cm2@demo.cg', password: 'TitulaireCM2123!', role: 'enseignant', nom: 'Obami', prenom: 'Sylvie', typeContrat: 'titulaire' },
    { email: 'prof.francais@demo.cg', password: 'ProfFrancais123!', role: 'enseignant', nom: 'Loemba', prenom: 'Estelle', typeContrat: 'titulaire' },
    { email: 'prof.histoire@demo.cg', password: 'ProfHistoire123!', role: 'enseignant', nom: 'Tchicaya', prenom: 'Rodrigue', typeContrat: 'contractuel' },
    { email: 'prof.svt@demo.cg', password: 'ProfSvt123!', role: 'enseignant', nom: 'Ondongo', prenom: 'Nadège', typeContrat: 'titulaire' },
  ];

  const staffMap = {};
  for (const s of staffDemo) {
    const hash = await bcrypt.hash(s.password, BCRYPT_ROUNDS);
    const created = await prisma.staff.upsert({
      where: { tenantId_email: { tenantId: demoTenant.id, email: s.email } },
      update: { passwordHash: hash, actif: true },
      create: {
        tenantId: demoTenant.id,
        email: s.email,
        passwordHash: hash,
        role: s.role,
        nom: s.nom,
        prenom: s.prenom,
        telephone: '+242 06 111 1111',
        typeContrat: s.typeContrat || 'titulaire',
        heuresHebdo: s.heuresHebdo || null,
        tauxHoraire: s.tauxHoraire || null,
        mustChangePassword: false,
        actif: true,
      },
    });
    staffMap[s.email] = created;
    staffMap[s.role] = created; // last writer wins for duplicate roles (vacataire)
    if (s.email === 'enseignant@demo.cg') staffMap.enseignantTitulaire = created;
    console.log(`✓ ${s.role} : ${created.email} / ${s.password}`);
  }

  // ==================== RÉFÉRENTIEL CONGO ====================
  const { NIVEAUX_CG_ACTUEL, FILIERES_CG_ACTUEL, PERIODES_2025_2026 } = await import('../src/data/referentielCongo.js');

  const refActuel = await prisma.referentielVersion.upsert({
    where: { tenantId_code: { tenantId: demoTenant.id, code: 'cg_actuel' } },
    update: { actif: true, libelle: 'Référentiel Congo actuel' },
    create: {
      tenantId: demoTenant.id,
      code: 'cg_actuel',
      libelle: 'Référentiel Congo actuel',
      actif: true,
    },
  });

  // Vague 4 — stub réforme inactive
  await prisma.referentielVersion.upsert({
    where: { tenantId_code: { tenantId: demoTenant.id, code: 'cg_reforme_2026' } },
    update: { actif: false, libelle: 'Réforme 2026 (préparation)' },
    create: {
      tenantId: demoTenant.id,
      code: 'cg_reforme_2026',
      libelle: 'Réforme 2026 (préparation)',
      actif: false,
    },
  });
  console.log('✓ Référentiels cg_actuel (actif) + cg_reforme_2026 (stub)');

  const niveauxMap = {};
  for (const n of NIVEAUX_CG_ACTUEL) {
    const created = await prisma.niveauOfficiel.upsert({
      where: { referentielVersionId_code: { referentielVersionId: refActuel.id, code: n.code } },
      update: {
        libelle: n.libelle,
        cycle: n.cycle,
        ordre: n.ordre,
        ageIndicatif: n.ageIndicatif || null,
        typeExamenSortie: n.typeExamenSortie || null,
      },
      create: {
        tenantId: demoTenant.id,
        referentielVersionId: refActuel.id,
        code: n.code,
        libelle: n.libelle,
        cycle: n.cycle,
        ordre: n.ordre,
        ageIndicatif: n.ageIndicatif || null,
        typeExamenSortie: n.typeExamenSortie || null,
      },
    });
    niveauxMap[n.code] = created;
  }
  console.log(`✓ ${NIVEAUX_CG_ACTUEL.length} niveaux officiels PS→Tle`);

  const filieresMap = {};
  for (const f of FILIERES_CG_ACTUEL) {
    const created = await prisma.filiereOfficielle.upsert({
      where: { referentielVersionId_code: { referentielVersionId: refActuel.id, code: f.code } },
      update: { libelle: f.libelle, cycle: f.cycle },
      create: {
        tenantId: demoTenant.id,
        referentielVersionId: refActuel.id,
        code: f.code,
        libelle: f.libelle,
        cycle: f.cycle,
      },
    });
    filieresMap[f.code] = created;
  }

  // ==================== ANNÉE SCOLAIRE ====================
  const anneeScolaire = await prisma.anneeScolaire.upsert({
    where: { tenantId_libelle: { tenantId: demoTenant.id, libelle: '2025-2026' } },
    update: { actif: true, referentielVersionId: refActuel.id },
    create: {
      tenantId: demoTenant.id,
      libelle: '2025-2026',
      dateDebut: new Date('2025-10-01'),
      dateFin: new Date('2026-07-15'),
      actif: true,
      referentielVersionId: refActuel.id,
    },
  });
  console.log(`✓ Année scolaire : ${anneeScolaire.libelle}`);

  await prisma.tenantConfig.update({
    where: { tenantId: demoTenant.id },
    data: {
      anneeScolaireActiveId: anneeScolaire.id,
      conventionPeriode: 'trimestre',
      nombrePeriodes: 3,
    },
  });

  for (const p of PERIODES_2025_2026) {
    await prisma.periodeScolaire.upsert({
      where: { anneeScolaireId_index: { anneeScolaireId: anneeScolaire.id, index: p.index } },
      update: {
        libelle: p.libelle,
        dateDebut: new Date(p.dateDebut),
        dateFin: new Date(p.dateFin),
        dateEvaluationDebut: p.dateEvaluationDebut ? new Date(p.dateEvaluationDebut) : null,
        dateEvaluationFin: p.dateEvaluationFin ? new Date(p.dateEvaluationFin) : null,
        poids: p.poids,
        concerneCycles: p.concerneCycles || null,
      },
      create: {
        tenantId: demoTenant.id,
        anneeScolaireId: anneeScolaire.id,
        index: p.index,
        libelle: p.libelle,
        dateDebut: new Date(p.dateDebut),
        dateFin: new Date(p.dateFin),
        dateEvaluationDebut: p.dateEvaluationDebut ? new Date(p.dateEvaluationDebut) : null,
        dateEvaluationFin: p.dateEvaluationFin ? new Date(p.dateEvaluationFin) : null,
        poids: p.poids,
        concerneCycles: p.concerneCycles || null,
      },
    });
  }
  console.log('✓ 3 périodes scolaires 2025-2026');

  // Sessions examens nationaux (vague 2)
  for (const sess of [
    { typeExamen: 'CEPE', libelle: 'CEPE 2026' },
    { typeExamen: 'BEPC', libelle: 'BEPC 2026' },
    { typeExamen: 'BAC_GENERAL', libelle: 'BAC Général 2026' },
  ]) {
    const exists = await prisma.examenSession.findFirst({
      where: { tenantId: demoTenant.id, anneeScolaireId: anneeScolaire.id, typeExamen: sess.typeExamen },
    });
    if (!exists) {
      await prisma.examenSession.create({
        data: {
          tenantId: demoTenant.id,
          anneeScolaireId: anneeScolaire.id,
          typeExamen: sess.typeExamen,
          libelle: sess.libelle,
          dateDebut: new Date('2026-06-01'),
          dateFin: new Date('2026-06-20'),
          centre: 'Brazzaville',
        },
      });
    }
  }
  console.log('✓ Sessions examens CEPE / BEPC / BAC');

  // ==================== CLASSES ====================
  const classesData = [
    { nom: 'GS A', niveauCode: 'GS', cycle: 'prescolaire', capacite: 25, fraisScolarite: 80000 },
    { nom: 'CM2 A', niveauCode: 'CM2', cycle: 'primaire', capacite: 40, fraisScolarite: 120000 },
    { nom: '6ème A', niveauCode: '6e', cycle: 'college', capacite: 40, fraisScolarite: 150000 },
    { nom: '5ème B', niveauCode: '5e', cycle: 'college', capacite: 35, fraisScolarite: 150000 },
    { nom: '3ème A', niveauCode: '3e', cycle: 'college', capacite: 35, fraisScolarite: 160000 },
    { nom: '2nde A', niveauCode: '2nde', cycle: 'lycee', filiereCode: 'generale', capacite: 35, fraisScolarite: 180000 },
    { nom: 'Terminale S1', niveauCode: 'Tle', cycle: 'lycee', filiereCode: 'scientifique', capacite: 30, fraisScolarite: 200000 },
  ];

  const classesMap = {};
  for (const c of classesData) {
    const niv = niveauxMap[c.niveauCode];
    const fil = c.filiereCode ? filieresMap[c.filiereCode] : null;
    const existing = await prisma.classe.findFirst({
      where: { tenantId: demoTenant.id, anneeScolaireId: anneeScolaire.id, nom: c.nom },
    });
    if (existing) {
      classesMap[c.nom] = await prisma.classe.update({
        where: { id: existing.id },
        data: {
          niveau: c.niveauCode,
          cycle: c.cycle,
          filiere: fil?.libelle || null,
          niveauOfficielId: niv?.id || null,
          filiereOfficielleId: fil?.id || null,
        },
      });
    } else {
      classesMap[c.nom] = await prisma.classe.create({
        data: {
          tenantId: demoTenant.id,
          anneeScolaireId: anneeScolaire.id,
          nom: c.nom,
          niveau: c.niveauCode,
          cycle: c.cycle,
          filiere: fil?.libelle || null,
          niveauOfficielId: niv?.id || null,
          filiereOfficielleId: fil?.id || null,
          capacite: c.capacite,
          fraisScolarite: c.fraisScolarite,
        },
      });
    }
  }
  console.log(`✓ ${classesData.length} classes créées (référentiel Congo)`);

  // ==================== MATIÈRES ====================
  const matieresData = [
    { nom: 'Mathématiques', code: 'MATH', coefficient: 4 },
    { nom: 'Français', code: 'FR', coefficient: 4 },
    { nom: 'Histoire-Géographie', code: 'HIST-GEO', coefficient: 2 },
    { nom: 'Sciences Physiques', code: 'PHY', coefficient: 3 },
    { nom: 'Sciences de la Vie et de la Terre', code: 'SVT', coefficient: 2 },
    { nom: 'Anglais', code: 'ANG', coefficient: 2 },
  ];

  const matieresMap = {};
  for (const m of matieresData) {
    const existing = await prisma.matiere.findFirst({
      where: { tenantId: demoTenant.id, code: m.code },
    });
    if (existing) {
      matieresMap[m.code] = existing;
    } else {
      matieresMap[m.code] = await prisma.matiere.create({
        data: {
          tenantId: demoTenant.id,
          nom: m.nom,
          code: m.code,
          coefficient: m.coefficient,
        },
      });
    }
  }
  console.log(`✓ ${matieresData.length} matières créées`);

  // ==================== ÉLÈVES ====================
  const elevesData = [
    { matricule: 'GS-2026-0001', nom: 'Ossobi', prenom: 'David', dateNaissance: '2014-03-15', sexe: 'M', classe: '6ème A' },
    { matricule: 'GS-2026-0002', nom: 'Mbounda', prenom: 'Grace', dateNaissance: '2014-07-22', sexe: 'F', classe: '6ème A' },
    { matricule: 'GS-2026-0003', nom: 'Nkounkou', prenom: 'Pierre', dateNaissance: '2013-11-05', sexe: 'M', classe: '5ème B' },
    { matricule: 'GS-2026-0004', nom: 'Samba', prenom: 'Aïcha', dateNaissance: '2013-01-18', sexe: 'F', classe: '5ème B' },
    { matricule: 'GS-2026-0005', nom: 'Bouissa', prenom: 'Eric', dateNaissance: '2008-09-30', sexe: 'M', classe: 'Terminale S1' },
    { matricule: 'GS-2026-0006', nom: 'Mavoungou', prenom: 'Christelle', dateNaissance: '2008-05-12', sexe: 'F', classe: 'Terminale S1' },
  ];

  const elevesMap = {};
  for (const e of elevesData) {
    const existing = await prisma.eleve.findUnique({ where: { matricule: e.matricule } });
    if (existing) {
      elevesMap[e.matricule] = existing;
    } else {
      elevesMap[e.matricule] = await prisma.eleve.create({
        data: {
          tenantId: demoTenant.id,
          matricule: e.matricule,
          nom: e.nom,
          prenom: e.prenom,
          dateNaissance: new Date(e.dateNaissance),
          sexe: e.sexe,
        },
      });
    }
  }
  console.log(`✓ ${elevesData.length} élèves créés`);

  // ==================== INSCRIPTIONS ====================
  for (const e of elevesData) {
    const eleve = elevesMap[e.matricule];
    const classe = classesMap[e.classe];
    const existing = await prisma.inscription.findFirst({
      where: { tenantId: demoTenant.id, eleveId: eleve.id, anneeScolaireId: anneeScolaire.id },
    });
    if (!existing) {
      await prisma.inscription.create({
        data: {
          tenantId: demoTenant.id,
          eleveId: eleve.id,
          classeId: classe.id,
          anneeScolaireId: anneeScolaire.id,
          statut: 'validee',
          soldeScolarite: parseFloat(classe.fraisScolarite),
        },
      });
    }
  }
  console.log(`✓ ${elevesData.length} inscriptions créées`);

  // ==================== ENSEIGNANT-CLASSE-MATIERE ====================
  const enseignant = staffMap.enseignantTitulaire || staffMap['enseignant@demo.cg'];
  // Préscolaire / primaire : un titulaire par classe, sur toutes les matières du programme.
  // Collège / lycée : une seule matière par enseignant, réparti sur plusieurs classes.
  const ecLinks = [
    { email: 'titulaire.gs@demo.cg', classe: 'GS A', matiere: 'FR' },
    { email: 'titulaire.gs@demo.cg', classe: 'GS A', matiere: 'MATH' },
    { email: 'titulaire.cm2@demo.cg', classe: 'CM2 A', matiere: 'FR' },
    { email: 'titulaire.cm2@demo.cg', classe: 'CM2 A', matiere: 'MATH' },
    { email: 'titulaire.cm2@demo.cg', classe: 'CM2 A', matiere: 'HIST-GEO' },
    { email: 'enseignant@demo.cg', classe: '6ème A', matiere: 'MATH' },
    { email: 'enseignant@demo.cg', classe: '5ème B', matiere: 'MATH' },
    { email: 'enseignant@demo.cg', classe: '3ème A', matiere: 'MATH' },
    { email: 'enseignant@demo.cg', classe: '2nde A', matiere: 'MATH' },
    { email: 'enseignant@demo.cg', classe: 'Terminale S1', matiere: 'MATH' },
    { email: 'prof.francais@demo.cg', classe: '6ème A', matiere: 'FR' },
    { email: 'prof.francais@demo.cg', classe: '3ème A', matiere: 'FR' },
    { email: 'prof.francais@demo.cg', classe: '2nde A', matiere: 'FR' },
    { email: 'prof.histoire@demo.cg', classe: '6ème A', matiere: 'HIST-GEO' },
    { email: 'prof.histoire@demo.cg', classe: '5ème B', matiere: 'HIST-GEO' },
    { email: 'vacataire@demo.cg', classe: '2nde A', matiere: 'PHY' },
    { email: 'vacataire@demo.cg', classe: 'Terminale S1', matiere: 'PHY' },
    { email: 'prof.svt@demo.cg', classe: '3ème A', matiere: 'SVT' },
    { email: 'prof.svt@demo.cg', classe: 'Terminale S1', matiere: 'SVT' },
  ];
  let ecCount = 0;
  for (const link of ecLinks) {
    const classe = classesMap[link.classe];
    const matiere = matieresMap[link.matiere];
    const prof = staffMap[link.email];
    if (!classe || !matiere || !prof) continue;
    const existing = await prisma.enseignantClasse.findFirst({
      where: { enseignantId: prof.id, classeId: classe.id, matiereId: matiere.id },
    });
    if (!existing) {
      await prisma.enseignantClasse.create({
        data: { tenantId: demoTenant.id, enseignantId: prof.id, classeId: classe.id, matiereId: matiere.id },
      });
      ecCount++;
    }
  }
  console.log(`✓ ${ecLinks.length} associations enseignant-classe-matière créées`);

  // ==================== PROGRAMME MATIÈRES PAR NIVEAU ====================
  const programmesNiveau = [
    { niveau: 'GS', items: [{ code: 'FR', coef: 3 }, { code: 'MATH', coef: 2 }] },
    { niveau: 'CM2', items: [{ code: 'FR', coef: 4 }, { code: 'MATH', coef: 4 }, { code: 'HIST-GEO', coef: 2 }] },
    { niveau: '6e', items: [{ code: 'FR', coef: 3 }, { code: 'MATH', coef: 3 }, { code: 'ANG', coef: 2 }, { code: 'HIST-GEO', coef: 2 }] },
    { niveau: '3e', items: [{ code: 'FR', coef: 3 }, { code: 'MATH', coef: 3 }, { code: 'PHY', coef: 2 }, { code: 'SVT', coef: 2 }] },
    { niveau: '2nde', items: [{ code: 'FR', coef: 3 }, { code: 'MATH', coef: 4 }, { code: 'PHY', coef: 3 }, { code: 'ANG', coef: 2 }] },
    { niveau: 'Tle', items: [{ code: 'MATH', coef: 5 }, { code: 'PHY', coef: 4 }, { code: 'SVT', coef: 3 }, { code: 'FR', coef: 2 }] },
  ];
  let progCount = 0;
  for (const prog of programmesNiveau) {
    const niveau = niveauxMap[prog.niveau];
    if (!niveau) continue;
    for (const item of prog.items) {
      const matiere = matieresMap[item.code];
      if (!matiere) continue;
      await prisma.matiereNiveauAnnee.upsert({
        where: {
          anneeScolaireId_niveauOfficielId_matiereId: {
            anneeScolaireId: anneeScolaire.id,
            niveauOfficielId: niveau.id,
            matiereId: matiere.id,
          },
        },
        update: { coefficient: item.coef, actif: true },
        create: {
          tenantId: demoTenant.id,
          anneeScolaireId: anneeScolaire.id,
          niveauOfficielId: niveau.id,
          matiereId: matiere.id,
          coefficient: item.coef,
          actif: true,
        },
      });
      progCount++;
    }
  }
  console.log(`✓ ${progCount} entrées programme matière/niveau/année`);

  // ==================== ÉCHÉANCES (mois de l'année scolaire) ====================
  const MOIS_FR = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
  ];
  const moisScolarite = [];
  {
    const start = new Date(anneeScolaire.dateDebut);
    const end = new Date(anneeScolaire.dateFin);
    let y = start.getUTCFullYear();
    let m = start.getUTCMonth();
    while (y < end.getUTCFullYear() || (y === end.getUTCFullYear() && m <= end.getUTCMonth())) {
      moisScolarite.push(new Date(Date.UTC(y, m, 1, 12, 0, 0)));
      m += 1;
      if (m > 11) { m = 0; y += 1; }
      if (moisScolarite.length > 18) break;
    }
  }
  const totalScolarite = 150000;
  const monthly = moisScolarite.length
    ? Math.round((totalScolarite / moisScolarite.length) * 100) / 100
    : 0;
  let echeanceCount = 0;
  for (const e of elevesData) {
    const eleve = elevesMap[e.matricule];
    const inscription = await prisma.inscription.findFirst({
      where: { tenantId: demoTenant.id, eleveId: eleve.id, anneeScolaireId: anneeScolaire.id },
    });
    if (!inscription) continue;
    const already = await prisma.echeance.count({
      where: { tenantId: demoTenant.id, inscriptionId: inscription.id },
    });
    if (already > 0) continue;
    const rows = [
      {
        tenantId: demoTenant.id,
        inscriptionId: inscription.id,
        libelle: "Frais d'inscription",
        montantAttendu: 25000,
        dateEcheance: new Date('2025-10-15'),
        statut: 'en_attente',
      },
      ...moisScolarite.map((d, i) => ({
        tenantId: demoTenant.id,
        inscriptionId: inscription.id,
        libelle: `${MOIS_FR[d.getUTCMonth()]} ${d.getUTCFullYear()}`,
        montantAttendu: i === moisScolarite.length - 1
          ? Math.round((totalScolarite - monthly * (moisScolarite.length - 1)) * 100) / 100
          : monthly,
        dateEcheance: new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 5, 12, 0, 0)),
        statut: 'en_attente',
      })),
    ];
    await prisma.echeance.createMany({ data: rows });
    echeanceCount += rows.length;
  }
  console.log(`✓ ${echeanceCount} échéances créées`);

  // ==================== ACTUALITÉS ====================
  const actualitesData = [
    { titre: 'Rentrée scolaire 2025-2026', contenu: 'La rentrée scolaire aura lieu le 1er octobre 2025. Les inscriptions sont ouvertes.', publique: true },
    { titre: 'Résultats du premier trimestre', contenu: 'Les résultats du premier trimestre seront publiés le 15 décembre 2025.', publique: true },
    { titre: 'Sortie pédagogique', contenu: 'Une sortie pédagogique est organisée pour les classes de 6ème le 20 novembre 2025.', publique: false },
  ];

  for (const a of actualitesData) {
    const existing = await prisma.actualite.findFirst({
      where: { tenantId: demoTenant.id, titre: a.titre },
    });
    if (!existing) {
      await prisma.actualite.create({
        data: {
          tenantId: demoTenant.id,
          titre: a.titre,
          contenu: a.contenu,
          publique: a.publique,
        },
      });
    }
  }
  console.log(`✓ ${actualitesData.length} actualités créées`);

  // ==================== SALLES ====================
  const sallesData = [
    { nom: 'A101', batiment: 'Bloc A', capacite: 40, type: 'cours' },
    { nom: 'A102', batiment: 'Bloc A', capacite: 35, type: 'cours' },
    { nom: 'Labo Sciences', batiment: 'Bloc B', capacite: 25, type: 'labo' },
    { nom: 'Salle Info', batiment: 'Bloc B', capacite: 30, type: 'informatique' },
  ];
  for (const s of sallesData) {
    const existing = await prisma.salle.findFirst({ where: { tenantId: demoTenant.id, nom: s.nom } });
    if (!existing) {
      await prisma.salle.create({ data: { tenantId: demoTenant.id, ...s, actif: true } });
    }
  }
  console.log(`✓ ${sallesData.length} salles créées`);

  // ==================== CALENDRIER SCOLAIRE ====================
  const calendrierData = [
    { titre: 'Rentrée scolaire 2025-2026', type: 'rentree', dateDebut: '2025-10-01', dateFin: '2025-10-01', description: 'Premier jour de classe' },
    { titre: 'Vacances de Toussaint', type: 'vacances', dateDebut: '2025-12-20', dateFin: '2026-01-05', description: 'Congé de Toussaint' },
    { titre: 'Vacances de Noël', type: 'vacances', dateDebut: '2025-12-22', dateFin: '2026-01-05', description: 'Congé de fin d\'année' },
    { titre: 'Compositions 1er trimestre', type: 'composition', dateDebut: '2025-12-01', dateFin: '2025-12-15', description: 'Compositions du 1er trimestre' },
    { titre: 'Conseil de classe T1', type: 'conseil_classe', dateDebut: '2025-12-18', dateFin: '2025-12-18', description: 'Conseils de classe 1er trimestre' },
    { titre: 'Vacances de Pâques', type: 'vacances', dateDebut: '2026-04-05', dateFin: '2026-04-19', description: 'Congé de Pâques' },
    { titre: 'Fête de l\'Indépendance', type: 'jour_ferie', dateDebut: '2026-08-15', dateFin: '2026-08-15', description: 'Fête nationale du Congo' },
  ];
  for (const ev of calendrierData) {
    const existing = await prisma.calendrierScolaire.findFirst({ where: { tenantId: demoTenant.id, titre: ev.titre } });
    if (!existing) {
      await prisma.calendrierScolaire.create({
        data: {
          tenantId: demoTenant.id,
          anneeScolaireId: anneeScolaire.id,
          titre: ev.titre,
          type: ev.type,
          dateDebut: new Date(ev.dateDebut),
          dateFin: new Date(ev.dateFin),
          description: ev.description,
        },
      });
    }
  }
  console.log(`✓ ${calendrierData.length} événements calendrier créés`);

  // ==================== ABSENCES (3 types) ====================
  const absencesData = [
    { eleve: 'GS-2026-0001', typeAbsence: 'absent', justifiee: true, motifJustif: 'Maladie - certificat médical fourni' },
    { eleve: 'GS-2026-0002', typeAbsence: 'retard', justifiee: false, motifJustif: null },
    { eleve: 'GS-2026-0003', typeAbsence: 'depart_anticipe', justifiee: true, motifJustif: 'Rendez-vous médical' },
    { eleve: 'GS-2026-0005', typeAbsence: 'absent', justifiee: false, motifJustif: null },
  ];
  for (const a of absencesData) {
    const eleve = elevesMap[a.eleve];
    if (!eleve) continue;
    const existing = await prisma.absence.findFirst({
      where: { tenantId: demoTenant.id, eleveId: eleve.id, dateAbsence: { gte: new Date('2025-11-01'), lt: new Date('2025-11-02') } },
    });
    if (!existing) {
      await prisma.absence.create({
        data: {
          tenantId: demoTenant.id,
          eleveId: eleve.id,
          dateAbsence: new Date('2025-11-01'),
          typeAbsence: a.typeAbsence,
          justifiee: a.justifiee,
          motifJustif: a.motifJustif,
          saisieParId: staffMap['surveillant'].id,
        },
      });
    }
  }
  console.log(`✓ ${absencesData.length} absences créées (3 types: absent, retard, départ anticipé)`);

  // ==================== COMPTE PARENT ====================
  const parentPassword = 'Parent123!';
  const parentHash = await bcrypt.hash(parentPassword, BCRYPT_ROUNDS);
  const parentUser = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: demoTenant.id, email: 'parent@demo.cg' } },
    update: { passwordHash: parentHash, actif: true },
    create: {
      tenantId: demoTenant.id,
      email: 'parent@demo.cg',
      passwordHash: parentHash,
      nom: 'Ossobi',
      prenom: 'Joseph',
      telephone: '+242 06 222 2222',
      actif: true,
    },
  });

  // Lier le parent au premier élève (David Ossobi)
  const eleve1 = elevesMap['GS-2026-0001'];
  if (eleve1) {
    await prisma.eleve.update({
      where: { id: eleve1.id },
      data: { parentId: parentUser.id },
    });
  }
  console.log(`✓ Parent : parent@demo.cg / ${parentPassword}`);

  // ==================== MESSAGE DÉMO ====================
  const directeur = staffMap['directeur'];
  const existingMsg = await prisma.message.findFirst({
    where: { tenantId: demoTenant.id, expediteurId: directeur.id, destinataireUserId: parentUser.id },
  });
  if (!existingMsg) {
    await prisma.message.create({
      data: {
        tenantId: demoTenant.id,
        expediteurId: directeur.id,
        destinataireUserId: parentUser.id,
        sujet: 'Bienvenue sur la plateforme GestSchool',
        contenu: 'Cher parent, nous vous welcomeons sur la plateforme de gestion scolaire. Vous pouvez consulter les bulletins, absences et échéances de paiement de votre enfant en ligne.',
      },
    });
  }
  console.log(`✓ 1 message de démonstration créé (directeur → parent)`);

  // ==================== PHASE 1 — EDT / NOTES / BULLETIN / PAIEMENT / NOTIFS ====================
  const salleA12 = await prisma.salle.findFirst({
    where: { tenantId: demoTenant.id, nom: 'A12' },
  });
  const todayJs = new Date().getDay();
  const todayJour = todayJs === 0 ? 7 : todayJs;

  // Un même enseignant peut cumuler plusieurs classes le même jour, sur des horaires disjoints
  const edtSlots = [
    { classe: '6ème A', matiere: 'MATH', email: 'enseignant@demo.cg', jourSemaine: todayJour, heureDebut: '08:00', heureFin: '09:00', salle: 'A12' },
    { classe: '6ème A', matiere: 'FR', email: 'prof.francais@demo.cg', jourSemaine: todayJour, heureDebut: '09:00', heureFin: '10:00', salle: 'A12' },
    { classe: '5ème B', matiere: 'MATH', email: 'enseignant@demo.cg', jourSemaine: todayJour, heureDebut: '10:00', heureFin: '11:00', salle: 'B05' },
    { classe: '6ème A', matiere: 'MATH', email: 'enseignant@demo.cg', jourSemaine: 1, heureDebut: '08:00', heureFin: '09:00', salle: 'A12' },
    { classe: '6ème A', matiere: 'FR', email: 'prof.francais@demo.cg', jourSemaine: 2, heureDebut: '10:00', heureFin: '11:00', salle: 'A12' },
    { classe: '5ème B', matiere: 'MATH', email: 'enseignant@demo.cg', jourSemaine: 3, heureDebut: '08:00', heureFin: '09:00', salle: 'B05' },
    { classe: 'Terminale S1', matiere: 'PHY', email: 'vacataire@demo.cg', jourSemaine: 4, heureDebut: '14:00', heureFin: '16:00', salle: 'Labo Sciences' },
  ];

  let edtCount = 0;
  for (const slot of edtSlots) {
    const classe = classesMap[slot.classe];
    const matiere = matieresMap[slot.matiere];
    const prof = staffMap[slot.email];
    if (!classe || !matiere || !prof) continue;
    const existing = await prisma.emploiDuTemps.findFirst({
      where: {
        tenantId: demoTenant.id,
        enseignantId: prof.id,
        classeId: classe.id,
        matiereId: matiere.id,
        jourSemaine: slot.jourSemaine,
        heureDebut: slot.heureDebut,
      },
    });
    if (!existing) {
      const salleRef = await prisma.salle.findFirst({
        where: { tenantId: demoTenant.id, nom: slot.salle },
      });
      await prisma.emploiDuTemps.create({
        data: {
          tenantId: demoTenant.id,
          classeId: classe.id,
          matiereId: matiere.id,
          enseignantId: prof.id,
          jourSemaine: slot.jourSemaine,
          heureDebut: slot.heureDebut,
          heureFin: slot.heureFin,
          salle: slot.salle,
          salleId: salleRef?.id || salleA12?.id || null,
        },
      });
      edtCount++;
    }
  }
  console.log(`✓ ${edtCount} créneaux EDT créés (dont cours du jour)`);

  // Evaluation + notes (6ème A MATH)
  const classe6A = classesMap['6ème A'];
  const matiereMath = matieresMap['MATH'];
  let evaluation = await prisma.evaluation.findFirst({
    where: {
      tenantId: demoTenant.id,
      classeId: classe6A.id,
      matiereId: matiereMath.id,
      nom: 'Devoir de Table n°1',
    },
  });
  if (!evaluation) {
    evaluation = await prisma.evaluation.create({
      data: {
        tenantId: demoTenant.id,
        classeId: classe6A.id,
        matiereId: matiereMath.id,
        anneeScolaireId: anneeScolaire.id,
        periodeIndex: 1,
        nom: 'Devoir de Table n°1',
        type: 'devoir',
        dateEvaluation: new Date('2025-11-20'),
        coefficient: 2,
        noteMaximale: 20,
      },
    });
  }

  const eleves6A = [elevesMap['GS-2026-0001'], elevesMap['GS-2026-0002']].filter(Boolean);
  const notesDemo = [14.5, 12.0];
  for (let i = 0; i < eleves6A.length; i++) {
    const el = eleves6A[i];
    const existingNote = await prisma.note.findFirst({
      where: { evaluationId: evaluation.id, eleveId: el.id },
    });
    if (!existingNote) {
      await prisma.note.create({
        data: {
          tenantId: demoTenant.id,
          evaluationId: evaluation.id,
          eleveId: el.id,
          valeur: notesDemo[i],
          appreciation: notesDemo[i] >= 14 ? 'Bon travail' : 'Peut mieux faire',
          saisiParId: enseignant.id,
        },
      });
    }
  }
  console.log('✓ 1 évaluation + notes (6ème A MATH)');

  // Bulletin published for parent's child
  const eleveParent = elevesMap['GS-2026-0001'];
  if (eleveParent && classe6A) {
    const existingBul = await prisma.bulletin.findFirst({
      where: {
        tenantId: demoTenant.id,
        eleveId: eleveParent.id,
        anneeScolaireId: anneeScolaire.id,
        periodeIndex: 1,
      },
    });
    if (!existingBul) {
      await prisma.bulletin.create({
        data: {
          tenantId: demoTenant.id,
          eleveId: eleveParent.id,
          classeId: classe6A.id,
          anneeScolaireId: anneeScolaire.id,
          periodeIndex: 1,
          moyenneGenerale: 13.75,
          rang: 2,
          effectifClasse: 2,
          mention: 'encouragements',
          decisionConseil: 'Continue ainsi',
          absencesHeures: 2,
          valide: true,
          notesDetaillees: {
            create: [
              { matiereId: matieresMap['MATH'].id, moyenne: 14.5 },
              { matiereId: matieresMap['FR'].id, moyenne: 13.0 },
            ],
          },
        },
      });
    }
  }
  console.log('✓ 1 bulletin publié (David Ossobi)');

  // Sanction
  if (eleveParent) {
    const existingSan = await prisma.sanction.findFirst({
      where: { tenantId: demoTenant.id, eleveId: eleveParent.id, motif: 'Retard répété' },
    });
    if (!existingSan) {
      await prisma.sanction.create({
        data: {
          tenantId: demoTenant.id,
          eleveId: eleveParent.id,
          type: 'avertissement',
          motif: 'Retard répété',
          dateSanction: new Date('2025-11-10'),
        },
      });
    }
  }
  console.log('✓ 1 sanction (avertissement)');

  // Paiement + notification
  const inscriptionParent = eleveParent
    ? await prisma.inscription.findFirst({
        where: {
          tenantId: demoTenant.id,
          eleveId: eleveParent.id,
          anneeScolaireId: anneeScolaire.id,
        },
        include: { echeances: true },
      })
    : null;
  const comptable = staffMap['comptable@demo.cg'] || staffMap['comptable'];
  if (inscriptionParent && comptable) {
    const existingPay = await prisma.paiement.findFirst({
      where: { tenantId: demoTenant.id, inscriptionId: inscriptionParent.id, numeroRecu: 1 },
    });
    if (!existingPay) {
      const echeance = inscriptionParent.echeances?.[0];
      await prisma.paiement.create({
        data: {
          tenantId: demoTenant.id,
          inscriptionId: inscriptionParent.id,
          echeanceId: echeance?.id || null,
          recuParId: comptable.id,
          numeroRecu: 1,
          montant: 25000,
          typePaiement: 'inscription',
          modePaiement: 'especes',
          motif: 'Frais d\'inscription',
          datePaiement: new Date('2025-10-10'),
        },
      });
      if (echeance) {
        await prisma.echeance.update({
          where: { id: echeance.id },
          data: { montantPaye: 25000, statut: 'payee' },
        });
      }
      await prisma.inscription.update({
        where: { id: inscriptionParent.id },
        data: { soldeScolarite: Math.max(0, Number(inscriptionParent.soldeScolarite) - 25000) },
      });
    }
  }
  console.log('✓ 1 paiement (frais d\'inscription)');

  if (parentUser) {
    const existingNotif = await prisma.notification.findFirst({
      where: { tenantId: demoTenant.id, userId: parentUser.id, titre: 'Bulletin disponible' },
    });
    if (!existingNotif) {
      await prisma.notification.createMany({
        data: [
          {
            tenantId: demoTenant.id,
            userId: parentUser.id,
            type: 'bulletin',
            titre: 'Bulletin disponible',
            contenu: 'Le bulletin du 1er trimestre de David Ossobi est disponible.',
            lu: false,
            lien: '/parent/bulletins',
          },
          {
            tenantId: demoTenant.id,
            userId: parentUser.id,
            type: 'paiement',
            titre: 'Paiement reçu',
            contenu: 'Nous avons bien reçu le paiement des frais d\'inscription (25 000 FCFA).',
            lu: true,
            lien: '/parent/facturation',
          },
        ],
      });
    }
  }
  console.log('✓ 2 notifications parent');

  console.log('✅ Seed terminé avec succès !\n');
  console.log('═══════════════════════════════════════════════════════');
  console.log('  🎭 IDENTIFIANTS DE CONNEXION - TENANT DE TEST');
  console.log('═══════════════════════════════════════════════════════');
  console.log('');
  console.log('  🔴 SUPER ADMIN (accès global)');
  console.log('     URL      : /super-admin');
  console.log(`     Email    : ${SUPER_ADMIN_EMAIL}`);
  console.log(`     Password : ${SUPER_ADMIN_PASSWORD}`);
  console.log('');
  console.log('  🟢 ÉCOLE DÉMO (slug: demo)');
  console.log('     URL      : /e/demo/login');
  console.log('     ----------------------------------------');
  console.log('     👨‍💼 Directeur');
  console.log('        Email    : directeur@demo.cg');
  console.log('        Password : Directeur123!');
  console.log('     ----------------------------------------');
  console.log('     👩‍💼 Secrétaire');
  console.log('        Email    : secretaire@demo.cg');
  console.log('        Password : Secretaire123!');
  console.log('     ----------------------------------------');
  console.log('     👨‍🏫 Enseignant (titulaire)');
  console.log('        Email    : enseignant@demo.cg');
  console.log('        Password : Enseignant123!');
  console.log('     ----------------------------------------');
  console.log('        Matière  : Mathématiques (6ème A, 5ème B, 3ème A, 2nde A, Tle S1)');
  console.log('     ----------------------------------------');
  console.log('     👨‍🏫 Enseignant (vacataire) — Physique');
  console.log('        Email    : vacataire@demo.cg');
  console.log('        Password : Vacataire123!');
  console.log('     ----------------------------------------');
  console.log('     👩‍🏫 Titulaire GS A (préscolaire)');
  console.log('        Email    : titulaire.gs@demo.cg');
  console.log('        Password : TitulaireGS123!');
  console.log('     ----------------------------------------');
  console.log('     👩‍🏫 Titulaire CM2 A (primaire)');
  console.log('        Email    : titulaire.cm2@demo.cg');
  console.log('        Password : TitulaireCM2123!');
  console.log('     ----------------------------------------');
  console.log('     👩‍🏫 Français : prof.francais@demo.cg / ProfFrancais123!');
  console.log('     👨‍🏫 Histoire-Géo : prof.histoire@demo.cg / ProfHistoire123!');
  console.log('     👩‍🏫 SVT : prof.svt@demo.cg / ProfSvt123!');
  console.log('     ----------------------------------------');
  console.log('     👮 Surveillant');
  console.log('        Email    : surveillant@demo.cg');
  console.log('        Password : Surveillant123!');
  console.log('     ----------------------------------------');
  console.log('     💰 Comptable');
  console.log('        Email    : comptable@demo.cg');
  console.log('        Password : Comptable123!');
  console.log('     ----------------------------------------');
  console.log('     👨‍👩‍👦 Parent');
  console.log('        Email    : parent@demo.cg');
  console.log('        Password : Parent123!');
  console.log('');
  console.log('  📦 DONNÉES CRÉÉES :');
  console.log('     • 1 année scolaire (2025-2026)');
  console.log('     • 3 classes');
  console.log('     • 6 matières');
  console.log('     • 6 élèves avec inscriptions');
  console.log('     • 3 actualités');
  console.log(`     • ${ecLinks.length} associations enseignant-classe-matière`);
  console.log('     • 24 échéances de paiement');
  console.log(`     • ${staffDemo.length} utilisateurs staff (dont 1 vacataire)`);
  console.log('     • 1 compte parent');
  console.log('     • 4 salles');
  console.log('     • 7 événements calendrier scolaire');
  console.log('     • 4 absences (3 types: absent, retard, départ anticipé)');
  console.log('     • 1 message (directeur → parent)');
  console.log('     • EDT + évaluation + bulletin + sanction + paiement + notifs (Phase 1)');
  console.log('═══════════════════════════════════════════════════════');
}

main()
  .catch((e) => {
    console.error('❌ Erreur durant le seed :', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
