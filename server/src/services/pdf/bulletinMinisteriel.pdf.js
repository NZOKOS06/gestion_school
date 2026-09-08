/**
 * bulletinMinisteriel.pdf.js
 *
 * Moteur de génération des bulletins scolaires officiels homologués par les Ministères
 * de l'Éducation en Afrique Centrale (MEPPSA pour la République du Congo, EPSP pour la RDC).
 *
 * Conforme aux grilles d'inspection et normes administratives :
 *   - En-tête d'État : Armoiries, Devise, Ministère, Direction Départementale, Inspection.
 *   - Fiche d'identification complète de l'élève (Matricule, Date/Lieu de naissance, Statut redoublant).
 *   - Grille officielle des notes groupées par domaines d'enseignement avec coefficients.
 *   - Moyenne de l'élève, Rang, Moyennes extrêmes de la classe (forte / faible / générale).
 *   - Tableau d'assiduité & discipline (absences justifiées/injustifiées, sanctions).
 *   - Distinctions & Décision du conseil (Tableau d'honneur, Félicitations, Avertissement, etc.).
 *   - 4 cadres officiels de signatures & cachet d'école.
 */

import PDFDocument from 'pdfkit';
import { toBuffer, formatDateFr } from './pdfHelpers.js';

const NAVY = '#1a365d';
const DARK_GRAY = '#2d3748';
const LIGHT_GRAY = '#f7fafc';
const BORDER_GRAY = '#cbd5e0';
const BORDER_DARK = '#4a5568';

const PAYS_CONFIG = {
  CG: {
    etat: 'RÉPUBLIQUE DU CONGO',
    devise: 'Unité – Travail – Progrès',
    ministere: "MINISTÈRE DE L'ENSEIGNEMENT PRÉSCOLAIRE, PRIMAIRE, SECONDAIRE ET DE L'ALPHABÉTISATION",
    inspectionDefault: 'INSPECTION DE LA CIRCONSCRIPTION SCOLAIRE',
    directionDefault: "DIRECTION DÉPARTEMENTALE DE L'ENSEIGNEMENT",
  },
  CD: {
    etat: 'RÉPUBLIQUE DÉMOCRATIQUE DU CONGO',
    devise: 'Justice – Paix – Travail',
    ministere: "MINISTÈRE DE L'ENSEIGNEMENT PRIMAIRE, SECONDAIRE ET PROFESSIONNEL",
    inspectionDefault: 'INSPECTION PRINCIPALE PROVINCIALE',
    directionDefault: 'SOUS-DIVISION URBAINE DE L’ENSEIGNEMENT',
  },
};

/**
 * Calcule l'appréciation pédagogique standard en fonction de la moyenne sur 20.
 */
function getAppreciation(moyenne) {
  const m = Number(moyenne || 0);
  if (m >= 18) return 'Excellent';
  if (m >= 16) return 'Très Bien';
  if (m >= 14) return 'Bien';
  if (m >= 12) return 'Assez Bien';
  if (m >= 10) return 'Passable';
  if (m >= 8) return 'Insuffisant';
  if (m >= 5) return 'Faible';
  return 'Très Faible';
}

/**
 * Génère le Bulletin Officiel Ministériel au format A4 portrait.
 * @param {object} data
 * @returns {Promise<Buffer>}
 */
