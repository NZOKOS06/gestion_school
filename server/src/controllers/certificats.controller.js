import { prisma } from '../utils/prisma.js';
import { createLogger } from '../utils/logger.js';
import { logAudit } from '../utils/auditLogger.js';

const log = createLogger('CertificatsController');

export const getAll = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { page = 1, limit = 20, eleveId, type, sortBy = 'dateDelivrance', order = 'desc' } = req.query;
    const take = parseInt(limit);
    const skip = (parseInt(page) - 1) * take;

    const where = { tenantId };
    if (eleveId) where.eleveId = eleveId;
    if (type) where.type = type;

    const orderBy = {};
    orderBy[sortBy] = order;

    const [rows, total] = await Promise.all([
      prisma.certificat.findMany({
        where,
        include: {
          eleve: { select: { id: true, matricule: true, nom: true, prenom: true, photoUrl: true } },
          delivrePar: { select: { id: true, nom: true, prenom: true } },
          anneeScolaire: { select: { id: true, libelle: true } },
        },
        skip,
        take,
        orderBy,
      }),
      prisma.certificat.count({ where }),
    ]);

    res.json({
      data: rows,
      pagination: { page: parseInt(page), limit: take, total, totalPages: Math.ceil(total / take) },
    });
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId }, 'Get all certificats error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getOne = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;

    const certificat = await prisma.certificat.findFirst({
      where: { id, tenantId },
      include: {
        eleve: true,
        delivrePar: { select: { id: true, nom: true, prenom: true } },
        anneeScolaire: { select: { id: true, libelle: true } },
      },
    });

    if (!certificat) {
      return res.status(404).json({ error: 'Certificat non trouvé' });
    }

    res.json(certificat);
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId, id: req.params.id }, 'Get certificat error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const create = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { eleveId, type, anneeScolaireId, numeroSerie } = req.body;

    // Generate numeroSerie if not provided
    let serie = numeroSerie;
    if (!serie) {
      const count = await prisma.certificat.count({ where: { tenantId } });
      serie = `CERT-${String(count + 1).padStart(5, '0')}`;
    }

    // Check uniqueness
    const existing = await prisma.certificat.findFirst({ where: { tenantId, numeroSerie: serie } });
    if (existing) {
      return res.status(400).json({ error: 'Numéro de série déjà utilisé' });
    }

    const certificat = await prisma.certificat.create({
      data: {
        tenantId,
        eleveId,
        type: type || 'scolarite',
        anneeScolaireId: anneeScolaireId || null,
        numeroSerie: serie,
        delivreParId: req.user.id,
      },
      include: {
        eleve: { select: { id: true, matricule: true, nom: true, prenom: true } },
      },
    });

    await logAudit(req, 'certificat_genere', 'Certificat', certificat.id, { eleveId, type });

    res.status(201).json(certificat);
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId }, 'Create certificat error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const remove = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;

    const existing = await prisma.certificat.findFirst({ where: { id, tenantId } });
    if (!existing) {
      return res.status(404).json({ error: 'Certificat non trouvé' });
    }

    await prisma.certificat.delete({ where: { id } });

    await logAudit(req, 'certificat_deleted', 'Certificat', id, {});

    res.json({ message: 'Certificat supprimé' });
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId, id: req.params.id }, 'Delete certificat error');
    res.status(500).json({ error: 'Internal server error' });
  }
};
