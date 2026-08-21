import PDFDocument from 'pdfkit';
import { montantEnLettres } from './montantLettres.js';
import { MODE_LABELS, formatDateFr, formatMontant, drawStamp, toBuffer } from './pdfHelpers.js';

/**
 * Reçu de paiement scolaire tenant sur la moitié haute d'une feuille A4 :
 * en-tête école, identité élève, montant en chiffres et en lettres,
 * reste à verser, signatures. Une ligne de découpe marque le milieu de page.
 * Le détail mensuel reste consultable via la situation financière.
 */
export function buildRecuPdf(data) {
  const doc = new PDFDocument({ size: 'A4', margin: 40 });
  const done = toBuffer(doc);

  const {
    nomEcole = 'GestSchool',
    adresse,
    telephone,
    email,
    numeroRecu,
    datePaiement,
    montant,
    devise = 'FCFA',
    modePaiement,
    reference,
    motif,
    eleve,
    matricule,
    classe,
    anneeScolaire,
    parent,
    recuPar,
    echeances = [],
  } = data;

  const left = 40;
  const usable = doc.page.width - 80;
  const half = doc.page.height / 2;

  const totalDu = echeances.reduce((s, e) => s + Number(e.montantAttendu || 0), 0);
  const totalPaye = echeances.reduce((s, e) => s + Number(e.montantPaye || 0), 0);
  const reste = Math.max(0, totalDu - totalPaye);

  // En-tête compact
  doc.font('Helvetica-Bold').fontSize(13).fillColor('#1a365d')
    .text((nomEcole || 'GestSchool').toUpperCase(), left, 30, { width: usable, align: 'center' });
  const contact = [adresse, telephone, email].filter(Boolean).join('  ·  ');
  if (contact) {
    doc.font('Helvetica').fontSize(7).fillColor('#555')
      .text(contact, left, 47, { width: usable, align: 'center' });
  }
  const ruleY = contact ? 60 : 50;
  doc.moveTo(left, ruleY).lineTo(left + usable, ruleY).lineWidth(1).stroke('#1a365d');

  let y = ruleY + 6;
  doc.rect(left, y, usable, 20).fillAndStroke('#1a365d', '#1a365d');
  doc.font('Helvetica-Bold').fontSize(11).fillColor('#fff')
    .text('REÇU DE PAIEMENT DE SCOLARITÉ', left, y + 5, { width: usable, align: 'center' });

  // Références
  y += 28;
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#1a365d')
    .text(`Reçu N° ${String(numeroRecu ?? '—').padStart(6, '0')}`, left, y);
  doc.font('Helvetica').fontSize(9).fillColor('#333')
    .text(`Date : ${formatDateFr(datePaiement)}`, left + usable / 2, y, { width: usable / 2, align: 'right' });

  y += 14;
  doc.fontSize(8).fillColor('#444')
    .text(`Année scolaire : ${anneeScolaire || '—'}`, left, y);
  doc.text(`Classe : ${classe || '—'}`, left + usable / 2, y, { width: usable / 2, align: 'right' });

  // Identité
  y += 16;
  doc.rect(left, y, usable, 42).stroke('#cbd5e0');
  doc.font('Helvetica').fontSize(7).fillColor('#666').text('Élève', left + 8, y + 5);
  doc.font('Helvetica-Bold').fontSize(11).fillColor('#111').text(eleve || '—', left + 8, y + 15);
  doc.font('Helvetica').fontSize(8).fillColor('#444')
    .text(`Matricule : ${matricule || '—'}`, left + 8, y + 30);
  doc.text(`Versé par : ${parent || '—'}`, left + usable / 2, y + 30, { width: usable / 2 - 8, align: 'right' });

  // Montant
  y += 52;
  doc.rect(left, y, usable, 44).fillAndStroke('#1a365d', '#1a365d');
  doc.fillColor('#fff').font('Helvetica').fontSize(8)
    .text('MONTANT DU VERSEMENT', left + 10, y + 7);
  doc.font('Helvetica-Bold').fontSize(17)
    .text(formatMontant(montant, devise), left + 10, y + 19);
  doc.font('Helvetica').fontSize(8)
    .text(MODE_LABELS[modePaiement] || modePaiement || 'Espèces', left, y + 10, { width: usable - 12, align: 'right' });
  if (reference) {
    doc.text(`Réf. ${reference}`, left, y + 24, { width: usable - 12, align: 'right' });
  }

  // Montant en lettres
  y += 52;
  const lettres = `Arrêté à la somme de : ${montantEnLettres(montant)}.`;
  doc.font('Helvetica-Oblique').fontSize(9).fillColor('#1a365d')
    .text(lettres, left, y, { width: usable });
  y += doc.heightOfString(lettres, { width: usable }) + 6;

  if (motif) {
    doc.font('Helvetica').fontSize(8).fillColor('#444').text(`Objet : ${motif}`, left, y, { width: usable });
    y += 14;
  }

  // Situation après versement
  doc.rect(left, y, usable, 24).stroke('#e2e8f0');
  doc.font('Helvetica').fontSize(8).fillColor('#666').text('Déjà versé', left + 8, y + 4);
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#111')
    .text(formatMontant(totalPaye, devise), left + 8, y + 13);
  doc.font('Helvetica').fontSize(8).fillColor('#666')
    .text('Reste à verser', left + usable / 2, y + 4, { width: usable / 2 - 8, align: 'right' });
  doc.font('Helvetica-Bold').fontSize(9).fillColor(reste > 0.01 ? '#c53030' : '#276749')
    .text(formatMontant(reste, devise), left + usable / 2, y + 13, { width: usable / 2 - 8, align: 'right' });

  // Signatures
  y += 34;
  doc.font('Helvetica').fontSize(8).fillColor('#333');
  doc.text('Le caissier / comptable', left, y, { width: usable / 2, align: 'center' });
  doc.text("Cachet de l'établissement", left + usable / 2, y, { width: usable / 2, align: 'center' });
  if (recuPar) {
    doc.fontSize(7).fillColor('#666').text(recuPar, left, y + 11, { width: usable / 2, align: 'center' });
  }
  doc.moveTo(left + 40, y + 36).lineTo(left + usable / 2 - 40, y + 36).lineWidth(0.5).stroke('#999');
  drawStamp(doc, left + (3 * usable) / 4, y + 30);

  // Mention légale + découpe à mi-page
  doc.font('Helvetica-Oblique').fontSize(6.5).fillColor('#888')
    .text('Frais non remboursables. Conservez ce reçu : il constitue la preuve du versement.', left, half - 22, { width: usable, align: 'center' });
  doc.moveTo(left, half - 6).lineTo(left + usable, half - 6)
    .lineWidth(0.5).dash(3, { space: 3 }).stroke('#bbb');
  doc.undash();
  doc.font('Helvetica').fontSize(6).fillColor('#bbb')
    .text('— découper ici —', left, half - 3, { width: usable, align: 'center' });

  doc.end();
  return done;
}
