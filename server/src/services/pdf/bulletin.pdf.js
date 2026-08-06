import PDFDocument from 'pdfkit';

/**
 * Build a bulletin scolaire PDF buffer.
 */
export function buildBulletinPdf(data) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const chunks = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const {
        nomEcole = 'GestSchool',
        eleve,
        matricule,
        classe,
        anneeScolaire,
        periodeIndex,
        moyenneGenerale,
        rang,
        effectifClasse,
        mention,
        notesDetaillees = [],
        absencesHeures = 0,
        qrCodeHash,
        devise = 'FCFA',
      } = data;

      doc.fontSize(18).font('Helvetica-Bold').text(nomEcole, { align: 'center' });
      doc.moveDown(0.2);
      doc.fontSize(14).text('BULLETIN SCOLAIRE', { align: 'center' });
      doc.fontSize(10).font('Helvetica').text(
        `${anneeScolaire || ''} — Période ${periodeIndex}`,
        { align: 'center' }
      );
      doc.moveDown();

      doc.fontSize(11);
      doc.text(`Élève : ${eleve} (${matricule})`);
      doc.text(`Classe : ${classe}`);
      doc.moveDown();

      // Table header
      doc.font('Helvetica-Bold');
      const y0 = doc.y;
      doc.text('Matière', 40, y0, { width: 200 });
      doc.text('Moy.', 250, y0, { width: 50 });
      doc.text('Coef.', 310, y0, { width: 50 });
      doc.moveDown(0.5);
      doc.moveTo(40, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown(0.3);
      doc.font('Helvetica');

      for (const m of notesDetaillees) {
        const y = doc.y;
        doc.text(m.matiereNom || m.matiere?.nom || '—', 40, y, { width: 200 });
        doc.text(String(m.moyenne ?? '—'), 250, y, { width: 50 });
        doc.text(String(m.coefficient ?? 1), 310, y, { width: 50 });
        doc.moveDown(0.4);
      }

      doc.moveDown();
      doc.font('Helvetica-Bold').fontSize(12);
      doc.text(`Moyenne générale : ${Number(moyenneGenerale).toFixed(2)} / 20`);
      doc.text(`Rang : ${rang} / ${effectifClasse}`);
      doc.text(`Mention : ${mention || 'aucune'}`);
      doc.font('Helvetica').fontSize(10);
      doc.text(`Absences (heures) : ${absencesHeures}`);

      if (qrCodeHash) {
        doc.moveDown();
        doc.fontSize(8).fillColor('#444').text(`Vérification : ${qrCodeHash.slice(0, 24)}…`, {
          align: 'left',
        });
        doc.text('Scannez / saisissez le code sur /api/public/bulletins/verify/:hash');
      }

      doc.moveDown(2);
      doc.fillColor('#666').fontSize(8).text(`Document généré par GestSchool — ${devise}`, {
        align: 'center',
      });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
