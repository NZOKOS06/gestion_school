import { prisma } from '../utils/prisma.js';
import { createLogger } from '../utils/logger.js';
import { buildDepensesPdf } from '../services/pdf/depenses.pdf.js';

const log = createLogger('DepensesController');

export const getAll = async (req, res) => {
  try {
    const { page = 1, limit = 20, categorie, dateDebut, dateFin } = req.query;
    const take = parseInt(limit);
    const skip = (parseInt(page) - 1) * take;
    const tenantId = req.tenantId;

    const where = { tenantId };
    if (categorie) where.categorie = { contains: categorie, mode: 'insensitive' };
    if (dateDebut || dateFin) {
      where.dateDepense = {};
      if (dateDebut) where.dateDepense.gte = new Date(dateDebut);
      if (dateFin) where.dateDepense.lte = new Date(dateFin);
    }

    const [rows, total] = await Promise.all([
      prisma.depense.findMany({
        where,
        include: { saisiePar: { select: { id: true, nom: true, prenom: true } } },
        skip,
        take,
        orderBy: { dateDepense: 'desc' },
      }),
      prisma.depense.count({ where }),
    ]);

    const data = rows.map((d) => ({ ...d, montant: Number(d.montant) }));
    res.json({ data, pagination: { page: parseInt(page), limit: take, total, totalPages: Math.ceil(total / take) } });
  } catch (error) {
    log.error({ err: error }, 'getAll depenses error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const create = async (req, res) => {
  try {
    const { categorie, montant, motif, reference, dateDepense } = req.body;
    const amount = parseFloat(montant);
    if (!categorie || !amount || amount <= 0 || !motif) {
      return res.status(400).json({ error: 'categorie, montant > 0 et motif sont requis' });
    }
    const depense = await prisma.depense.create({
      data: {
        tenantId: req.tenantId,
        categorie: categorie.trim(),
        montant: amount,
        motif: motif.trim(),
        reference: reference?.trim() || null,
        dateDepense: dateDepense ? new Date(dateDepense) : new Date(),
        saisieParId: req.user.id,
      },
      include: { saisiePar: { select: { id: true, nom: true, prenom: true } } },
    });
    res.status(201).json({ ...depense, montant: Number(depense.montant) });
  } catch (error) {
    log.error({ err: error }, 'create depense error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const update = async (req, res) => {
  try {
    const { id } = req.params;
    const { categorie, montant, motif, reference, dateDepense } = req.body;
    const existing = await prisma.depense.findFirst({ where: { id, tenantId: req.tenantId } });
    if (!existing) return res.status(404).json({ error: 'Dépense non trouvée' });

    const depense = await prisma.depense.update({
      where: { id },
      data: {
        ...(categorie && { categorie: categorie.trim() }),
        ...(montant !== undefined && { montant: parseFloat(montant) }),
        ...(motif && { motif: motif.trim() }),
        ...(reference !== undefined && { reference: reference?.trim() || null }),
        ...(dateDepense && { dateDepense: new Date(dateDepense) }),
      },
      include: { saisiePar: { select: { id: true, nom: true, prenom: true } } },
    });
    res.json({ ...depense, montant: Number(depense.montant) });
  } catch (error) {
    log.error({ err: error }, 'update depense error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const remove = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.depense.findFirst({ where: { id, tenantId: req.tenantId } });
    if (!existing) return res.status(404).json({ error: 'Dépense non trouvée' });
    await prisma.depense.delete({ where: { id } });
    res.json({ message: 'Dépense supprimée' });
  } catch (error) {
    log.error({ err: error }, 'delete depense error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getStats = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [totalMois, totalAnnee, parCategorie] = await Promise.all([
      prisma.depense.aggregate({
        where: { tenantId, dateDepense: { gte: startOfMonth } },
        _sum: { montant: true },
      }),
      prisma.depense.aggregate({
        where: { tenantId, dateDepense: { gte: new Date(now.getFullYear(), 0, 1) } },
        _sum: { montant: true },
      }),
      prisma.depense.groupBy({
        by: ['categorie'],
        where: { tenantId, dateDepense: { gte: startOfMonth } },
        _sum: { montant: true },
        orderBy: { _sum: { montant: 'desc' } },
      }),
    ]);

    res.json({
      totalMois: Number(totalMois._sum.montant || 0),
      totalAnnee: Number(totalAnnee._sum.montant || 0),
      parCategorie: parCategorie.map((c) => ({ categorie: c.categorie, montant: Number(c._sum.montant || 0) })),
    });
  } catch (error) {
    log.error({ err: error }, 'getStats depenses error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getExportPdf = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { categorie, dateDebut, dateFin } = req.query;
    const where = { tenantId };
    if (categorie) where.categorie = { contains: categorie, mode: 'insensitive' };
    if (dateDebut || dateFin) {
      where.dateDepense = {};
      if (dateDebut) where.dateDepense.gte = new Date(dateDebut);
      if (dateFin) {
        const to = new Date(dateFin);
        if (String(dateFin).length <= 10) to.setHours(23, 59, 59, 999);
        where.dateDepense.lte = to;
      }
    }

    const rows = await prisma.depense.findMany({
      where,
      orderBy: { dateDepense: 'asc' },
      take: 500,
    });
    const config = await prisma.tenantConfig.findUnique({ where: { tenantId } });
    const buffer = await buildDepensesPdf({
      nomEcole: config?.nomEcole || req.tenant?.nom || 'GestSchool',
      adresse: config?.adresse || null,
      telephone: config?.telephone || null,
      devise: config?.devise || 'FCFA',
      dateDebut: dateDebut || rows[0]?.dateDepense,
      dateFin: dateFin || new Date(),
      depenses: rows.map((d) => ({
        dateDepense: d.dateDepense,
        categorie: d.categorie,
        motif: d.motif,
        montant: Number(d.montant),
        reference: d.reference,
      })),
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="depenses.pdf"');
    res.send(buffer);
  } catch (error) {
    log.error({ err: error }, 'getExportPdf depenses error');
    res.status(500).json({ error: 'Internal server error' });
  }
};
