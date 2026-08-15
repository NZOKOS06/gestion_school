import PDFDocument from 'pdfkit';
import {
  formatDateFr, drawOfficialHeader, drawStamp, drawFooter, toBuffer,
} from './pdfHelpers.js';

const TYPE_TITRES = {
  scolarite: 'CERTIFICAT DE SCOLARITÉ',
  inscription: "CERTIFICAT D'INSCRIPTION",
  fin_etudes: "CERTIFICAT DE FIN D'ÉTUDES",
  attestation_inscription: "ATTESTATION D'INSCRIPTION",
  releve_notes: 'RELEVÉ DE NOTES',
  carte_scolaire: 'CARTE SCOLAIRE',
  convocation_examen: "CONVOCATION D'EXAMEN",
  autre: 'ATTESTATION DE SCOLARITÉ',
};

export function titreCertificat(type) {
  return TYPE_TITRES[type] || TYPE_TITRES.autre;
}

function identiteEleve({ eleve, matricule, dateNaissance, lieuNaissance, sexe }) {
  const nom = eleve || '—';
  const nee = sexe === 'F' ? 'née' : 'né';
  const naissance = dateNaissance
    ? `${nee}(e) le ${formatDateFr(dateNaissance)}${lieuNaissance ? ` à ${lieuNaissance}` : ''}`
    : '';
  return { nom, naissance, matricule: matricule || '—' };
}

export function contenuCertificat(data) {
  const {
    type, eleve, matricule, classe, anneeScolaire, nomEcole,
    dateNaissance, lieuNaissance, sexe, parent, delivrePar,
  } = data;
  const annee = anneeScolaire || "l'année en cours";
  const cl = classe || '—';
  const { nom, naissance } = identiteEleve({ eleve, matricule, dateNaissance, lieuNaissance, sexe });
  const signataire = delivrePar || "Chef d'établissement";
  const filiation = parent ? ` fils/fille de ${parent},` : '';
  const identite = naissance
    ? `${nom}, ${naissance},${filiation} matricule ${matricule || '—'}`
    : `${nom}${filiation} (matricule ${matricule || '—'})`;

  let corps;
  switch (type) {
    case 'inscription':
    case 'attestation_inscription':
      corps = `Je soussigné(e), ${signataire}, Chef d'établissement de ${nomEcole}, certifie que ${identite} est régulièrement inscrit(e) en classe de ${cl} pour l'année scolaire ${annee}, et suit les cours prévus au programme officiel.`;
      break;
    case 'fin_etudes':
      corps = `Je soussigné(e), ${signataire}, Chef d'établissement de ${nomEcole}, certifie que ${identite} a achevé sa scolarité en classe de ${cl} au titre de l'année scolaire ${annee}.`;
      break;
    case 'releve_notes':
      corps = `Je soussigné(e), ${signataire}, Chef d'établissement de ${nomEcole}, atteste la délivrance du relevé de notes de ${identite}, classe de ${cl}, année scolaire ${annee}.`;
      break;
    default:
      corps = `Je soussigné(e), ${signataire}, Chef d'établissement de ${nomEcole}, certifie que ${identite} est élève régulier(ère) de cet établissement, inscrit(e) en classe de ${cl} pour l'année scolaire ${annee}, et fréquente assidûment les cours.`;
  }
  return `${corps} En foi de quoi, le présent certificat lui est délivré pour servir et valoir ce que de droit.`;
}

/**
 * Certificat / attestation A4 — forme officielle francophone
 * (République, identité, formule « Je soussigné », cachet).
 */
