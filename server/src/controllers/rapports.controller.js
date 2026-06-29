import PDFDocument from 'pdfkit';
import { prisma } from '../utils/prisma.js';
import { formatMontant, formatDate } from '../utils/formatters.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('RapportsController');

const MODES_PAIEMENT = ['especes', 'mobile_money', 'carte', 'credit'];

function resolvePeriode(periode, dateDebut, dateFin) {
  const maintenant = new Date()

  const fin = new Date(maintenant)
  fin.setHours(23, 59, 59, 999)

  const debut = new Date(maintenant)
  debut.setHours(0, 0, 0, 0)

  switch (periode) {
    case '7j':
      debut.setDate(maintenant.getDate() - 6)
      break
    case '30j':
      debut.setDate(maintenant.getDate() - 29)
      break
    case '90j':
      debut.setDate(maintenant.getDate() - 89)
      break
    case 'custom':
      if (!dateDebut || !dateFin) {
        throw new Error('Dates requises pour la période personnalisée')
      }
      return {
        debut: new Date(dateDebut + 'T00:00:00.000Z'),
        fin: new Date(dateFin + 'T23:59:59.999Z'),
      }
    default:
      debut.setDate(maintenant.getDate() - 29)
  }

  return { debut, fin }
}

function getPreviousPeriode(debut, fin) {
  const duree = fin.getTime() - debut.getTime()
  return {
    debut: new Date(debut.getTime() - duree),
    fin: new Date(fin.getTime() - duree),
  }
}

function calcEvolutionPct(current, previous) {
  if (previous == null || previous === undefined) return null;
  if (previous === 0) return current > 0 ? 100 : null;
  return parseFloat((((current - previous) / previous) * 100).toFixed(1));
}

async function aggregatePeriode(tenantId, debut, fin) {
  const ventes = await prisma.vente.findMany({
    where: {
      tenantId,
      createdAt: { gte: debut, lte: fin },
      statut: { in: ['finalisee', 'en_cours'] }
    },
    include: {
      lignes: {
        include: {
          medicament: true,
          lotStock: true
        }
      }
    }
  });

  let ca_total = 0;
  let marge_totale = 0;
  const medicMap = {};
  const parJour = {};
  const parPaiement = {};

  ventes.forEach((v) => {
    const montant = parseFloat(v.montantTotal);
    ca_total += montant;

    const mode = v.modePaiement || 'especes';
    if (!parPaiement[mode]) parPaiement[mode] = { montant: 0, count: 0 };
    parPaiement[mode].montant += montant;
    parPaiement[mode].count += 1;

    const jour = v.createdAt.toISOString().split('T')[0];
    if (!parJour[jour]) parJour[jour] = { date: jour, montant: 0, nb: 0 };
    parJour[jour].montant += montant;
    parJour[jour].nb += 1;

    v.lignes.forEach((l) => {
      const prixVente = parseFloat(l.prixUnitaire);
      // Fallback: si prixAchat est NULL, estimer le coût à 60% du prix de vente (marge implicite de 40%)
      const prixAchat = parseFloat(l.lotStock?.prixAchatLot || l.medicament?.prixAchat || (prixVente * 0.6));
      const qty = l.quantite;
      const ca = prixVente * qty;
      const marge = ca - prixAchat * qty;
      marge_totale += marge;

      const medId = l.medicamentId;
      if (!medicMap[medId]) {
        medicMap[medId] = {
          dci: l.medicament?.dci || '—',
          nomCommercial: l.medicament?.nomCommercial || '—',
          quantite: 0,
          ca: 0,
          marge: 0
        };
      }
      medicMap[medId].quantite += qty;
      medicMap[medId].ca += ca;
      medicMap[medId].marge += marge;
    });
  });

  const marge_pct = ca_total > 0 ? parseFloat(((marge_totale / ca_total) * 100).toFixed(1)) : 0;

  const ventes_par_jour = [];
  const cursor = new Date(debut);
  while (cursor <= fin) {
    const key = cursor.toISOString().split('T')[0];
    ventes_par_jour.push(
      parJour[key] || { date: key, montant: 0, nb: 0 }
    );
    cursor.setDate(cursor.getDate() + 1);
  }

  const top_medicaments = Object.values(medicMap)
    .sort((a, b) => b.ca - a.ca)
    .slice(0, 10)
    .map((m) => ({
      dci: m.dci,
      nomCommercial: m.nomCommercial,
      quantite: m.quantite,
      ca: Math.round(m.ca),
      marge: Math.round(m.marge)
    }));

  const repartition_paiement = MODES_PAIEMENT.map((mode) => ({
    mode,
    montant: Math.round(parPaiement[mode]?.montant || 0),
    count: parPaiement[mode]?.count || 0
  }));

  return {
    ca_total: Math.round(ca_total),
    nb_ventes: ventes.length,
    marge_totale: Math.round(marge_totale),
    marge_pct,
    top_medicaments,
    ventes_par_jour,
    repartition_paiement
  };
}

