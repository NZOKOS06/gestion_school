import { body, param, query, validationResult } from 'express-validator';
import { messageErreurDateNaissance } from './formatters.js';

export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array().map(e => ({
        field: e.path,
        message: e.msg
      }))
    });
  }
  next();
};

// Validators Auth
export const loginValidator = [
  body('email').isEmail().normalizeEmail().withMessage('Email invalide'),
  body('password').notEmpty().withMessage('Mot de passe requis'),
  handleValidationErrors
];

export const forgotPasswordValidator = [
  body('email').isEmail().normalizeEmail().withMessage('Email invalide'),
  handleValidationErrors
];

export const registerValidator = [
  body('email').isEmail().normalizeEmail().withMessage('Email invalide'),
  body('password').isLength({ min: 6 }).withMessage('Mot de passe: 6 caractères minimum'),
  body('nom').trim().notEmpty().withMessage('Nom requis'),
  body('prenom').trim().notEmpty().withMessage('Prénom requis'),
  body('telephone').optional().trim(),
  handleValidationErrors
];

// Validators Élèves
export const eleveValidator = [
  body('matricule').trim().notEmpty().withMessage('Matricule requis'),
  body('nom').trim().notEmpty().withMessage('Nom requis'),
  body('prenom').trim().notEmpty().withMessage('Prénom requis'),
  body('dateNaissance').isISO8601().toDate().withMessage('Date de naissance invalide'),
  body('dateNaissance').custom((value) => {
    const err = messageErreurDateNaissance(value);
    if (err) throw new Error(err);
    return true;
  }),
  body('sexe').isIn(['M', 'F']).withMessage('Sexe invalide (M ou F)'),
  body('lieuNaissance').optional().trim(),
  body('adresse').optional().trim(),
  body('parentId').optional().isUUID().withMessage('ID parent invalide'),
  handleValidationErrors
];

// Validators Classes
export const classeValidator = [
  body('nom').trim().notEmpty().withMessage('Nom de classe requis'),
  body('niveau').optional({ values: 'falsy' }).trim(),
  body('niveauOfficielId').optional({ values: 'falsy' }).isUUID().withMessage('Niveau officiel invalide'),
  body('anneeScolaireId').optional({ values: 'falsy' }).isUUID().withMessage('ID année scolaire invalide'),
  body('filiere').optional({ values: 'falsy' }).trim(),
  body('filiereOfficielleId').optional({ values: 'falsy' }).isUUID().withMessage('ID filière officielle invalide'),
  body('capacite').optional({ values: 'falsy' }).customSanitizer(v => parseInt(v, 10)).isInt({ min: 1 }).withMessage('Capacité invalide'),
  body('fraisScolarite').optional({ values: 'falsy' }).customSanitizer(v => parseFloat(v)).isFloat({ min: 0 }).withMessage('Frais de scolarité invalide'),
  body().custom((_, { req }) => {
    if (!req.body.niveau && !req.body.niveauOfficielId) {
      throw new Error('Niveau ou niveau officiel requis');
    }
    return true;
  }),
  handleValidationErrors
];

// Validators Année Scolaire
export const anneeScolaireValidator = [
  body('libelle').trim().notEmpty().withMessage('Libellé requis'),
  body('dateDebut').isISO8601().toDate().withMessage('Date de début invalide'),
  body('dateFin').isISO8601().toDate().withMessage('Date de fin invalide'),
  handleValidationErrors
];

// Validators Matière
export const matiereValidator = [
  body('nom').trim().notEmpty().withMessage('Nom requis'),
  body('code').trim().notEmpty().withMessage('Code requis'),
  body('coefficient').optional().isInt({ min: 1 }).withMessage('Coefficient invalide'),
  body('description').optional().trim(),
  handleValidationErrors
];

// Validators Inscription
export const inscriptionValidator = [
  body('eleveId').isUUID().withMessage('ID élève invalide'),
  body('classeId').isUUID().withMessage('ID classe invalide'),
  body('anneeScolaireId').isUUID().withMessage('ID année scolaire invalide'),
  handleValidationErrors
];

