import { prisma } from './prisma.js';
import { emitStockAlerte } from './pharmacyEvents.js';
import { randomUUID } from 'crypto';

/**
 * Algorithme FEFO (First Expired, First Out)
 * Décrémente le stock en sélectionnant les lots avec péremption la plus proche
 * Utilise FOR UPDATE pour éviter les race conditions sur les ventes simultanées
 */
export const decrementerStockFEFO = async (tenantId, medicamentId, quantiteVente, venteId, staffId, tx = null) => {
  const db = tx || prisma;
  
  // Si pas de transaction fournie, en créer une pour garantir l'atomicité
  if (!tx) {
    return await prisma.$transaction(async (tx) => {
      return decrementerStockFEFO(tenantId, medicamentId, quantiteVente, venteId, staffId, tx);
    });
  }

  // 1. Verrouiller le médicament (SELECT FOR UPDATE empêche lecture concurrente)
  const [medicament] = await tx.$queryRaw`
    SELECT id, "stockTotal", "seuilAlerte", "actif", "prixAchat"
    FROM "Medicament"
    WHERE id = ${medicamentId}::text
      AND "tenantId" = ${tenantId}::text
    FOR UPDATE
  `;

  if (!medicament) {
    throw new Error('Médicament introuvable');
  }

  if (!medicament.actif) {
    throw new Error('Médicament inactif');
  }

  // 2. Vérifier le stock DANS la transaction (après verrou)
  if (medicament.stockTotal < quantiteVente) {
    throw new Error(
      `Stock insuffisant : ${medicament.stockTotal} unité(s) disponible(s), ` +
      `${quantiteVente} demandée(s)`
    );
  }

  // 3. Récupérer les lots dans l'ordre FEFO (aussi sous verrou)
  let lots = await tx.$queryRaw`
    SELECT id, "quantiteRestante", "datePeremption", "numeroLot"
    FROM "LotStock"
    WHERE "medicamentId" = ${medicamentId}::text
      AND "tenantId" = ${tenantId}::text
      AND "quantiteRestante" > 0
      AND "datePeremption" > NOW()
    ORDER BY "datePeremption" ASC
    FOR UPDATE
  `;

  // 4. Si aucun lot disponible mais stockTotal > 0, créer un lot générique
  if (lots.length === 0 && medicament.stockTotal >= quantiteVente) {
    const [lotGeneric] = await tx.$queryRaw`
      INSERT INTO "LotStock" (
        id, "tenantId", "medicamentId", "numeroLot", "quantiteInitiale",
        "quantiteRestante", "prixAchatLot", "datePeremption", "recuParId",
        "updatedAt"
      )
      VALUES (
        ${randomUUID()}::text,
        ${tenantId}::text,
        ${medicamentId}::text,
        'INIT-' || EXTRACT(EPOCH FROM NOW())::bigint,
        ${medicament.stockTotal},
        ${medicament.stockTotal},
        ${medicament.prixAchat || 0},
        NOW() + INTERVAL '365 days',
        ${staffId}::text,
        NOW()
      )
      RETURNING id, "quantiteRestante", "datePeremption", "numeroLot"
    `;
    lots = lotGeneric ? [lotGeneric] : [];
  }

  if (lots.length === 0) {
    throw new Error('Stock insuffisant : aucun lot disponible');
  }

  // 5. Décrémenter lot par lot (logique FEFO)
  let quantiteRestanteAVendre = quantiteVente;
  const mouvements = [];
  const lignesLot = [];

  for (const lot of lots) {
    if (quantiteRestanteAVendre <= 0) break;

    const quantiteAPrendre = Math.min(lot.quantiteRestante, quantiteRestanteAVendre);

    // Mise à jour du lot avec opération atomique
    await tx.$executeRaw`
      UPDATE "LotStock"
      SET "quantiteRestante" = "quantiteRestante" - ${quantiteAPrendre}
      WHERE id = ${lot.id}::text
    `;

    // Création du mouvement de stock
    const mouvement = await tx.mouvementStock.create({
      data: {
        medicamentId,
        lotStockId: lot.id || null,
        type: 'sortie',
        quantite: quantiteAPrendre,
        reference: `Vente ${venteId}`,
        staffId
      }
    });

    mouvements.push(mouvement);
    lignesLot.push({
      lotStockId: lot.id,
      quantite: quantiteAPrendre
    });

    quantiteRestanteAVendre -= quantiteAPrendre;
  }

  // 6. Mettre à jour stockTotal avec opération atomique
  const [updatedMedicament] = await tx.$queryRaw`
    UPDATE "Medicament"
    SET "stockTotal" = "stockTotal" - ${quantiteVente}
    WHERE id = ${medicamentId}::text
      AND "tenantId" = ${tenantId}::text
    RETURNING "stockTotal", "seuilAlerte", (SELECT slug FROM "Tenant" WHERE id = ${tenantId}::text) as "tenantSlug"
  `;

  // 7. Alerte si stock critique
  if (updatedMedicament.stockTotal <= updatedMedicament.seuilAlerte) {
    emitStockAlerte(updatedMedicament.tenantSlug, {
      ...medicament,
      stockTotal: updatedMedicament.stockTotal
    });
  }

  return {
    mouvements,
    lignesLot,
    stockRestant: updatedMedicament.stockTotal
  };
};