async function buildRapportComplet(tenantId, periode, dateDebut, dateFin) {
  const { debut, fin } = resolvePeriode(periode, dateDebut, dateFin);
  const prev = getPreviousPeriode(debut, fin);

  const [current, previous, medicaments, mouvements] = await Promise.all([
    aggregatePeriode(tenantId, debut, fin),
    aggregatePeriode(tenantId, prev.debut, prev.fin),
    prisma.medicament.findMany({
      where: { tenantId, actif: true },
      select: { stockTotal: true, prixAchat: true }
    }),
    prisma.mouvementStock.findMany({
      where: { tenantId, createdAt: { gte: debut, lte: fin } },
      include: {
        medicament: { select: { dci: true, nomCommercial: true } },
        staff: { select: { nom: true, prenom: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    })
  ]);

  const stock_value = Math.round(
    medicaments.reduce((sum, m) => sum + m.stockTotal * parseFloat(m.prixAchat), 0)
  );

  return {
    periode: { debut: debut.toISOString(), fin: fin.toISOString() },
    ca_total: current.ca_total,
    ca_evolution_pct: calcEvolutionPct(current.ca_total, previous.ca_total),
    nb_ventes: current.nb_ventes,
    nb_ventes_evolution_pct: calcEvolutionPct(current.nb_ventes, previous.nb_ventes),
    marge_totale: current.marge_totale,
    marge_evolution_pct: calcEvolutionPct(current.marge_totale, previous.marge_totale),
    marge_pct: current.marge_pct,
    marge_pct_evolution_pct: calcEvolutionPct(current.marge_pct, previous.marge_pct),
    top_medicaments: current.top_medicaments,
    ventes_par_jour: current.ventes_par_jour,
    repartition_paiement: current.repartition_paiement,
    stock_value,
    mouvements_recents: mouvements.map((m) => ({
      id: m.id,
      type: m.type,
      quantite: m.quantite,
      medicament: m.medicament?.dci,
      staff: m.staff ? `${m.staff.prenom} ${m.staff.nom}` : null,
      createdAt: m.createdAt
    }))
  };
}

export const getRapports = async (req, res) => {
  try {
    const { periode = '30j', dateDebut, dateFin } = req.query;
    const data = await buildRapportComplet(req.tenantId, periode, dateDebut, dateFin);
    res.json(data);
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId, periode }, 'Get reports error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

function buildCsv(data, devise) {
  const lines = [];
  
  // Métadonnées du rapport
  lines.push('# GestPharma - Rapport Financier');
  lines.push(`# Période: ${formatDate(data.periode.debut)} au ${formatDate(data.periode.fin)}`);
  lines.push(`# Généré le: ${new Date().toLocaleDateString('fr-FR')} ${new Date().toLocaleTimeString('fr-FR')}`);
  lines.push(`# Devise: ${devise}`);
  lines.push('');
  
  // Section Résumé Exécutif
  lines.push('## RÉSUMÉ EXÉCUTIF');
  lines.push('Indicateur;Valeur;Contexte');
  lines.push(`Chiffre d'affaires;${data.ca_total};${data.nb_ventes} ventes`);
  lines.push(`Marge totale;${data.marge_totale};${data.marge_pct}% du CA`);
  lines.push(`Valeur du stock;${data.stock_value};Stock actuel`);
  lines.push('');
  
  // Section Top Médicaments
  lines.push('## TOP 10 MÉDICAMENTS PAR CHIFFRE D\'AFFAIRES');
  lines.push('Rang;DCI;Nom commercial;Quantité vendue;CA généré;Marge réalisée;Taux de marge');
  data.top_medicaments.forEach((m, i) => {
    const tauxMarge = m.ca > 0 ? ((m.marge / m.ca) * 100).toFixed(2) : '0.00';
    lines.push(`${i + 1};${m.dci};${m.nomCommercial};${m.quantite};${m.ca};${m.marge};${tauxMarge}%`);
  });
  lines.push('');
  
  // Section Ventes par jour
  lines.push('## VENTES PAR JOUR');
  lines.push('Date;Montant journalier;Nombre de ventes');
  data.ventes_par_jour.forEach((j) => {
    lines.push(`${formatDate(j.date)};${Math.round(j.montant)};${j.nb}`);
  });
  lines.push('');
  
  // Section Répartition des paiements
  lines.push('## RÉPARTITION DES MODES DE PAIEMENT');
  lines.push('Mode de paiement;Montant total;Nombre de transactions;Pourcentage');
  const totalPaiements = data.repartition_paiement.reduce((sum, p) => sum + p.montant, 0);
  data.repartition_paiement.forEach((p) => {
    const pourcentage = totalPaiements > 0 ? ((p.montant / totalPaiements) * 100).toFixed(2) : '0.00';
    const modeLabel = {
      especes: 'Espèces',
      mobile_money: 'Mobile Money',
      carte: 'Carte bancaire',
      credit: 'Crédit client'
    }[p.mode] || p.mode;
    lines.push(`${modeLabel};${p.montant};${p.count};${pourcentage}%`);
  });
  lines.push('');
  
  // Fin du rapport
  lines.push('# Fin du rapport');

  return '\uFEFF' + lines.join('\n');
}

function buildPdfBuffer(data, devise) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ 
      margin: 60,
      size: 'A4',
      info: {
        Title: 'GestPharma - Rapport Financier',
        Author: 'GestPharma',
        Subject: 'Rapport financier et analyse des ventes',
        Creator: 'GestPharma'
      }
    });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Palette professionnelle épurée (tons de gris et bleu marine)
    const primaryColor = '#1a365d';
    const secondaryColor = '#2d3748';
    const accentColor = '#4a5568';
    const textColor = '#2d3748';
    const lightGray = '#f7fafc';
    const borderColor = '#e2e8f0';

    // En-tête minimaliste
    doc.fillColor('#ffffff')
       .fontSize(24)
       .font('Helvetica-Bold')
       .text('GestPharma', 60, 70)
       .fontSize(10)
       .font('Helvetica')
       .fillColor('#718096')
       .text('Rapport Financier', 60, 95);

    doc.fillColor('#718096')
       .fontSize(9)
       .font('Helvetica')
       .text(`Période : ${formatDate(data.periode.debut)} - ${formatDate(data.periode.fin)}`, 
            doc.page.width - 60, 70, { align: 'right' })
       .text(`Généré le ${new Date().toLocaleDateString('fr-FR')}`, 
            doc.page.width - 60, 85, { align: 'right' });

    // Ligne de séparation fine
    doc.moveTo(60, 115)
       .lineTo(doc.page.width - 60, 115)
       .strokeColor(borderColor)
       .lineWidth(1)
       .stroke();

    let yPos = 140;

    // Section Résumé Exécutif
    doc.fillColor(primaryColor)
       .fontSize(11)
       .font('Helvetica-Bold')
       .text('RÉSUMÉ EXÉCUTIF', 60, yPos);
    
    yPos += 20;

    // Tableau résumé
    const summaryData = [
      ['Chiffre d\'affaires', formatMontant(data.ca_total, devise), `${data.nb_ventes} ventes`],
      ['Marge totale', formatMontant(data.marge_totale, devise), `${data.marge_pct}% du CA`],
      ['Valeur du stock', formatMontant(data.stock_value, devise), 'Stock actuel']
    ];

    summaryData.forEach((row, i) => {
      const rowY = yPos + (i * 25);
      
      // Fond alterné subtil
      if (i % 2 === 0) {
        doc.rect(60, rowY, doc.page.width - 120, 25).fill(lightGray);
      }
      
      doc.fillColor(textColor)
         .fontSize(9)
         .font('Helvetica')
         .text(row[0], 70, rowY + 8);
      
      doc.fillColor(primaryColor)
         .fontSize(10)
         .font('Helvetica-Bold')
         .text(row[1], 200, rowY + 8);
      
      doc.fillColor('#718096')
         .fontSize(8)
         .text(row[2], 350, rowY + 8);
    });

    yPos += 90;

    // Section Top Médicaments
    doc.fillColor(primaryColor)
       .fontSize(11)
       .font('Helvetica-Bold')
       .text('TOP 10 MÉDICAMENTS PAR CHIFFRE D\'AFFAIRES', 60, yPos);
    
    yPos += 25;

    // En-tête tableau
    doc.rect(60, yPos, doc.page.width - 120, 22).fill(primaryColor);
    doc.fillColor('#ffffff')
       .fontSize(8)
       .font('Helvetica-Bold')
       .text('Rang', 70, yPos + 7);
    doc.text('DCI', 110, yPos + 7);
    doc.text('Nom commercial', 220, yPos + 7);
    doc.text('Qté', 400, yPos + 7);
    doc.text('CA généré', 440, yPos + 7);
    doc.text('Marge', 510, yPos + 7);
    
    yPos += 22;

    // Lignes du tableau
    data.top_medicaments.forEach((m, i) => {
      const bgColor = i % 2 === 0 ? '#ffffff' : '#f7fafc';
      doc.rect(60, yPos, doc.page.width - 120, 18).fill(bgColor);
      
      doc.fillColor(textColor)
         .fontSize(8)
         .font('Helvetica')
         .text(`${i + 1}`, 70, yPos + 5);
      doc.text(m.dci, 110, yPos + 5);
      doc.text(m.nomCommercial, 220, yPos + 5);
      doc.text(`${m.quantite}`, 400, yPos + 5);
      doc.text(formatMontant(m.ca, devise), 440, yPos + 5);
      
      doc.fillColor(textColor)
         .font('Helvetica')
         .text(formatMontant(m.marge, devise), 510, yPos + 5);
      
      yPos += 18;
    });

    yPos += 25;

    // Nouvelle page si nécessaire
    if (yPos > 700) {
      doc.addPage();
      yPos = 70;
    }

    // Section Paiements
    doc.fillColor(primaryColor)
       .fontSize(11)
       .font('Helvetica-Bold')
       .text('RÉPARTITION DES PAIEMENTS', 60, yPos);
    
    yPos += 25;

    const totalPaiements = data.repartition_paiement.reduce((sum, p) => sum + p.montant, 0);
    
    data.repartition_paiement.forEach((p, i) => {
      const pourcentage = totalPaiements > 0 ? ((p.montant / totalPaiements) * 100).toFixed(1) : '0.0';
      const modeLabel = {
        especes: 'Espèces',
        mobile_money: 'Mobile Money',
        carte: 'Carte bancaire',
        credit: 'Crédit client'
      }[p.mode] || p.mode;
      
      const rowY = yPos + (i * 30);
      
      // Fond alterné
      if (i % 2 === 0) {
        doc.rect(60, rowY, doc.page.width - 120, 30).fill(lightGray);
      }
      
      doc.fillColor(textColor)
         .fontSize(9)
         .font('Helvetica-Bold')
         .text(modeLabel, 70, rowY + 10);
      
      doc.fillColor(textColor)
         .fontSize(9)
         .font('Helvetica')
         .text(formatMontant(p.montant, devise), 200, rowY + 10);
      
      doc.fillColor('#718096')
         .fontSize(8)
         .text(`${p.count} transaction(s)`, 320, rowY + 10);
      
      doc.fillColor(primaryColor)
         .fontSize(9)
         .font('Helvetica-Bold')
         .text(`${pourcentage}%`, 450, rowY + 10);
    });

    // Pied de page professionnel
    const pageCount = doc.bufferedPageRange().count;
    for (let i = 0; i < pageCount; i++) {
      doc.switchToPage(i);
      
      // Ligne de séparation
      doc.moveTo(60, doc.page.height - 40)
         .lineTo(doc.page.width - 60, doc.page.height - 40)
         .strokeColor(borderColor)
         .lineWidth(1)
         .stroke();
      
      doc.fontSize(8)
         .fillColor('#a0aec0')
         .text(
           `GestPharma - Rapport financier - Page ${i + 1}/${pageCount}`,
           60,
           doc.page.height - 25
         );
    }

    doc.end();
  });
}

