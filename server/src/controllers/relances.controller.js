import { prisma } from '../utils/prisma.js';
import { createLogger } from '../utils/logger.js';
import { logAudit } from '../utils/auditLogger.js';
import { sendSms } from '../services/sms.service.js';
import { sendWhatsApp } from '../services/whatsapp.service.js';
import { formatMontant, formatDateFr } from '../services/pdf/pdfHelpers.js';

const log = createLogger('RelancesController');

const THROTTLE_HOURS = 24;

/**
 * Vérifie si une relance similaire a déjà été envoyée dans les dernières 24 heures pour cet élève.
 */
async function isThrottled(tenantId, eleveId, type) {
  const since = new Date(Date.now() - THROTTLE_HOURS * 60 * 60 * 1000);
  const existing = await prisma.relanceLog.findFirst({
    where: {
      tenantId,
      eleveId,
      type,
      createdAt: { gte: since },
      statut: { in: ['envoye', 'simule'] },
    },
  });
  return !!existing;
}

/**
 * Envoie un message via le canal spécifié ('sms' ou 'whatsapp')
 */
async function dispatchMessage({ canal, to, message, senderName }) {
  if (canal === 'whatsapp') {
    return await sendWhatsApp({ to, message });
  }
  return await sendSms({ to, message, sender: senderName });
}

/**
 * POST /api/relances/paiements
 * Relance automatique des échéances impayées / en retard.
 */
export const relancerPaiements = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { classeId, canal = 'sms', force = false } = req.body;

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { config: true },
    });
    const schoolName = tenant?.config?.nomEcole || tenant?.nom || 'GestSchool';

    // Récupérer les échéances échues ou en attente
    const now = new Date();
    const echeancesWhere = {
      tenantId,
      statut: 'en_attente',
      dateEcheance: { lte: now },
      inscription: {
        anneeScolaire: { actif: true },
        ...(classeId ? { classeId } : {}),
      },
    };

    const echeances = await prisma.echeance.findMany({
      where: echeancesWhere,
      include: {
        inscription: {
          include: {
            eleve: {
              include: {
                parent: { select: { id: true, telephone: true, nom: true, prenom: true } },
              },
            },
            classe: { select: { id: true, nom: true } },
          },
        },
      },
      orderBy: { dateEcheance: 'asc' },
    });

    let envoyes = 0;
    let ignores = 0;
    let echecs = 0;
    const logs = [];

    for (const ech of echeances) {
      const eleve = ech.inscription?.eleve;
      const classe = ech.inscription?.classe;
      const parentTel = eleve?.parent?.telephone;

      if (!eleve || !parentTel) {
        ignores++;
        continue;
      }

      // Respecter le throttle anti-spam (max 1 relance / 24h par élève) sauf si force=true
      if (!force && (await isThrottled(tenantId, eleve.id, 'paiement'))) {
        ignores++;
        continue;
      }

      const resteAPayer = Number(ech.montantAttendu) - Number(ech.montantPaye || 0);
      const montantStr = formatMontant(resteAPayer);
      const dateLimite = formatDateFr(ech.dateEcheance);

      const message = `${schoolName} : Rappel solde de ${eleve.prenom} ${eleve.nom} (${classe?.nom || ''}). Reliquat attendu de ${montantStr} (${ech.libelle}) échu le ${dateLimite}. Merci de régulariser.`;

      const result = await dispatchMessage({
        canal,
        to: parentTel,
        message,
        senderName: schoolName,
      });

      const statut = result.success ? (result.provider === 'simulateur' ? 'simule' : 'envoye') : 'echec';
      if (result.success) envoyes++;
      else echecs++;

      await prisma.relanceLog.create({
        data: {
          tenantId,
          eleveId: eleve.id,
          parentTel,
          type: 'paiement',
          canal,
          statut,
          message,
          provider: result.provider,
        },
      });

      await prisma.echeance.update({
        where: { id: ech.id },
        data: { lastRelanceAt: new Date() },
      });

      logs.push({
        eleve: `${eleve.prenom} ${eleve.nom}`,
        classe: classe?.nom,
        parentTel,
        statut,
        provider: result.provider,
      });
    }

    await logAudit(req, 'relance_paiements_executed', 'RelanceLog', tenantId, {
      total: echeances.length,
      envoyes,
      ignores,
      echecs,
      canal,
    });

    res.json({
      message: `Relances paiements terminées : ${envoyes} envoyée(s), ${ignores} ignorée(s), ${echecs} échec(s)`,
      totalEcheances: echeances.length,
      envoyes,
      ignores,
      echecs,
      details: logs,
    });
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId }, 'Relance paiements error');
    res.status(500).json({ error: 'Erreur lors de la relance des paiements' });
  }
};

