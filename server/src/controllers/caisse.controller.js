/**
 * caisse.controller.js
 *
 * Forteresse de caisse GestSchool :
 *   - Gestion des sessions journalières de caisse (ouverture / clôture / billetterie physique).
 *   - Contrôle strict des écarts théorique vs réel avec justification obligatoire.
 *   - Journal d'audit immuable des annulations de paiements (Append-Only Ledger anti-fraude).
 */

import { prisma } from '../utils/prisma.js';
import { createLogger } from '../utils/logger.js';
import { logAudit } from '../utils/auditLogger.js';
import { syncInscriptionSolde } from '../services/echeances.service.js';

const log = createLogger('CaisseController');

// ─── Billetterie Helper ───────────────────────────────────────────────────────

/**
 * Calcule le montant total physique à partir du décompte des coupures en FCFA.
 * @param {Record<string, number>} billetterie Ex: { "10000": 5, "5000": 2, "2000": 3, "1000": 10, "500": 4 }
 * @returns {number}
 */
export function calculerTotalBilletterie(billetterie) {
  if (!billetterie || typeof billetterie !== 'object') return 0;
  return Object.entries(billetterie).reduce((sum, [valeurStr, quantite]) => {
    const coupure = parseFloat(valeurStr);
    const qte = parseInt(quantite, 10);
    if (!isNaN(coupure) && !isNaN(qte) && qte > 0) {
      return sum + coupure * qte;
    }
    return sum;
  }, 0);
}

// ─── 1. Ouvrir une Session de Caisse ──────────────────────────────────────────

export const ouvrirSession = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const caissierId = req.user.id;
    const { fondDeCaisse = 0 } = req.body;

    const fond = parseFloat(fondDeCaisse);
    if (isNaN(fond) || fond < 0) {
      return res.status(400).json({ error: 'Le montant du fond de caisse initial doit être un nombre positif ou nul.' });
    }

    // Vérifier si une session est déjà ouverte pour ce caissier
    const sessionExistante = await prisma.caisseSession.findFirst({
      where: {
        tenantId,
        caissierId,
        statut: 'ouverte',
      },
    });

    if (sessionExistante) {
      return res.status(400).json({
        error: 'Une session de caisse est déjà ouverte pour ce caissier. Veuillez clôturer la session active avant d\'en ouvrir une nouvelle.',
        sessionId: sessionExistante.id,
      });
    }

    const session = await prisma.caisseSession.create({
      data: {
        tenantId,
        caissierId,
        statut: 'ouverte',
        fondDeCaisse: fond,
        montantTheorique: fond,
      },
      include: {
        caissier: { select: { id: true, nom: true, prenom: true, email: true } },
      },
    });

    await logAudit(req, 'caisse_session_ouverte', 'CaisseSession', session.id, {
      caissierId,
      fondDeCaisse: fond,
    });

    res.status(201).json({
      message: 'Session de caisse ouverte avec succès.',
      data: session,
    });
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId }, 'Erreur ouverture session caisse');
    res.status(500).json({ error: 'Erreur lors de l\'ouverture de la session de caisse.' });
  }
};

// ─── 2. Obtenir la Session Courante avec Totaux Temps Réel ────────────────────

export const getSessionCourante = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const caissierId = req.query.caissierId || req.user.id;

    const session = await prisma.caisseSession.findFirst({
      where: {
        tenantId,
        caissierId,
        statut: 'ouverte',
      },
      include: {
        caissier: { select: { id: true, nom: true, prenom: true, email: true } },
      },
    });

    if (!session) {
      return res.json({ data: null, message: 'Aucune session de caisse active.' });
    }

    // Calculer les paiements enregistrés pour cette session
    const paiements = await prisma.paiement.findMany({
      where: {
        tenantId,
        OR: [
          { caisseSessionId: session.id },
          {
            recuParId: caissierId,
            datePaiement: { gte: session.dateOuverture },
            caisseSessionId: null,
          },
        ],
      },
      select: {
        id: true,
        montant: true,
        modePaiement: true,
        typePaiement: true,
        numeroRecu: true,
        datePaiement: true,
      },
    });

    let totalEspeces = 0;
    let totalMobileMoney = 0;
    let totalAutres = 0;

    for (const p of paiements) {
      const montant = Number(p.montant);
      if (p.modePaiement === 'especes') {
        totalEspeces += montant;
      } else if (p.modePaiement === 'mobile_money') {
        totalMobileMoney += montant;
      } else {
        totalAutres += montant;
      }
    }

    const fond = Number(session.fondDeCaisse);
    const totalEncaisse = totalEspeces + totalMobileMoney + totalAutres;
    const montantTheoriqueEspeces = fond + totalEspeces;

    res.json({
      data: {
        ...session,
        nombrePaiements: paiements.length,
        totalEncaisse,
        totalEspeces,
        totalMobileMoney,
        totalAutres,
        montantTheoriqueEspeces, // Le montant physique en espèces attendu
        fondDeCaisse: fond,
      },
    });
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId }, 'Erreur consultation session courante');
    res.status(500).json({ error: 'Erreur lors de la récupération de la session courante.' });
  }
};