export const inscriptionAvecEleveValidator = [
  body('classeId').isUUID().withMessage('ID classe invalide'),
  body('anneeScolaireId').isUUID().withMessage('ID année scolaire invalide'),
  body('eleveId').optional({ nullable: true }).isUUID().withMessage('ID élève invalide'),
  body('parentId').optional({ nullable: true }).isUUID().withMessage('ID parent invalide'),
  body().custom((_, { req }) => {
    if (!req.body.eleveId && !req.body.eleve) {
      throw new Error('Élève existant (eleveId) ou nouveau (eleve) requis');
    }
    if (!req.body.eleveId && req.body.eleve) {
      const e = req.body.eleve;
      if (!e.matricule?.trim() || !e.nom?.trim() || !e.prenom?.trim() || !e.dateNaissance || !['M', 'F'].includes(e.sexe)) {
        throw new Error('Matricule, nom, prénom, date de naissance et sexe requis pour un nouvel élève');
      }
      const errAge = messageErreurDateNaissance(e.dateNaissance);
      if (errAge) throw new Error(errAge);
    }
    return true;
  }),
  handleValidationErrors
];

// Validators Évaluation
export const evaluationValidator = [
  body('classeId').isUUID().withMessage('ID classe invalide'),
  body('matiereId').isUUID().withMessage('ID matière invalide'),
  body('anneeScolaireId').isUUID().withMessage('ID année scolaire invalide'),
  body('periodeIndex').isInt({ min: 1 }).withMessage('Index de période invalide'),
  body('nom').trim().notEmpty().withMessage('Nom requis'),
  body('type').optional().isIn(['devoir', 'interrogation', 'examen', 'rattrapage', 'pratique']).withMessage('Type invalide'),
  body('dateEvaluation').isISO8601().toDate().withMessage('Date d\'évaluation invalide'),
  body('coefficient').optional().isInt({ min: 1 }).withMessage('Coefficient invalide'),
  body('noteMaximale').optional().isDecimal({ min: 0 }).withMessage('Note maximale invalide'),
  handleValidationErrors
];

// Validators Note
export const noteValidator = [
  body('eleveId').isUUID().withMessage('ID élève invalide'),
  body('valeur').isDecimal({ min: 0 }).withMessage('Valeur de note invalide'),
  body('appreciation').optional().trim(),
  handleValidationErrors
];

// Validators Paiement
export const paiementValidator = [
  body('inscriptionId').isUUID().withMessage('ID inscription invalide'),
  body('montant').isFloat({ gt: 0 }).withMessage('Montant invalide'),
  body('typePaiement').optional().isIn(['inscription', 'scolarite', 'mensualite', 'examen_officiel', 'bibliotheque', 'cantine', 'transport', 'uniforme', 'autre']).withMessage('Type de paiement invalide'),
  body('modePaiement')
    .optional({ nullable: true })
    .customSanitizer((v) => {
      if (!v) return 'especes';
      const m = String(v).toLowerCase().trim()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const map = {
        especes: 'especes',
        espece: 'especes',
        cash: 'especes',
        mobile_money: 'mobile_money',
        'mobile money': 'mobile_money',
        momo: 'mobile_money',
        carte: 'carte',
        cheque: 'cheque',
        virement: 'virement',
      };
      return map[m] || map[m.replace(/\s+/g, '_')] || 'especes';
    })
    .isIn(['especes', 'mobile_money', 'carte', 'cheque', 'virement']).withMessage('Mode de paiement invalide'),
  body('echeanceId').optional({ nullable: true }).isUUID().withMessage('ID échéance invalide'),
  body('reference').optional().trim(),
  body('motif').optional().trim(),
  handleValidationErrors
];

export const depenseValidator = [
  body('categorie').trim().notEmpty().withMessage('Catégorie requise'),
  body('montant').isFloat({ gt: 0 }).withMessage('Montant invalide'),
  body('motif').trim().notEmpty().withMessage('Motif requis'),
  body('reference').optional({ nullable: true }).trim(),
  body('dateDepense').optional({ nullable: true }).isISO8601().withMessage('Date invalide'),
  handleValidationErrors
];

