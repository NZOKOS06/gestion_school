import PDFDocument from 'pdfkit';
import { montantEnLettres } from './montantLettres.js';
import {
  MODE_LABELS, formatDateFr, formatMontant,
  drawOfficialHeader, drawStamp, drawFooter, toBuffer,
} from './pdfHelpers.js';

/**
 * Reçu de paiement scolaire A4 — forme carnet de caisse (Afrique francophone) :
 * en-tête République, identité élève, montant chiffres + lettres,
 * détail mensuel, déjà versé / reste, cachet et signatures.
 */
export function buildRecuPdf(data) {
  const doc = new PDFDocument({ size: 'A4', margin: 40 });
  const done = toBuffer(doc);

  const {
    pays = 'CG',
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
  let y = drawOfficialHeader(doc, {
    pays, nomEcole, adresse, telephone, email,
    titre: 'REÇU DE PAIEMENT DE SCOLARITÉ',
  });

  y += 6;
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#1a365d')
    .text(`Reçu N° ${String(numeroRecu ?? '—').padStart(6, '0')}`, left, y);
  doc.font('Helvetica').fontSize(9).fillColor('#333')
    .text(`Date : ${formatDateFr(datePaiement)}`, left + usable / 2, y, { width: usable / 2, align: 'right' });
  y += 14;
  doc.text(`Année scolaire : ${anneeScolaire || '—'}`, left, y);
  doc.text(`Exemplaire parent / tuteur`, left + usable / 2, y, { width: usable / 2, align: 'right' });

  y += 18;
  doc.rect(left, y, usable, 54).stroke('#cbd5e0');
  doc.font('Helvetica').fontSize(8).fillColor('#666')
    .text('Reçu de M. / Mme (parent ou tuteur)', left + 8, y + 6);
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#111')
    .text(parent || '—', left + 8, y + 18);
  doc.font('Helvetica').fontSize(8).fillColor('#333')
    .text(`Pour l'élève : ${eleve || '—'}`, left + 8, y + 34);
  doc.text(`Matricule : ${matricule || '—'}   Classe : ${classe || '—'}`, left + usable / 2, y + 34, { width: usable / 2 - 8 });

  const totalDu = echeances.reduce((s, e) => s + Number(e.montantAttendu || 0), 0);
  const totalPaye = echeances.reduce((s, e) => s + Number(e.montantPaye || 0), 0);
  const reste = Math.max(0, totalDu - totalPaye);

  y += 66;
  doc.rect(left, y, usable, 48).fillAndStroke('#1a365d', '#1a365d');
  doc.fillColor('#fff').font('Helvetica').fontSize(8)
    .text('MONTANT DU VERSEMENT DU JOUR', left + 10, y + 8);
  doc.font('Helvetica-Bold').fontSize(16)
    .text(formatMontant(montant, devise), left + 10, y + 22);
  doc.font('Helvetica').fontSize(8)
    .text(MODE_LABELS[modePaiement] || modePaiement || 'Espèces', left, y + 12, { width: usable - 12, align: 'right' });
  if (reference) {
    doc.text(`Réf. ${reference}`, left, y + 26, { width: usable - 12, align: 'right' });
  }

  y += 56;
  doc.font('Helvetica-Oblique').fontSize(9).fillColor('#1a365d')
    .text(`Arrêté le présent reçu à la somme de : ${montantEnLettres(montant)}.`, left, y, { width: usable });
  if (motif) {
    y += 14;
    doc.font('Helvetica').fontSize(8).fillColor('#333').text(`Objet : ${motif}`, left, y);
  }

  y += 18;
  const boxW = (usable - 16) / 3;
  [
    ['Frais de base', formatMontant(totalDu, devise)],
    ['Déjà versé', formatMontant(totalPaye, devise)],
    ['Reste à verser', formatMontant(reste, devise)],
  ].forEach((b, i) => {
    const x = left + i * (boxW + 8);
    doc.rect(x, y, boxW, 32).stroke('#e2e8f0');
    doc.font('Helvetica').fontSize(7).fillColor('#666').text(b[0], x + 8, y + 5);
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#111').text(b[1], x + 8, y + 16);
  });

  y += 44;
  if (echeances.length) {
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#1a365d')
      .text('Détail mensuel de la scolarité', left, y);
    y += 14;
    const cols = [usable * 0.38, usable * 0.18, usable * 0.18, usable * 0.26];
    const headers = ['Mois / libellé', 'Dû', 'Payé', 'Reste / observation'];
    doc.rect(left, y, usable, 15).fill('#1a365d');
    doc.font('Helvetica-Bold').fontSize(7).fillColor('#fff');
    let x = left + 4;
    headers.forEach((h, i) => {
      doc.text(h, x, y + 4, { width: cols[i] - 4 });
      x += cols[i];
    });
    y += 15;
    doc.font('Helvetica').fontSize(8).fillColor('#111');
    for (const ech of echeances) {
      if (y > doc.page.height - 120) {
        doc.addPage();
        y = 40;
      }
      const attendu = Number(ech.montantAttendu || 0);
      const paye = Number(ech.montantPaye || 0);
      const r = Math.max(0, attendu - paye);
      const obs = r <= 0.01 ? 'Soldé' : (paye > 0 ? 'Acompte' : 'À payer');
      doc.rect(left, y, usable, 14).stroke('#edf2f7');
      const vals = [ech.libelle || '—', formatMontant(attendu, ''), formatMontant(paye, ''), `${formatMontant(r, '')}  ${obs}`];
      x = left + 4;
      vals.forEach((v, i) => {
        doc.text(String(v), x, y + 3, { width: cols[i] - 4 });
        x += cols[i];
      });
      y += 14;
    }
  }

  y += 16;
  doc.font('Helvetica-Oblique').fontSize(7).fillColor('#666')
    .text('Les frais de scolarité ne sont ni remboursables, ni cessibles, ni transférables. Conservez ce reçu : il constitue la preuve du versement.', left, y, { width: usable });

  y = Math.max(y + 28, doc.page.height - 130);
  doc.font('Helvetica').fontSize(8).fillColor('#333');
  doc.text('Le caissier / comptable', left, y, { width: usable / 3, align: 'center' });
  doc.text("Cachet de l'établissement", left + usable / 3, y, { width: usable / 3, align: 'center' });
  doc.text('Le parent / tuteur', left + (2 * usable) / 3, y, { width: usable / 3, align: 'center' });
  if (recuPar) {
    doc.fontSize(7).text(recuPar, left, y + 12, { width: usable / 3, align: 'center' });
  }
  doc.moveTo(left + 16, y + 42).lineTo(left + usable / 3 - 16, y + 42).stroke('#999');
  drawStamp(doc, left + usable / 2, y + 36);
  doc.moveTo(left + (2 * usable) / 3 + 16, y + 42).lineTo(left + usable - 16, y + 42).stroke('#999');

  drawFooter(doc, 'Reçu officiel de scolarité — Toute rature ou surcharge annule ce document.');
  doc.end();
  return done;
}
