import { prisma } from '../utils/prisma.js';

export const getActualites = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const tenantId = req.tenantId;

    const take = parseInt(limit);
    const skip = (parseInt(page) - 1) * take;

    const [rows, total] = await Promise.all([
      prisma.actualite.findMany({
        where: { tenantId, publique: true },
        select: {
          id: true,
          titre: true,
          contenu: true,
          photoUrl: true,
          createdAt: true
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take
      }),
      prisma.actualite.count({ where: { tenantId, publique: true } })
    ]);

    const pages = Math.ceil(total / take) || 1;

    res.json({
      actualites: rows,
      total,
      pages,
      pagination: { page: parseInt(page), limit: take, total, totalPages: pages }
    });
  } catch (error) {
    console.error('[PublicController] getActualites error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getInfosEcole = async (req, res) => {
  try {
    const tenant = req.tenant;
    const config = tenant.config;

    res.json({
      nom: tenant.nom,
      slug: tenant.slug,
      config: {
        nomEcole: config?.nomEcole || tenant.nom,
        slogan: config?.sloganApp || null,
        logoUrl: config?.logoUrl || null,
        adresse: config?.adresse || null,
        telephone: config?.telephone || null,
        email: config?.email || null,
        facebookUrl: config?.facebookUrl || null,
        instagramUrl: config?.instagramUrl || null,
        whatsappUrl: config?.whatsappUrl || null,
        googleMapsUrl: config?.googleMapsUrl || null,
        horaireOuverture: config?.horaireOuverture || null,
        messageAccueil: config?.messageAccueil || null,
        devise: config?.devise || 'FCFA'
      }
    });
  } catch (error) {
    console.error('[PublicController] getInfosEcole error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
