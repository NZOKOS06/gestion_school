import PDFDocument from 'pdfkit';
import { formatDateFr, formatMontant, drawHeader, drawFooter, toBuffer } from './pdfHelpers.js';

export function buildDepensesPdf(data) {
  const doc = new PDFDocument({ size: 'A4', margin: 40 });
  const done = toBuffer(doc);

  const {
    nomEcole = 'GestSchool',
    adresse,
    telephone,
    devise = 'FCFA',
    dateDebut,
    dateFin,
    depenses = [],
  } = data;

  const left = 40;
  const usable = doc.page.width - 80;

  let y = drawHeader(doc, {
    nomEcole,
    adresse,
    telephone,
    titre: 'REGISTRE DES DÉPENSES',
  });
  y += 8;
  doc.font('Helvetica').fontSize(9).fillColor('#333')
    .text(`Période : ${formatDateFr(dateDebut)} → ${formatDateFr(dateFin)}`, left, y);
  y += 18;

  const total = depenses.reduce((s, d) => s + Number(d.montant || 0), 0);
  doc.rect(left, y, usable, 28).fillAndStroke('#fff5f5', '#fed7d7');
  doc.fillColor('#c53030').font('Helvetica-Bold').fontSize(10)
    .text(`${depenses.length} dépense(s)  ·  Total ${formatMontant(total, devise)}`, left + 10, y + 8);
  y += 40;

  const cols = [80, 110, 220, 90, usable - 500];
  const headers = ['Date', 'Catégorie', 'Motif', 'Montant', 'Référence'];
  const drawHead = () => {
    doc.rect(left, y, usable, 16).fill('#1a365d');
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#fff');
    let x = left + 4;
    headers.forEach((h, i) => {
      doc.text(h, x, y + 4, { width: cols[i] - 4, align: i === 3 ? 'right' : 'left' });
      x += cols[i];
    });
    y += 16;
  };
  drawHead();
  doc.font('Helvetica').fontSize(8).fillColor('#111');

  for (const d of depenses) {
    if (y > doc.page.height - 70) {
      doc.addPage();
      y = 40;
      drawHead();
      doc.font('Helvetica').fontSize(8).fillColor('#111');
    }
    const vals = [
      formatDateFr(d.dateDepense),
      d.categorie || '—',
      d.motif || '—',
      formatMontant(d.montant, ''),
      d.reference || '—',
    ];
    doc.rect(left, y, usable, 15).stroke('#edf2f7');
    let x = left + 4;
    vals.forEach((v, i) => {
      doc.text(String(v), x, y + 3, { width: cols[i] - 4, align: i === 3 ? 'right' : 'left' });
      x += cols[i];
    });
    y += 15;
  }

  y += 20;
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#c53030')
    .text(`Total des sorties : ${formatMontant(total, devise)}`, left, y, { width: usable, align: 'right' });

  drawFooter(doc, 'Registre des dépenses GestSchool — Document interne.');
  doc.end();
  return done;
}
