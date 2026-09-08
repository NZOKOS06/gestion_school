import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { toBuffer, formatDateFr } from './pdfHelpers.js';

const CARD_WIDTH = 243;  // ~85.6 mm en points
const CARD_HEIGHT = 153; // ~54.0 mm en points

const NAVY = '#1e3a8a';
const GOLD = '#f59e0b';
const DARK = '#0f172a';
const MUTED = '#64748b';
const LIGHT_BG = '#f8fafc';
const BORDER_COLOR = '#cbd5e1';

/**
 * Génère une carte scolaire PDF au format ID card (85.6 × 54 mm).
 * Inclut photo/avatar, nom/prénom, classe, matricule, année scolaire, logo/nom école,
 * et un QR Code scannable pour accès direct au portail parent.
 *
 * @param {Object} data
 * @param {Object} data.eleve - Données élève { nom, prenom, matricule, dateNaissance, sexe, photoUrl }
 * @param {Object} data.classe - Données classe { nom, niveau }
 * @param {Object} data.anneeScolaire - { libelle }
 * @param {Object} data.ecole - { nomEcole, logoUrl, adresse, telephone }
 * @param {string} data.qrUrl - URL encodée dans le QR code (ex: http://.../portail-parent?token=...)
 * @returns {Promise<Buffer>} Buffer PDF
 */
