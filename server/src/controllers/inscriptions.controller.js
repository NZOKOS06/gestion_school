import { prisma } from '../utils/prisma.js';
import { createLogger } from '../utils/logger.js';
import { logAudit } from '../utils/auditLogger.js';
import { generateForInscription } from '../services/echeances.service.js';
import { messageErreurDateNaissance } from '../utils/formatters.js';
import { resolveAnneeScolaireId, getAnneeOperationnelle } from '../utils/anneeScolaire.js';
import { hashPassword } from '../utils/password.js';

const log = createLogger('InscriptionsController');

async function resolveFees(tenantId, classeId) {
  const [classe, config] = await Promise.all([
    prisma.classe.findFirst({ where: { id: classeId, tenantId } }),
    prisma.tenantConfig.findUnique({ where: { tenantId } }),
  ]);
  const fraisScolarite = Number(classe?.fraisScolarite ?? config?.fraisScolariteDefault ?? 0);
  const fraisInscription = Number(config?.fraisInscriptionDefault ?? 0);
  return { classe, config, fraisScolarite, fraisInscription };
}

export const getAll = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { page = 1, limit = 20, search, classeId, anneeScolaireId, statut, sortBy = 'createdAt', order = 'desc' } = req.query;
    const take = parseInt(limit);
    const skip = (parseInt(page) - 1) * take;

    const resolvedAnneeId = await resolveAnneeScolaireId(tenantId, anneeScolaireId || null);

    const where = { tenantId };
    if (statut) where.statut = statut;
    if (classeId) where.classeId = classeId;
    if (resolvedAnneeId) where.anneeScolaireId = resolvedAnneeId;
    if (search) {
      where.eleve = {
        OR: [
          { matricule: { contains: search, mode: 'insensitive' } },
          { nom: { contains: search, mode: 'insensitive' } },
          { prenom: { contains: search, mode: 'insensitive' } },
        ],
      };
    }

    const orderBy = {};
    orderBy[sortBy] = order;

    const [rows, total] = await Promise.all([
      prisma.inscription.findMany({
        where,
        include: {
          eleve: { select: { id: true, matricule: true, nom: true, prenom: true, sexe: true, photoUrl: true, dateNaissance: true } },
          classe: { select: { id: true, nom: true, niveau: true } },
          anneeScolaire: { select: { id: true, libelle: true, statut: true } },
        },
        skip,
        take,
        orderBy,
      }),
      prisma.inscription.count({ where }),
    ]);

    res.json({
      data: rows,
      anneeScolaireId: resolvedAnneeId,
      pagination: {
        page: parseInt(page),
        limit: take,
        total,
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId }, 'Get all inscriptions error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getById = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;

    const inscription = await prisma.inscription.findFirst({
      where: { id, tenantId },
      include: {
        eleve: true,
        classe: { include: { anneeScolaire: true } },
        anneeScolaire: true,
        paiements: { orderBy: { datePaiement: 'desc' } },
      },
    });

    if (!inscription) {
      return res.status(404).json({ error: 'Inscription non trouvée' });
    }

    res.json(inscription);
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId, id: req.params.id }, 'Get inscription by ID error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const create = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { eleveId, classeId, anneeScolaireId } = req.body;

    const existing = await prisma.inscription.findFirst({
      where: { tenantId, eleveId, anneeScolaireId },
    });
    if (existing) {
      return res.status(409).json({ error: 'Cet élève est déjà inscrit pour cette année scolaire' });
    }

    const { fraisScolarite, fraisInscription } = await resolveFees(tenantId, classeId);

    const inscription = await prisma.$transaction(async (tx) => {
      const insc = await tx.inscription.create({
        data: {
          tenantId,
          eleveId,
          classeId,
          anneeScolaireId,
          statut: 'en_attente',
          soldeScolarite: fraisInscription + fraisScolarite,
        },
      });
      await generateForInscription(tx, insc, {
        fraisInscription,
        fraisScolarite,
      });
      return tx.inscription.findUnique({
        where: { id: insc.id },
        include: {
          echeances: true,
          eleve: { select: { id: true, matricule: true, nom: true, prenom: true } },
          classe: { select: { id: true, nom: true } },
        },
      });
    });

    await logAudit(req, 'inscription_created', 'Inscription', inscription.id, { eleveId, classeId });

    res.status(201).json(inscription);
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId }, 'Create inscription error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Inscription d'abord : crée éventuellement la fiche élève puis l'inscription + échéances.
 */
