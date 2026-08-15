import PDFDocument from 'pdfkit';
import {
  MODE_LABELS, formatDateFr, formatMontant,
  drawHeader, drawFooter, toBuffer,
} from './pdfHelpers.js';

export function buildJournalCaissePdf(data) {
  const doc = new PDFDocument({ size: 'A4', margin: 40 });
  const done = toBuffer(doc);

  const {
    nomEcole = 'GestSchool',
    adresse,
    telephone,
    devise = 'FCFA',
    dateDebut,
    dateFin,
    paiements = [],
    recuPar,
  } = data;

  const left = 40;
  const usable = doc.page.width - 80;

  let y = drawHeader(doc, {
    nomEcole,
    adresse,
    telephone,
    titre: 'JOURNAL DE CAISSE',
  });
  y += 8;
  const periode = dateDebut || dateFin
    ? `Période : ${formatDateFr(dateDebut)} → ${formatDateFr(dateFin)}`
    : `Édité le ${formatDateFr(new Date())}`;
  doc.font('Helvetica').fontSize(9).fillColor('#333').text(periode, left, y);
  y += 18;

  const total = paiements.reduce((s, p) => s + Number(p.montant || 0), 0);
  doc.rect(left, y, usable, 28).fillAndStroke('#f7fafc', '#e2e8f0');
  doc.fillColor('#111').font('Helvetica-Bold').fontSize(10)
    .text(`${paiements.length} encaissement(s)`, left + 10, y + 8);
  doc.text(formatMontant(total, devise), left, y + 8, { width: usable - 10, align: 'right' });
  y += 40;

  const cols = [50, 70, 150, 80, 90, usable - 440];
  const headers = ['N°', 'Date', 'Élève', 'Classe', 'Mode', 'Montant'];
  const drawTableHeader = () => {
    doc.rect(left, y, usable, 16).fill('#1a365d');
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#fff');
    let x = left + 4;
    headers.forEach((h, i) => {
      doc.text(h, x, y + 4, { width: cols[i] - 4, align: i === 5 ? 'right' : 'left' });
      x += cols[i];
    });
    y += 16;
  };

  drawTableHeader();
  doc.font('Helvetica').fontSize(8).fillColor('#111');

  for (const p of paiements) {
    if (y > doc.page.height - 70) {
      doc.addPage();
      y = 40;
      drawTableHeader();
      doc.font('Helvetica').fontSize(8).fillColor('#111');
    }
    const vals = [
      `#${p.numeroRecu ?? '—'}`,
      formatDateFr(p.datePaiement),
      `${p.elevePrenom || ''} ${p.eleveNom || ''}`.trim() || '—',
      p.classeNom || '—',
      MODE_LABELS[p.modePaiement] || p.modePaiement || '—',
      formatMontant(p.montant, ''),
    ];
    doc.rect(left, y, usable, 15).stroke('#edf2f7');
    let x = left + 4;
    vals.forEach((v, i) => {
      doc.text(String(v), x, y + 3, { width: cols[i] - 4, align: i === 5 ? 'right' : 'left' });
      x += cols[i];
    });
    y += 15;
  }

  y += 20;
  doc.font('Helvetica-Bold').fontSize(10)
    .text(`Total : ${formatMontant(total, devise)}`, left, y, { width: usable, align: 'right' });

  y += 36;
  doc.font('Helvetica').fontSize(8).fillColor('#333')
    .text(`Caissier : ${recuPar || '—'}`, left, y);
  doc.text('Signature', left + usable / 2, y, { width: usable / 2, align: 'center' });
  doc.moveTo(left + usable / 2 + 30, y + 28).lineTo(left + usable - 30, y + 28).stroke('#999');

  drawFooter(doc, 'Journal de caisse GestSchool — Document interne.');
  doc.end();
  return done;
}