export async function generateCarteScolairePdf({
  eleve,
  classe,
  anneeScolaire,
  ecole = {},
  qrUrl,
}) {
  const doc = new PDFDocument({
    size: [CARD_WIDTH, CARD_HEIGHT],
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
    autoFirstPage: true,
  });

  const bufferPromise = toBuffer(doc);

  // 1. Fond carte avec bordure subtile
  doc.rect(0, 0, CARD_WIDTH, CARD_HEIGHT).fill(LIGHT_BG);
  doc.rect(0.5, 0.5, CARD_WIDTH - 1, CARD_HEIGHT - 1).lineWidth(1).stroke(BORDER_COLOR);

  // 2. En-tête bleu marine avec liseré doré
  const headerHeight = 28;
  doc.rect(0, 0, CARD_WIDTH, headerHeight).fill(NAVY);
  doc.rect(0, headerHeight - 2, CARD_WIDTH, 2).fill(GOLD);

  // Nom de l'école
  const schoolName = (ecole.nomEcole || 'GESTSCHOOL').toUpperCase();
  doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#ffffff')
    .text(schoolName, 8, 5, { width: 160, ellipsis: true });

  // Sous-titre officiel
  doc.font('Helvetica-Bold').fontSize(5.5).fillColor(GOLD)
    .text("CARTE D'IDENTITÉ SCOLAIRE", 8, 16, { width: 160 });

  // Badge Année scolaire à droite
  const anneeText = anneeScolaire?.libelle || `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`;
  doc.roundedRect(174, 5, 62, 16, 3).fillAndStroke('#ffffff', '#ffffff');
  doc.font('Helvetica-Bold').fontSize(6).fillColor(NAVY)
    .text(anneeText, 174, 9.5, { width: 62, align: 'center' });

  // 3. Cadre Photo / Avatar élève (gauche)
  const photoX = 8;
  const photoY = 34;
  const photoW = 44;
  const photoH = 54;

  doc.roundedRect(photoX, photoY, photoW, photoH, 3).fillAndStroke('#e2e8f0', '#cbd5e1');

  // Si pas de photo binaire, dessiner silhouette stylisée
  const initials = `${(eleve.prenom?.[0] || 'E').toUpperCase()}${(eleve.nom?.[0] || '').toUpperCase()}`;
  doc.font('Helvetica-Bold').fontSize(14).fillColor(MUTED)
    .text(initials, photoX, photoY + 18, { width: photoW, align: 'center' });
  doc.font('Helvetica').fontSize(5).fillColor(MUTED)
    .text('PHOTO', photoX, photoY + 38, { width: photoW, align: 'center' });

  // 4. Informations textuelles de l'élève (centre)
  const infoX = 58;
  let infoY = 34;
  const infoW = 110;

  // Nom Complet
  const nomComplet = `${(eleve.nom || '').toUpperCase()} ${eleve.prenom || ''}`.trim();
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor(DARK)
    .text(nomComplet || 'ÉLÈVE', infoX, infoY, { width: infoW, ellipsis: true });
  infoY += 13;

  // Matricule avec fond léger
  const matricule = eleve.matricule || 'N/A';
  doc.roundedRect(infoX, infoY - 1, 95, 11, 2).fill('#e0e7ff');
  doc.font('Helvetica-Bold').fontSize(6.5).fillColor('#3730a3')
    .text(`MATRICULE : ${matricule}`, infoX + 3, infoY + 1.5, { width: 90, ellipsis: true });
  infoY += 14;

  // Classe
  const classeNom = classe?.nom || 'Non assignée';
  doc.font('Helvetica').fontSize(6.5).fillColor(MUTED).text('Classe :', infoX, infoY, { continued: true });
  doc.font('Helvetica-Bold').fontSize(6.5).fillColor(DARK).text(` ${classeNom}`);
  infoY += 10;

  // Date de naissance
  const dateNais = eleve.dateNaissance ? formatDateFr(eleve.dateNaissance) : '—';
  doc.font('Helvetica').fontSize(6).fillColor(MUTED).text('Né(e) le :', infoX, infoY, { continued: true });
  doc.font('Helvetica').fontSize(6).fillColor(DARK).text(` ${dateNais}`);
  infoY += 9;

  // Sexe
  const sexeStr = eleve.sexe === 'M' ? 'Masculin' : eleve.sexe === 'F' ? 'Féminin' : '—';
  doc.font('Helvetica').fontSize(6).fillColor(MUTED).text('Sexe :', infoX, infoY, { continued: true });
  doc.font('Helvetica').fontSize(6).fillColor(DARK).text(` ${sexeStr}`);

  // 5. QR Code scannable (droite)
  const qrX = 175;
  const qrY = 32;
  const qrSize = 58;

  if (qrUrl) {
    try {
      const qrBuffer = await QRCode.toBuffer(qrUrl, {
        errorCorrectionLevel: 'M',
        type: 'png',
        margin: 1,
        width: 140,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      });

      // Cadre blanc pour le QR code
      doc.roundedRect(qrX - 2, qrY - 2, qrSize + 4, qrSize + 4, 3).fillAndStroke('#ffffff', '#e2e8f0');
      doc.image(qrBuffer, qrX, qrY, { width: qrSize, height: qrSize });
    } catch (err) {
      doc.font('Helvetica').fontSize(6).fillColor('#ef4444')
        .text('QR indisponible', qrX, qrY + 20, { width: qrSize, align: 'center' });
    }
  }

  doc.font('Helvetica-Bold').fontSize(4.8).fillColor(NAVY)
    .text('SCANNER LE QR', qrX - 4, qrY + qrSize + 4, { width: qrSize + 8, align: 'center' });
  doc.font('Helvetica').fontSize(4.2).fillColor(MUTED)
    .text('Suivi solde & absences', qrX - 4, qrY + qrSize + 10, { width: qrSize + 8, align: 'center' });

  // 6. Signature / Cachet / Bandeau bas
  const footerY = 136;
  const footerH = 17;
  doc.rect(0, footerY, CARD_WIDTH, footerH).fill('#f1f5f9');
  doc.moveTo(0, footerY).lineTo(CARD_WIDTH, footerY).lineWidth(0.5).stroke('#cbd5e1');

  const contactText = [ecole.telephone, ecole.adresse].filter(Boolean).join('  ·  ');
  const footerNotice = contactText
    ? `${contactText} — Carte strictement personnelle`
    : 'Document officiel strictement personnel — En cas de perte, prévenir la Direction.';

  doc.font('Helvetica').fontSize(4.5).fillColor(MUTED)
    .text(footerNotice, 4, footerY + 5.5, { width: CARD_WIDTH - 8, align: 'center', ellipsis: true });

  doc.end();
  return bufferPromise;
}