export const createAvecEleve = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const {
      eleveId: existingEleveId,
      classeId,
      anneeScolaireId,
      eleve: eleveData,
      parentId: explicitParentId,
      tuteur: tuteurData,
    } = req.body;

    const annee = await prisma.anneeScolaire.findFirst({ where: { id: anneeScolaireId, tenantId } });
    if (!annee) return res.status(400).json({ error: 'Année scolaire invalide' });

    const classe = await prisma.classe.findFirst({ where: { id: classeId, tenantId, anneeScolaireId } });
    if (!classe) return res.status(400).json({ error: 'Classe invalide pour cette année' });

    const { fraisScolarite, fraisInscription } = await resolveFees(tenantId, classeId);

    const result = await prisma.$transaction(async (tx) => {
      let finalParentId = explicitParentId || eleveData?.parentId || null;

      // Création automatique ou rattachement du tuteur obligatoire
      if (!finalParentId && tuteurData && tuteurData.nom && tuteurData.telephone) {
        const cleanTel = tuteurData.telephone.trim();
        const cleanEmail = tuteurData.email?.trim()?.toLowerCase() || null;

        let parentUser = await tx.user.findFirst({
          where: {
            tenantId,
            OR: [
              { telephone: cleanTel },
              ...(cleanEmail ? [{ email: cleanEmail }] : []),
            ],
          },
        });

        if (!parentUser) {
          const pwdHash = await hashPassword('Parent123!');
          const generatedEmail =
            cleanEmail ||
            `parent_${cleanTel.replace(/\D/g, '') || Date.now()}@${req.tenant?.slug || 'gestschool'}.cg`;

          parentUser = await tx.user.create({
            data: {
              tenantId,
              nom: tuteurData.nom.trim(),
              prenom: tuteurData.prenom?.trim() || '',
              telephone: cleanTel,
              email: generatedEmail,
              adresse: tuteurData.adresse?.trim() || null,
              passwordHash: pwdHash,
              actif: true,
            },
          });
        }
        finalParentId = parentUser.id;
      }

      let eleveId = existingEleveId || null;

      if (!eleveId) {
        if (!eleveData?.matricule || !eleveData?.nom || !eleveData?.prenom || !eleveData?.dateNaissance || !eleveData?.sexe) {
          throw Object.assign(new Error('Données élève incomplètes'), { status: 400 });
        }
        const errNaissance = messageErreurDateNaissance(eleveData.dateNaissance);
        if (errNaissance) {
          throw Object.assign(new Error(errNaissance), { status: 400 });
        }
        const dup = await tx.eleve.findFirst({
          where: { tenantId, matricule: eleveData.matricule.trim() },
        });
        if (dup) {
          throw Object.assign(new Error('Ce matricule existe déjà'), { status: 409 });
        }
        const created = await tx.eleve.create({
          data: {
            tenantId,
            matricule: eleveData.matricule.trim(),
            nom: eleveData.nom.trim(),
            prenom: eleveData.prenom.trim(),
            dateNaissance: new Date(eleveData.dateNaissance),
            sexe: eleveData.sexe,
            lieuNaissance: eleveData.lieuNaissance?.trim() || null,
            adresse: eleveData.adresse?.trim() || null,
            parentId: finalParentId,
          },
        });
        eleveId = created.id;
      } else {
        const eleve = await tx.eleve.findFirst({ where: { id: eleveId, tenantId } });
        if (!eleve) {
          throw Object.assign(new Error('Élève introuvable'), { status: 404 });
        }
        if (finalParentId) {
          await tx.eleve.update({
            where: { id: eleveId },
            data: { parentId: finalParentId },
          });
        }
      }

      const existing = await tx.inscription.findFirst({
        where: { tenantId, eleveId, anneeScolaireId },
      });
      if (existing) {
        throw Object.assign(new Error('Cet élève est déjà inscrit pour cette année scolaire'), { status: 409 });
      }

      const insc = await tx.inscription.create({
        data: {
          tenantId,
          eleveId,
          classeId,
          anneeScolaireId,
          statut: 'en_attente',
          soldeScolarite: fraisInscription + fraisScolarite,
        },
      });
      await generateForInscription(tx, insc, {
        fraisInscription,
        fraisScolarite,
      });

      return tx.inscription.findUnique({
        where: { id: insc.id },
        include: {
          echeances: true,
          eleve: { select: { id: true, matricule: true, nom: true, prenom: true, parentId: true } },
          classe: { select: { id: true, nom: true } },
          anneeScolaire: { select: { id: true, libelle: true } },
        },
      });
    });

    await logAudit(req, 'inscription_created_avec_eleve', 'Inscription', result.id, {
      eleveId: result.eleveId,
      classeId,
      createdEleve: !existingEleveId,
    });

    res.status(201).json(result);
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    log.error(
      { err: error, message: error.message, code: error.code, meta: error.meta, tenantId: req.tenantId },
      'Create inscription avec eleve error'
    );
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const update = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;
    const {
      classeId, statut, decisionFinAnnee, niveauCibleId, classeCibleId, motifDecision, resultatExamenId,
    } = req.body;

    const existing = await prisma.inscription.findFirst({ where: { id, tenantId } });
    if (!existing) {
      return res.status(404).json({ error: 'Inscription non trouvée' });
    }

    const data = {};
    if (classeId !== undefined) data.classeId = classeId;
    if (statut !== undefined) data.statut = statut;
    if (decisionFinAnnee !== undefined) data.decisionFinAnnee = decisionFinAnnee;
    if (niveauCibleId !== undefined) data.niveauCibleId = niveauCibleId || null;
    if (classeCibleId !== undefined) data.classeCibleId = classeCibleId || null;
    if (motifDecision !== undefined) data.motifDecision = motifDecision || null;
    if (resultatExamenId !== undefined) data.resultatExamenId = resultatExamenId || null;

    const inscription = await prisma.inscription.update({
      where: { id },
      data,
      include: {
        niveauCible: true,
        classeCible: true,
        resultatExamen: true,
      },
    });

    await logAudit(req, 'inscription_updated', 'Inscription', inscription.id, { statut, decisionFinAnnee });

    res.json(inscription);
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId, id: req.params.id }, 'Update inscription error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Décision de fin d'année + génération inscription N+1 si passage/redoublement
 */
