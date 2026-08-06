import { prisma } from '../utils/prisma.js';
import { createLogger } from '../utils/logger.js';
import { logAudit } from '../utils/auditLogger.js';
import {
  calculerClasse,
  computeEleveBulletin,
  buildQrHash,
  countAbsencesHeures,
  mentionFromMoyenne,
} from '../services/bulletins.service.js';
import { buildBulletinPdf } from '../services/pdf/bulletin.pdf.js';
import { uploadPdfBuffer, isCloudinaryConfigured } from '../utils/cloudinary.js';
import { broadcastBulletin } from '../utils/notifications.js';

const log = createLogger('BulletinsController');

export const getAll = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { page = 1, limit = 20, eleveId, classeId, anneeScolaireId, periodeIndex, sortBy = 'createdAt', order = 'desc' } = req.query;
    const take = parseInt(limit);
    const skip = (parseInt(page) - 1) * take;

    const where = { tenantId };
    if (eleveId) where.eleveId = eleveId;
    if (anneeScolaireId) where.anneeScolaireId = anneeScolaireId;
    if (periodeIndex) where.periodeIndex = parseInt(periodeIndex);
    if (classeId) where.classeId = classeId;

    const orderBy = {};
    orderBy[sortBy] = order;

    const [rows, total] = await Promise.all([
      prisma.bulletin.findMany({
        where,
        include: {
          eleve: { select: { id: true, matricule: true, nom: true, prenom: true } },
          classe: { select: { id: true, nom: true, niveau: true } },
          anneeScolaire: { select: { id: true, libelle: true } },
        },
        skip,
        take,
        orderBy,
      }),
      prisma.bulletin.count({ where }),
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
    log.error({ err: error, tenantId: req.tenantId }, 'Get all bulletins error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getById = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;

    const bulletin = await prisma.bulletin.findFirst({
      where: { id, tenantId },
      include: {
        eleve: { select: { id: true, matricule: true, nom: true, prenom: true, sexe: true, dateNaissance: true, photoUrl: true } },
        classe: { select: { id: true, nom: true, niveau: true, filiere: true } },
        anneeScolaire: { select: { id: true, libelle: true } },
      },
    });

    if (!bulletin) {
      return res.status(404).json({ error: 'Bulletin non trouvé' });
    }

    res.json(bulletin);
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId, id: req.params.id }, 'Get bulletin by ID error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const calculer = async (req, res) => {
  try {
    const { anneeScolaireId, classeId, periodeIndex } = req.body;
    if (!anneeScolaireId || !classeId || periodeIndex == null) {
      return res.status(400).json({ error: 'anneeScolaireId, classeId et periodeIndex requis' });
    }

    const data = await calculerClasse(req.tenantId, {
      anneeScolaireId,
      classeId,
      periodeIndex,
    });

    res.json({ data });
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId }, 'Calculer bulletins error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

async function upsertBulletinFromComputed(tenantId, computed, meta, config) {
  const { anneeScolaireId, classeId, periodeIndex } = meta;
  const absencesHeures = await countAbsencesHeures(tenantId, computed.eleveId, anneeScolaireId);
  const qrCodeHash = buildQrHash({
    tenantId,
    eleveId: computed.eleveId,
    classeId,
    anneeScolaireId,
    periodeIndex,
  });

  const payload = {
    moyenneGenerale: computed.moyenneGenerale,
    rang: computed.rang,
    effectifClasse: computed.effectifClasse,
    mention: computed.mention,
    absencesHeures,
    notesDetaillees: computed.notesDetaillees,
    qrCodeHash,
    valide: false,
  };

  const existing = await prisma.bulletin.findFirst({
    where: {
      tenantId,
      eleveId: computed.eleveId,
      classeId,
      anneeScolaireId,
      periodeIndex: parseInt(periodeIndex, 10),
    },
  });

  let bulletin;
  if (existing) {
    bulletin = await prisma.bulletin.update({
      where: { id: existing.id },
      data: payload,
      include: {
        eleve: { select: { id: true, prenom: true, nom: true, matricule: true } },
        classe: { select: { id: true, nom: true } },
        anneeScolaire: { select: { id: true, libelle: true } },
      },
    });
  } else {
    bulletin = await prisma.bulletin.create({
      data: {
        tenantId,
        eleveId: computed.eleveId,
        classeId,
        anneeScolaireId,
        periodeIndex: parseInt(periodeIndex, 10),
        ...payload,
      },
      include: {
        eleve: { select: { id: true, prenom: true, nom: true, matricule: true } },
        classe: { select: { id: true, nom: true } },
        anneeScolaire: { select: { id: true, libelle: true } },
      },
    });
  }

  // PDF
  try {
    const buffer = await buildBulletinPdf({
      nomEcole: config?.nomEcole || 'GestSchool',
      eleve: `${bulletin.eleve.prenom} ${bulletin.eleve.nom}`,
      matricule: bulletin.eleve.matricule,
      classe: bulletin.classe?.nom,
      anneeScolaire: bulletin.anneeScolaire?.libelle,
      periodeIndex: bulletin.periodeIndex,
      moyenneGenerale: Number(bulletin.moyenneGenerale),
      rang: bulletin.rang,
      effectifClasse: bulletin.effectifClasse,
      mention: bulletin.mention,
      notesDetaillees: bulletin.notesDetaillees,
      absencesHeures: bulletin.absencesHeures,
      qrCodeHash: bulletin.qrCodeHash,
    });

    let pdfUrl = null;
    if (isCloudinaryConfigured()) {
      try {
        pdfUrl = await uploadPdfBuffer(buffer, {
          folder: 'gestschool/bulletins',
          publicId: `bulletin-${bulletin.id.slice(0, 12)}`,
        });
      } catch (upErr) {
        log.warn({ err: upErr }, 'Cloudinary bulletin upload failed');
      }
    }

    if (pdfUrl) {
      bulletin = await prisma.bulletin.update({
        where: { id: bulletin.id },
        data: { pdfUrl },
        include: {
          eleve: { select: { id: true, prenom: true, nom: true, matricule: true } },
          classe: { select: { id: true, nom: true } },
          anneeScolaire: { select: { id: true, libelle: true } },
        },
      });
    }
  } catch (pdfErr) {
    log.warn({ err: pdfErr }, 'Bulletin PDF generation failed');
  }

  return bulletin;
}

export const genererMasse = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { anneeScolaireId, classeId, periodeIndex } = req.body;
    if (!anneeScolaireId || !classeId || periodeIndex == null) {
      return res.status(400).json({ error: 'anneeScolaireId, classeId et periodeIndex requis' });
    }

    const results = await calculerClasse(tenantId, {
      anneeScolaireId,
      classeId,
      periodeIndex,
    });

    const withNotes = results.filter((r) => r.hasNotes);
    if (!withNotes.length) {
      return res.status(400).json({ error: 'Aucune note trouvée pour cette classe / période' });
    }

    const config = await prisma.tenantConfig.findUnique({ where: { tenantId } });
    const created = [];
    for (const row of withNotes) {
      const bulletin = await upsertBulletinFromComputed(
        tenantId,
        row,
        { anneeScolaireId, classeId, periodeIndex },
        config
      );
      created.push(bulletin);
    }

    await logAudit(req, 'bulletins_generated_masse', 'Bulletin', null, {
      classeId,
      periodeIndex,
      count: created.length,
    });

    res.status(201).json({ data: created, count: created.length });
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId }, 'Generer masse bulletins error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const publier = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { anneeScolaireId, classeId, periodeIndex } = req.body;
    if (!anneeScolaireId || !classeId || periodeIndex == null) {
      return res.status(400).json({ error: 'anneeScolaireId, classeId et periodeIndex requis' });
    }

    const result = await prisma.bulletin.updateMany({
      where: {
        tenantId,
        anneeScolaireId,
        classeId,
        periodeIndex: parseInt(periodeIndex, 10),
      },
      data: { valide: true },
    });

    const published = await prisma.bulletin.findMany({
      where: {
        tenantId,
        anneeScolaireId,
        classeId,
        periodeIndex: parseInt(periodeIndex, 10),
        valide: true,
      },
    });
    for (const b of published) {
      try {
        await broadcastBulletin(req.tenant?.slug, tenantId, b);
      } catch { /* optional */ }
    }

    await logAudit(req, 'bulletins_published', 'Bulletin', null, {
      classeId,
      periodeIndex,
      count: result.count,
    });

    res.json({ message: 'Bulletins publiés', count: result.count });
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId }, 'Publier bulletins error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const generate = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { eleveId, classeId, anneeScolaireId, periodeIndex } = req.body;

    if (!eleveId || !classeId || !anneeScolaireId || periodeIndex == null) {
      return res.status(400).json({ error: 'eleveId, classeId, anneeScolaireId, periodeIndex requis' });
    }

    const config = await prisma.tenantConfig.findUnique({ where: { tenantId } });
    const seuil = Number(config?.seuilReussite ?? 10);

    const computed = await computeEleveBulletin(tenantId, {
      eleveId,
      classeId,
      anneeScolaireId,
      periodeIndex,
      seuilReussite: seuil,
    });

    if (!computed.hasNotes) {
      return res.status(400).json({ error: 'Aucune note trouvée pour cette période' });
    }

    // Rank within class for single generate
    const classResults = await calculerClasse(tenantId, {
      anneeScolaireId,
      classeId,
      periodeIndex,
    });
    const ranked = classResults.find((r) => r.eleveId === eleveId);
    const row = {
      ...computed,
      rang: ranked?.rang || 1,
      effectifClasse: ranked?.effectifClasse || 1,
      mention: ranked?.mention || mentionFromMoyenne(computed.moyenneGenerale, seuil),
    };

    const bulletin = await upsertBulletinFromComputed(
      tenantId,
      row,
      { anneeScolaireId, classeId, periodeIndex },
      config
    );

    await logAudit(req, 'bulletin_generated', 'Bulletin', bulletin.id, { eleveId, periodeIndex });

    res.status(201).json(bulletin);
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId }, 'Generate bulletin error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const update = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;
    const { appreciationGenerale, decisionConseil, valide, mention } = req.body;

    const existing = await prisma.bulletin.findFirst({ where: { id, tenantId } });
    if (!existing) {
      return res.status(404).json({ error: 'Bulletin non trouvé' });
    }

    const data = {};
    if (decisionConseil !== undefined) data.decisionConseil = decisionConseil;
    if (appreciationGenerale !== undefined) {
      data.decisionConseil = appreciationGenerale;
    }
    if (valide !== undefined) data.valide = !!valide;
    if (mention !== undefined) data.mention = mention;

    const bulletin = await prisma.bulletin.update({ where: { id }, data });

    await logAudit(req, 'bulletin_updated', 'Bulletin', bulletin.id, { valide: bulletin.valide });

    res.json(bulletin);
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId, id: req.params.id }, 'Update bulletin error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const remove = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;

    const existing = await prisma.bulletin.findFirst({ where: { id, tenantId } });
    if (!existing) {
      return res.status(404).json({ error: 'Bulletin non trouvé' });
    }

    await prisma.bulletin.delete({ where: { id } });

    await logAudit(req, 'bulletin_deleted', 'Bulletin', id, {});

    res.json({ message: 'Bulletin supprimé' });
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId, id: req.params.id }, 'Delete bulletin error');
    res.status(500).json({ error: 'Internal server error' });
  }
};
