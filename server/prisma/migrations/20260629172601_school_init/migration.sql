-- CreateEnum
CREATE TYPE "StaffRole" AS ENUM ('super_admin', 'directeur', 'secretaire', 'enseignant', 'surveillant', 'comptable');

-- CreateEnum
CREATE TYPE "StatutInscription" AS ENUM ('en_attente', 'validee', 'annulee', 'suspendue');

-- CreateEnum
CREATE TYPE "TypeEvaluation" AS ENUM ('devoir', 'interrogation', 'examen', 'rattrapage');

-- CreateEnum
CREATE TYPE "TypePaiement" AS ENUM ('inscription', 'scolarite', 'mensualite', 'examen_officiel', 'bibliotheque', 'cantine', 'uniforme', 'autre');

-- CreateEnum
CREATE TYPE "ModePaiement" AS ENUM ('especes', 'mobile_money', 'carte', 'cheque', 'virement');

-- CreateEnum
CREATE TYPE "TypeSanction" AS ENUM ('avertissement', 'blame', 'retenue', 'exclusion_temporaire', 'exclusion_definitive');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('login', 'logout', 'staff_created', 'staff_updated', 'staff_deleted', 'tenant_created', 'tenant_updated', 'eleve_created', 'eleve_updated', 'inscription_created', 'note_saisie', 'note_modifiee', 'bulletin_genere', 'paiement_encaisse', 'absence_saisie', 'sanction_attribuee', 'password_changed');

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "customDomain" TEXT,
    "plan" TEXT NOT NULL DEFAULT 'basique',
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "numeroAutorisation" TEXT,
    "contact" JSONB,
    "modeMaintenance" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantConfig" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nomEcole" TEXT NOT NULL DEFAULT 'GestSchool',
    "slogan" TEXT,
    "logoUrl" TEXT,
    "faviconUrl" TEXT,
    "backgroundImageUrl" TEXT,
    "loaderUrl" TEXT,
    "couleurPrimaire" TEXT NOT NULL DEFAULT '#1e3a8a',
    "couleurSecondaire" TEXT NOT NULL DEFAULT '#0d9488',
    "couleurTexte" TEXT NOT NULL DEFAULT '#1f2937',
    "couleurAlerte" TEXT NOT NULL DEFAULT '#f59e0b',
    "couleurErreur" TEXT NOT NULL DEFAULT '#ef4444',
    "couleurSucces" TEXT NOT NULL DEFAULT '#22c55e',
    "darkModeDefault" BOOLEAN NOT NULL DEFAULT false,
    "police" TEXT NOT NULL DEFAULT 'Plus Jakarta Sans',
    "adresse" TEXT,
    "telephone" TEXT,
    "email" TEXT,
    "devise" TEXT NOT NULL DEFAULT 'FCFA',
    "messageAccueil" TEXT,
    "anneeScolaireActiveId" TEXT,
    "notationSur" INTEGER NOT NULL DEFAULT 20,
    "seuilReussite" DECIMAL(5,2) NOT NULL DEFAULT 10.00,
    "nombrePeriodes" INTEGER NOT NULL DEFAULT 3,
    "joursEcole" JSONB,
    "heureDebut" TEXT NOT NULL DEFAULT '08:00',
    "heureFin" TEXT NOT NULL DEFAULT '17:00',
    "fraisInscriptionDefault" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "fraisScolariteDefault" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "moduleNotes" BOOLEAN NOT NULL DEFAULT true,
    "moduleBulletins" BOOLEAN NOT NULL DEFAULT true,
    "modulePresences" BOOLEAN NOT NULL DEFAULT true,
    "modulePaiements" BOOLEAN NOT NULL DEFAULT true,
    "moduleEmploiDuTemps" BOOLEAN NOT NULL DEFAULT true,
    "moduleParents" BOOLEAN NOT NULL DEFAULT true,
    "moduleEleves" BOOLEAN NOT NULL DEFAULT false,
    "moduleSanctions" BOOLEAN NOT NULL DEFAULT true,
    "moduleBiblio" BOOLEAN NOT NULL DEFAULT false,
    "moduleCantine" BOOLEAN NOT NULL DEFAULT false,
    "moduleTransport" BOOLEAN NOT NULL DEFAULT false,
    "moduleCertificats" BOOLEAN NOT NULL DEFAULT true,
    "dureeSessionMinutes" INTEGER NOT NULL DEFAULT 480,
    "ipWhitelist" JSONB,
    "forcer2FA" BOOLEAN NOT NULL DEFAULT false,
    "privacyPolicyUrl" TEXT,
    "termsOfServiceUrl" TEXT,
    "cookiePolicyUrl" TEXT,
    "cookieBannerText" TEXT,
    "cookieBannerEnabled" BOOLEAN NOT NULL DEFAULT true,
    "analyticsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Staff" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "passwordHash" TEXT NOT NULL,
    "role" "StaffRole" NOT NULL,
    "nom" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "telephone" TEXT,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT true,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "derniereConnexion" TIMESTAMP(3),
    "lastIp" TEXT,
    "lastUserAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "passwordHash" TEXT,
    "nom" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "telephone" TEXT,
    "adresse" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "derniereConnexion" TIMESTAMP(3),
    "lastIp" TEXT,
    "lastUserAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userType" TEXT NOT NULL DEFAULT 'staff',
    "tenantId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailVerificationToken" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userType" TEXT NOT NULL DEFAULT 'staff',
    "tenantId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailVerificationToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CookieConsent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT,
    "sessionId" TEXT,
    "necessary" BOOLEAN NOT NULL DEFAULT true,
    "analytics" BOOLEAN NOT NULL DEFAULT false,
    "marketing" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CookieConsent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnneeScolaire" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "dateDebut" TIMESTAMP(3) NOT NULL,
    "dateFin" TIMESTAMP(3) NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnneeScolaire_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Classe" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "anneeScolaireId" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "niveau" TEXT NOT NULL,
    "filiere" TEXT,
    "capacite" INTEGER NOT NULL DEFAULT 40,
    "fraisScolarite" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Classe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Matiere" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "coefficient" INTEGER NOT NULL DEFAULT 1,
    "description" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Matiere_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Eleve" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "parentId" TEXT,
    "matricule" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "dateNaissance" TIMESTAMP(3) NOT NULL,
    "lieuNaissance" TEXT,
    "sexe" TEXT NOT NULL,
    "adresse" TEXT,
    "photoUrl" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "dateEntree" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Eleve_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inscription" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "eleveId" TEXT NOT NULL,
    "classeId" TEXT NOT NULL,
    "anneeScolaireId" TEXT NOT NULL,
    "dateInscription" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "statut" "StatutInscription" NOT NULL DEFAULT 'validee',
    "soldeScolarite" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Inscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnseignantClasse" (
    "id" TEXT NOT NULL,
    "enseignantId" TEXT NOT NULL,
    "classeId" TEXT NOT NULL,

    CONSTRAINT "EnseignantClasse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evaluation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "classeId" TEXT NOT NULL,
    "matiereId" TEXT NOT NULL,
    "anneeScolaireId" TEXT NOT NULL,
    "periodeIndex" INTEGER NOT NULL,
    "nom" TEXT NOT NULL,
    "type" "TypeEvaluation" NOT NULL DEFAULT 'devoir',
    "dateEvaluation" TIMESTAMP(3) NOT NULL,
    "coefficient" INTEGER NOT NULL DEFAULT 1,
    "noteMaximale" DECIMAL(5,2) NOT NULL DEFAULT 20.00,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Evaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Note" (
    "id" TEXT NOT NULL,
    "eleveId" TEXT NOT NULL,
    "evaluationId" TEXT NOT NULL,
    "valeur" DECIMAL(5,2) NOT NULL,
    "appreciation" TEXT,
    "saisiParId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bulletin" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "eleveId" TEXT NOT NULL,
    "classeId" TEXT NOT NULL,
    "anneeScolaireId" TEXT NOT NULL,
    "periodeIndex" INTEGER NOT NULL,
    "moyenneGenerale" DECIMAL(5,2) NOT NULL,
    "rang" INTEGER NOT NULL,
    "effectifClasse" INTEGER NOT NULL,
    "decisionConseil" TEXT,
    "absencesHeures" INTEGER NOT NULL DEFAULT 0,
    "notesDetaillees" JSONB NOT NULL,
    "pdfUrl" TEXT,
    "valide" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bulletin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Paiement" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "inscriptionId" TEXT NOT NULL,
    "recuParId" TEXT NOT NULL,
    "numeroRecu" INTEGER NOT NULL,
    "montant" DECIMAL(12,2) NOT NULL,
    "typePaiement" "TypePaiement" NOT NULL DEFAULT 'scolarite',
    "modePaiement" "ModePaiement" NOT NULL,
    "reference" TEXT,
    "datePaiement" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "motif" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Paiement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmploiDuTemps" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "classeId" TEXT NOT NULL,
    "matiereId" TEXT NOT NULL,
    "enseignantId" TEXT NOT NULL,
    "jourSemaine" INTEGER NOT NULL,
    "heureDebut" TEXT NOT NULL,
    "heureFin" TEXT NOT NULL,
    "salle" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmploiDuTemps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Absence" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "eleveId" TEXT NOT NULL,
    "emploiDuTempsId" TEXT,
    "dateAbsence" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "justifiee" BOOLEAN NOT NULL DEFAULT false,
    "motifJustif" TEXT,
    "pieceJustifUrl" TEXT,
    "saisieParId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Absence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sanction" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "eleveId" TEXT NOT NULL,
    "type" "TypeSanction" NOT NULL,
    "motif" TEXT NOT NULL,
    "dureeJours" INTEGER,
    "dateSanction" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validee" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sanction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Actualite" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "contenu" TEXT NOT NULL,
    "publique" BOOLEAN NOT NULL DEFAULT false,
    "photoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Actualite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "actorId" TEXT,
    "actorRole" TEXT,
    "action" "AuditAction" NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "details" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE INDEX "Tenant_slug_idx" ON "Tenant"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "TenantConfig_tenantId_key" ON "TenantConfig"("tenantId");

