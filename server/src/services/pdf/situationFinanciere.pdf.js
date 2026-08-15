import PDFDocument from 'pdfkit';
import {
  MODE_LABELS, formatDateFr, formatMontant,
  drawHeader, drawFooter, toBuffer,
} from './pdfHelpers.js';

export function buildSituationFinancierePdf(data) {
  const doc = new PDFDocument({ size: 'A4', margin: 40 });
  const done = toBuffer(doc);

  const {
    nomEcole = 'GestSchool',
    adresse,
    telephone,
    devise = 'FCFA',
    eleve,
    matricule,
    classe,
    anneeScolaire,
    parent,
    echeances = [],
    paiements = [],
  } = data;

  const left = 40;
  const usable = doc.page.width - 80;

  let y = drawHeader(doc, {
    nomEcole,
    adresse,
    telephone,
    titre: 'SITUATION FINANCIÈRE',
  });
  y += 8;
  doc.rect(left, y, usable, 52).fillAndStroke('#f7fafc', '#e2e8f0');
  doc.fillColor('#111').font('Helvetica-Bold').fontSize(11)
    .text(eleve || '—', left + 10, y + 8);
  doc.font('Helvetica').fontSize(8).fillColor('#444')
    .text(`Matricule : ${matricule || '—'}  ·  Classe : ${classe || '—'}  ·  ${anneeScolaire || ''}`, left + 10, y + 24);
  if (parent) {
    doc.text(`Parent : ${parent}`, left + 10, y + 36);
  }

  const totalDu = echeances.reduce((s, e) => s + Number(e.montantAttendu || 0), 0);
  const totalPaye = echeances.reduce((s, e) => s + Number(e.montantPaye || 0), 0);
  const reste = Math.max(0, totalDu - totalPaye);

  y += 64;
  const boxW = (usable - 16) / 3;
  const boxes = [
    ['Total facturé', formatMontant(totalDu, devise), '#1a365d'],
    ['Total payé', formatMontant(totalPaye, devise), '#276749'],
    ['Reste à payer', formatMontant(reste, devise), reste > 0 ? '#c53030' : '#276749'],
  ];
  boxes.forEach((b, i) => {
    const x = left + i * (boxW + 8);
    doc.rect(x, y, boxW, 36).stroke('#e2e8f0');
    doc.font('Helvetica').fontSize(7).fillColor('#666').text(b[0], x + 8, y + 6);
    doc.font('Helvetica-Bold').fontSize(10).fillColor(b[2]).text(b[1], x + 8, y + 18);
  });

  y += 52;
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#1a365d').text('Échéancier', left, y);
  y += 16;

  const eCols = [usable * 0.34, usable * 0.16, usable * 0.16, usable * 0.16, usable * 0.18];
  const eHeaders = ['Libellé', 'Échéance', 'Dû', 'Payé', 'Statut'];
  doc.rect(left, y, usable, 16).fill('#1a365d');
  doc.font('Helvetica-Bold').fontSize(8).fillColor('#fff');
  let x = left + 4;
  eHeaders.forEach((h, i) => {
    doc.text(h, x, y + 4, { width: eCols[i] - 4 });
    x += eCols[i];
  });
  y += 16;
  doc.font('Helvetica').fontSize(8).fillColor('#111');
  for (const ech of echeances) {
    if (y > doc.page.height - 80) {
      doc.addPage();
      y = 40;
    }
    const attendu = Number(ech.montantAttendu || 0);
    const paye = Number(ech.montantPaye || 0);
    const statut = paye >= attendu - 0.01 ? 'Soldée' : (ech.statut === 'en_retard' ? 'En retard' : 'En attente');
    const vals = [ech.libelle || '—', formatDateFr(ech.dateEcheance), formatMontant(attendu, ''), formatMontant(paye, ''), statut];
    doc.rect(left, y, usable, 15).stroke('#edf2f7');
    x = left + 4;
    vals.forEach((v, i) => {
      doc.text(String(v), x, y + 3, { width: eCols[i] - 4 });
      x += eCols[i];
    });
    y += 15;
  }

  y += 20;
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#1a365d').text('Historique des paiements', left, y);
  y += 16;
  const pCols = [60, 80, 100, 120, usable - 360];
  const pHeaders = ['Reçu', 'Date', 'Mode', 'Montant', 'Motif'];
  doc.rect(left, y, usable, 16).fill('#1a365d');
  doc.font('Helvetica-Bold').fontSize(8).fillColor('#fff');
  x = left + 4;
  pHeaders.forEach((h, i) => {
    doc.text(h, x, y + 4, { width: pCols[i] - 4 });
    x += pCols[i];
  });
  y += 16;
  doc.font('Helvetica').fontSize(8).fillColor('#111');
  if (!paiements.length) {
    doc.text('Aucun paiement enregistré.', left + 4, y + 4);
  }
  for (const p of paiements) {
    if (y > doc.page.height - 60) {
      doc.addPage();
      y = 40;
    }
    const vals = [
      `#${p.numeroRecu ?? '—'}`,
      formatDateFr(p.datePaiement),
      MODE_LABELS[p.modePaiement] || p.modePaiement || '—',
      formatMontant(p.montant, devise),
      p.motif || p.typePaiement || '—',
    ];
    doc.rect(left, y, usable, 15).stroke('#edf2f7');
    x = left + 4;
    vals.forEach((v, i) => {
      doc.text(String(v), x, y + 3, { width: pCols[i] - 4 });
      x += pCols[i];
    });
    y += 15;
  }

  drawFooter(doc, 'Situation financière GestSchool — Document informatif.');
  doc.end();
  return done;
}
