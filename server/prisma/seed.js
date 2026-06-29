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
    update: {},
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
    update: {},
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
    },
  });
  console.log('✓ Configuration default créée');

  // ==================== STAFF COMPLET (démo) ====================
  const staffDemo = [
    { email: 'directeur@demo.cg', password: 'Directeur123!', role: 'directeur', nom: 'Mbemba', prenom: 'Jean' },
    { email: 'secretaire@demo.cg', password: 'Secretaire123!', role: 'secretaire', nom: 'Ngoma', prenom: 'Marie' },
    { email: 'enseignant@demo.cg', password: 'Enseignant123!', role: 'enseignant', nom: 'Kouassi', prenom: 'Paul' },
    { email: 'surveillant@demo.cg', password: 'Surveillant123!', role: 'surveillant', nom: 'Moussa', prenom: 'Amadou' },
    { email: 'comptable@demo.cg', password: 'Comptable123!', role: 'comptable', nom: 'Lingui', prenom: 'Sarah' },
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
        mustChangePassword: false,
        actif: true,
      },
    });
    staffMap[s.role] = created;
    console.log(`✓ ${s.role} : ${created.email} / ${s.password}`);
  }

  // ==================== ANNÉE SCOLAIRE ====================
  const anneeScolaire = await prisma.anneeScolaire.upsert({
    where: { tenantId_libelle: { tenantId: demoTenant.id, libelle: '2025-2026' } },
    update: { actif: true },
    create: {
      tenantId: demoTenant.id,
      libelle: '2025-2026',
      dateDebut: new Date('2025-10-01'),
      dateFin: new Date('2026-07-15'),
      actif: true,
    },
  });
  console.log(`✓ Année scolaire : ${anneeScolaire.libelle}`);

  // ==================== CLASSES ====================
  const classesData = [
    { nom: '6ème A', niveau: '6eme', filiere: 'Générale', capacite: 40, fraisScolarite: 150000 },
    { nom: '5ème B', niveau: '5eme', filiere: 'Générale', capacite: 35, fraisScolarite: 150000 },
    { nom: 'Terminale S1', niveau: 'terminale', filiere: 'Scientifique', capacite: 30, fraisScolarite: 200000 },
  ];

  const classesMap = {};
  for (const c of classesData) {
    const existing = await prisma.classe.findFirst({
      where: { tenantId: demoTenant.id, anneeScolaireId: anneeScolaire.id, nom: c.nom },
    });
    if (existing) {
      classesMap[c.nom] = existing;
    } else {
      classesMap[c.nom] = await prisma.classe.create({
        data: {
          tenantId: demoTenant.id,
          anneeScolaireId: anneeScolaire.id,
          nom: c.nom,
          niveau: c.niveau,
          filiere: c.filiere,
          capacite: c.capacite,
          fraisScolarite: c.fraisScolarite,
        },
      });
    }
  }
  console.log(`✓ ${classesData.length} classes créées`);

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

  // ==================== ENSEIGNANT-CLASSE ====================
  const enseignant = staffMap['enseignant'];
  for (const c of Object.values(classesMap)) {
    const existing = await prisma.enseignantClasse.findFirst({
      where: { enseignantId: enseignant.id, classeId: c.id },
    });
    if (!existing) {
      await prisma.enseignantClasse.create({
        data: { enseignantId: enseignant.id, classeId: c.id },
      });
    }
  }
  console.log(`✓ ${classesData.length} associations enseignant-classe créées`);

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
  console.log('     URL      : /p/demo/login');
  console.log('     ----------------------------------------');
  console.log('     👨‍💼 Directeur');
  console.log('        Email    : directeur@demo.cg');
  console.log('        Password : Directeur123!');
  console.log('     ----------------------------------------');
  console.log('     👩‍💼 Secrétaire');
  console.log('        Email    : secretaire@demo.cg');
  console.log('        Password : Secretaire123!');
  console.log('     ----------------------------------------');
  console.log('     👨‍🏫 Enseignant');
  console.log('        Email    : enseignant@demo.cg');
  console.log('        Password : Enseignant123!');
  console.log('     ----------------------------------------');
  console.log('     👮 Surveillant');
  console.log('        Email    : surveillant@demo.cg');
  console.log('        Password : Surveillant123!');
  console.log('     ----------------------------------------');
  console.log('     💰 Comptable');
  console.log('        Email    : comptable@demo.cg');
  console.log('        Password : Comptable123!');
  console.log('');
  console.log('  📦 DONNÉES CRÉÉES :');
  console.log('     • 1 année scolaire (2025-2026)');
  console.log('     • 3 classes');
  console.log('     • 6 matières');
  console.log('     • 6 élèves avec inscriptions');
  console.log('     • 3 actualités');
  console.log('     • 5 utilisateurs staff');
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
