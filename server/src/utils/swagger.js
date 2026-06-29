import swaggerJsdoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'GestPharma API',
      version: '1.0.0',
      description: `
API REST de GestPharma — SaaS multi-tenant de gestion de pharmacies.

## Authentification
Toutes les routes protégées utilisent des cookies HttpOnly (JWT dual-token).
- **auth_token** : access token (15 minutes)
- **refresh_token** : refresh token (7 jours)

Appeler POST /api/auth/login pour obtenir les cookies,
puis toutes les requêtes suivantes les envoient automatiquement.

## Multi-tenant
Chaque requête doit identifier la pharmacie cible via :
- Header **X-Tenant-Slug** : slug de la pharmacie (ex: demo)
- OU URL : /p/:slug/...
- OU sous-domaine : pharmacie.gestpharma.com

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
        name: 'Support GestPharma',
        email: 'support@gestpharma.com',
      },
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Développement local',
      },
      {
        url: 'https://api.gestpharma.com',
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
          description: 'Slug de la pharmacie cible',
        },
      },
      schemas: {
        // Réponse succès générique
        SuccessResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: 'Opération réussie' },
          },
        },
        // Réponse erreur générique
        ErrorResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string', example: 'Description de l\'erreur' },
          },
        },
        // Medicament
        Medicament: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            dci: { type: 'string', example: 'Paracétamol' },
            nomCommercial: { type: 'string', example: 'Doliprane 500mg' },
            formeGalenique: {
              type: 'string',
              enum: ['comprime', 'sirop', 'injectable', 'pommade', 'autre'],
            },
            dosage: { type: 'string', example: '500mg' },
            prixVente: { type: 'number', example: 550 },
            stockTotal: { type: 'integer', example: 100 },
            actif: { type: 'boolean', example: true },
          },
        },
        // Vente
        Vente: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            numeroVente: { type: 'integer', example: 14 },
            statut: {
              type: 'string',
              enum: ['en_cours', 'finalisee', 'annulee'],
            },
            montantTotal: { type: 'number', example: 13700 },
            modePaiement: {
              type: 'string',
              enum: ['especes', 'mobile_money', 'carte', 'credit'],
            },
            nomClient: { type: 'string', example: 'Patient Dupont' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        // LigneVente
        LigneVente: {
          type: 'object',
          properties: {
            medicamentId: { type: 'string', format: 'uuid' },
            quantite: { type: 'integer', example: 3, minimum: 1 },
          },
          required: ['medicamentId', 'quantite'],
        },
      },
    },
    security: [{ cookieAuth: [] }],
    tags: [
      { name: 'Auth', description: 'Authentification et gestion des tokens' },
      { name: 'Médicaments', description: 'Catalogue des médicaments' },
      { name: 'Stock', description: 'Gestion des stocks et lots' },
      { name: 'Ventes', description: 'Ventes et encaissements' },
      { name: 'Ordonnances', description: 'Ordonnances et prescriptions' },
      { name: 'Fournisseurs', description: 'Fournisseurs et commandes' },
      { name: 'Livraisons', description: 'Livraisons à domicile' },
      { name: 'Dashboard', description: 'KPIs et tableaux de bord' },
      { name: 'Rapports', description: 'Rapports et exports' },
      { name: 'Personnel', description: 'Gestion du staff' },
      { name: 'Super Admin', description: 'Gestion multi-tenant (super admin uniquement)' },
    ],
  },
  // Lire les annotations JSDoc dans les routes
  apis: ['./src/routes/*.js'],
};

export const swaggerSpec = swaggerJsdoc(options);
