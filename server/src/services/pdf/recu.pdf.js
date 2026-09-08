import PDFDocument from 'pdfkit';
import { montantEnLettres } from './montantLettres.js';
import { MODE_LABELS, TYPE_LABELS, formatDateFr, formatMontant, toBuffer } from './pdfHelpers.js';

const NAVY = '#1a365d';
const RED = '#c53030';
const LIGHT_BLUE = '#E8F0F8';
const BORDER = '#2d3748';
const MUTED = '#4a5568';

function designationFromPayment({ motif, typePaiement, libelle }) {
  if (motif && String(motif).trim()) return String(motif).trim();
  if (libelle && /inscription/i.test(libelle)) return "Frais d'inscription";
  if (libelle && /^avance/i.test(libelle)) return 'Avance sur scolarité';
  const typeLabel = TYPE_LABELS[typePaiement] || null;
  if (typeLabel && typePaiement !== 'scolarite' && typePaiement !== 'mensualite') {
    return typeLabel;
  }
  return 'Frais de Scolarité / Mensualité';
}

function periodeFromPayment({ periode, libelle, dateEcheance, datePaiement }) {
  if (periode && String(periode).trim()) return String(periode).trim();
  if (libelle && String(libelle).trim() && !/^avance/i.test(libelle)) {
    return String(libelle).trim();
  }
  const d = dateEcheance || datePaiement;
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  } catch {
    return '—';
  }
}

function formatRecuNumber(numeroRecu, datePaiement) {
  const year = datePaiement ? new Date(datePaiement).getFullYear() : new Date().getFullYear();
  const n = String(numeroRecu ?? '0').padStart(4, '0');
  return `N° ${year}-${n}`;
}

function dottedField(doc, x, y, label, value, width) {
  doc.font('Helvetica').fontSize(9).fillColor(MUTED).text(label, x, y, { continued: false });
  const labelW = doc.widthOfString(label) + 4;
  const valueX = x + labelW;
  const valueW = Math.max(40, width - labelW);
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#111')
    .text(value || '—', valueX, y - 1, { width: valueW });
  const underlineY = y + 12;
  doc.save();
  doc.moveTo(valueX, underlineY).lineTo(x + width, underlineY)
    .lineWidth(0.6).dash(1.5, { space: 1.5 }).stroke('#a0aec0');
  doc.undash();
  doc.restore();
}

/**
 * Reçu thermique 80mm (largeur rouleau standard ~226pt, hauteur dynamique ou adaptée).
 * Optimisé pour les imprimantes de caisse POS / tickets de caisse en direct.
 */