/**
 * POST /api/relances/absences
 * Alerte SMS/WhatsApp pour les absences non justifiées de la semaine.
 */
export const relancerAbsences = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { classeId, nbJours = 7, canal = 'sms', force = false } = req.body;

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { config: true },
    });
    const schoolName = tenant?.config?.nomEcole || tenant?.nom || 'GestSchool';

    const dateDebut = new Date(Date.now() - parseInt(nbJours) * 24 * 60 * 60 * 1000);

    const absences = await prisma.absence.findMany({
      where: {
        tenantId,
        justifiee: false,
        dateAbsence: { gte: dateDebut },
        eleve: {
          inscriptions: {
            some: {
              anneeScolaire: { actif: true },
              ...(classeId ? { classeId } : {}),
            },
          },
        },
      },
      include: {
        eleve: {
          include: {
            parent: { select: { id: true, telephone: true, nom: true, prenom: true } },
            inscriptions: {
              where: { anneeScolaire: { actif: true } },
              include: { classe: { select: { nom: true } } },
              take: 1,
            },
          },
        },
      },
    });

    // Agréger le décompte par élève
    const elevesMap = new Map();
    for (const abs of absences) {
      const eid = abs.eleveId;
      if (!elevesMap.has(eid)) {
        elevesMap.set(eid, {
          eleve: abs.eleve,
          count: 0,
        });
      }
      elevesMap.get(eid).count++;
    }

    let envoyes = 0;
    let ignores = 0;
    let echecs = 0;
    const logs = [];

    for (const [eleveId, { eleve, count }] of elevesMap.entries()) {
      const parentTel = eleve.parent?.telephone;
      const classeNom = eleve.inscriptions?.[0]?.classe?.nom || '';

      if (!parentTel) {
        ignores++;
        continue;
      }

      if (!force && (await isThrottled(tenantId, eleveId, 'absence'))) {
        ignores++;
        continue;
      }

      const message = `${schoolName} - Vie Scolaire : Votre enfant ${eleve.prenom} ${eleve.nom} (${classeNom}) cumule ${count} absence(s) non justifiée(s) sur les 7 derniers jours. Merci de contacter l'établissement.`;

      const result = await dispatchMessage({
        canal,
        to: parentTel,
        message,
        senderName: schoolName,
      });

      const statut = result.success ? (result.provider === 'simulateur' ? 'simule' : 'envoye') : 'echec';
      if (result.success) envoyes++;
      else echecs++;

      await prisma.relanceLog.create({
        data: {
          tenantId,
          eleveId,
          parentTel,
          type: 'absence',
          canal,
          statut,
          message,
          provider: result.provider,
        },
      });

      logs.push({
        eleve: `${eleve.prenom} ${eleve.nom}`,
        classe: classeNom,
        parentTel,
        absencesNonJustifiees: count,
        statut,
        provider: result.provider,
      });
    }

    await logAudit(req, 'relance_absences_executed', 'RelanceLog', tenantId, {
      totalElevesConcernes: elevesMap.size,
      envoyes,
      ignores,
      echecs,
      canal,
    });

    res.json({
      message: `Relances absences terminées : ${envoyes} envoyée(s), ${ignores} ignorée(s), ${echecs} échec(s)`,
      totalElevesConcernes: elevesMap.size,
      envoyes,
      ignores,
      echecs,
      details: logs,
    });
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId }, 'Relance absences error');
    res.status(500).json({ error: 'Erreur lors de la relance des absences' });
  }
};

