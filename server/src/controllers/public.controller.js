import { prisma } from '../utils/prisma.js';
import { withCdnImages } from '../utils/httpCache.js';

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

    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    res.json({
      actualites: rows.map((row) => withCdnImages(row)),
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

    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    res.json(withCdnImages({
      nom: tenant.nom,
      slug: tenant.slug,
      config: withCdnImages({
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
      })
    }));
  } catch (error) {
    console.error('[PublicController] getInfosEcole error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const verifyBulletin = async (req, res) => {
  try {
    const { idOrHash } = req.params;
    const tenantId = req.tenantId;

    const bulletin = await prisma.bulletin.findFirst({
      where: {
        tenantId,
        OR: [{ id: idOrHash }, { qrCodeHash: idOrHash }],
        valide: true,
      },
      include: {
        eleve: { select: { prenom: true, nom: true, matricule: true } },
        classe: { select: { nom: true, niveau: true } },
        anneeScolaire: { select: { libelle: true } },
      },
    });

    if (!bulletin) {
      return res.status(404).json({
        authentique: false,
        error: 'Bulletin introuvable ou non publié',
      });
    }

    res.json({
      authentique: true,
      eleve: `${bulletin.eleve.prenom} ${bulletin.eleve.nom}`,
      matricule: bulletin.eleve.matricule,
      classe: bulletin.classe?.nom,
      anneeScolaire: bulletin.anneeScolaire?.libelle,
      periodeIndex: bulletin.periodeIndex,
      moyenneGenerale: Number(bulletin.moyenneGenerale),
      rang: bulletin.rang,
      effectifClasse: bulletin.effectifClasse,
      mention: bulletin.mention,
      qrCodeHash: bulletin.qrCodeHash,
    });
  } catch (error) {
    console.error('[PublicController] verifyBulletin error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
