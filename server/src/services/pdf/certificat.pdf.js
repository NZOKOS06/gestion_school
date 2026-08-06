import PDFDocument from 'pdfkit';

const TYPE_TITRES = {
  scolarite: 'CERTIFICAT DE SCOLARITÉ',
  inscription: "CERTIFICAT D'INSCRIPTION",
  fin_etudes: "CERTIFICAT DE FIN D'ÉTUDES",
  attestation_inscription: "ATTESTATION D'INSCRIPTION",
  releve_notes: 'RELEVÉ DE NOTES',
  carte_scolaire: 'CARTE SCOLAIRE',
  convocation_examen: "CONVOCATION D'EXAMEN",
  autre: 'ATTESTATION',
};

export function titreCertificat(type) {
  return TYPE_TITRES[type] || TYPE_TITRES.autre;
}

export function contenuCertificat({ type, eleve, matricule, classe, anneeScolaire, nomEcole }) {
  const nom = eleve || '—';
  const annee = anneeScolaire || "l'année en cours";
  const cl = classe || '—';
  switch (type) {
    case 'inscription':
    case 'attestation_inscription':
      return `Le soussigné, Directeur de ${nomEcole}, certifie que ${nom} (matricule ${matricule}) est régulièrement inscrit(e) en classe de ${cl} pour ${annee}.`;
    case 'fin_etudes':
      return `Le soussigné, Directeur de ${nomEcole}, certifie que ${nom} (matricule ${matricule}) a achevé sa scolarité en classe de ${cl} au titre de ${annee}.`;
    case 'releve_notes':
      return `Le soussigné, Directeur de ${nomEcole}, atteste la délivrance du relevé de notes de ${nom} (matricule ${matricule}), classe ${cl}, année ${annee}.`;
    default:
      return `Le soussigné, Directeur de ${nomEcole}, certifie que ${nom} (matricule ${matricule}) est élève régulier(ère) de cet établissement, inscrit(e) en classe de ${cl} pour ${annee}.`;
  }
}

/**
 * Build a certificat scolaire PDF buffer.
 */
export function buildCertificatPdf(data) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const {
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
      } = data;

      const titre = titreCertificat(type);
      const contenu = contenuCertificat({
        type,
        eleve,
        matricule,
        classe,
        anneeScolaire,
        nomEcole,
      });

      doc.fontSize(16).font('Helvetica-Bold').text(nomEcole, { align: 'center' });
      if (adresse) {
        doc.fontSize(9).font('Helvetica').fillColor('#555').text(adresse, { align: 'center' });
      }
      doc.fillColor('#000').moveDown(1.5);
      doc.fontSize(14).font('Helvetica-Bold').text(titre, { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica').text(`N° ${numeroSerie || '—'}`, { align: 'center' });
      doc.moveDown(2);

      doc.fontSize(11).font('Helvetica').text(contenu, { align: 'justify', lineGap: 4 });
      doc.moveDown(2);

      doc.text(`Fait à ${nomEcole}, le ${new Date(dateDelivrance).toLocaleDateString('fr-FR')}.`);
      doc.moveDown(2);
      doc.font('Helvetica-Bold').text('Le Directeur', { align: 'right' });
      if (delivrePar) {
        doc.font('Helvetica').text(delivrePar, { align: 'right' });
      }

      doc.moveDown(3);
      doc.fontSize(8).fillColor('#666').text(
        'Document officiel généré par GestSchool — Toute falsification est passible de poursuites.',
        { align: 'center' }
      );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
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
  } = data;
  return {
    titre: titreCertificat(type),
    eleveNom: eleve,
    eleveMatricule: matricule,
    numeroSerie: numeroSerie || '(sera attribué)',
    contenu: contenuCertificat({ type, eleve, matricule, classe, anneeScolaire, nomEcole }),
  };
}
