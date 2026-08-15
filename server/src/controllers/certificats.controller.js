import { prisma } from '../utils/prisma.js';
import { createLogger } from '../utils/logger.js';
import { logAudit } from '../utils/auditLogger.js';
import { buildCertificatPdf, buildPreviewPayload } from '../services/pdf/certificat.pdf.js';
import { loadSchoolPdfMeta } from '../services/pdf/schoolMeta.js';
import { uploadPdfBuffer, isCloudinaryConfigured } from '../utils/cloudinary.js';

const log = createLogger('CertificatsController');

async function loadCertificatContext(tenantId, { eleveId, anneeScolaireId }) {
  const [eleve, annee, config, inscription] = await Promise.all([
    prisma.eleve.findFirst({
      where: { id: eleveId, tenantId },
      select: {
        id: true,
        prenom: true,
        nom: true,
        matricule: true,
        dateNaissance: true,
        lieuNaissance: true,
        sexe: true,
        parent: { select: { prenom: true, nom: true } },
      },
    }),
    anneeScolaireId
      ? prisma.anneeScolaire.findFirst({ where: { id: anneeScolaireId, tenantId } })
      : prisma.anneeScolaire.findFirst({ where: { tenantId, actif: true } }),
    prisma.tenantConfig.findUnique({ where: { tenantId } }),
    prisma.inscription.findFirst({
      where: {
        tenantId,
        eleveId,
        ...(anneeScolaireId ? { anneeScolaireId } : {}),
        statut: 'validee',
      },
      include: { classe: { select: { nom: true } } },
      orderBy: { dateInscription: 'desc' },
    }),
  ]);
  return { eleve, annee, config, inscription };
}

function parentName(eleve) {
  return eleve?.parent ? `${eleve.parent.prenom} ${eleve.parent.nom}` : null;
}

async function certificatPdfPayload({ certificat, eleve, annee, inscription, req, delivrePar }) {
  const meta = await loadSchoolPdfMeta(certificat?.tenantId || req.tenantId, req);
  return {
    ...meta,
    type: certificat?.type || 'scolarite',
    eleve: eleve ? `${eleve.prenom} ${eleve.nom}` : '—',
    matricule: eleve?.matricule,
    classe: inscription?.classe?.nom,
    anneeScolaire: annee?.libelle || certificat?.anneeScolaire?.libelle,
    numeroSerie: certificat?.numeroSerie,
    dateDelivrance: certificat?.dateDelivrance || new Date(),
    delivrePar,
    dateNaissance: eleve?.dateNaissance,
    lieuNaissance: eleve?.lieuNaissance,
    sexe: eleve?.sexe,
    parent: parentName(eleve),
  };
}

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
      data: rows.map((r) => ({
        ...r,
        elevePrenom: r.eleve?.prenom,
        eleveNom: r.eleve?.nom,
        eleveMatricule: r.eleve?.matricule,
      })),
      pagination: { page: parseInt(page), limit: take, total, totalPages: Math.ceil(total / take) },
    });
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId }, 'Get all certificats error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const preview = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { eleveId, type, anneeScolaireId } = req.query;
    if (!eleveId) return res.status(400).json({ error: 'eleveId requis' });

    const { eleve, annee, config, inscription } = await loadCertificatContext(tenantId, {
      eleveId,
      anneeScolaireId,
    });
    if (!eleve) return res.status(404).json({ error: 'Élève non trouvé' });

    const count = await prisma.certificat.count({ where: { tenantId } });
    const numeroSerie = `CERT-${String(count + 1).padStart(5, '0')}`;

    res.json(
      buildPreviewPayload({
        type: type || 'scolarite',
        eleve: `${eleve.prenom} ${eleve.nom}`,
        matricule: eleve.matricule,
        classe: inscription?.classe?.nom,
        anneeScolaire: annee?.libelle,
        numeroSerie,
        nomEcole: config?.nomEcole || req.tenant?.nom || 'GestSchool',
        dateNaissance: eleve.dateNaissance,
        lieuNaissance: eleve.lieuNaissance,
        sexe: eleve.sexe,
        parent: parentName(eleve),
      })
    );
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId }, 'Preview certificat error');
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