export function buildRecuThermiquePdf(data) {
  const width = 226; // 80mm
  const margin = 10;
  const usable = width - margin * 2;

  const {
    nomEcole = 'GestSchool',
    adresse,
    telephone,
    numeroRecu,
    datePaiement,
    montant,
    devise = 'FCFA',
    modePaiement,
    reference,
    motif,
    typePaiement,
    eleve,
    matricule,
    classe,
    anneeScolaire,
    recuPar,
    libelle,
    periode,
    dateEcheance,
    lignes,
  } = data;

  const detailLines = Array.isArray(lignes) && lignes.length
    ? lignes
    : [{
      designation: designationFromPayment({ motif, typePaiement, libelle }),
      periode: periodeFromPayment({ periode, libelle, dateEcheance, datePaiement }),
      montant: Number(montant) || 0,
    }];

  const total = detailLines.reduce((s, l) => s + Number(l.montant || 0), 0);

  // Estimation hauteur selon lignes
  const estimatedHeight = Math.max(480, 360 + detailLines.length * 28);
  const doc = new PDFDocument({ size: [width, estimatedHeight], margin });
  const done = toBuffer(doc);

  let y = margin + 4;

  // En-tête École
  doc.font('Helvetica-Bold').fontSize(11).fillColor('#000')
    .text((nomEcole || 'GestSchool').toUpperCase(), margin, y, { width: usable, align: 'center' });
  y += 14;

  if (adresse) {
    doc.font('Helvetica').fontSize(7.5).fillColor('#333')
      .text(adresse, margin, y, { width: usable, align: 'center' });
    y += 10;
  }
  if (telephone) {
    doc.font('Helvetica').fontSize(7.5).fillColor('#333')
      .text(`Tél : ${telephone}`, margin, y, { width: usable, align: 'center' });
    y += 10;
  }

  // Ligne de séparation
  y += 2;
  doc.moveTo(margin, y).lineTo(margin + usable, y).lineWidth(0.8).dash(2, { space: 2 }).stroke('#000');
  doc.undash();
  y += 8;

  // Titre Reçu & Date
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#000')
    .text('REÇU DE CAISSE', margin, y, { width: usable, align: 'center' });
  y += 13;

  doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#000')
    .text(formatRecuNumber(numeroRecu, datePaiement), margin, y, { width: usable, align: 'center' });
  y += 11;

  doc.font('Helvetica').fontSize(7.5).fillColor('#444')
    .text(`Date : ${formatDateFr(datePaiement)}`, margin, y, { width: usable, align: 'center' });
  y += 12;

  // Ligne pointillée
  doc.moveTo(margin, y).lineTo(margin + usable, y).lineWidth(0.5).dash(2, { space: 2 }).stroke('#666');
  doc.undash();
  y += 6;

  // Infos Élève
  doc.font('Helvetica-Bold').fontSize(8).fillColor('#000')
    .text(`Élève : ${eleve || '—'}`, margin, y, { width: usable });
  y += 11;

  const subInfos = [
    matricule ? `Matr: ${matricule}` : null,
    classe ? `Classe: ${classe}` : null,
  ].filter(Boolean).join('  ·  ');
  if (subInfos) {
    doc.font('Helvetica').fontSize(7.5).fillColor('#333').text(subInfos, margin, y, { width: usable });
    y += 10;
  }
  if (anneeScolaire) {
    doc.font('Helvetica').fontSize(7).fillColor('#555').text(`Année : ${anneeScolaire}`, margin, y, { width: usable });
    y += 10;
  }

  // Ligne séparation
  y += 2;
  doc.moveTo(margin, y).lineTo(margin + usable, y).lineWidth(0.5).stroke('#000');
  y += 6;

  // Détails paiement
  detailLines.forEach((line) => {
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#000')
      .text(line.designation || 'Paiement', margin, y, { width: usable * 0.65 });
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#000')
      .text(formatMontant(line.montant, devise), margin + usable * 0.65, y, {
        width: usable * 0.35,
        align: 'right',
      });
    y += 11;

    if (line.periode && line.periode !== '—') {
      doc.font('Helvetica-Oblique').fontSize(7).fillColor('#555')
        .text(`Période : ${line.periode}`, margin + 4, y, { width: usable - 4 });
      y += 9;
    }
  });

  // Mode de règlement
  y += 2;
  doc.moveTo(margin, y).lineTo(margin + usable, y).lineWidth(0.5).stroke('#000');
  y += 5;

  const modeLabel = MODE_LABELS[modePaiement] || modePaiement || 'Espèces';
  doc.font('Helvetica').fontSize(7.5).fillColor('#333')
    .text(`Règlement : ${modeLabel}`, margin, y, { width: usable });
  y += 10;
  if (reference) {
    doc.font('Helvetica').fontSize(7).fillColor('#555')
      .text(`Réf Trans : ${reference}`, margin, y, { width: usable });
    y += 9;
  }

  // Ligne double total
  y += 2;
  doc.moveTo(margin, y).lineTo(margin + usable, y).lineWidth(1).stroke('#000');
  y += 5;

  doc.font('Helvetica-Bold').fontSize(11).fillColor('#000')
    .text(`TOTAL : ${formatMontant(total, devise)}`, margin, y, { width: usable, align: 'center' });
  y += 15;

  // Montant en toutes lettres
  const lettres = montantEnLettres(total);
  if (lettres) {
    doc.font('Helvetica-Oblique').fontSize(6.5).fillColor('#333')
      .text(`(${lettres})`, margin, y, { width: usable, align: 'center' });
    y += 12;
  }

  // Caissier & Message
  if (recuPar) {
    doc.font('Helvetica').fontSize(7).fillColor('#444')
      .text(`Encaissé par : ${recuPar}`, margin, y, { width: usable, align: 'center' });
    y += 10;
  }

  y += 4;
  doc.moveTo(margin, y).lineTo(margin + usable, y).lineWidth(0.5).dash(2, { space: 2 }).stroke('#888');
  doc.undash();
  y += 8;

  doc.font('Helvetica-Bold').fontSize(7).fillColor('#000')
    .text('Conservez précieusement ce reçu.', margin, y, { width: usable, align: 'center' });
  y += 9;
  doc.font('Helvetica').fontSize(6.5).fillColor('#666')
    .text('Document certifié par GestSchool', margin, y, { width: usable, align: 'center' });

  doc.end();
  return done;
}

/**
 * Reçu de paiement scolaire (modèle administratif A4 / demi-page).
 * Une ligne de détail = un mois / une période / une avance.
 */