/**
 * POST /api/relances/bulletins
 * Notification aux parents lors de la publication d'un bulletin.
 */
export const relancerBulletins = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { classeId, periodeIndex, canal = 'sms', force = false } = req.body;

    if (!classeId || periodeIndex === undefined) {
      return res.status(400).json({ error: 'classeId et periodeIndex sont obligatoires' });
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { config: true },
    });
    const schoolName = tenant?.config?.nomEcole || tenant?.nom || 'GestSchool';

    const bulletins = await prisma.bulletin.findMany({
      where: {
        tenantId,
        classeId,
        periodeIndex: parseInt(periodeIndex),
        valide: true,
      },
      include: {
        eleve: {
          include: {
            parent: { select: { id: true, telephone: true, nom: true, prenom: true } },
          },
        },
        classe: { select: { nom: true } },
      },
    });

    let envoyes = 0;
    let ignores = 0;
    let echecs = 0;
    const logs = [];

    for (const b of bulletins) {
      const eleve = b.eleve;
      const parentTel = eleve?.parent?.telephone;

      if (!eleve || !parentTel) {
        ignores++;
        continue;
      }

      if (!force && (await isThrottled(tenantId, eleve.id, 'bulletin'))) {
        ignores++;
        continue;
      }

      const periodeLibelle = `Période ${periodeIndex}`;
      const message = `${schoolName} : Le bulletin officiel (${periodeLibelle}) de ${eleve.prenom} ${eleve.nom} (${b.classe?.nom}) est disponible. Scannez sa carte scolaire QR Code pour le consulter.`;

      const result = await dispatchMessage({
        canal,
        to: parentTel,
        message,
        senderName: schoolName,
      });

      const statut = result.success ? (result.provider === 'simulateur' ? 'simule' : 'envoye') : 'echec';
      if (result.success) envoyes++;
      else echecs++;

      await prisma.relanceLog.create({
        data: {
          tenantId,
          eleveId: eleve.id,
          parentTel,
          type: 'bulletin',
          canal,
          statut,
          message,
          provider: result.provider,
        },
      });

      logs.push({
        eleve: `${eleve.prenom} ${eleve.nom}`,
        parentTel,
        statut,
        provider: result.provider,
      });
    }

    await logAudit(req, 'relance_bulletins_executed', 'RelanceLog', tenantId, {
      classeId,
      periodeIndex,
      envoyes,
      ignores,
      echecs,
      canal,
    });

    res.json({
      message: `Notifications bulletins envoyées : ${envoyes} succès, ${ignores} ignoré(s), ${echecs} échec(s)`,
      envoyes,
      ignores,
      echecs,
      details: logs,
    });
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId }, 'Relance bulletins error');
    res.status(500).json({ error: 'Erreur lors de la notification des bulletins' });
  }
};

/**
 * GET /api/relances/historique
 * Journal paginé des relances envoyées.
 */
export const getHistorique = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { page = 1, limit = 20, type, canal, statut, search } = req.query;

    const take = parseInt(limit);
    const skip = (parseInt(page) - 1) * take;

    const where = { tenantId };
    if (type) where.type = type;
    if (canal) where.canal = canal;
    if (statut) where.statut = statut;
    if (search) {
      where.OR = [
        { parentTel: { contains: search } },
        { message: { contains: search, mode: 'insensitive' } },
        { eleve: { nom: { contains: search, mode: 'insensitive' } } },
        { eleve: { prenom: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [rows, total] = await Promise.all([
      prisma.relanceLog.findMany({
        where,
        include: {
          eleve: {
            select: {
              id: true,
              matricule: true,
              nom: true,
              prenom: true,
              inscriptions: {
                where: { anneeScolaire: { actif: true } },
                include: { classe: { select: { nom: true } } },
                take: 1,
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.relanceLog.count({ where }),
    ]);

    res.json({
      data: rows,
      pagination: {
        page: parseInt(page),
        limit: take,
        total,
        totalPages: Math.ceil(total / take) || 1,
      },
    });
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId }, 'Get historique relances error');
    res.status(500).json({ error: 'Internal server error' });
  }
};
