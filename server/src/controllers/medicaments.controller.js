import { prisma } from '../utils/prisma.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('MedicamentsController');

export const getAll = async (req, res) => {
  try {
    const { page = 1, limit = 20, search, categorieId, actif = 'true' } = req.query;
    const tenantId = req.tenantId;

    const where = {
      tenantId,
      actif: actif === 'true'
    };

    if (search) {
      where.OR = [
        { dci: { contains: search, mode: 'insensitive' } },
        { nomCommercial: { contains: search, mode: 'insensitive' } },
        { codeBarres: { contains: search } }
      ];
    }

    if (categorieId) {
      where.categorieId = categorieId;
    }

    const [medicaments, total] = await Promise.all([
      prisma.medicament.findMany({
        where,
        include: {
          categorie: { select: { id: true, nom: true } },
          lots: {
            where: { quantiteRestante: { gt: 0 }, datePeremption: { gt: new Date() } },
            orderBy: { datePeremption: 'asc' },
            take: 3
          }
        },
        skip: (page - 1) * limit,
        take: parseInt(limit),
        orderBy: { dci: 'asc' }
      }),
      prisma.medicament.count({ where })
    ]);

    res.json({
      data: medicaments,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    log.error({ err: error }, 'getAll error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getStockAlerts = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const config = req.tenant.config;

    const alertes = await prisma.medicament.findMany({
      where: {
        tenantId,
        stockTotal: { lte: prisma.medicament.fields.seuilAlerte },
        actif: true
      },
      include: {
        categorie: { select: { nom: true } },
        lots: {
          where: { quantiteRestante: { gt: 0 } },
          orderBy: { datePeremption: 'asc' }
        }
      },
      orderBy: { stockTotal: 'asc' }
    });

    const peremptions = await prisma.lotStock.findMany({
      where: {
        tenantId,
        quantiteRestante: { gt: 0 },
        datePeremption: {
          lt: new Date(Date.now() + (config?.joursAlertePeremption || 90) * 24 * 60 * 60 * 1000)
        }
      },
      include: {
        medicament: { select: { dci: true, nomCommercial: true } }
      },
      orderBy: { datePeremption: 'asc' }
    });

    res.json({
      ruptures: alertes,
      peremptions: peremptions.filter(l => l.datePeremption > new Date()),
      perimes: peremptions.filter(l => l.datePeremption <= new Date())
    });
  } catch (error) {
    log.error({ err: error }, 'getStockAlerts error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getById = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;

    const medicament = await prisma.medicament.findFirst({
      where: { id, tenantId },
      include: {
        categorie: true,
        fournisseur: { select: { id: true, nom: true } },
        lots: {
          where: { quantiteRestante: { gt: 0 } },
          orderBy: { datePeremption: 'asc' },
          include: {
            fournisseur: { select: { nom: true } }
          }
        }
      }
    });

    if (!medicament) {
      return res.status(404).json({ error: 'Médicament non trouvé' });
    }

    const dateDebut = new Date();
    dateDebut.setMonth(dateDebut.getMonth() - 3);

    const mouvements = await prisma.mouvementStock.findMany({
      where: {
        tenantId,
        medicamentId: id,
        type: 'sortie',
        createdAt: { gte: dateDebut }
      }
    });

    const quantiteTotale = mouvements.reduce((sum, m) => sum + m.quantite, 0);
    const cmm = Math.round(quantiteTotale / 3);

    res.json({
      ...medicament,
      cmm,
      consommation3Mois: quantiteTotale
    });
  } catch (error) {
    log.error({ err: error }, 'getById error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const create = async (req, res) => {
  try {
    const data = req.body;
    const tenantId = req.tenantId;

    if (data.codeBarres) {
      const existant = await prisma.medicament.findFirst({
        where: { tenantId, codeBarres: data.codeBarres }
      });
      if (existant) {
        return res.status(409).json({ error: 'Code barres déjà utilisé' });
      }
    }

    const medicament = await prisma.medicament.create({
      data: {
        ...data,
        prixAchat: parseFloat(data.prixAchat),
        prixVente: parseFloat(data.prixVente),
        margePercent: data.margePercent ? parseFloat(data.margePercent) :
          (((data.prixVente - data.prixAchat) / data.prixAchat) * 100),
        tenantId
      },
      include: {
        categorie: true,
        fournisseur: true
      }
    });

    res.status(201).json(medicament);
  } catch (error) {
    log.error({ err: error }, 'create error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const update = async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;
    const tenantId = req.tenantId;

    // Validation de l'ID UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({ error: 'ID de médicament invalide' });
    }

    const existant = await prisma.medicament.findFirst({
      where: { id, tenantId }
    });

    if (!existant) {
      return res.status(404).json({ error: 'Médicament non trouvé' });
    }

    if (data.codeBarres && data.codeBarres !== existant.codeBarres) {
      const doublon = await prisma.medicament.findFirst({
        where: { tenantId, codeBarres: data.codeBarres, id: { not: id } }
      });
      if (doublon) {
        return res.status(409).json({ error: 'Code barres déjà utilisé' });
      }
    }

    const updateData = { ...data };
    if (data.prixAchat !== undefined && data.prixAchat !== '') {
      updateData.prixAchat = parseFloat(data.prixAchat);
    }
    if (data.prixVente !== undefined && data.prixVente !== '') {
      updateData.prixVente = parseFloat(data.prixVente);
    }
    
    // Recalculer automatiquement la marge si les prix changent et que la marge n'est pas explicitement fournie
    const prixChanged = (data.prixAchat !== undefined && data.prixAchat !== '') || 
                        (data.prixVente !== undefined && data.prixVente !== '');
    if (prixChanged && data.margePercent === undefined) {
      const prixAchat = updateData.prixAchat !== undefined ? updateData.prixAchat : existant.prixAchat;
      const prixVente = updateData.prixVente !== undefined ? updateData.prixVente : existant.prixVente;
      updateData.margePercent = ((prixVente - prixAchat) / prixAchat) * 100;
    } else if (data.margePercent !== undefined && data.margePercent !== '') {
      updateData.margePercent = parseFloat(data.margePercent);
    }

    const medicament = await prisma.medicament.update({
      where: { id },
      data: updateData,
      include: {
        categorie: true,
        fournisseur: true
      }
    });

    res.json(medicament);
  } catch (error) {
    log.error({ err: error }, 'update error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const remove = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;

    const medicament = await prisma.medicament.findFirst({
      where: { id, tenantId }
    });

    if (!medicament) {
      return res.status(404).json({ error: 'Médicament non trouvé' });
    }

    await prisma.medicament.update({
      where: { id },
      data: { actif: false }
    });

    res.json({ message: 'Médicament désactivé' });
  } catch (error) {
    log.error({ err: error }, 'remove error');
    res.status(500).json({ error: 'Internal server error' });
  }
};