-- CreateIndex
CREATE INDEX "Staff_tenantId_idx" ON "Staff"("tenantId");

-- CreateIndex
CREATE INDEX "Staff_role_idx" ON "Staff"("role");

-- CreateIndex
CREATE UNIQUE INDEX "Staff_tenantId_email_key" ON "Staff"("tenantId", "email");

-- CreateIndex
CREATE INDEX "User_tenantId_idx" ON "User"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "User_tenantId_email_key" ON "User"("tenantId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_token_key" ON "RefreshToken"("token");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE INDEX "RefreshToken_token_idx" ON "RefreshToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_token_key" ON "PasswordResetToken"("token");

-- CreateIndex
CREATE INDEX "PasswordResetToken_email_idx" ON "PasswordResetToken"("email");

-- CreateIndex
CREATE INDEX "PasswordResetToken_token_idx" ON "PasswordResetToken"("token");

-- CreateIndex
CREATE INDEX "PasswordResetToken_tenantId_idx" ON "PasswordResetToken"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "EmailVerificationToken_token_key" ON "EmailVerificationToken"("token");

-- CreateIndex
CREATE INDEX "EmailVerificationToken_email_idx" ON "EmailVerificationToken"("email");

-- CreateIndex
CREATE INDEX "EmailVerificationToken_token_idx" ON "EmailVerificationToken"("token");

-- CreateIndex
CREATE INDEX "EmailVerificationToken_tenantId_idx" ON "EmailVerificationToken"("tenantId");

-- CreateIndex
CREATE INDEX "CookieConsent_tenantId_idx" ON "CookieConsent"("tenantId");

-- CreateIndex
CREATE INDEX "CookieConsent_userId_idx" ON "CookieConsent"("userId");

-- CreateIndex
CREATE INDEX "CookieConsent_sessionId_idx" ON "CookieConsent"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "CookieConsent_tenantId_sessionId_key" ON "CookieConsent"("tenantId", "sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "CookieConsent_tenantId_userId_key" ON "CookieConsent"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "AnneeScolaire_tenantId_idx" ON "AnneeScolaire"("tenantId");

-- CreateIndex
CREATE INDEX "AnneeScolaire_actif_idx" ON "AnneeScolaire"("actif");

-- CreateIndex
CREATE UNIQUE INDEX "AnneeScolaire_tenantId_libelle_key" ON "AnneeScolaire"("tenantId", "libelle");

-- CreateIndex
CREATE INDEX "Classe_tenantId_idx" ON "Classe"("tenantId");

-- CreateIndex
CREATE INDEX "Classe_anneeScolaireId_idx" ON "Classe"("anneeScolaireId");

-- CreateIndex
CREATE UNIQUE INDEX "Classe_tenantId_anneeScolaireId_nom_key" ON "Classe"("tenantId", "anneeScolaireId", "nom");

-- CreateIndex
CREATE INDEX "Matiere_tenantId_idx" ON "Matiere"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Matiere_tenantId_code_key" ON "Matiere"("tenantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Eleve_matricule_key" ON "Eleve"("matricule");

-- CreateIndex
CREATE INDEX "Eleve_tenantId_idx" ON "Eleve"("tenantId");

-- CreateIndex
CREATE INDEX "Eleve_matricule_idx" ON "Eleve"("matricule");

-- CreateIndex
CREATE INDEX "Eleve_nom_prenom_idx" ON "Eleve"("nom", "prenom");

-- CreateIndex
CREATE INDEX "Inscription_tenantId_idx" ON "Inscription"("tenantId");

-- CreateIndex
CREATE INDEX "Inscription_eleveId_idx" ON "Inscription"("eleveId");

-- CreateIndex
CREATE INDEX "Inscription_classeId_idx" ON "Inscription"("classeId");

-- CreateIndex
CREATE INDEX "Inscription_anneeScolaireId_idx" ON "Inscription"("anneeScolaireId");

-- CreateIndex
CREATE UNIQUE INDEX "Inscription_tenantId_anneeScolaireId_eleveId_key" ON "Inscription"("tenantId", "anneeScolaireId", "eleveId");

-- CreateIndex
CREATE UNIQUE INDEX "EnseignantClasse_enseignantId_classeId_key" ON "EnseignantClasse"("enseignantId", "classeId");

-- CreateIndex
CREATE INDEX "Evaluation_tenantId_idx" ON "Evaluation"("tenantId");

-- CreateIndex
CREATE INDEX "Evaluation_classeId_matiereId_idx" ON "Evaluation"("classeId", "matiereId");

-- CreateIndex
CREATE INDEX "Note_eleveId_idx" ON "Note"("eleveId");

-- CreateIndex
CREATE INDEX "Note_evaluationId_idx" ON "Note"("evaluationId");

-- CreateIndex
CREATE UNIQUE INDEX "Note_eleveId_evaluationId_key" ON "Note"("eleveId", "evaluationId");

-- CreateIndex
CREATE INDEX "Bulletin_tenantId_idx" ON "Bulletin"("tenantId");

-- CreateIndex
CREATE INDEX "Bulletin_eleveId_idx" ON "Bulletin"("eleveId");

-- CreateIndex
CREATE UNIQUE INDEX "Bulletin_tenantId_anneeScolaireId_classeId_periodeIndex_ele_key" ON "Bulletin"("tenantId", "anneeScolaireId", "classeId", "periodeIndex", "eleveId");

-- CreateIndex
CREATE INDEX "Paiement_tenantId_idx" ON "Paiement"("tenantId");

-- CreateIndex
CREATE INDEX "Paiement_inscriptionId_idx" ON "Paiement"("inscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "Paiement_tenantId_numeroRecu_key" ON "Paiement"("tenantId", "numeroRecu");

-- CreateIndex
CREATE INDEX "EmploiDuTemps_tenantId_idx" ON "EmploiDuTemps"("tenantId");

-- CreateIndex
CREATE INDEX "EmploiDuTemps_classeId_idx" ON "EmploiDuTemps"("classeId");

-- CreateIndex
CREATE INDEX "EmploiDuTemps_enseignantId_idx" ON "EmploiDuTemps"("enseignantId");

-- CreateIndex
CREATE INDEX "Absence_tenantId_idx" ON "Absence"("tenantId");

-- CreateIndex
CREATE INDEX "Absence_eleveId_idx" ON "Absence"("eleveId");

-- CreateIndex
CREATE INDEX "Absence_dateAbsence_idx" ON "Absence"("dateAbsence");

-- CreateIndex
CREATE INDEX "Sanction_tenantId_idx" ON "Sanction"("tenantId");

-- CreateIndex
CREATE INDEX "Sanction_eleveId_idx" ON "Sanction"("eleveId");

-- CreateIndex
CREATE INDEX "Actualite_tenantId_idx" ON "Actualite"("tenantId");

-- CreateIndex
CREATE INDEX "Actualite_publique_idx" ON "Actualite"("publique");

-- CreateIndex
CREATE INDEX "AuditLog_tenantId_idx" ON "AuditLog"("tenantId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "TenantConfig" ADD CONSTRAINT "TenantConfig_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Staff" ADD CONSTRAINT "Staff_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CookieConsent" ADD CONSTRAINT "CookieConsent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnneeScolaire" ADD CONSTRAINT "AnneeScolaire_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Classe" ADD CONSTRAINT "Classe_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Classe" ADD CONSTRAINT "Classe_anneeScolaireId_fkey" FOREIGN KEY ("anneeScolaireId") REFERENCES "AnneeScolaire"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Matiere" ADD CONSTRAINT "Matiere_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Eleve" ADD CONSTRAINT "Eleve_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Eleve" ADD CONSTRAINT "Eleve_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inscription" ADD CONSTRAINT "Inscription_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inscription" ADD CONSTRAINT "Inscription_eleveId_fkey" FOREIGN KEY ("eleveId") REFERENCES "Eleve"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inscription" ADD CONSTRAINT "Inscription_classeId_fkey" FOREIGN KEY ("classeId") REFERENCES "Classe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inscription" ADD CONSTRAINT "Inscription_anneeScolaireId_fkey" FOREIGN KEY ("anneeScolaireId") REFERENCES "AnneeScolaire"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnseignantClasse" ADD CONSTRAINT "EnseignantClasse_enseignantId_fkey" FOREIGN KEY ("enseignantId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnseignantClasse" ADD CONSTRAINT "EnseignantClasse_classeId_fkey" FOREIGN KEY ("classeId") REFERENCES "Classe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_classeId_fkey" FOREIGN KEY ("classeId") REFERENCES "Classe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_matiereId_fkey" FOREIGN KEY ("matiereId") REFERENCES "Matiere"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_anneeScolaireId_fkey" FOREIGN KEY ("anneeScolaireId") REFERENCES "AnneeScolaire"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_eleveId_fkey" FOREIGN KEY ("eleveId") REFERENCES "Eleve"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "Evaluation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bulletin" ADD CONSTRAINT "Bulletin_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bulletin" ADD CONSTRAINT "Bulletin_eleveId_fkey" FOREIGN KEY ("eleveId") REFERENCES "Eleve"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bulletin" ADD CONSTRAINT "Bulletin_classeId_fkey" FOREIGN KEY ("classeId") REFERENCES "Classe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bulletin" ADD CONSTRAINT "Bulletin_anneeScolaireId_fkey" FOREIGN KEY ("anneeScolaireId") REFERENCES "AnneeScolaire"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Paiement" ADD CONSTRAINT "Paiement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Paiement" ADD CONSTRAINT "Paiement_inscriptionId_fkey" FOREIGN KEY ("inscriptionId") REFERENCES "Inscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Paiement" ADD CONSTRAINT "Paiement_recuParId_fkey" FOREIGN KEY ("recuParId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmploiDuTemps" ADD CONSTRAINT "EmploiDuTemps_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmploiDuTemps" ADD CONSTRAINT "EmploiDuTemps_classeId_fkey" FOREIGN KEY ("classeId") REFERENCES "Classe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmploiDuTemps" ADD CONSTRAINT "EmploiDuTemps_matiereId_fkey" FOREIGN KEY ("matiereId") REFERENCES "Matiere"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmploiDuTemps" ADD CONSTRAINT "EmploiDuTemps_enseignantId_fkey" FOREIGN KEY ("enseignantId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Absence" ADD CONSTRAINT "Absence_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Absence" ADD CONSTRAINT "Absence_eleveId_fkey" FOREIGN KEY ("eleveId") REFERENCES "Eleve"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Absence" ADD CONSTRAINT "Absence_emploiDuTempsId_fkey" FOREIGN KEY ("emploiDuTempsId") REFERENCES "EmploiDuTemps"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sanction" ADD CONSTRAINT "Sanction_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sanction" ADD CONSTRAINT "Sanction_eleveId_fkey" FOREIGN KEY ("eleveId") REFERENCES "Eleve"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Actualite" ADD CONSTRAINT "Actualite_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