export const exportRapports = async (req, res) => {
  try {
    const { format = 'csv', periode = '30j', dateDebut, dateFin } = req.query;
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.tenantId },
      include: { config: true }
    });
    const devise = tenant?.config?.devise || 'FCFA';
    const data = await buildRapportComplet(req.tenantId, periode, dateDebut, dateFin);

    if (format === 'pdf') {
      const buffer = await buildPdfBuffer(data, devise);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="rapports-${periode}.pdf"`);
      return res.send(buffer);
    }

    const csv = buildCsv(data, devise);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="rapports-${periode}.csv"`);
    res.send(csv);
  } catch (error) {
    log.error({ err: error, tenantId: req.tenantId, format, periode }, 'Export reports error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getVentes = async (req, res) => {
  try {
    const { dateDebut, dateFin, groupeBy = 'jour' } = req.query;
    const tenantId = req.tenantId;

    const debut = dateDebut ? new Date(dateDebut) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const fin = dateFin ? new Date(dateFin) : new Date();
    fin.setHours(23, 59, 59, 999);

    const ventes = await prisma.vente.findMany({
      where: {
        tenantId,
        createdAt: { gte: debut, lte: fin },
        statut: 'finalisee'
      },
      include: {
        lignes: {
          include: {
            medicament: { select: { dci: true, categorieId: true } }
          }
        }
      }
    });

    const stats = {
      totalVentes: ventes.length,
      montantTotal: ventes.reduce((sum, v) => sum + parseFloat(v.montantTotal), 0),
      montantMoyen: ventes.length > 0 ? ventes.reduce((sum, v) => sum + parseFloat(v.montantTotal), 0) / ventes.length : 0,
      articlesVendus: ventes.reduce((sum, v) => sum + v.lignes.reduce((ls, l) => ls + l.quantite, 0), 0),
      parModePaiement: {},
      parJour: {},
      parCategorie: {}
    };

    ventes.forEach(v => {
      const mode = v.modePaiement || 'non_specifie';
      stats.parModePaiement[mode] = (stats.parModePaiement[mode] || 0) + parseFloat(v.montantTotal);

      const jour = v.createdAt.toISOString().split('T')[0];
      stats.parJour[jour] = (stats.parJour[jour] || 0) + parseFloat(v.montantTotal);

      v.lignes.forEach(l => {
        const catId = l.medicament?.categorieId || 'sans_categorie';
        stats.parCategorie[catId] = (stats.parCategorie[catId] || 0) + parseFloat(l.sousTotal);
      });
    });

    res.json({
      periode: { debut: debut.toISOString(), fin: fin.toISOString() },
      stats
    });
  } catch (error) {
    log.error({ err: error, tenantId, dateDebut, dateFin }, 'Get sales error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getMarges = async (req, res) => {
  try {
    const { dateDebut, dateFin } = req.query;
    const tenantId = req.tenantId;

    const debut = dateDebut ? new Date(dateDebut) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const fin = dateFin ? new Date(dateFin) : new Date();
    fin.setHours(23, 59, 59, 999);

    const ventes = await prisma.vente.findMany({
      where: {
        tenantId,
        createdAt: { gte: debut, lte: fin },
        statut: 'finalisee'
      },
      include: {
        lignes: {
          include: {
            medicament: true,
            lotStock: true
          }
        }
      }
    });

    let caTotal = 0;
    let coutTotal = 0;
    const details = [];

    ventes.forEach(v => {
      v.lignes.forEach(l => {
        const prixVente = parseFloat(l.prixUnitaire);
        const prixAchat = parseFloat(l.lotStock?.prixAchatLot || l.medicament?.prixAchat || 0);
        const quantite = l.quantite;

        const ca = prixVente * quantite;
        const cout = prixAchat * quantite;
        const marge = ca - cout;

        caTotal += ca;
        coutTotal += cout;

        details.push({
          medicamentId: l.medicamentId,
          dci: l.medicament?.dci,
          quantite,
          ca,
          cout,
          marge,
          tauxMarge: ca > 0 ? (marge / ca * 100).toFixed(2) : 0
        });
      });
    });

    res.json({
      periode: { debut: debut.toISOString(), fin: fin.toISOString() },
      synthese: {
        caTotal,
        coutTotal,
        margeTotale: caTotal - coutTotal,
        tauxMargeGlobal: caTotal > 0 ? (((caTotal - coutTotal) / caTotal) * 100).toFixed(2) : 0
      },
      topMarges: details.sort((a, b) => b.marge - a.marge).slice(0, 20)
    });
  } catch (error) {
    log.error({ err: error, tenantId, dateDebut, dateFin }, 'Get margins error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getRotationStock = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { mois = 3 } = req.query;

    const dateDebut = new Date();
    dateDebut.setMonth(dateDebut.getMonth() - parseInt(mois));

    const medicaments = await prisma.medicament.findMany({
      where: { tenantId, actif: true },
      include: { categorie: { select: { nom: true } } }
    });

    const rotation = await Promise.all(
      medicaments.map(async (med) => {
        const mouvements = await prisma.mouvementStock.findMany({
          where: { tenantId, medicamentId: med.id, type: 'sortie', createdAt: { gte: dateDebut } }
        });

        const quantiteVendue = mouvements.reduce((sum, m) => sum + m.quantite, 0);
        const cmm = Math.round(quantiteVendue / parseInt(mois));
        const stockActuel = med.stockTotal;
        const rotation = cmm > 0 ? (stockActuel / cmm).toFixed(1) : 0;

        return {
          ...med,
          quantiteVendue,
          cmm,
          stockActuel,
          rotation: parseFloat(rotation),
          moisCouverture: rotation
        };
      })
    );

    rotation.sort((a, b) => a.rotation - b.rotation);

    res.json({
      periode: `${mois} mois`,
      stockFaibleRotation: rotation.filter(r => r.rotation < 1 && r.stockTotal > 0),
      stockSurRotation: rotation.filter(r => r.rotation > 6),
      tous: rotation
    });
  } catch (error) {
    log.error({ err: error, tenantId, mois }, 'Get stock rotation error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getFournisseurs = async (req, res) => {
  try {
    const { dateDebut, dateFin } = req.query;
    const tenantId = req.tenantId;

    const debut = dateDebut ? new Date(dateDebut) : new Date(new Date().getFullYear(), 0, 1);
    const fin = dateFin ? new Date(dateFin) : new Date();
    fin.setHours(23, 59, 59, 999);

    const fournisseurs = await prisma.fournisseur.findMany({
      where: { tenantId, actif: true }
    });

    const stats = await Promise.all(
      fournisseurs.map(async (f) => {
        const commandes = await prisma.commandeFournisseur.findMany({
          where: {
            tenantId,
            fournisseurId: f.id,
            createdAt: { gte: debut, lte: fin }
          }
        });

        const totalAchats = commandes.reduce((sum, c) => sum + parseFloat(c.montantTotal), 0);
        const nbCommandes = commandes.length;
        const commandesRecues = commandes.filter(c => c.statut === 'recue').length;

        return {
          fournisseur: f,
          totalAchats,
          nbCommandes,
          commandesRecues,
          tauxReception: nbCommandes > 0 ? ((commandesRecues / nbCommandes) * 100).toFixed(1) : 0
        };
      })
    );

    stats.sort((a, b) => b.totalAchats - a.totalAchats);

    res.json({
      periode: { debut: debut.toISOString(), fin: fin.toISOString() },
      stats
    });
  } catch (error) {
    log.error({ err: error, tenantId, dateDebut, dateFin }, 'Get suppliers error');
    res.status(500).json({ error: 'Internal server error' });
  }
};