/**
 * Retour de stock (annulation de vente)
 */
export const retourStock = async (tenantId, medicamentId, lotStockId, quantite, reference, staffId, tx = null) => {
  const db = tx || prisma;
  // Mise à jour du lot
  await db.lotStock.update({
    where: { id: lotStockId },
    data: { quantiteRestante: { increment: quantite } }
  });

  // Création du mouvement
  const mouvement = await db.mouvementStock.create({
    data: {
      medicamentId,
      lotStockId: lotStockId || null,
      type: 'retour',
      quantite,
      reference,
      staffId
    }
  });

  // Mise à jour du stock total
  await db.medicament.update({
    where: { id: medicamentId },
    data: { stockTotal: { increment: quantite } }
  });

  return mouvement;
};

/**
 * Réception de commande fournisseur - création des lots
 */
export const receptionCommande = async (tenantId, commandeId, lignes, staffId) => {
  return await prisma.$transaction(async (tx) => {
    const lotsCrees = [];
    const mouvements = [];

    for (const ligne of lignes) {
      const { medicamentId, numeroLot, datePeremption, quantiteRecue, prixAchatLot, fournisseurId } = ligne;

      // Création du lot
      const lot = await tx.lotStock.create({
        data: {
          tenantId,
          medicamentId,
          numeroLot,
          datePeremption: new Date(datePeremption),
          quantiteInitiale: quantiteRecue,
          quantiteRestante: quantiteRecue,
          prixAchatLot,
          fournisseurId,
          recuParId: staffId
        }
      });

      lotsCrees.push(lot);

      // Mouvement d'entrée
      const mouvement = await tx.mouvementStock.create({
        data: {
          medicamentId,
          lotStockId: lot.id || null,
          type: 'entree',
          quantite: quantiteRecue,
          reference: `Commande ${commandeId}`,
          staffId
        }
      });

      mouvements.push(mouvement);

      // Mise à jour du stock total
      await tx.medicament.update({
        where: { id: medicamentId },
        data: {
          stockTotal: { increment: quantiteRecue },
          prixAchat: prixAchatLot // Mise à jour du prix d'achat moyen
        }
      });
    }

    return { lotsCrees, mouvements };
  });
};

/**
 * Ajustement manuel de stock (inventaire)
 */
export const ajustementStock = async (tenantId, medicamentId, lotStockId, quantiteAjustee, difference, staffId, note) => {
  return await prisma.$transaction(async (tx) => {
    const lot = await tx.lotStock.update({
      where: { id: lotStockId },
      data: { quantiteRestante: quantiteAjustee }
    });

    const mouvement = await tx.mouvementStock.create({
      data: {
        medicamentId,
        lotStockId: lotStockId || null,
        type: 'ajustement',
        quantite: Math.abs(difference),
        reference: 'Inventaire',
        staffId,
        note: note || `Ajustement: ${difference > 0 ? '+' : ''}${difference}`
      }
    });

    const updated = await tx.medicament.update({
      where: { id: medicamentId },
      data: { stockTotal: { [difference > 0 ? 'increment' : 'decrement']: Math.abs(difference) } }
    });

    return { lot, mouvement, updated };
  });
};

/**
 * Calcul de la consommation moyenne mensuelle (CMM)
 */
export const calculerCMM = async (tenantId, medicamentId, mois = 12) => {
  const dateDebut = new Date();
  dateDebut.setMonth(dateDebut.getMonth() - mois);

  const mouvements = await prisma.mouvementStock.findMany({
    where: {
      tenantId,
      medicamentId,
      type: 'sortie',
      createdAt: { gte: dateDebut }
    }
  });

  const quantiteTotale = mouvements.reduce((sum, m) => sum + m.quantite, 0);
  const cmm = Math.round(quantiteTotale / mois);

  return {
    cmm,
    periode: `${mois} mois`,
    quantiteTotale,
    nombreMouvements: mouvements.length
  };
};

/**
 * Quantité à commander = (CMM × délaiLivraison) + stockSécurité - stockActuel
 */
export const calculerQuantiteACommander = async (tenantId, medicamentId, delaiLivraison = 7, stockSecurite = null) => {
  const medicament = await prisma.medicament.findUnique({
    where: { id: medicamentId }
  });

  if (!medicament) return null;

  const { cmm } = await calculerCMM(tenantId, medicamentId, 12);
  const consommationPendantDelai = cmm * (delaiLivraison / 30);
  const secu = stockSecurite ?? Math.ceil(consommationPendantDelai * 0.5);
  const stockActuel = medicament.stockTotal;

  const qteCommander = (cmm * (delaiLivraison / 30)) + secu - stockActuel;

  return {
    medicamentId,
    dci: medicament.dci,
    cmm,
    delaiLivraison,
    stockSecurite: secu,
    stockActuel,
    quantiteACommander: Math.max(0, Math.round(qteCommander)),
    seuilAlerte: medicament.seuilAlerte
  };
};
