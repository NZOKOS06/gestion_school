import { prisma } from '../utils/prisma.js';

export const getBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    const tenant = await prisma.tenant.findFirst({
      where: { slug, actif: true },
      include: { config: true }
    });

    if (!tenant) {
      return res.status(404).json({
        error: 'Tenant not found',
        message: 'Pharmacie introuvable ou inactive.'
      });
    }

    const config = tenant.config || {};

    res.json({
      id: tenant.id,
      slug: tenant.slug,
      nom: tenant.nom,
      numeroAutorisation: tenant.numeroAutorisation,
      modeMaintenance: tenant.modeMaintenance || false,
      domainePersonnalise: tenant.domainePersonnalise || null,
      ...config,
      logoUrl: config.logoUrl || null,
      backgroundImageUrl: config.backgroundImageUrl || null,
      heroImageUrl: config.heroImageUrl || null,
      featuresImageUrl: config.featuresImageUrl || null,
      aboutImageUrl: config.aboutImageUrl || null,
      heroVideoUrl: config.heroVideoUrl || null,
      featuresVideoUrl: config.featuresVideoUrl || null,
      aboutVideoUrl: config.aboutVideoUrl || null,
      faviconUrl: config.faviconUrl || config.logoUrl || null,
      ogImageUrl: config.ogImageUrl || config.logoUrl || null,
      cssVariables: {
        '--color-primary': config.couleurPrimaire || '#16a34a',
        '--color-secondary': config.couleurSecondaire || '#0d9488',
        '--color-text': config.couleurTexte || '#1f2937',
        '--color-alert': config.couleurAlerte || '#f59e0b',
        '--color-error': config.couleurErreur || '#ef4444',
        '--color-success': config.couleurSucces || '#22c55e',
        '--font-family': config.police || 'DM Sans',
      },
      modules: {
        catalogue: config.moduleCatalogue ?? true,
        stock: config.moduleStock ?? true,
        ventes: config.moduleVentes ?? true,
        ordonnances: config.moduleOrdonnances ?? true,
        fournisseurs: config.moduleFournisseurs ?? true,
        personnel: config.modulePersonnel ?? true,
        rapports: config.moduleRapports ?? true,
        livraison: config.moduleLivraison ?? false,
        commandeEnLigne: config.moduleCommandeEnLigne ?? false,
        patients: config.modulePatients ?? false,
        interactions: config.moduleInteractions ?? false,
        fidelite: config.moduleFidelite ?? false,
        multiDepot: config.moduleMultiDepot ?? false,
      }
    });
  } catch (error) {
    console.error('[ConfigController] getBySlug error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
