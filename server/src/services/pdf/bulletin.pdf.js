import PDFDocument from 'pdfkit';
import {
  formatDateFr, drawOfficialHeader, drawStamp, drawFooter, toBuffer,
} from './pdfHelpers.js';

const MENTION_LABELS = {
  felicitations: 'Félicitations',
  tableau_honneur: "Tableau d'honneur",
  encouragements: 'Encouragements',
  avertissement_travail: 'Avertissement travail',
  avertissement_conduite: 'Avertissement conduite',
  aucune: '—',
};

function appreciation(moy) {
  if (moy == null || Number.isNaN(Number(moy))) return '—';
  const n = Number(moy);
  if (n >= 16) return 'Très Bien';
  if (n >= 14) return 'Bien';
  if (n >= 12) return 'Assez Bien';
  if (n >= 10) return 'Passable';
  return 'Insuffisant';
}

/**
 * Bulletin de notes A4 — forme établissement francophone
 * (République, identité, tableau matières, synthèse, cachet).
 */
export function buildBulletinPdf(data) {
  const doc = new PDFDocument({ size: 'A4', margin: 36 });
  const done = toBuffer(doc);

  const {
    pays = 'CG',
    nomEcole = 'GestSchool',
    adresseEcole = '',
    telephone,
    email,
    eleve,
    matricule,
    dateNaissance,
    lieuNaissance,
    sexe,
    parent,
    classe,
    anneeScolaire,
    periodeIndex,
    periodeLibelle,
    moyenneGenerale,
    rang,
    effectifClasse,
    mention,
    notesDetaillees = [],
    absencesHeures = 0,
    qrCodeHash,
    decisionConseil,
    notationSur = 20,
  } = data;

  const left = 36;
  const usable = doc.page.width - 72;
  let y = drawOfficialHeader(doc, {
    pays,
    nomEcole,
    adresse: adresseEcole,
    telephone,
    email,
    titre: 'BULLETIN DE NOTES',
  });

  y += 4;
  doc.font('Helvetica').fontSize(9).fillColor('#333');
  doc.text(`Année scolaire : ${anneeScolaire || '—'}`, left, y);
  doc.text(periodeLibelle || `Période ${periodeIndex}`, left + usable / 2, y, { width: usable / 2, align: 'right' });

  y += 16;
  doc.rect(left, y, usable, 48).stroke('#cbd5e0');
  doc.font('Helvetica-Bold').fontSize(11).fillColor('#111')
    .text(eleve || '—', left + 8, y + 6);
  doc.font('Helvetica').fontSize(8).fillColor('#333')
    .text(`Matricule : ${matricule || '—'}    Classe : ${classe || '—'}    Sexe : ${sexe === 'F' ? 'Féminin' : sexe === 'M' ? 'Masculin' : (sexe || '—')}`, left + 8, y + 22);
  doc.text(
    `Né(e) le : ${formatDateFr(dateNaissance)}${lieuNaissance ? ` à ${lieuNaissance}` : ''}${parent ? `    Parent / tuteur : ${parent}` : ''}`,
    left + 8,
    y + 32,
    { width: usable - 16 }
  );

  y += 60;
  const col = {
    matiere: left,
    moy: left + 210,
    coef: left + 268,
    pts: left + 318,
    app: left + 390,
  };
  const rowH = 16;
  doc.rect(left, y, usable, rowH).fillAndStroke('#1a365d', '#1a365d');
  doc.fillColor('#fff').font('Helvetica-Bold').fontSize(7);
  doc.text('DISCIPLINES / MATIÈRES', col.matiere + 4, y + 4, { width: 200 });
  doc.text('MOY.', col.moy, y + 4, { width: 50, align: 'center' });
  doc.text('COEF.', col.coef, y + 4, { width: 46, align: 'center' });
  doc.text('POINTS', col.pts, y + 4, { width: 60, align: 'center' });
  doc.text('APPRÉCIATION', col.app, y + 4, { width: 90, align: 'center' });
  y += rowH;

  let totalCoef = 0;
  let totalPts = 0;
  const notes = Array.isArray(notesDetaillees) ? notesDetaillees : [];
  notes.forEach((m, idx) => {
    if (y > 680) {
      doc.addPage();
      y = 50;
    }
    if (idx % 2 === 0) doc.rect(left, y, usable, rowH).fill('#f7fafc');
    const moy = m.moyenne != null ? Number(m.moyenne) : null;
    const coef = Number(m.coefficient ?? 1);
    const pts = moy != null ? Math.round(moy * coef * 100) / 100 : null;
    if (moy != null) {
      totalCoef += coef;
      totalPts += moy * coef;
    }
    doc.fillColor('#000').font('Helvetica').fontSize(8);
    doc.text(m.matiereNom || m.matiere?.nom || '—', col.matiere + 4, y + 4, { width: 200 });
    doc.text(moy != null ? moy.toFixed(2) : '—', col.moy, y + 4, { width: 50, align: 'center' });
    doc.text(String(coef), col.coef, y + 4, { width: 46, align: 'center' });
    doc.text(pts != null ? pts.toFixed(2) : '—', col.pts, y + 4, { width: 60, align: 'center' });
    doc.fontSize(7).text(appreciation(moy), col.app, y + 4, { width: 90, align: 'center' });
    doc.rect(left, y, usable, rowH).stroke('#d0d7de');
    y += rowH;
  });
  if (!notes.length) {
    doc.font('Helvetica').fontSize(8).fillColor('#666')
      .text('Aucune note saisie pour cette période.', left + 6, y + 6);
    y += rowH;
  } else {
    doc.rect(left, y, usable, rowH).fillAndStroke('#edf2f7', '#1a365d');
    doc.fillColor('#1a365d').font('Helvetica-Bold').fontSize(8);
    doc.text('TOTAL', col.matiere + 4, y + 4, { width: 200 });
    doc.text(String(totalCoef || '—'), col.coef, y + 4, { width: 46, align: 'center' });
    doc.text(totalPts ? totalPts.toFixed(2) : '—', col.pts, y + 4, { width: 60, align: 'center' });
    y += rowH;
  }

  const mg = Number(moyenneGenerale) || (totalCoef > 0 ? totalPts / totalCoef : 0);
  y += 12;
  doc.rect(left, y, usable, 78).stroke('#1a365d');
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#1a365d')
    .text('RÉSULTATS ET DÉCISION DU CONSEIL DE CLASSE', left + 8, y + 8);
  doc.font('Helvetica').fontSize(9).fillColor('#000');
  doc.text(`Moyenne générale : ${mg.toFixed(2)} / ${notationSur}`, left + 8, y + 26);
  doc.text(`Rang : ${rang || '—'} / ${effectifClasse || '—'}`, left + usable / 2, y + 26);
  doc.text(`Mention : ${MENTION_LABELS[mention] || mention || appreciation(mg)}`, left + 8, y + 42);
  doc.text(`Absences : ${absencesHeures || 0} h`, left + usable / 2, y + 42);
  doc.text(`Décision : ${decisionConseil || '—'}`, left + 8, y + 58, { width: usable - 16 });

  y += 96;
  doc.font('Helvetica-Oblique').fontSize(7).fillColor('#666')
    .text("Le bulletin est sans valeur s'il est raturé ou surchargé. Interdiction de reproduction sous peine de sanctions.", left, y, { width: usable });

  y += 22;
  doc.font('Helvetica').fontSize(8).fillColor('#333');
  doc.text('Le professeur principal', left, y, { width: usable / 3, align: 'center' });
  doc.text("Le chef d'établissement", left + usable / 3, y, { width: usable / 3, align: 'center' });
  doc.text('Le parent / tuteur', left + (2 * usable) / 3, y, { width: usable / 3, align: 'center' });
  doc.moveTo(left + 16, y + 40).lineTo(left + usable / 3 - 16, y + 40).stroke('#999');
  drawStamp(doc, left + usable / 2, y + 36);
  doc.moveTo(left + (2 * usable) / 3 + 16, y + 40).lineTo(left + usable - 16, y + 40).stroke('#999');

  if (qrCodeHash) {
    doc.fontSize(7).fillColor('#666')
      .text(`Vérification : ${String(qrCodeHash).slice(0, 24)}`, left, doc.page.height - 48, { width: usable });
  }
  drawFooter(doc, `Bulletin officiel GestSchool — ${formatDateFr(new Date())}`);
  doc.end();
  return done;
}
