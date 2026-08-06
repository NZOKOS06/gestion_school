import swaggerJsdoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'GestSchool API',
      version: '1.0.0',
      description: `
API REST de GestSchool — SaaS multi-tenant de gestion scolaire.

## Authentification
Toutes les routes protégées utilisent des cookies HttpOnly (JWT dual-token).
- **auth_token** : access token (15 minutes)
- **refresh_token** : refresh token (7 jours)

Appeler POST /api/auth/login pour obtenir les cookies,
puis toutes les requêtes suivantes les envoient automatiquement.

## Multi-tenant
Chaque requête doit identifier l'établissement cible via :
- Header **X-Tenant-Slug** : slug de l'école (ex: demo)
- OU URL : /p/:slug/...
- OU sous-domaine : ecole.gestschool.com

## Codes de réponse
- **200** : Succès
- **201** : Ressource créée
- **400** : Données invalides
- **401** : Non authentifié
- **403** : Accès refusé (rôle insuffisant ou mauvais tenant)
- **404** : Ressource introuvable
- **429** : Trop de requêtes (rate limit)
- **500** : Erreur serveur
      `,
      contact: {
        name: 'Support GestSchool',
        email: 'support@gestschool.com',
      },
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Développement local',
      },
      {
        url: 'https://api.gestschool.com',
        description: 'Production',
      },
    ],
    components: {
      securitySchemes: {
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'auth_token',
        },
      },
      parameters: {
        TenantSlug: {
          in: 'header',
          name: 'X-Tenant-Slug',
          required: true,
          schema: { type: 'string', example: 'demo' },
          description: "Slug de l'établissement cible",
        },
      },
      schemas: {
        SuccessResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: 'Opération réussie' },
          },
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string', example: "Description de l'erreur" },
          },
        },
        Eleve: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            matricule: { type: 'string', example: 'ELV-2026-001' },
            nom: { type: 'string', example: 'Mbemba' },
            prenom: { type: 'string', example: 'Jean' },
            dateNaissance: { type: 'string', format: 'date' },
            sexe: { type: 'string', enum: ['M', 'F'] },
            actif: { type: 'boolean', example: true },
          },
        },
        Classe: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            nom: { type: 'string', example: '6ème A' },
            capacite: { type: 'integer', example: 40 },
            fraisScolarite: { type: 'number', example: 150000 },
          },
        },
        Paiement: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            numeroRecu: { type: 'integer', example: 14 },
            montant: { type: 'number', example: 50000 },
            modePaiement: {
              type: 'string',
              enum: ['especes', 'mobile_money', 'carte', 'cheque', 'virement'],
            },
            datePaiement: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
    security: [{ cookieAuth: [] }],
    tags: [
      { name: 'Auth', description: 'Authentification et gestion des tokens' },
      { name: 'Élèves', description: 'Dossiers élèves et inscriptions' },
      { name: 'Classes', description: 'Classes, niveaux et cycles' },
      { name: 'Notes', description: 'Notes, évaluations et bulletins' },
      { name: 'Absences', description: 'Présences et absences' },
      { name: 'Paiements', description: 'Scolarités et encaissements' },
      { name: 'Dashboard', description: 'KPIs et tableaux de bord' },
      { name: 'Rapports', description: 'Rapports et exports' },
      { name: 'Personnel', description: 'Gestion du staff' },
      { name: 'Super Admin', description: 'Gestion multi-tenant (super admin uniquement)' },
    ],
  },
  apis: ['./src/routes/*.js'],
};

export const swaggerSpec = swaggerJsdoc(options);