export async function buildBulletinMinisterielPdf(data) {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 22, bottom: 22, left: 28, right: 28 },
    autoFirstPage: true,
  });

  const done = toBuffer(doc);

  const {
    pays = 'CG',
    nomEcole = 'GestSchool',
    adresseEcole = '',
    telephone = '',
    numeroAutorisation = '',
    inspection,
    directionDepartementale,
    anneeScolaire = '2025-2026',
    periodeIndex = 1,
    periodeLibelle = '1er TRIMESTRE',
    eleve = '—',
    matricule = '—',
    dateNaissance = null,
    lieuNaissance = null,
    sexe = null,
    statutEleve = 'Non redoublant',
    classe = '—',
    effectifClasse = 0,
    moyenneGenerale = 0,
    rang = '—',
    moyenneForte = null,
    moyenneFaible = null,
    moyenneClasse = null,
    absencesHeures = 0,
    absencesInjustifiees = 0,
    sanctions = 'Néant',
    mention = '',
    decisionConseil = null,
    notesDetaillees = [],
    observationDirection = null,
  } = data;

  const paysConf = PAYS_CONFIG[pays] || PAYS_CONFIG.CG;
  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const usableW = right - left;

  let y = doc.page.margins.top;

  // ─── 1. EN-TÊTE RÉPUBLICAIN & MINISTÉRIEL ───────────────────────────────────
  const colW = usableW / 3;

  // Gauche : Établissement
  doc.font('Helvetica-Bold').fontSize(10).fillColor(NAVY)
    .text(nomEcole.toUpperCase(), left, y, { width: colW + 20, align: 'left' });
  let yGauche = y + 13;
  if (numeroAutorisation) {
    doc.font('Helvetica').fontSize(6.5).fillColor('#4a5568')
      .text(`Arrêté d'ouv. N° : ${numeroAutorisation}`, left, yGauche, { width: colW + 20 });
    yGauche += 9;
  }
  if (adresseEcole) {
    doc.font('Helvetica').fontSize(6.5).fillColor('#4a5568')
      .text(adresseEcole, left, yGauche, { width: colW + 20 });
    yGauche += 9;
  }
  if (telephone) {
    doc.font('Helvetica').fontSize(6.5).fillColor('#4a5568')
      .text(`Tél : ${telephone}`, left, yGauche, { width: colW + 20 });
    yGauche += 9;
  }

  // Droite : République & Ministère
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor(NAVY)
    .text(paysConf.etat, right - colW - 30, y, { width: colW + 30, align: 'right' });
  doc.font('Helvetica-Oblique').fontSize(6.5).fillColor('#555')
    .text(paysConf.devise, right - colW - 30, y + 11, { width: colW + 30, align: 'right' });
  doc.font('Helvetica').fontSize(6.5).fillColor('#111')
    .text(paysConf.ministere, right - colW - 30, y + 21, { width: colW + 30, align: 'right' });
  const dirName = directionDepartementale || paysConf.directionDefault;
  doc.text(dirName, right - colW - 30, y + 36, { width: colW + 30, align: 'right' });
  const inspName = inspection || paysConf.inspectionDefault;
  doc.text(inspName, right - colW - 30, y + 45, { width: colW + 30, align: 'right' });

  // Double filet de séparation
  y = Math.max(yGauche, y + 56);
  doc.moveTo(left, y).lineTo(right, y).lineWidth(1.2).stroke(NAVY);
  doc.moveTo(left, y + 2.5).lineTo(right, y + 2.5).lineWidth(0.4).stroke(NAVY);
  y += 7;

  // ─── 2. BANDEAU TITRE DU BULLETIN ───────────────────────────────────────────
  const titreH = 22;
  doc.rect(left, y, usableW, titreH).fillAndStroke(NAVY, NAVY);
  const titreTexte = `BULLETIN DE NOTES DU ${periodeLibelle.toUpperCase()} — ANNÉE SCOLAIRE ${anneeScolaire}`;
  doc.font('Helvetica-Bold').fontSize(11).fillColor('#ffffff')
    .text(titreTexte, left, y + 6, { width: usableW, align: 'center' });
  y += titreH + 6;

  // ─── 3. FICHE SIGNALÉTIQUE DE L'ÉLÈVE ───────────────────────────────────────
  const infoBoxH = 46;
  doc.rect(left, y, usableW, infoBoxH).fillAndStroke(LIGHT_GRAY, BORDER_GRAY);

  const infoY = y + 5;
  const c1 = left + 8;
  const c2 = left + usableW * 0.52;

  // Colonne 1
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#111').text('Nom & Prénom(s) : ', c1, infoY, { continued: true });
  doc.font('Helvetica-Bold').fillColor(NAVY).text(eleve.toUpperCase());

  doc.font('Helvetica-Bold').fontSize(8).fillColor('#333').text('Matricule : ', c1, infoY + 13, { continued: true });
  doc.font('Helvetica').fillColor('#111').text(matricule);

  const dateLieu = [
    dateNaissance ? formatDateFr(dateNaissance) : null,
    lieuNaissance ? `à ${lieuNaissance}` : null,
  ].filter(Boolean).join(' ') || 'Non renseigné';
  doc.font('Helvetica-Bold').fontSize(8).fillColor('#333').text('Né(e) le : ', c1, infoY + 25, { continued: true });
  doc.font('Helvetica').fillColor('#111').text(dateLieu);

  // Colonne 2
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#333').text('Classe : ', c2, infoY, { continued: true });
  doc.font('Helvetica-Bold').fillColor(NAVY).text(`${classe}   (Effectif : ${effectifClasse} élèves)`);

  const sexeLabel = sexe === 'M' ? 'Masculin' : sexe === 'F' ? 'Féminin' : '—';
  doc.font('Helvetica-Bold').fontSize(8).fillColor('#333').text('Sexe : ', c2, infoY + 13, { continued: true });
  doc.font('Helvetica').fillColor('#111').text(`${sexeLabel}   ·   Statut : ${statutEleve}`);

  doc.font('Helvetica-Bold').fontSize(8).fillColor('#333').text('Période évaluée : ', c2, infoY + 25, { continued: true });
  doc.font('Helvetica').fillColor('#111').text(periodeLibelle);

  y += infoBoxH + 7;

  // ─── 4. TABLEAU OFFICIEL DES MATIÈRES & NOTES ───────────────────────────────
  const colMatW = usableW * 0.32;
  const colCoeffW = usableW * 0.08;
  const colEvalW = usableW * 0.12;
  const colCompW = usableW * 0.12;
  const colMoyW = usableW * 0.14;
  const colRangW = usableW * 0.08;
  const colAppW = usableW - (colMatW + colCoeffW + colEvalW + colCompW + colMoyW + colRangW);

  // Entête du tableau
  const headerH = 20;
  doc.rect(left, y, usableW, headerH).fillAndStroke('#2b6cb0', BORDER_DARK);
  doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#ffffff');

  let curX = left;
  doc.text('DISCIPLINES / MATIÈRES', curX + 4, y + 6, { width: colMatW - 6, align: 'left' });
  curX += colMatW;
  doc.text('COEFF', curX, y + 6, { width: colCoeffW, align: 'center' });
  curX += colCoeffW;
  doc.text('MOY /20', curX, y + 6, { width: colEvalW, align: 'center' });
  curX += colEvalW;
  doc.text('COMP /20', curX, y + 6, { width: colCompW, align: 'center' });
  curX += colCompW;
  doc.text('TOTAL COEFF', curX, y + 6, { width: colMoyW, align: 'center' });
  curX += colMoyW;
  doc.text('RANG', curX, y + 6, { width: colRangW, align: 'center' });
  curX += colRangW;
  doc.text('APPRÉCIATION', curX + 4, y + 6, { width: colAppW - 6, align: 'left' });

  y += headerH;

  // Lignes de notes
  let totalPoints = 0;
  let totalCoeffs = 0;
  const rowH = 16;

  notesDetaillees.forEach((matiereRow, index) => {
    const isZebra = index % 2 === 1;
    doc.rect(left, y, usableW, rowH).fillAndStroke(isZebra ? LIGHT_GRAY : '#ffffff', BORDER_GRAY);

    const coeff = Number(matiereRow.coefficient || matiereRow.matiere?.coefficient || 1);
    const moy = Number(matiereRow.moyenne ?? matiereRow.note ?? 0);
    const points = moy * coeff;
    totalPoints += points;
    totalCoeffs += coeff;

    curX = left;
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#1a202c')
      .text(matiereRow.matiereNom || matiereRow.matiere?.nom || 'Matière', curX + 4, y + 4, {
        width: colMatW - 6,
        ellipsis: true,
      });

    curX += colMatW;
    doc.font('Helvetica').fontSize(7.5).fillColor('#2d3748')
      .text(String(coeff), curX, y + 4, { width: colCoeffW, align: 'center' });

    curX += colCoeffW;
    doc.text(moy.toFixed(2), curX, y + 4, { width: colEvalW, align: 'center' });

    curX += colEvalW;
    const compVal = matiereRow.composition != null ? Number(matiereRow.composition).toFixed(2) : '—';
    doc.text(compVal, curX, y + 4, { width: colCompW, align: 'center' });

    curX += colCompW;
    doc.font('Helvetica-Bold').fillColor(NAVY)
      .text(points.toFixed(2), curX, y + 4, { width: colMoyW, align: 'center' });

    curX += colMoyW;
    doc.font('Helvetica').fillColor('#4a5568')
      .text(matiereRow.rang ? `${matiereRow.rang}e` : '—', curX, y + 4, { width: colRangW, align: 'center' });

    curX += colRangW;
    const app = matiereRow.appreciation || getAppreciation(moy);
    doc.font('Helvetica-Oblique').fontSize(7).fillColor('#2d3748')
      .text(app, curX + 4, y + 4, { width: colAppW - 6, ellipsis: true });

    y += rowH;
  });

  // Ligne Total des Coefficients & Points
  doc.rect(left, y, usableW, rowH).fillAndStroke('#edf2f7', BORDER_DARK);
  curX = left;
  doc.font('Helvetica-Bold').fontSize(8).fillColor(NAVY)
    .text('TOTAL GÉNÉRAL', curX + 4, y + 4, { width: colMatW - 6 });
  curX += colMatW;
  doc.text(String(totalCoeffs), curX, y + 4, { width: colCoeffW, align: 'center' });
  curX += colCoeffW + colEvalW + colCompW;
  doc.text(totalPoints.toFixed(2), curX, y + 4, { width: colMoyW, align: 'center' });
  y += rowH + 6;

  // ─── 5. BLOC RÉSULTATS GÉNÉRAUX & STATISTIQUES CLASSE ─────────────────────────
  const bilanH = 44;
  doc.rect(left, y, usableW, bilanH).fillAndStroke(LIGHT_GRAY, BORDER_DARK);

  const moyGenNum = Number(moyenneGenerale || (totalCoeffs > 0 ? totalPoints / totalCoeffs : 0));
  const bY = y + 5;

  // Cadre Moyenne & Rang de l'élève (gauche)
  doc.font('Helvetica-Bold').fontSize(10).fillColor(NAVY)
    .text(`MOYENNE GÉNÉRALE : ${moyGenNum.toFixed(2)} / 20`, left + 10, bY);
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#c53030')
    .text(`RANG : ${rang} ${rang === 1 ? 'er' : 'ème'} sur ${effectifClasse} élèves`, left + 10, bY + 15);
  const mentionFinale = mention || getAppreciation(moyGenNum);
  doc.font('Helvetica').fontSize(8).fillColor('#2d3748')
    .text(`Mention : ${mentionFinale.toUpperCase()}`, left + 10, bY + 28);

  // Statistiques de classe (centre/droite)
  const statsX = left + usableW * 0.52;
  doc.font('Helvetica-Bold').fontSize(8).fillColor(NAVY).text('STATISTIQUES DE LA CLASSE :', statsX, bY);
  const mForte = moyenneForte != null ? Number(moyenneForte).toFixed(2) : '—';
  const mFaible = moyenneFaible != null ? Number(moyenneFaible).toFixed(2) : '—';
  const mClasse = moyenneClasse != null ? Number(moyenneClasse).toFixed(2) : '—';
  doc.font('Helvetica').fontSize(7.5).fillColor('#333')
    .text(`Plus forte moyenne : ${mForte} / 20`, statsX, bY + 12);
  doc.text(`Plus faible moyenne : ${mFaible} / 20`, statsX, bY + 22);
  doc.text(`Moyenne de la classe : ${mClasse} / 20`, statsX + 150, bY + 12);

  y += bilanH + 6;

  // ─── 6. DISCIPLINE & ASSIDUITÉ + DÉCISION DU CONSEIL ──────────────────────────
  const discH = 34;
  doc.rect(left, y, usableW, discH).fillAndStroke('#ffffff', BORDER_GRAY);

  const discY = y + 4;
  doc.font('Helvetica-Bold').fontSize(7.5).fillColor(NAVY).text('DISCIPLINE & ASSIDUITÉ :', left + 8, discY);
  doc.font('Helvetica').fontSize(7.5).fillColor('#333')
    .text(`Absences justifiées : ${absencesHeures} h   ·   Injustifiées : ${absencesInjustifiees} h   ·   Sanctions : ${sanctions}`, left + 8, discY + 11);

  const decX = left + usableW * 0.52;
  doc.font('Helvetica-Bold').fontSize(7.5).fillColor(NAVY).text('DÉCISION DU CONSEIL DES PROFESSEURS :', decX, discY);
  const decText = decisionConseil || (moyGenNum >= 10 ? 'Admis(e) en classe supérieure' : 'Doit redoubler d’efforts');
  doc.font('Helvetica-Bold').fontSize(8).fillColor(moyGenNum >= 10 ? '#276749' : '#9b2c2c')
    .text(decText, decX, discY + 12);

  y += discH + 8;

  // ─── 7. CADRES DE SIGNATURES OFFICIELLES (4 VOLETS) ─────────────────────────
  const signW = usableW / 4;
  const signH = 54;

  const labels = [
    'Le Professeur Principal\nou Maître',
    'Le Directeur des Études',
    "Le Chef d'Établissement\n(Cachet & Signature)",
    'Signature des Parents\nou Tuteur',
  ];

  labels.forEach((lbl, i) => {
    const sX = left + i * signW;
    doc.rect(sX, y, signW, signH).stroke(BORDER_GRAY);
    doc.font('Helvetica-Bold').fontSize(7).fillColor('#4a5568')
      .text(lbl, sX + 4, y + 4, { width: signW - 8, align: 'center' });
  });

  // Emplacement cachet rond officiel au 3ème volet
  const cachetX = left + 2 * signW + signW / 2;
  const cachetY = y + signH / 2 + 6;
  doc.save();
  doc.circle(cachetX, cachetY, 15).lineWidth(0.6).dash(2, { space: 2 }).stroke('#a0aec0');
  doc.undash();
  doc.font('Helvetica').fontSize(5).fillColor('#a0aec0')
    .text('Cachet', cachetX - 12, cachetY - 3, { width: 24, align: 'center' });
  doc.restore();

  // ─── 8. PIED DE PAGE LÉGAL ──────────────────────────────────────────────────
  const footerY = doc.page.height - 18;
  doc.font('Helvetica-Oblique').fontSize(6.5).fillColor('#718096')
    .text(
      'Document officiel scolaire délivré conformément aux instructions ministérielles. Toute falsification ou rature annule ce document.',
      left,
      footerY,
      { width: usableW, align: 'center' }
    );

  doc.end();
  return done;
}