// Validators Emploi du Temps
export const emploiDuTempsValidator = [
  body('classeId').isUUID().withMessage('ID classe invalide'),
  body('matiereId').isUUID().withMessage('ID matière invalide'),
  body('enseignantId').optional({ values: 'falsy' }).isUUID().withMessage('ID enseignant invalide'),
  body('jourSemaine').isInt({ min: 1, max: 7 }).withMessage('Jour de semaine invalide (1-7)'),
  body('heureDebut').matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Format heure début invalide (HH:MM)'),
  body('heureFin').matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Format heure fin invalide (HH:MM)'),
  body('salle').optional().trim(),
  body('salleId').optional().isUUID().withMessage('ID salle invalide'),
  handleValidationErrors
];

// Validators Absence
export const absenceValidator = [
  body('eleveId').isUUID().withMessage('ID élève invalide'),
  body('dateAbsence').optional().isISO8601().toDate(),
  body('typeAbsence').optional().isIn(['absent', 'retard', 'depart_anticipe']).withMessage('Type d\'absence invalide'),
  body('justifiee').optional().isBoolean(),
  body('motifJustif').optional().trim(),
  body('pieceJustifUrl').optional().trim(),
  body('emploiDuTempsId').optional().isUUID().withMessage('ID emploi du temps invalide'),
  handleValidationErrors
];

// Validators Sanction
export const sanctionValidator = [
  body('eleveId').isUUID().withMessage('ID élève invalide'),
  body('type').isIn(['avertissement', 'blame', 'retenue', 'exclusion_temporaire', 'exclusion_definitive']).withMessage('Type de sanction invalide'),
  body('motif').trim().notEmpty().withMessage('Motif requis'),
  body('dureeJours').optional({ values: 'falsy' }).isInt({ min: 0 }).withMessage('Durée invalide'),
  handleValidationErrors
];

// Validators Actualité
export const actualiteValidator = [
  body('titre').trim().notEmpty().withMessage('Titre requis'),
  body('contenu').trim().notEmpty().withMessage('Contenu requis'),
  body('publique').optional().isBoolean(),
  handleValidationErrors
];

// Validators Staff
export const staffValidator = [
  body('email').isEmail().normalizeEmail().withMessage('Email invalide'),
  body('nom').trim().notEmpty().withMessage('Nom requis'),
  body('prenom').trim().notEmpty().withMessage('Prénom requis'),
  body('role').isIn(['directeur', 'directeur_etudes', 'secretaire', 'enseignant', 'surveillant', 'comptable']).withMessage('Rôle invalide'),
  body('telephone').optional().trim(),
  handleValidationErrors
];

// Validators Tenant/Config
export const tenantConfigValidator = [
  body('nomEcole').optional().trim(),
  body('couleurPrimaire').optional().matches(/^#[0-9A-Fa-f]{6}$/).withMessage('Format couleur invalide'),
  body('couleurSecondaire').optional().matches(/^#[0-9A-Fa-f]{6}$/),
  body('couleurTexte').optional().matches(/^#[0-9A-Fa-f]{6}$/),
  body('devise').optional().isIn(['FCFA', 'XOF', 'USD', 'EUR', 'CDF']),
  body('notationSur').optional().isInt({ min: 1 }),
  body('seuilReussite').optional().isDecimal({ min: 0 }),
  body('nombrePeriodes').optional().isInt({ min: 1, max: 4 }),
  body('fraisInscriptionDefault').optional().isDecimal({ min: 0 }),
  body('fraisScolariteDefault').optional().isDecimal({ min: 0 }),
  handleValidationErrors
];

// Validators Paginations
export const paginationValidator = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 1000 }).toInt(),
  query('sortBy').optional().trim(),
  query('order').optional().isIn(['asc', 'desc']),
  query('search').optional().trim(),
  handleValidationErrors
];

// Validators ID
export const idParamValidator = [
  param('id').isUUID().withMessage('ID invalide'),
  handleValidationErrors
];