export function buildRecuA4Pdf(data) {
  const doc = new PDFDocument({ size: 'A4', margin: 36 });
  const done = toBuffer(doc);

  const {
    nomEcole = 'GestSchool',
    adresse,
    telephone,
    email,
    slogan,
    agrement,
    niveaux,
    numeroRecu,
    datePaiement,
    montant,
    devise = 'FCFA',
    modePaiement,
    reference,
    motif,
    typePaiement,
    eleve,
    matricule,
    classe,
    anneeScolaire,
    parent,
    recuPar,
    libelle,
    periode,
    dateEcheance,
    lignes,
  } = data;

  const left = 40;
  const usable = doc.page.width - 80;
  const half = doc.page.height / 2;

  const detailLines = Array.isArray(lignes) && lignes.length
    ? lignes
    : [{
      designation: designationFromPayment({ motif, typePaiement, libelle }),
      periode: periodeFromPayment({ periode, libelle, dateEcheance, datePaiement }),
      montant: Number(montant) || 0,
    }];

  const total = detailLines.reduce((s, l) => s + Number(l.montant || 0), 0);

  // Cadre extérieur
  doc.rect(28, 24, doc.page.width - 56, half - 40).lineWidth(1.4).stroke(BORDER);

  // En-tête école (gauche) + boîte reçu (droite)
  let y = 36;
  doc.font('Helvetica-Bold').fontSize(13).fillColor(NAVY)
    .text((nomEcole || 'GestSchool').toUpperCase(), left, y, { width: usable * 0.62 });

  const boxW = 168;
  const boxX = left + usable - boxW;
  doc.rect(boxX, y - 4, boxW, 36).lineWidth(0.9).dash(3, { space: 2 }).stroke('#718096');
  doc.undash();
  doc.font('Helvetica').fontSize(8).fillColor(MUTED)
    .text('REÇU N° :', boxX + 8, y + 2);
  doc.font('Helvetica-Bold').fontSize(11).fillColor(RED)
    .text(formatRecuNumber(numeroRecu, datePaiement), boxX + 52, y, { width: boxW - 60 });
  doc.font('Helvetica').fontSize(9).fillColor('#111')
    .text(`Date : ${formatDateFr(datePaiement)}`, boxX + 8, y + 18);

  y += 18;
  const niveauxLine = niveaux || slogan || 'Maternelle - Primaire - Collège - Lycée';
  doc.font('Helvetica').fontSize(8).fillColor(MUTED)
    .text(niveauxLine, left, y, { width: usable * 0.62 });
  y += 12;
  if (adresse) {
    doc.font('Helvetica').fontSize(8).fillColor(MUTED)
      .text(adresse, left, y, { width: usable * 0.62 });
    y += 11;
  }
  const contact = [telephone, email].filter(Boolean).join('  ·  ');
  if (contact) {
    doc.font('Helvetica').fontSize(7.5).fillColor(MUTED)
      .text(contact, left, y, { width: usable * 0.62 });
    y += 11;
  }
  if (agrement) {
    doc.font('Helvetica').fontSize(7.5).fillColor(MUTED)
      .text(agrement, left, y, { width: usable * 0.62 });
    y += 11;
  }

  y = Math.max(y, 88);
  doc.moveTo(left, y).lineTo(left + usable, y).lineWidth(0.8).stroke(NAVY);
  y += 14;

  // Identité payeur / élève
  const colW = (usable - 16) / 2;
  dottedField(doc, left, y, 'Reçu de M./Mme :', parent || '—', colW);
  dottedField(doc, left + colW + 16, y, 'Matricule :', matricule || '—', colW);
  y += 22;
  dottedField(doc, left, y, "Pour l'Élève :", eleve || '—', colW);
  dottedField(doc, left + colW + 16, y, 'Classe :', classe || '—', colW);
  y += 26;

  if (anneeScolaire) {
    doc.font('Helvetica').fontSize(8).fillColor(MUTED)
      .text(`Année scolaire : ${anneeScolaire}`, left, y);
    y += 14;
  }

  // Table
  const colDes = usable * 0.48;
  const colPer = usable * 0.26;
  const colMont = usable * 0.26;
  const headerH = 20;

  doc.rect(left, y, usable, headerH).fill(LIGHT_BLUE).stroke(BORDER);
  doc.font('Helvetica-Bold').fontSize(8).fillColor(NAVY);
  doc.text('DÉSIGNATION / MOTIF DU PAIEMENT', left + 6, y + 6, { width: colDes - 8 });
  doc.text('MOIS / PÉRIODE', left + colDes, y + 6, { width: colPer, align: 'center' });
  doc.text(`MONTANT PAYÉ (${devise})`, left + colDes + colPer, y + 6, { width: colMont - 6, align: 'right' });
  y += headerH;

  detailLines.forEach((line) => {
    const rowH = 22;
    doc.rect(left, y, usable, rowH).stroke(BORDER);
    doc.moveTo(left + colDes, y).lineTo(left + colDes, y + rowH).stroke(BORDER);
    doc.moveTo(left + colDes + colPer, y).lineTo(left + colDes + colPer, y + rowH).stroke(BORDER);

    doc.font('Helvetica').fontSize(9).fillColor('#111')
      .text(line.designation || '—', left + 6, y + 6, { width: colDes - 10 });
    doc.text(line.periode || '—', left + colDes, y + 6, { width: colPer, align: 'center' });
    doc.font('Helvetica-Bold').fontSize(9)
      .text(formatMontant(line.montant, devise), left + colDes + colPer, y + 6, {
        width: colMont - 6,
        align: 'right',
      });
    y += rowH;
  });

  y += 12;

  // Total + montant en lettres
  const totalBoxW = 190;
  const totalBoxX = left + usable - totalBoxW;
  const lettres = `Arrêté la présente somme à : ${montantEnLettres(total)}.`;
  doc.font('Helvetica-Oblique').fontSize(9).fillColor(NAVY)
    .text(lettres, left, y + 4, { width: usable - totalBoxW - 12 });

  doc.rect(totalBoxX, y, totalBoxW, 28).fillAndStroke(LIGHT_BLUE, BORDER);
  doc.font('Helvetica-Bold').fontSize(10).fillColor(NAVY)
    .text(`TOTAL PAYÉ : ${formatMontant(total, devise)}`, totalBoxX + 8, y + 9, {
      width: totalBoxW - 16,
      align: 'right',
    });

  y += 40;

  // Mode / référence
  const metaBits = [
    MODE_LABELS[modePaiement] || modePaiement,
    reference ? `Réf. ${reference}` : null,
  ].filter(Boolean);
  if (metaBits.length) {
    doc.font('Helvetica').fontSize(8).fillColor(MUTED)
      .text(metaBits.join('  ·  '), left, y, { width: usable });
    y += 14;
  }

  // Signatures
  const sigW = usable / 3;
  doc.font('Helvetica').fontSize(8).fillColor('#333');
  doc.text('Signature du Parent / Payeur', left, y, { width: sigW, align: 'center' });
  doc.text('La Caisse / Comptabilité', left + sigW, y, { width: sigW, align: 'center' });
  doc.text("Cachet de l'Établissement", left + 2 * sigW, y, { width: sigW, align: 'center' });

  if (recuPar) {
    doc.fontSize(7).fillColor(MUTED)
      .text(recuPar, left + sigW, y + 12, { width: sigW, align: 'center' });
  }

  doc.moveTo(left + 20, y + 42).lineTo(left + sigW - 20, y + 42).lineWidth(0.5).stroke('#999');
  doc.moveTo(left + sigW + 20, y + 42).lineTo(left + 2 * sigW - 20, y + 42).stroke('#999');

  // Découpe
  doc.font('Helvetica-Oblique').fontSize(6.5).fillColor('#888')
    .text('Frais non remboursables. Conservez ce reçu : il constitue la preuve du versement.', left, half - 22, {
      width: usable,
      align: 'center',
    });
  doc.moveTo(left, half - 6).lineTo(left + usable, half - 6)
    .lineWidth(0.5).dash(3, { space: 3 }).stroke('#bbb');
  doc.undash();
  doc.font('Helvetica').fontSize(6).fillColor('#bbb')
    .text('— découper ici —', left, half - 3, { width: usable, align: 'center' });

  doc.end();
  return done;
}

/**
 * Générateur principal de reçus supportant les deux formats :
 * - 'a4' : Reçu administratif avec souche à découper (défaut).
 * - 'thermique' : Ticket de caisse 80mm pour imprimantes thermiques POS.
 *
 * @param {object} data Données du paiement et de l'école
 * @param {'a4'|'thermique'} [requestedFormat] Format forcé ou déduit de data.format
 * @returns {Promise<Buffer>}
 */
export function buildRecuPdf(data, requestedFormat = null) {
  const format = String(requestedFormat || data?.format || 'a4').toLowerCase();
  if (format === 'thermique' || format === 'pos' || format === '80mm' || format === 'ticket') {
    return buildRecuThermiquePdf(data);
  }
  return buildRecuA4Pdf(data);
}