// ─── 3. Clôturer une Session de Caisse (avec Billetterie) ──────────────────────

export const cloturerSession = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { id } = req.params;
    const { billetterie, montantReel: montantSaisi, justificationEcart, notesCloture } = req.body;

    const session = await prisma.caisseSession.findFirst({
      where: { id, tenantId, statut: 'ouverte' },
    });

    if (!session) {
      return res.status(404).json({ error: 'Session de caisse introuvable ou déjà clôturée.' });
    }

    // Récupérer tous les paiements liés
    const paiements = await prisma.paiement.findMany({
      where: {
        tenantId,
        OR: [
          { caisseSessionId: session.id },
          {
            recuParId: session.caissierId,
            datePaiement: { gte: session.dateOuverture },
            caisseSessionId: null,
          },
        ],
      },
    });

    // Lier explicitement les paiements non encore taggués à cette session
    const unlinkedIds = paiements.filter((p) => !p.caisseSessionId).map((p) => p.id);
    if (unlinkedIds.length > 0) {
      await prisma.paiement.updateMany({
        where: { id: { in: unlinkedIds } },
        data: { caisseSessionId: session.id },
      });
    }

    let totalEspeces = 0;
    let totalGeneral = 0;
    for (const p of paiements) {
      const m = Number(p.montant);
      totalGeneral += m;
      if (p.modePaiement === 'especes') {
        totalEspeces += m;
      }
    }

    const fond = Number(session.fondDeCaisse);
    const montantTheoriqueEspeces = fond + totalEspeces;

    // Déterminer le montant physique réel compté (via billetterie prioritaire)
    let montantReel = 0;
    if (billetterie && typeof billetterie === 'object' && Object.keys(billetterie).length > 0) {
      montantReel = calculerTotalBilletterie(billetterie);
    } else if (montantSaisi != null) {
      montantReel = parseFloat(montantSaisi);
    } else {
      return res.status(400).json({ error: 'Veuillez renseigner le décompte de billetterie ou le montant réel compté.' });
    }

    const ecart = Math.round((montantReel - montantTheoriqueEspeces) * 100) / 100;

    // Règle d'or : Si écart !== 0, la justification écrite est impérative
    if (ecart !== 0 && (!justificationEcart || justificationEcart.trim().length < 5)) {
      return res.status(400).json({
        error: `Un écart de caisse de ${ecart} FCFA a été détecté (Théorique: ${montantTheoriqueEspeces}, Réel: ${montantReel}). Une justification écrite détaillée (au moins 5 caractères) est obligatoire.`,
        montantTheorique: montantTheoriqueEspeces,
        montantReel,
        ecart,
      });
    }

    const sessionCloturee = await prisma.caisseSession.update({
      where: { id },
      data: {
        statut: 'fermee',
        dateCloture: new Date(),
        montantTheorique: montantTheoriqueEspeces,
        montantReel,
        ecart,
        justificationEcart: ecart !== 0 ? justificationEcart.trim() : null,
        billetterie: billetterie || null,
        nombrePaiements: paiements.length,
        totalEncaisse: totalGeneral,
        notesCloture: notesCloture || null,
      },
      include: {
        caissier: { select: { id: true, nom: true, prenom: true } },
      },
    });

    await logAudit(req, 'caisse_session_cloturee', 'CaisseSession', session.id, {
      montantTheorique: montantTheoriqueEspeces,
      montantReel,
      ecart,
      nombrePaiements: paiements.length,
    });

    res.json({
      message: 'Session de caisse clôturée avec succès.',
      data: sessionCloturee,
    });
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId }, 'Erreur clôture session caisse');
    res.status(500).json({ error: 'Erreur lors de la clôture de la session de caisse.' });
  }
};

// ─── 4. Historique des Sessions de Caisse ─────────────────────────────────────