export const decideFinAnnee = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;
    const {
      decisionFinAnnee,
      niveauCibleId,
      classeCibleId,
      motifDecision,
      resultatExamenId,
      anneeCibleId,
      genererInscription = true,
    } = req.body;

    if (!decisionFinAnnee) {
      return res.status(400).json({ error: 'decisionFinAnnee requise' });
    }

    const existing = await prisma.inscription.findFirst({
      where: { id, tenantId },
      include: {
        classe: { include: { niveauOfficiel: true } },
        eleve: true,
      },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Inscription non trouvée' });
    }

    let resolvedNiveauCibleId = niveauCibleId || null;
    let resolvedClasseCibleId = classeCibleId || null;

    // Auto-resolve next niveau on passage
    if (decisionFinAnnee === 'passage' && !resolvedNiveauCibleId && existing.classe?.niveauOfficiel) {
      const { PASSAGE_NIVEAU } = await import('../data/referentielCongo.js');
      const nextCode = PASSAGE_NIVEAU[existing.classe.niveauOfficiel.code];
      if (nextCode) {
        const next = await prisma.niveauOfficiel.findFirst({
          where: {
            tenantId,
            referentielVersionId: existing.classe.niveauOfficiel.referentielVersionId,
            code: nextCode,
          },
        });
        resolvedNiveauCibleId = next?.id || null;
      }
    }

    if (decisionFinAnnee === 'redoublement' && !resolvedNiveauCibleId) {
      resolvedNiveauCibleId = existing.classe?.niveauOfficielId || null;
    }

    const updated = await prisma.inscription.update({
      where: { id },
      data: {
        decisionFinAnnee,
        niveauCibleId: resolvedNiveauCibleId,
        classeCibleId: resolvedClasseCibleId,
        motifDecision: motifDecision || null,
        resultatExamenId: resultatExamenId || null,
      },
      include: {
        niveauCible: true,
        classeCible: true,
        resultatExamen: true,
      },
    });

    let nouvelleInscription = null;
    if (
      genererInscription
      && resolvedClasseCibleId
      && anneeCibleId
      && ['passage', 'redoublement', 'orientation'].includes(decisionFinAnnee)
    ) {
      const anneeCible = await prisma.anneeScolaire.findFirst({
        where: { id: anneeCibleId, tenantId },
      });
      const classeCible = await prisma.classe.findFirst({
        where: { id: resolvedClasseCibleId, tenantId, anneeScolaireId: anneeCibleId },
      });

      if (anneeCible && classeCible) {
        const already = await prisma.inscription.findFirst({
          where: {
            tenantId,
            anneeScolaireId: anneeCibleId,
            eleveId: existing.eleveId,
          },
        });
        if (!already) {
          const { fraisScolarite, fraisInscription } = await resolveFees(tenantId, classeCible.id);
          nouvelleInscription = await prisma.$transaction(async (tx) => {
            const insc = await tx.inscription.create({
              data: {
                tenantId,
                eleveId: existing.eleveId,
                classeId: classeCible.id,
                anneeScolaireId: anneeCibleId,
                statut: 'en_attente',
                soldeScolarite: fraisInscription + fraisScolarite,
              },
            });
            await generateForInscription(tx, insc, {
              fraisInscription,
              fraisScolarite,
            });
            return tx.inscription.findUnique({
              where: { id: insc.id },
              include: { echeances: true },
            });
          });
        } else {
          nouvelleInscription = already;
        }
      }
    }

    await logAudit(req, 'decision_fin_annee', 'Inscription', id, {
      decisionFinAnnee,
      niveauCibleId: resolvedNiveauCibleId,
      classeCibleId: resolvedClasseCibleId,
      nouvelleInscriptionId: nouvelleInscription?.id,
    });

    res.json({ inscription: updated, nouvelleInscription });
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId }, 'decideFinAnnee error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const validate = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;

    const existing = await prisma.inscription.findFirst({
      where: { id, tenantId },
      include: { echeances: true, classe: true },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Inscription non trouvée' });
    }

    const { fraisScolarite, fraisInscription } = await resolveFees(tenantId, existing.classeId);

    const inscription = await prisma.$transaction(async (tx) => {
      const insc = await tx.inscription.update({
        where: { id },
        data: { statut: 'validee' },
      });
      if (!existing.echeances?.length) {
        await generateForInscription(tx, insc, {
          fraisInscription,
          fraisScolarite: Number(existing.classe?.fraisScolarite ?? fraisScolarite),
        });
      }
      return tx.inscription.findUnique({
        where: { id },
        include: { echeances: true },
      });
    });

    await logAudit(req, 'inscription_validated', 'Inscription', id, { eleveId: existing.eleveId });

    res.json(inscription);
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId, id: req.params.id }, 'Validate inscription error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const remove = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;

    const existing = await prisma.inscription.findFirst({ where: { id, tenantId } });
    if (!existing) {
      return res.status(404).json({ error: 'Inscription non trouvée' });
    }

    await prisma.inscription.update({
      where: { id },
      data: { statut: 'annulee' },
    });

    await logAudit(req, 'inscription_cancelled', 'Inscription', id, { eleveId: existing.eleveId });

    res.json({ message: 'Inscription annulée' });
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId, id: req.params.id }, 'Delete inscription error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Élèves de l'année source éligibles à la réinscription sur l'année active (ou cible).
 */