export function buildCertificatPdf(data) {
  const doc = new PDFDocument({ size: 'A4', margin: 48 });
  const done = toBuffer(doc);

  const {
    pays = 'CG',
    nomEcole = 'GestSchool',
    type = 'scolarite',
    eleve,
    matricule,
    classe,
    anneeScolaire,
    numeroSerie,
    dateDelivrance = new Date(),
    delivrePar,
    adresse,
    telephone,
    email,
    dateNaissance,
    lieuNaissance,
    sexe,
    parent,
    ville,
  } = data;

  const left = 48;
  const usable = doc.page.width - 96;
  const titre = titreCertificat(type);

  let y = drawOfficialHeader(doc, {
    pays, nomEcole, adresse, telephone, email, titre,
  });

  y += 8;
  doc.font('Helvetica').fontSize(10).fillColor('#1a365d')
    .text(`N° ${numeroSerie || '—'}`, left, y);
  doc.text(`Année scolaire : ${anneeScolaire || '—'}`, left, y, { width: usable, align: 'right' });

  y += 22;
  const signataire = delivrePar || "Chef d'établissement";
  doc.font('Helvetica').fontSize(11).fillColor('#111')
    .text(
      `Je soussigné(e), ${signataire}, Chef d'établissement de ${nomEcole}, certifie que :`,
      left + 4,
      y,
      { width: usable - 8, lineGap: 4 }
    );

  y += 36;
  const rows = [
    ['Élève', eleve || '—'],
    ['Né(e) le', `${formatDateFr(dateNaissance)}${lieuNaissance ? ` à ${lieuNaissance}` : ''}`],
    [sexe === 'F' ? 'Fille de' : 'Fils / fille de', parent || '—'],
    ['Matricule', matricule || '—'],
    ['Classe', classe || '—'],
    ['Année scolaire', anneeScolaire || '—'],
  ];
  const rowH = 18;
  doc.rect(left, y, usable, rows.length * rowH).stroke('#1a365d');
  rows.forEach((r, i) => {
    const ry = y + i * rowH;
    if (i % 2 === 0) doc.rect(left, ry, usable, rowH).fill('#f7fafc');
    doc.rect(left, ry, 130, rowH).stroke('#cbd5e0');
    doc.rect(left + 130, ry, usable - 130, rowH).stroke('#cbd5e0');
    doc.font('Helvetica').fontSize(8).fillColor('#555').text(r[0], left + 8, ry + 5, { width: 114 });
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#111').text(r[1], left + 138, ry + 4, { width: usable - 146 });
  });

  y += rows.length * rowH + 22;
  let attestation;
  switch (type) {
    case 'inscription':
    case 'attestation_inscription':
      attestation = "est régulièrement inscrit(e) dans cet établissement et suit les cours prévus au programme officiel.";
      break;
    case 'fin_etudes':
      attestation = "a achevé sa scolarité dans cet établissement au titre de l'année scolaire indiquée.";
      break;
    case 'releve_notes':
      attestation = "s'est vu délivrer le relevé de notes correspondant à la période indiquée.";
      break;
    default:
      attestation = "est élève régulier(ère) de cet établissement et fréquente assidûment les cours.";
  }
  doc.font('Helvetica').fontSize(11).fillColor('#111')
    .text(attestation, left + 4, y, { width: usable - 8, align: 'justify', lineGap: 4 });

  y += 36;
  doc.font('Helvetica-Oblique').fontSize(11)
    .text(
      'En foi de quoi, le présent certificat lui est délivré pour servir et valoir ce que de droit.',
      left + 4,
      y,
      { width: usable - 8, align: 'justify' }
    );

  y += 36;
  const lieu = ville || nomEcole;
  doc.font('Helvetica').fontSize(10)
    .text(`Fait à ${lieu}, le ${formatDateFr(dateDelivrance)}.`, left, y, { width: usable, align: 'right' });

  y += 32;
  doc.font('Helvetica-Bold').fontSize(9)
    .text("Le Chef d'établissement", left + usable / 2, y, { width: usable / 2, align: 'center' });
  if (delivrePar) {
    doc.font('Helvetica').fontSize(8).text(delivrePar, left + usable / 2, y + 14, { width: usable / 2, align: 'center' });
  }
  drawStamp(doc, left + usable / 2 + usable / 4, y + 58);
  doc.moveTo(left + usable / 2 + 30, y + 96).lineTo(left + usable - 20, y + 96).stroke('#999');

  y += 120;
  doc.font('Helvetica-Oblique').fontSize(7).fillColor('#666')
    .text(
      'Document officiel. Toute falsification, rature ou surcharge est passible de poursuites. À présenter sur demande des autorités compétentes.',
      left,
      y,
      { width: usable, align: 'center' }
    );

  drawFooter(doc, 'Certificat généré par GestSchool — Conservez l\'original.');
  doc.end();
  return done;
}

export function buildPreviewPayload(data) {
  const {
    type = 'scolarite',
    eleve,
    matricule,
    classe,
    anneeScolaire,
    numeroSerie,
    nomEcole = 'GestSchool',
    dateNaissance,
    lieuNaissance,
    sexe,
    parent,
    delivrePar,
  } = data;
  return {
    titre: titreCertificat(type),
    eleveNom: eleve,
    eleveMatricule: matricule,
    numeroSerie: numeroSerie || '(sera attribué)',
    contenu: contenuCertificat({
      type, eleve, matricule, classe, anneeScolaire, nomEcole,
      dateNaissance, lieuNaissance, sexe, parent, delivrePar,
    }),
  };
}
