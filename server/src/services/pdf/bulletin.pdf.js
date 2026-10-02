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

function appreciation(moy, notationSur = 20) {
  if (moy == null || Number.isNaN(Number(moy))) return '—';
  // Seuils exprimés sur 20, mis à l'échelle de la notation de l'école
  const n = (Number(moy) * 20) / (Number(notationSur) || 20);
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
    moyenneClasse = null,
    moyenneForte = null,
    moyenneFaible = null,
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
    moy: left + 128,
    coef: left + 168,
    pts: left + 198,
    rang: left + 240,
    classe: left + 272,
    minmax: left + 308,
    app: left + 366,
  };
  const largeurApp = left + usable - col.app;
  const rowH = 18;
  doc.rect(left, y, usable, rowH).fillAndStroke('#1a365d', '#1a365d');
  doc.fillColor('#fff').font('Helvetica-Bold').fontSize(6.5);
  doc.text('DISCIPLINES / MATIÈRES', col.matiere + 4, y + 6, { width: 120 });
  doc.text('MOY.', col.moy, y + 6, { width: 38, align: 'center' });
  doc.text('COEF.', col.coef, y + 6, { width: 28, align: 'center' });
  doc.text('POINTS', col.pts, y + 6, { width: 40, align: 'center' });
  doc.text('RANG', col.rang, y + 6, { width: 30, align: 'center' });
  doc.text('MOY. CL.', col.classe, y + 6, { width: 34, align: 'center' });
  doc.text('MIN – MAX', col.minmax, y + 6, { width: 56, align: 'center' });
  doc.text('APPRÉCIATION', col.app, y + 6, { width: largeurApp, align: 'center' });
  y += rowH;

  let totalCoef = 0;
  let totalPts = 0;
  const notes = Array.isArray(notesDetaillees) ? notesDetaillees : [];
  const fmt = (v) => (v != null && !Number.isNaN(Number(v)) ? Number(v).toFixed(2) : '—');
  notes.forEach((m, idx) => {
    if (y > 680) {
      doc.addPage();
      y = 50;
    }
    if (idx % 2 === 0) doc.rect(left, y, usable, rowH).fill('#f7fafc');
    const nonClasse = Boolean(m.nonClasse);
    const moy = !nonClasse && m.moyenne != null ? Number(m.moyenne) : null;
    const coef = Number(m.coefficient ?? 1);
    const pts = moy != null ? Math.round(moy * coef * 100) / 100 : null;
    if (moy != null) {
      totalCoef += coef;
      totalPts += moy * coef;
    }
    doc.fillColor('#000').font('Helvetica').fontSize(7.5);
    doc.text(m.matiereNom || m.matiere?.nom || '—', col.matiere + 4, y + 5, { width: 120 });
    doc.text(nonClasse ? 'NC' : fmt(moy), col.moy, y + 5, { width: 38, align: 'center' });
    doc.text(String(coef), col.coef, y + 5, { width: 28, align: 'center' });
    doc.text(pts != null ? pts.toFixed(2) : '—', col.pts, y + 5, { width: 40, align: 'center' });
    doc.text(m.rangMatiere ? `${m.rangMatiere}e` : '—', col.rang, y + 5, { width: 30, align: 'center' });
    doc.text(fmt(m.moyenneClasse), col.classe, y + 5, { width: 34, align: 'center' });
    doc.fontSize(6.5).text(
      m.moyenneMin != null ? `${Number(m.moyenneMin).toFixed(1)} – ${Number(m.moyenneMax).toFixed(1)}` : '—',
      col.minmax, y + 5, { width: 56, align: 'center' }
    );
    // Appréciation de l'enseignant, sinon appréciation automatique
    const texteApp = nonClasse ? 'Non classé' : (m.appreciation || appreciation(moy, notationSur));
    doc.fontSize(6.5).text(texteApp, col.app, y + 2, { width: largeurApp, height: rowH - 3, align: 'center', ellipsis: true });
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
    doc.text('TOTAL', col.matiere + 4, y + 5, { width: 120 });
    doc.text(String(totalCoef || '—'), col.coef, y + 5, { width: 28, align: 'center' });
    doc.text(totalPts ? totalPts.toFixed(2) : '—', col.pts, y + 5, { width: 40, align: 'center' });
    y += rowH;
  }
  if (notes.some((m) => m.nonClasse)) {
    doc.font('Helvetica-Oblique').fontSize(6.5).fillColor('#666')
      .text('NC : non classé (aucune note dans la matière) — exclu du calcul de la moyenne.', left, y + 3, { width: usable });
    y += 12;
  }

  const mg = Number(moyenneGenerale) || (totalCoef > 0 ? totalPts / totalCoef : 0);
  y += 12;
  doc.rect(left, y, usable, 92).stroke('#1a365d');
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#1a365d')
    .text('RÉSULTATS ET DÉCISION DU CONSEIL DE CLASSE', left + 8, y + 8);
  doc.font('Helvetica').fontSize(9).fillColor('#000');
  doc.text(`Moyenne générale : ${mg.toFixed(2)} / ${notationSur}`, left + 8, y + 26);
  doc.text(`Rang : ${rang || '—'} / ${effectifClasse || '—'}`, left + usable / 2, y + 26);
  doc.text(`Mention : ${MENTION_LABELS[mention] || mention || appreciation(mg, notationSur)}`, left + 8, y + 42);
  doc.text(`Absences : ${absencesHeures || 0} h`, left + usable / 2, y + 42);
  const statsClasse = [
    moyenneClasse != null ? `Moyenne de la classe : ${Number(moyenneClasse).toFixed(2)}` : null,
    moyenneForte != null ? `Plus forte : ${Number(moyenneForte).toFixed(2)}` : null,
    moyenneFaible != null ? `Plus faible : ${Number(moyenneFaible).toFixed(2)}` : null,
  ].filter(Boolean).join('    ');
  doc.text(statsClasse || ' ', left + 8, y + 58, { width: usable - 16 });
  doc.text(`Décision : ${decisionConseil || '—'}`, left + 8, y + 74, { width: usable - 16 });

  y += 110;
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
