import jwt from 'jsonwebtoken';
import { prisma } from '../utils/prisma.js';
import { withCdnImages } from '../utils/httpCache.js';
import { config } from '../config.js';

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

export const getPortailParent = async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) {
      return res.status(400).json({ error: 'Token manquant' });
    }

    let payload;
    try {
      payload = jwt.verify(token, config.jwtSecret);
    } catch (err) {
      return res.status(401).json({ error: 'Token invalide ou expiré' });
    }

    const { eleveId, tenantId, scope } = payload;
    if (scope !== 'portail_parent' || !eleveId || !tenantId) {
      return res.status(401).json({ error: 'Token non autorisé pour ce portail' });
    }

    const eleve = await prisma.eleve.findFirst({
      where: { id: eleveId, tenantId, actif: true },
      select: {
        id: true,
        nom: true,
        prenom: true,
        matricule: true,
        photoUrl: true,
        inscriptions: {
          where: { anneeScolaire: { actif: true } },
          include: {
            classe: { select: { nom: true, niveau: true, cycle: true } },
            anneeScolaire: { select: { libelle: true } },
            echeances: {
              select: {
                id: true,
                libelle: true,
                montantAttendu: true,
                montantPaye: true,
                dateEcheance: true,
                statut: true,
              },
              orderBy: { dateEcheance: 'asc' },
            },
            paiements: {
              select: {
                id: true,
                numeroRecu: true,
                montant: true,
                datePaiement: true,
                modePaiement: true,
                motif: true,
              },
              orderBy: { datePaiement: 'desc' },
              take: 5,
            },
          },
          take: 1,
        },
        absences: {
          select: {
            id: true,
            dateAbsence: true,
            typeAbsence: true,
            justifiee: true,
            motifJustif: true,
          },
          orderBy: { dateAbsence: 'desc' },
          take: 10,
        },
        bulletins: {
          where: { valide: true },
          select: {
            id: true,
            periodeIndex: true,
            moyenneGenerale: true,
            rang: true,
            effectifClasse: true,
            mention: true,
            qrCodeHash: true,
          },
          orderBy: { periodeIndex: 'desc' },
          take: 3,
        },
      },
    });

    if (!eleve) {
      return res.status(404).json({ error: 'Élève non trouvé' });
    }

    const inscription = eleve.inscriptions?.[0] || null;
    let totalDu = 0;
    let totalPaye = 0;
    if (inscription?.echeances) {
      for (const ech of inscription.echeances) {
        totalDu += Number(ech.montantAttendu || 0);
        totalPaye += Number(ech.montantPaye || 0);
      }
    }
    const soldeRestant = Math.max(0, totalDu - totalPaye);

    const ecole = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        nom: true,
        contact: true,
        config: {
          select: {
            nomEcole: true,
            logoUrl: true,
            telephone: true,
            adresse: true,
          },
        },
      },
    });

    res.json({
      eleve: {
        nom: eleve.nom,
        prenom: eleve.prenom,
        matricule: eleve.matricule,
        photoUrl: eleve.photoUrl,
        classe: inscription?.classe?.nom || '—',
        anneeScolaire: inscription?.anneeScolaire?.libelle || '—',
      },
      ecole: {
        nom: ecole?.config?.nomEcole || ecole?.nom || 'École',
        telephone: ecole?.config?.telephone || ecole?.contact?.telephone || null,
        adresse: ecole?.config?.adresse || ecole?.contact?.adresse || null,
        logoUrl: ecole?.config?.logoUrl || null,
      },
      finances: {
        totalDu,
        totalPaye,
        soldeRestant,
        echeances: inscription?.echeances || [],
        derniersPaiements: inscription?.paiements || [],
      },
      absences: eleve.absences || [],
      bulletins: eleve.bulletins || [],
    });
  } catch (error) {
    console.error('[PublicController] getPortailParent error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