export const eligiblesReinscription = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    let { anneeSourceId, anneeCibleId } = req.query;

    const anneeActive = await getAnneeOperationnelle(tenantId);
    if (!anneeCibleId) anneeCibleId = anneeActive?.id;
    if (!anneeCibleId) {
      return res.status(400).json({ error: 'Aucune année active pour la réinscription' });
    }

    if (!anneeSourceId) {
      const archivee = await prisma.anneeScolaire.findFirst({
        where: { tenantId, statut: 'archivee', id: { not: anneeCibleId } },
        orderBy: { dateFin: 'desc' },
      });
      anneeSourceId = archivee?.id;
    }
    if (!anneeSourceId) {
      return res.status(400).json({ error: 'Aucune année source (archivée) trouvée' });
    }

    const [sources, dejaInscrits, classesCibles] = await Promise.all([
      prisma.inscription.findMany({
        where: {
          tenantId,
          anneeScolaireId: anneeSourceId,
          statut: { in: ['validee', 'en_attente'] },
        },
        include: {
          eleve: { select: { id: true, matricule: true, nom: true, prenom: true, sexe: true } },
          classe: {
            include: {
              niveauOfficiel: { select: { id: true, code: true, libelle: true, referentielVersionId: true } },
            },
          },
        },
        orderBy: [{ classe: { nom: 'asc' } }, { eleve: { nom: 'asc' } }],
      }),
      prisma.inscription.findMany({
        where: { tenantId, anneeScolaireId: anneeCibleId },
        select: { eleveId: true },
      }),
      prisma.classe.findMany({
        where: { tenantId, anneeScolaireId: anneeCibleId },
        select: {
          id: true,
          nom: true,
          niveau: true,
          cycle: true,
          niveauOfficielId: true,
          fraisScolarite: true,
        },
        orderBy: { nom: 'asc' },
      }),
    ]);

    const dejaSet = new Set(dejaInscrits.map((i) => i.eleveId));
    const { PASSAGE_NIVEAU } = await import('../data/referentielCongo.js');

    const data = sources.map((insc) => {
      const deja = dejaSet.has(insc.eleveId);
      let suggestedDecision = insc.decisionFinAnnee || 'passage';
      let suggestedClasseId = null;

      // Homonyme par nom de classe
      const sameName = classesCibles.find((c) => c.nom === insc.classe?.nom);
      if (suggestedDecision === 'redoublement') {
        suggestedClasseId = sameName?.id || null;
      } else if (suggestedDecision === 'passage' || !insc.decisionFinAnnee) {
        const nextCode = insc.classe?.niveauOfficiel
          ? PASSAGE_NIVEAU[insc.classe.niveauOfficiel.code]
          : null;
        if (nextCode) {
          const next = classesCibles.find((c) => c.niveau === nextCode || c.nom.startsWith(nextCode));
          suggestedClasseId = next?.id || sameName?.id || null;
        } else {
          suggestedClasseId = sameName?.id || null;
        }
      }

      return {
        inscriptionSourceId: insc.id,
        eleve: insc.eleve,
        classeSource: insc.classe,
        decisionExistante: insc.decisionFinAnnee,
        suggestedDecision,
        suggestedClasseId,
        dejaInscrit: deja,
      };
    });

    res.json({
      data,
      anneeSourceId,
      anneeCibleId,
      classesCibles,
    });
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId }, 'eligiblesReinscription error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Lot de réinscription : décisions + inscriptions N+1.
 * Body: { anneeCibleId, items: [{ inscriptionSourceId, decisionFinAnnee, classeCibleId, motifDecision? }] }
 */