export const getSessions = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { statut, caissierId, page = 1, limit = 20 } = req.query;

    const where = { tenantId };
    if (statut) where.statut = statut;
    if (caissierId) where.caissierId = caissierId;

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const take = parseInt(limit, 10);

    const [total, sessions] = await Promise.all([
      prisma.caisseSession.count({ where }),
      prisma.caisseSession.findMany({
        where,
        skip,
        take,
        orderBy: { dateOuverture: 'desc' },
        include: {
          caissier: { select: { id: true, nom: true, prenom: true, email: true } },
        },
      }),
    ]);

    res.json({
      data: sessions,
      pagination: {
        total,
        page: parseInt(page, 10),
        limit: take,
        pages: Math.ceil(total / take),
      },
    });
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId }, 'Erreur historique sessions caisse');
    res.status(500).json({ error: 'Erreur lors de la récupération des sessions de caisse.' });
  }
};

// ─── 5. Forteresse Anti-Fraude : Annulation Immuable de Paiement ──────────────

export const annulerPaiement = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { id: paiementId } = req.params;
    const { motif, autorisePar } = req.body;

    if (!motif || motif.trim().length < 8) {
      return res.status(400).json({ error: 'Le motif d\'annulation détaillé est obligatoire (au moins 8 caractères).' });
    }

    // Récupérer le paiement avec toutes ses liaisons
    const paiement = await prisma.paiement.findFirst({
      where: { id: paiementId, tenantId },
      include: {
        inscription: true,
        echeance: true,
        recuPar: { select: { id: true, nom: true, prenom: true } },
      },
    });

    if (!paiement) {
      return res.status(404).json({ error: 'Paiement introuvable.' });
    }

    // Vérifier si ce paiement a déjà été annulé
    const dejaAnnule = await prisma.paiementAnnulation.findFirst({
      where: { tenantId, paiementId },
    });
    if (dejaAnnule) {
      return res.status(400).json({
        error: 'Ce paiement a déjà été annulé.',
        annulationId: dejaAnnule.id,
        dateAnnulation: dejaAnnule.createdAt,
      });
    }

    // Transaction atomique :
    // 1. Journalisation Append-Only dans PaiementAnnulation
    // 2. Annulation de l'allocation d'échéance
    // 3. Suppression du paiement
    // 4. Synchronisation du solde de l'inscription
    const result = await prisma.$transaction(async (tx) => {
      // 1. Enregistrement immuable de l'annulation avec snapshot complet
      const annulation = await tx.paiementAnnulation.create({
        data: {
          tenantId,
          paiementId,
          montantAnnule: paiement.montant,
          numeroRecuRef: paiement.numeroRecu,
          motif: motif.trim(),
          annulePar: req.user.id,
          autorisePar: autorisePar || req.user.id,
          snapshotPaiement: paiement,
        },
      });

      // 2. Si le paiement était rattaché à une échéance, restaurer le solde de l'échéance
      if (paiement.echeanceId) {
        const echeance = await tx.echeance.findUnique({ where: { id: paiement.echeanceId } });
        if (echeance) {
          const nouveauPaye = Math.max(0, Number(echeance.montantPaye) - Number(paiement.montant));
          const nouveauSolde = nouveauPaye >= Number(echeance.montant) - 0.01;
          await tx.echeance.update({
            where: { id: paiement.echeanceId },
            data: {
              montantPaye: nouveauPaye,
              solde: nouveauSolde,
            },
          });
        }
      }

      // 3. Suppression du paiement
      await tx.paiement.delete({
        where: { id: paiementId },
      });

      // 4. Recalcul et resynchronisation du solde global de l'élève
      await syncInscriptionSolde(tx, tenantId, paiement.inscriptionId);

      return annulation;
    });

    await logAudit(req, 'paiement_annule_forteresse', 'PaiementAnnulation', result.id, {
      paiementId,
      numeroRecu: paiement.numeroRecu,
      montant: Number(paiement.montant),
      motif: motif.trim(),
    });

    res.json({
      message: `Paiement n° ${paiement.numeroRecu} de ${paiement.montant} FCFA annulé avec succès. Journal d'audit forteresse mis à jour.`,
      data: result,
    });
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId, paiementId: req.params.id }, 'Erreur annulation paiement');
    res.status(500).json({ error: 'Erreur lors de l\'annulation du paiement.' });
  }
};

// ─── 6. Consulter le Journal d'Audit des Annulations ───────────────────────────

export const getJournalAnnulations = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { page = 1, limit = 20 } = req.query;

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const take = parseInt(limit, 10);

    const [total, annulations] = await Promise.all([
      prisma.paiementAnnulation.count({ where: { tenantId } }),
      prisma.paiementAnnulation.findMany({
        where: { tenantId },
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    res.json({
      data: annulations,
      pagination: {
        total,
        page: parseInt(page, 10),
        limit: take,
        pages: Math.ceil(total / take),
      },
    });
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId }, 'Erreur journal annulations');
    res.status(500).json({ error: 'Erreur lors de la consultation du journal des annulations.' });
  }
};
