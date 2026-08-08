import PDFDocument from 'pdfkit';

const MENTION_LABELS = {
  felicitations: 'Félicitations',
  tableau_honneur: 'Tableau d\'honneur',
  encouragements: 'Encouragements',
  avertissement_travail: 'Avertissement travail',
  avertissement_conduite: 'Avertissement conduite',
  aucune: '—',
};

function formatDate(d) {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('fr-FR');
  } catch {
    return '—';
  }
}

/**
 * Bulletin scolaire A4 — format type établissement (en-tête, identité, tableau notes, synthèse).
 */
export function buildBulletinPdf(data) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 36 });
      const chunks = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const {
        nomEcole = 'GestSchool',
        adresseEcole = '',
        eleve,
        matricule,
        dateNaissance,
        sexe,
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
        devise = 'FCFA',
      } = data;

      const pageW = doc.page.width;
      const left = 36;
      const right = pageW - 36;
      const usable = right - left;

      // En-tête établissement
      doc.rect(left, 30, usable, 56).stroke('#1a365d');
      doc.font('Helvetica-Bold').fontSize(14).fillColor('#1a365d')
        .text(nomEcole.toUpperCase(), left, 38, { width: usable, align: 'center' });
      if (adresseEcole) {
        doc.font('Helvetica').fontSize(8).fillColor('#444')
          .text(adresseEcole, left, 56, { width: usable, align: 'center' });
      }
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#000')
        .text('BULLETIN DE NOTES', left, 70, { width: usable, align: 'center' });

      doc.moveDown(2);
      let y = 100;

      doc.font('Helvetica').fontSize(9).fillColor('#333');
      doc.text(`Année scolaire : ${anneeScolaire || '—'}`, left, y);
      doc.text(periodeLibelle || `Période ${periodeIndex}`, left + usable / 2, y, { width: usable / 2, align: 'right' });
      y += 16;
      doc.text(`Classe : ${classe || '—'}`, left, y);
      doc.text(`Matricule : ${matricule || '—'}`, left + usable / 2, y, { width: usable / 2, align: 'right' });
      y += 16;
      doc.font('Helvetica-Bold').fontSize(11).text(`Élève : ${eleve || '—'}`, left, y);
      y += 14;
      doc.font('Helvetica').fontSize(9);
      doc.text(`Né(e) le : ${formatDate(dateNaissance)}    Sexe : ${sexe === 'F' ? 'F' : sexe === 'M' ? 'M' : (sexe || '—')}`, left, y);
      y += 18;

      // Tableau des notes
      const col = {
        matiere: left,
        moy: left + 220,
        coef: left + 280,
        pts: left + 340,
        rang: left + 420,
      };
      const rowH = 18;

      doc.rect(left, y, usable, rowH).fillAndStroke('#1a365d', '#1a365d');
      doc.fillColor('#fff').font('Helvetica-Bold').fontSize(8);
      doc.text('MATIÈRE', col.matiere + 4, y + 5, { width: 200 });
      doc.text('MOY.', col.moy, y + 5, { width: 50, align: 'center' });
      doc.text('COEF.', col.coef, y + 5, { width: 50, align: 'center' });
      doc.text('POINTS', col.pts, y + 5, { width: 60, align: 'center' });
      doc.text('RANG', col.rang, y + 5, { width: 50, align: 'center' });
      y += rowH;

      doc.fillColor('#000').font('Helvetica').fontSize(8);
      let totalCoef = 0;
      let totalPts = 0;
      const notes = Array.isArray(notesDetaillees) ? notesDetaillees : [];

      notes.forEach((m, idx) => {
        if (y > 700) {
          doc.addPage();
          y = 50;
        }
        if (idx % 2 === 0) {
          doc.rect(left, y, usable, rowH).fill('#f5f7fa');
          doc.fillColor('#000');
        }
        const moy = m.moyenne != null ? Number(m.moyenne) : null;
        const coef = Number(m.coefficient ?? 1);
        const pts = moy != null ? Math.round(moy * coef * 100) / 100 : null;
        if (moy != null) {
          totalCoef += coef;
          totalPts += moy * coef;
        }
        doc.font('Helvetica').text(m.matiereNom || m.matiere?.nom || '—', col.matiere + 4, y + 5, { width: 210 });
        doc.text(moy != null ? moy.toFixed(2) : '—', col.moy, y + 5, { width: 50, align: 'center' });
        doc.text(String(coef), col.coef, y + 5, { width: 50, align: 'center' });
        doc.text(pts != null ? pts.toFixed(2) : '—', col.pts, y + 5, { width: 60, align: 'center' });
        doc.text(m.rangMatiere != null ? String(m.rangMatiere) : '—', col.rang, y + 5, { width: 50, align: 'center' });
        doc.rect(left, y, usable, rowH).stroke('#ccd');
        y += rowH;
      });

      if (!notes.length) {
        doc.text('Aucune note saisie pour cette période.', left + 4, y + 6);
        y += rowH;
      }

      // Synthèse
      y += 12;
      const mg = Number(moyenneGenerale) || (totalCoef > 0 ? totalPts / totalCoef : 0);
      doc.rect(left, y, usable, 70).stroke('#1a365d');
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#1a365d');
      doc.text('RÉSULTATS', left + 8, y + 8);
      doc.font('Helvetica').fontSize(9).fillColor('#000');
      doc.text(`Moyenne générale : ${mg.toFixed(2)} / 20`, left + 8, y + 26);
      doc.text(`Rang : ${rang || '—'} / ${effectifClasse || '—'}`, left + usable / 2, y + 26);
      doc.text(`Mention : ${MENTION_LABELS[mention] || mention || '—'}`, left + 8, y + 42);
      doc.text(`Absences : ${absencesHeures || 0} h`, left + usable / 2, y + 42);
      if (decisionConseil) {
        doc.text(`Décision / appréciation : ${decisionConseil}`, left + 8, y + 56, { width: usable - 16 });
      }
      y += 90;

      // Signatures
      doc.font('Helvetica').fontSize(8).fillColor('#444');
      doc.text('Le professeur principal', left, y, { width: usable / 3, align: 'center' });
      doc.text('Le directeur', left + usable / 3, y, { width: usable / 3, align: 'center' });
      doc.text('Le parent / tuteur', left + (2 * usable) / 3, y, { width: usable / 3, align: 'center' });
      y += 40;
      doc.moveTo(left + 20, y).lineTo(left + usable / 3 - 20, y).stroke('#999');
      doc.moveTo(left + usable / 3 + 20, y).lineTo(left + (2 * usable) / 3 - 20, y).stroke('#999');
      doc.moveTo(left + (2 * usable) / 3 + 20, y).lineTo(right - 20, y).stroke('#999');

      if (qrCodeHash) {
        doc.fontSize(7).fillColor('#666')
          .text(`Vérification : ${String(qrCodeHash).slice(0, 32)}…`, left, 800, { width: usable });
      }

      doc.fontSize(7).fillColor('#888')
        .text(`Document généré par GestSchool — ${new Date().toLocaleDateString('fr-FR')} — ${devise}`, left, 812, {
          width: usable,
          align: 'center',
        });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