export const reinscriptionLot = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { items } = req.body;
    let { anneeCibleId } = req.body;

    if (!Array.isArray(items) || !items.length) {
      return res.status(400).json({ error: 'items[] requis' });
    }

    const anneeActive = await getAnneeOperationnelle(tenantId);
    if (!anneeCibleId) anneeCibleId = anneeActive?.id;
    const anneeCible = await prisma.anneeScolaire.findFirst({
      where: { id: anneeCibleId, tenantId },
    });
    if (!anneeCible) {
      return res.status(404).json({ error: 'Année cible introuvable' });
    }
    if (anneeCible.statut === 'archivee') {
      return res.status(403).json({ error: 'Impossible de réinscrire sur une année archivée' });
    }

    const result = { created: 0, skipped: 0, decisionsOnly: 0, errors: [] };

    for (const item of items) {
      try {
        const {
          inscriptionSourceId,
          decisionFinAnnee,
          classeCibleId,
          motifDecision,
        } = item;

        if (!inscriptionSourceId || !decisionFinAnnee) {
          result.errors.push({ inscriptionSourceId, error: 'Champs manquants' });
          continue;
        }

        const existing = await prisma.inscription.findFirst({
          where: { id: inscriptionSourceId, tenantId },
          include: {
            classe: { include: { niveauOfficiel: true } },
            eleve: true,
          },
        });
        if (!existing) {
          result.errors.push({ inscriptionSourceId, error: 'Inscription source introuvable' });
          continue;
        }

        let resolvedNiveauCibleId = null;
        if (decisionFinAnnee === 'passage' && existing.classe?.niveauOfficiel) {
          const { PASSAGE_NIVEAU } = await import('../data/referentielCongo.js');
          const nextCode = PASSAGE_NIVEAU[existing.classe.niveauOfficiel.code];
          if (nextCode) {
            const next = await prisma.niveauOfficiel.findFirst({
              where: {
                tenantId,
                referentielVersionId: existing.classe.niveauOfficiel.referentielVersionId,
                code: nextCode,
              },
            });
            resolvedNiveauCibleId = next?.id || null;
          }
        }
        if (decisionFinAnnee === 'redoublement') {
          resolvedNiveauCibleId = existing.classe?.niveauOfficielId || null;
        }

        await prisma.inscription.update({
          where: { id: existing.id },
          data: {
            decisionFinAnnee,
            niveauCibleId: resolvedNiveauCibleId,
            classeCibleId: classeCibleId || null,
            motifDecision: motifDecision || null,
          },
        });

        if (decisionFinAnnee === 'exclusion') {
          result.decisionsOnly += 1;
          continue;
        }

        if (!classeCibleId || !['passage', 'redoublement', 'orientation'].includes(decisionFinAnnee)) {
          result.decisionsOnly += 1;
          continue;
        }

        const already = await prisma.inscription.findFirst({
          where: {
            tenantId,
            anneeScolaireId: anneeCibleId,
            eleveId: existing.eleveId,
          },
        });
        if (already) {
          result.skipped += 1;
          continue;
        }

        const classeCible = await prisma.classe.findFirst({
          where: { id: classeCibleId, tenantId, anneeScolaireId: anneeCibleId },
        });
        if (!classeCible) {
          result.errors.push({ inscriptionSourceId, error: 'Classe cible invalide' });
          continue;
        }

        const { fraisScolarite, fraisInscription } = await resolveFees(tenantId, classeCible.id);
        await prisma.$transaction(async (tx) => {
          const insc = await tx.inscription.create({
            data: {
              tenantId,
              eleveId: existing.eleveId,
              classeId: classeCible.id,
              anneeScolaireId: anneeCibleId,
              statut: 'validee',
              soldeScolarite: fraisInscription + fraisScolarite,
            },
          });
          await generateForInscription(tx, insc, { fraisInscription, fraisScolarite });
        });
        result.created += 1;
      } catch (itemErr) {
        result.errors.push({
          inscriptionSourceId: item?.inscriptionSourceId,
          error: itemErr.message || 'Erreur',
        });
      }
    }

    await logAudit(req, 'reinscription_lot', 'Inscription', anneeCibleId, result);
    res.json(result);
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId }, 'reinscriptionLot error');
    res.status(500).json({ error: 'Internal server error' });
  }
};
