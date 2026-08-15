export const MODE_LABELS = {
  especes: 'Espèces',
  mobile_money: 'Mobile Money',
  carte: 'Carte',
  cheque: 'Chèque',
  virement: 'Virement',
};

export const TYPE_LABELS = {
  inscription: 'Inscription',
  scolarite: 'Scolarité',
  mensualite: 'Mensualité',
  examen_officiel: 'Examen',
  bibliotheque: 'Bibliothèque',
  cantine: 'Cantine',
  transport: 'Transport',
  uniforme: 'Uniforme',
  autre: 'Autre',
};

export const PAYS_HEADERS = {
  CG: { etat: 'RÉPUBLIQUE DU CONGO', devise: 'Unité – Travail – Progrès', ministere: "MINISTÈRE DE L'ÉDUCATION NATIONALE ET DE L'ALPHABÉTISATION" },
  CD: { etat: 'RÉPUBLIQUE DÉMOCRATIQUE DU CONGO', devise: 'Justice – Paix – Travail', ministere: "MINISTÈRE DE L'ENSEIGNEMENT PRIMAIRE, SECONDAIRE ET PROFESSIONNEL" },
  CI: { etat: "RÉPUBLIQUE DE CÔTE D'IVOIRE", devise: 'Union – Discipline – Travail', ministere: "MINISTÈRE DE L'ÉDUCATION NATIONALE ET DE L'ALPHABÉTISATION" },
  CM: { etat: 'RÉPUBLIQUE DU CAMEROUN', devise: 'Paix – Travail – Patrie', ministere: "MINISTÈRE DE L'ÉDUCATION DE BASE" },
  SN: { etat: 'RÉPUBLIQUE DU SÉNÉGAL', devise: 'Un Peuple – Un But – Une Foi', ministere: "MINISTÈRE DE L'ÉDUCATION NATIONALE" },
};

export function formatDateFr(d) {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('fr-FR');
  } catch {
    return '—';
  }
}

export function formatMontant(n, devise = 'FCFA') {
  const num = Number(n || 0).toLocaleString('fr-FR');
  return devise ? `${num} ${devise}` : num;
}

export function paysHeader(paysCode) {
  return PAYS_HEADERS[paysCode] || PAYS_HEADERS.CG;
}

/** En-tête type document officiel (République / Ministère / École). */
export function drawOfficialHeader(doc, {
  pays = 'CG',
  nomEcole = 'GestSchool',
  adresse,
  telephone,
  email,
  titre,
}) {
  const left = doc.page.margins.left;
  const usable = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const h = paysHeader(pays);

  doc.font('Helvetica-Bold').fontSize(9).fillColor('#1a365d')
    .text(h.etat, left, 28, { width: usable, align: 'center' });
  doc.font('Helvetica-Oblique').fontSize(7).fillColor('#555')
    .text(h.devise, left, 40, { width: usable, align: 'center' });
  doc.font('Helvetica').fontSize(8).fillColor('#1a365d')
    .text(h.ministere, left, 52, { width: usable, align: 'center' });

  doc.moveTo(left, 66).lineTo(left + usable, 66).lineWidth(1.2).stroke('#1a365d');
  doc.moveTo(left, 69).lineTo(left + usable, 69).lineWidth(0.4).stroke('#1a365d');

  doc.font('Helvetica-Bold').fontSize(12).fillColor('#111')
    .text((nomEcole || 'GestSchool').toUpperCase(), left, 76, { width: usable, align: 'center' });
  const contact = [adresse, telephone, email].filter(Boolean).join('  ·  ');
  if (contact) {
    doc.font('Helvetica').fontSize(8).fillColor('#444')
      .text(contact, left, 92, { width: usable, align: 'center' });
  }

  const titreY = contact ? 108 : 96;
  doc.rect(left, titreY, usable, 22).fillAndStroke('#1a365d', '#1a365d');
  doc.font('Helvetica-Bold').fontSize(11).fillColor('#fff')
    .text(titre, left, titreY + 6, { width: usable, align: 'center' });

  return titreY + 30;
}

export function drawStamp(doc, cx, cy, label = "CACHE T\nDE L'ÉCOLE") {
  doc.save();
  doc.circle(cx, cy, 28).lineWidth(1).stroke('#c53030');
  doc.circle(cx, cy, 24).lineWidth(0.4).stroke('#c53030');
  doc.font('Helvetica-Bold').fontSize(6).fillColor('#c53030')
    .text(label, cx - 22, cy - 8, { width: 44, align: 'center', lineGap: 1 });
  doc.restore();
}

export function drawHeader(doc, opts) {
  return drawOfficialHeader(doc, opts);
}

export function drawFooter(doc, text = 'Document généré par GestSchool — Conservez ce document.') {
  const left = doc.page.margins.left;
  const usable = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const y = doc.page.height - 32;
  doc.font('Helvetica').fontSize(7).fillColor('#888')
    .text(text, left, y, { width: usable, align: 'center' });
}

export function toBuffer(doc) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
}