async function generateAndAttachPdf(certificat, req) {
  const tenantId = certificat.tenantId;
  const { eleve, annee, inscription } = await loadCertificatContext(tenantId, {
    eleveId: certificat.eleveId,
    anneeScolaireId: certificat.anneeScolaireId,
  });

  const delivrePar = certificat.delivrePar
    ? `${certificat.delivrePar.prenom} ${certificat.delivrePar.nom}`
    : null;

  const buffer = await buildCertificatPdf(await certificatPdfPayload({
    certificat, eleve, annee, inscription, req, delivrePar,
  }));

  let pdfUrl = null;
  if (isCloudinaryConfigured()) {
    try {
      pdfUrl = await uploadPdfBuffer(buffer, {
        folder: 'gestschool/certificats',
        publicId: `cert-${certificat.id.slice(0, 12)}`,
      });
    } catch (upErr) {
      log.warn({ err: upErr }, 'Cloudinary certificat upload failed');
    }
  }

  if (pdfUrl) {
    return prisma.certificat.update({
      where: { id: certificat.id },
      data: { pdfUrl },
      include: {
        eleve: { select: { id: true, matricule: true, nom: true, prenom: true } },
        delivrePar: { select: { id: true, nom: true, prenom: true } },
        anneeScolaire: { select: { id: true, libelle: true } },
      },
    });
  }
  return certificat;
}

export const create = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { eleveId, type, anneeScolaireId, numeroSerie } = req.body;

    if (!eleveId) return res.status(400).json({ error: 'eleveId requis' });

    const eleve = await prisma.eleve.findFirst({ where: { id: eleveId, tenantId } });
    if (!eleve) return res.status(404).json({ error: 'Élève non trouvé' });

    let serie = numeroSerie;
    if (!serie) {
      const count = await prisma.certificat.count({ where: { tenantId } });
      serie = `CERT-${String(count + 1).padStart(5, '0')}`;
    }

    const existing = await prisma.certificat.findFirst({ where: { tenantId, numeroSerie: serie } });
    if (existing) {
      return res.status(400).json({ error: 'Numéro de série déjà utilisé' });
    }

    let certificat = await prisma.certificat.create({
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
        delivrePar: { select: { id: true, nom: true, prenom: true } },
        anneeScolaire: { select: { id: true, libelle: true } },
      },
    });

    try {
      certificat = await generateAndAttachPdf(certificat, req);
    } catch (pdfErr) {
      log.warn({ err: pdfErr }, 'Certificat PDF generation failed');
    }

    await logAudit(req, 'certificat_genere', 'Certificat', certificat.id, { eleveId, type });

    res.status(201).json(certificat);
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId }, 'Create certificat error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getPdf = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;

    const certificat = await prisma.certificat.findFirst({
      where: { id, tenantId },
      include: {
        eleve: {
          select: {
            prenom: true,
            nom: true,
            matricule: true,
            dateNaissance: true,
            lieuNaissance: true,
            sexe: true,
            parent: { select: { prenom: true, nom: true } },
          },
        },
        delivrePar: { select: { prenom: true, nom: true } },
        anneeScolaire: { select: { libelle: true } },
      },
    });
    if (!certificat) return res.status(404).json({ error: 'Certificat non trouvé' });

    const { inscription } = await loadCertificatContext(tenantId, {
      eleveId: certificat.eleveId,
      anneeScolaireId: certificat.anneeScolaireId,
    });

    const buffer = await buildCertificatPdf(await certificatPdfPayload({
      certificat,
      eleve: certificat.eleve,
      annee: certificat.anneeScolaire,
      inscription,
      req,
      delivrePar: certificat.delivrePar
        ? `${certificat.delivrePar.prenom} ${certificat.delivrePar.nom}`
        : null,
    }));

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="certificat-${certificat.numeroSerie}.pdf"`);
    res.send(buffer);
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId, id: req.params.id }, 'Get certificat PDF error');
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
