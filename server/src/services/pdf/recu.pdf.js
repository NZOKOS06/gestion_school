import PDFDocument from 'pdfkit';

/**
 * Build a PDF receipt buffer for a paiement.
 */
export function buildRecuPdf(data) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A5', margin: 40 });
      const chunks = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const {
        nomEcole = 'GestSchool',
        numeroRecu,
        datePaiement,
        montant,
        devise = 'FCFA',
        typePaiement,
        modePaiement,
        reference,
        motif,
        eleve,
        matricule,
        classe,
        anneeScolaire,
        recuPar,
      } = data;

      doc.fontSize(16).font('Helvetica-Bold').text(nomEcole, { align: 'center' });
      doc.moveDown(0.3);
      doc.fontSize(12).font('Helvetica').text('REÇU DE PAIEMENT', { align: 'center' });
      doc.moveDown();

      doc.fontSize(10);
      doc.text(`N° reçu : ${numeroRecu}`);
      doc.text(`Date : ${new Date(datePaiement).toLocaleDateString('fr-FR')}`);
      doc.text(`Année scolaire : ${anneeScolaire || '—'}`);
      doc.moveDown(0.5);

      doc.font('Helvetica-Bold').text('Élève');
      doc.font('Helvetica').text(`${eleve} (${matricule})`);
      doc.text(`Classe : ${classe || '—'}`);
      doc.moveDown(0.5);

      doc.font('Helvetica-Bold').text('Paiement');
      doc.font('Helvetica');
      doc.text(`Montant : ${Number(montant).toLocaleString('fr-FR')} ${devise}`);
      doc.text(`Type : ${typePaiement || 'scolarite'}`);
      doc.text(`Mode : ${modePaiement || '—'}`);
      if (reference) doc.text(`Référence : ${reference}`);
      if (motif) doc.text(`Motif : ${motif}`);
      doc.moveDown();

      doc.text(`Reçu par : ${recuPar || '—'}`);
      doc.moveDown(1.5);
      doc.fontSize(8).fillColor('#666').text('Document généré par GestSchool — Conservez ce reçu.', {
        align: 'center',
      });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
