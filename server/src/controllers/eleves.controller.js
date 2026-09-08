import jwt from 'jsonwebtoken';
import { prisma } from '../utils/prisma.js';
import { createLogger } from '../utils/logger.js';
import { logAudit } from '../utils/auditLogger.js';
import { messageErreurDateNaissance, safeOrderBy } from '../utils/formatters.js';
import { config } from '../config.js';
import { generateCarteScolairePdf } from '../services/pdf/carteScolaire.pdf.js';

const log = createLogger('ElevesController');

export const getAll = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const {
      page = 1,
      limit = 20,
      search,
      classeId,
      classe,
      cycle,
      sexe,
      statut,
      inscription,
      sortBy = 'nom',
      order = 'asc',
    } = req.query;
    const take = parseInt(limit);
    const skip = (parseInt(page) - 1) * take;
    const resolvedClasseId = classeId || classe || null;

    const where = { tenantId };
    if (statut === 'inactif') where.actif = false;
    else where.actif = true;

    if (sexe) where.sexe = sexe;
    if (search) {
      where.OR = [
        { matricule: { contains: search, mode: 'insensitive' } },
        { nom: { contains: search, mode: 'insensitive' } },
        { prenom: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (inscription === 'sans') {
      where.inscriptions = {
        none: { anneeScolaire: { actif: true } },
      };
    } else if (inscription === 'en_attente' || inscription === 'validee') {
      where.inscriptions = {
        some: {
          anneeScolaire: { actif: true },
          statut: inscription,
          ...(resolvedClasseId ? { classeId: resolvedClasseId } : {}),
          ...(cycle ? { classe: { cycle } } : {}),
        },
      };
    } else if (resolvedClasseId || cycle) {
      where.inscriptions = {
        some: {
          anneeScolaire: { actif: true },
          ...(resolvedClasseId ? { classeId: resolvedClasseId } : {}),
          ...(cycle ? { classe: { cycle } } : {}),
        },
      };
    }

    const orderBy = safeOrderBy(
      sortBy,
      order,
      ['nom', 'prenom', 'matricule', 'dateNaissance', 'dateEntree', 'createdAt'],
      'nom',
      'asc'
    );

    const [rows, total] = await Promise.all([
      prisma.eleve.findMany({
        where,
        include: {
          parent: { select: { id: true, nom: true, prenom: true, email: true, telephone: true } },
          inscriptions: {
            where: { anneeScolaire: { actif: true } },
            select: {
              id: true,
              statut: true,
              soldeScolarite: true,
              classe: { select: { id: true, nom: true, niveau: true, cycle: true } },
            },
            take: 1,
          },
        },
        skip,
        take,
        orderBy,
      }),
      prisma.eleve.count({ where }),
    ]);

    res.json({
      data: rows,
      pagination: {
        page: parseInt(page),
        limit: take,
        total,
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId }, 'Get all eleves error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getById = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;

    const eleve = await prisma.eleve.findFirst({
      where: { id, tenantId },
      include: {
        parent: { select: { id: true, nom: true, prenom: true, email: true, telephone: true } },
        inscriptions: {
          include: {
            classe: { select: { id: true, nom: true, niveau: true, cycle: true } },
            anneeScolaire: { select: { id: true, libelle: true, actif: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!eleve) {
      return res.status(404).json({ error: 'Élève non trouvé' });
    }

    res.json(eleve);
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId, id: req.params.id }, 'Get eleve by ID error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const create = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { matricule, nom, prenom, dateNaissance, sexe, lieuNaissance, adresse, parentId, photoUrl } = req.body;

    const errNaissance = messageErreurDateNaissance(dateNaissance);
    if (errNaissance) {
      return res.status(400).json({ error: errNaissance });
    }

    const existing = await prisma.eleve.findFirst({
      where: { tenantId, matricule },
    });
    if (existing) {
      return res.status(409).json({ error: 'Ce matricule existe déjà' });
    }

    const eleve = await prisma.eleve.create({
      data: {
        tenantId,
        matricule,
        nom,
        prenom,
        dateNaissance: new Date(dateNaissance),
        sexe,
        lieuNaissance: lieuNaissance || null,
        adresse: adresse || null,
        parentId: parentId || null,
        photoUrl: photoUrl || null,
      },
    });

    await logAudit(req, 'eleve_created', 'Eleve', eleve.id, { matricule, nom, prenom });

    res.status(201).json(eleve);
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId }, 'Create eleve error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const update = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;
    const { nom, prenom, dateNaissance, sexe, lieuNaissance, adresse, parentId, photoUrl, actif } = req.body;

    const existing = await prisma.eleve.findFirst({ where: { id, tenantId } });
    if (!existing) {
      return res.status(404).json({ error: 'Élève non trouvé' });
    }

    if (dateNaissance !== undefined) {
      const errNaissance = messageErreurDateNaissance(dateNaissance);
      if (errNaissance) {
        return res.status(400).json({ error: errNaissance });
      }
    }

    const data = {};
    if (nom !== undefined) data.nom = nom;
    if (prenom !== undefined) data.prenom = prenom;
    if (dateNaissance !== undefined) data.dateNaissance = new Date(dateNaissance);
    if (sexe !== undefined) data.sexe = sexe;
    if (lieuNaissance !== undefined) data.lieuNaissance = lieuNaissance;
    if (adresse !== undefined) data.adresse = adresse;
    if (parentId !== undefined) data.parentId = parentId || null;
    if (photoUrl !== undefined) data.photoUrl = photoUrl;
    if (actif !== undefined) data.actif = actif;

    const eleve = await prisma.eleve.update({ where: { id }, data });

    await logAudit(req, 'eleve_updated', 'Eleve', eleve.id, { nom, prenom });

    res.json(eleve);
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId, id: req.params.id }, 'Update eleve error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const remove = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;

    const existing = await prisma.eleve.findFirst({ where: { id, tenantId } });
    if (!existing) {
      return res.status(404).json({ error: 'Élève non trouvé' });
    }

    await prisma.eleve.update({ where: { id }, data: { actif: false } });

    await logAudit(req, 'eleve_deleted', 'Eleve', id, { matricule: existing.matricule, nom: existing.nom });

    res.json({ message: 'Élève désactivé' });
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId, id: req.params.id }, 'Delete eleve error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getCarteScolaire = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;

    const eleve = await prisma.eleve.findFirst({
      where: { id, tenantId },
      include: {
        inscriptions: {
          where: { anneeScolaire: { actif: true } },
          include: {
            classe: { select: { id: true, nom: true, niveau: true } },
            anneeScolaire: { select: { id: true, libelle: true } },
          },
          take: 1,
        },
        tenant: {
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
        },
      },
    });

    if (!eleve) {
      return res.status(404).json({ error: 'Élève non trouvé' });
    }

    const inscription = eleve.inscriptions?.[0];
    const anneeScolaire = inscription?.anneeScolaire;
    const classe = inscription?.classe;
    const ecole = {
      nomEcole: eleve.tenant?.config?.nomEcole || eleve.tenant?.nom,
      logoUrl: eleve.tenant?.config?.logoUrl,
      telephone: eleve.tenant?.config?.telephone || eleve.tenant?.contact?.telephone,
      adresse: eleve.tenant?.config?.adresse || eleve.tenant?.contact?.adresse,
    };

    // Générer token JWT signé 1 an pour le portail parent public
    const portalToken = jwt.sign(
      { eleveId: eleve.id, tenantId, scope: 'portail_parent' },
      config.jwtSecret,
      { expiresIn: '365d' }
    );

    const baseUrl = config.frontendUrl || `${req.protocol}://${req.get('host')}`;
    const qrUrl = `${baseUrl}/portail-parent?token=${portalToken}`;

    const pdfBuffer = await generateCarteScolairePdf({
      eleve,
      classe,
      anneeScolaire,
      ecole,
      qrUrl,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="carte_scolaire_${eleve.matricule}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId, id: req.params.id }, 'Generate carte scolaire error');
    res.status(500).json({ error: 'Erreur lors de la génération de la carte scolaire' });
  }
};

