import { prisma } from '../utils/prisma.js';
import { createLogger } from '../utils/logger.js';
import { assertParentOwnsEleve } from '../utils/ownership.js';
import { initSandboxPayment, confirmSandboxPayment } from '../services/momo.sandbox.js';

const log = createLogger('ParentController');

const activeInscriptionInclude = {
  where: { statut: { in: ['validee', 'en_attente'] } },
  include: {
    classe: { select: { id: true, nom: true, niveau: true } },
    anneeScolaire: { select: { id: true, libelle: true, actif: true } },
  },
  orderBy: { createdAt: 'desc' },
  take: 1,
};

const mapEnfantSummary = (eleve) => {
  const insc = eleve.inscriptions?.[0];
  return {
    id: eleve.id,
    prenom: eleve.prenom,
    nom: eleve.nom,
    matricule: eleve.matricule,
    dateNaissance: eleve.dateNaissance,
    classeNom: insc?.classe?.nom || null,
    soldeScolarite: Number(insc?.soldeScolarite ?? 0),
  };
};

export const getDashboard = async (req, res) => {
  try {
    const parentId = req.user.id;
    const tenantId = req.tenantId;

    const enfants = await prisma.eleve.findMany({
      where: { tenantId, parentId, actif: true },
      include: { inscriptions: activeInscriptionInclude },
    });

    const enfantIds = enfants.map((e) => e.id);

    const [absencesNonJust, bulletins, notifications] = await Promise.all([
      enfantIds.length
        ? prisma.absence.count({
            where: { tenantId, eleveId: { in: enfantIds }, justifiee: false },
          })
        : 0,
      enfantIds.length
        ? prisma.bulletin.count({ where: { tenantId, eleveId: { in: enfantIds } } })
        : 0,
      prisma.notification.findMany({
        where: { tenantId, userId: parentId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

    const enfantsDetail = await Promise.all(
      enfants.map(async (e) => {
        const absNj = await prisma.absence.count({
          where: { tenantId, eleveId: e.id, justifiee: false },
        });
        const lastBulletin = await prisma.bulletin.findFirst({
          where: { tenantId, eleveId: e.id },
          orderBy: { createdAt: 'desc' },
        });
        const summary = mapEnfantSummary(e);
        return {
          ...summary,
          moyenneGenerale: lastBulletin ? Number(lastBulletin.moyenneGenerale) : null,
          rang: lastBulletin?.rang ?? null,
          nbAbsencesNonJustifiees: absNj,
        };
      })
    );

    const soldeTotal = enfantsDetail.reduce((s, e) => s + (e.soldeScolarite || 0), 0);

    res.json({
      nbEnfants: enfants.length,
      nbBulletins: bulletins,
      soldeTotal,
      nbAbsencesNonJustifiees: absencesNonJust,
      enfants: enfantsDetail,
      notifications: notifications.map((n) => ({
        id: n.id,
        titre: n.titre,
        message: n.contenu,
        lu: n.lu,
      })),
    });
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId }, 'parent dashboard error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getMesEnfants = async (req, res) => {
  try {
    const enfants = await prisma.eleve.findMany({
      where: { tenantId: req.tenantId, parentId: req.user.id, actif: true },
      include: { inscriptions: activeInscriptionInclude },
      orderBy: [{ nom: 'asc' }, { prenom: 'asc' }],
    });
    res.json(enfants.map(mapEnfantSummary));
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId }, 'mes-enfants error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getEnfantDetail = async (req, res) => {
  try {
    const eleve = await assertParentOwnsEleve(req, res, req.params.id);
    if (!eleve) return;

    const [notes, absences, full] = await Promise.all([
      prisma.note.findMany({
        where: { tenantId: req.tenantId, eleveId: eleve.id },
        include: {
          evaluation: {
            include: { matiere: { select: { nom: true } } },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      prisma.absence.findMany({
        where: { tenantId: req.tenantId, eleveId: eleve.id },
        orderBy: { dateAbsence: 'desc' },
        take: 20,
      }),
      prisma.eleve.findFirst({
        where: { id: eleve.id },
        include: { inscriptions: activeInscriptionInclude },
      }),
    ]);

    res.json({
      ...mapEnfantSummary(full),
      notes: notes.map((n) => ({
        matiereNom: n.evaluation?.matiere?.nom || null,
        evaluation: n.evaluation?.nom || null,
        valeur: Number(n.valeur),
        noteMaximale: Number(n.evaluation?.noteMaximale ?? 20),
      })),
      absences: absences.map((a) => ({
        dateAbsence: a.dateAbsence,
        justifiee: a.justifiee,
      })),
    });
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId }, 'enfant detail error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getEnfantBulletins = async (req, res) => {
  try {
    const eleve = await assertParentOwnsEleve(req, res, req.params.id);
    if (!eleve) return;

    const bulletins = await prisma.bulletin.findMany({
      where: { tenantId: req.tenantId, eleveId: eleve.id, valide: true },
      include: { anneeScolaire: { select: { libelle: true } } },
      orderBy: [{ anneeScolaireId: 'desc' }, { periodeIndex: 'desc' }],
    });

    res.json(
      bulletins.map((b) => ({
        id: b.id,
        anneeScolaireLibelle: b.anneeScolaire?.libelle || null,
        periodeIndex: b.periodeIndex,
        moyenneGenerale: Number(b.moyenneGenerale),
        rang: b.rang,
        mention: b.mention,
        valide: b.valide,
        pdfUrl: b.pdfUrl || null,
      }))
    );
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId }, 'enfant bulletins error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getEnfantEcheances = async (req, res) => {
  try {
    const eleve = await assertParentOwnsEleve(req, res, req.params.id);
    if (!eleve) return;

    const inscriptions = await prisma.inscription.findMany({
      where: { tenantId: req.tenantId, eleveId: eleve.id },
      select: { id: true },
    });
    const ids = inscriptions.map((i) => i.id);
    if (!ids.length) return res.json([]);

    const echeances = await prisma.echeance.findMany({
      where: { tenantId: req.tenantId, inscriptionId: { in: ids } },
      orderBy: { dateEcheance: 'asc' },
    });

    res.json(
      echeances.map((e) => ({
        id: e.id,
        libelle: e.libelle,
        dateEcheance: e.dateEcheance,
        montantAttendu: Number(e.montantAttendu),
        montantPaye: Number(e.montantPaye),
        statut: e.statut,
      }))
    );
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId }, 'enfant echeances error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getEnfantPaiements = async (req, res) => {
  try {
    const eleve = await assertParentOwnsEleve(req, res, req.params.id);
    if (!eleve) return;

    const inscriptions = await prisma.inscription.findMany({
      where: { tenantId: req.tenantId, eleveId: eleve.id },
      select: { id: true },
    });
    const ids = inscriptions.map((i) => i.id);
    if (!ids.length) return res.json([]);

    const paiements = await prisma.paiement.findMany({
      where: { tenantId: req.tenantId, inscriptionId: { in: ids } },
      orderBy: { datePaiement: 'desc' },
    });

    res.json(
      paiements.map((p) => ({
        id: p.id,
        numeroRecu: p.numeroRecu,
        datePaiement: p.datePaiement,
        montant: Number(p.montant),
        modePaiement: p.modePaiement,
        typePaiement: p.typePaiement,
        motif: p.motif,
        pdfUrl: p.pdfUrl || `/api/paiements/${p.id}/recu-pdf`,
      }))
    );
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId }, 'enfant paiements error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const initMomoPayment = async (req, res) => {
  try {
    const eleve = await assertParentOwnsEleve(req, res, req.params.id);
    if (!eleve) return;

    const { echeanceId, montant } = req.body;
    const amount = parseFloat(montant);
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'montant > 0 requis' });
    }

    const inscription = await prisma.inscription.findFirst({
      where: {
        tenantId: req.tenantId,
        eleveId: eleve.id,
        statut: { in: ['validee', 'en_attente'] },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!inscription) {
      return res.status(404).json({ error: 'Aucune inscription trouvée' });
    }

    if (echeanceId) {
      const ech = await prisma.echeance.findFirst({
        where: { id: echeanceId, tenantId: req.tenantId, inscriptionId: inscription.id },
      });
      if (!ech) return res.status(404).json({ error: 'Échéance non trouvée' });
      const reste = Number(ech.montantAttendu) - Number(ech.montantPaye);
      if (amount > reste + 0.01) {
        return res.status(400).json({ error: `Montant supérieur au reste (${reste})` });
      }
    }

    const intent = initSandboxPayment({
      tenantId: req.tenantId,
      parentId: req.user.id,
      eleveId: eleve.id,
      inscriptionId: inscription.id,
      echeanceId: echeanceId || null,
      montant: amount,
      motif: 'Paiement Mobile Money sandbox',
    });

    res.status(201).json(intent);
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId }, 'initMomoPayment error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const confirmMomoPayment = async (req, res) => {
  try {
    const { ref } = req.params;
    const { getPending } = await import('../services/momo.sandbox.js');
    const intent = getPending(ref);
    if (!intent) return res.status(404).json({ error: 'Paiement sandbox introuvable ou expiré' });
    if (intent.parentId !== req.user.id || intent.tenantId !== req.tenantId) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    const paiement = await confirmSandboxPayment(ref, { tenantSlug: req.tenant?.slug });
    res.json({
      message: 'Paiement Mobile Money confirmé (sandbox)',
      paiement,
    });
  } catch (error) {
    if (['INTENT_NOT_FOUND', 'INTENT_NOT_PENDING'].includes(error.message)) {
      return res.status(404).json({ error: 'Paiement sandbox introuvable' });
    }
    if (error.message === 'NO_STAFF_RECEIVER') {
      return res.status(500).json({ error: 'Aucun personnel pour enregistrer le reçu' });
    }
    log.error({ err: error, tenantId: req.tenantId }, 'confirmMomoPayment error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getEnfantAbsences = async (req, res) => {
  try {
    const eleve = await assertParentOwnsEleve(req, res, req.params.id);
    if (!eleve) return;

    const absences = await prisma.absence.findMany({
      where: { tenantId: req.tenantId, eleveId: eleve.id },
      include: {
        emploiDuTemps: {
          include: { matiere: { select: { nom: true } } },
        },
      },
      orderBy: { dateAbsence: 'desc' },
    });

    res.json(
      absences.map((a) => ({
        id: a.id,
        dateAbsence: a.dateAbsence,
        matiereNom: a.emploiDuTemps?.matiere?.nom || null,
        coursNom: a.emploiDuTemps?.matiere?.nom || null,
        motifJustif: a.motifJustif,
        justifiee: a.justifiee,
        typeAbsence: a.typeAbsence,
      }))
    );
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId }, 'enfant absences error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getEnfantSanctions = async (req, res) => {
  try {
    const eleve = await assertParentOwnsEleve(req, res, req.params.id);
    if (!eleve) return;

    const sanctions = await prisma.sanction.findMany({
      where: { tenantId: req.tenantId, eleveId: eleve.id },
      orderBy: { dateSanction: 'desc' },
    });

    res.json(
      sanctions.map((s) => ({
        id: s.id,
        dateSanction: s.dateSanction,
        type: s.type,
        motif: s.motif,
        dureeJours: s.dureeJours,
      }))
    );
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId }, 'enfant sanctions error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getNotifications = async (req, res) => {
  try {
    const rows = await prisma.notification.findMany({
      where: { tenantId: req.tenantId, userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json({ data: rows });
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId }, 'parent notifications error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const markNotificationRead = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.notification.findFirst({
      where: { id, tenantId: req.tenantId, userId: req.user.id },
    });
    if (!existing) return res.status(404).json({ error: 'Notification non trouvée' });
    const updated = await prisma.notification.update({
      where: { id },
      data: { lu: true },
    });
    res.json(updated);
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId }, 'mark notification read error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const markAllNotificationsRead = async (req, res) => {
  try {
    const result = await prisma.notification.updateMany({
      where: { tenantId: req.tenantId, userId: req.user.id, lu: false },
      data: { lu: true },
    });
    res.json({ count: result.count });
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId }, 'mark all notifications read error');
    res.status(500).json({ error: 'Internal server error' });
  }
};
