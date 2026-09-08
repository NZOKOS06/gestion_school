import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { calculerTotalBilletterie } from '../../controllers/caisse.controller.js';
import { buildRecuPdf, buildRecuThermiquePdf, buildRecuA4Pdf } from '../pdf/recu.pdf.js';

describe('Vague 1 — Immunisation GestSchool', () => {
  describe('Pilier 2 : Forteresse de caisse — Billetterie physique', () => {
    it('calcule exactement le montant physique total des coupures FCFA', () => {
      const billetterie = {
        '10000': 5,  // 50 000
        '5000': 10,  // 50 000
        '2000': 4,   // 8 000
        '1000': 12,  // 12 000
        '500': 6,    // 3 000
        '100': 15,   // 1 500
      };
      const total = calculerTotalBilletterie(billetterie);
      expect(total).toBe(124500);
    });

    it('gère une billetterie vide ou nulle sans crasher', () => {
      expect(calculerTotalBilletterie(null)).toBe(0);
      expect(calculerTotalBilletterie({})).toBe(0);
      expect(calculerTotalBilletterie({ 'invalid': 'abc' })).toBe(0);
    });
  });

  describe('Pilier 4 : Reçus Dual Format (A4 + Thermique 80mm)', () => {
    const mockData = {
      nomEcole: 'Groupe Scolaire Excellence',
      adresse: 'Brazzaville, Moungali',
      telephone: '+242 06 123 45 67',
      numeroRecu: 1042,
      datePaiement: new Date('2026-10-15'),
      montant: 25000,
      devise: 'FCFA',
      modePaiement: 'especes',
      eleve: 'MVOULA Grace',
      matricule: 'MAT-2026-0042',
      classe: '6ème A',
      anneeScolaire: '2026-2027',
      recuPar: 'Mme BIKINDOU (Caissière)',
      motif: 'Scolarité Octobre 2026',
    };

    it('génère avec succès un reçu au format A4 standard', async () => {
      const buffer = await buildRecuPdf(mockData, 'a4');
      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThan(1000);
      // Signature PDF '%PDF'
      expect(buffer.toString('utf-8', 0, 4)).toBe('%PDF');
    });

    it('génère avec succès un reçu au format Thermique 80mm POS', async () => {
      const buffer = await buildRecuPdf(mockData, 'thermique');
      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThan(1000);
      expect(buffer.toString('utf-8', 0, 4)).toBe('%PDF');
    });
  });

  describe('Pilier 3 : ExcelJS Import / Export de Grille de Notes', () => {
    it('génère et relit un classeur Excel avec cellules typées', async () => {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Saisie Notes');
      ws.addRow(['ID', 'Matricule', 'Nom', 'Prénom', 'Note (sur 20)', 'Appréciation']);
      ws.addRow(['el-1', 'MAT-001', 'OBAMBI', 'Christian', 17.5, 'Très bon travail']);
      const buffer = await wb.xlsx.writeBuffer();

      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThan(500);

      // Relecture
      const wbIn = new ExcelJS.Workbook();
      await wbIn.xlsx.load(buffer);
      const sheet = wbIn.getWorksheet('Saisie Notes');
      expect(sheet.rowCount).toBe(2);
      expect(sheet.getRow(2).getCell(3).value).toBe('OBAMBI');
      expect(sheet.getRow(2).getCell(5).value).toBe(17.5);
    }, 20000);
  });

  describe('Vague 2 : Bulletin Officiel Ministériel Congo', () => {
    it('génère un bulletin PDF officiel conforme aux normes ministérielles', async () => {
      const { buildBulletinMinisterielPdf } = await import('../pdf/bulletinMinisteriel.pdf.js');
      const mockBulletin = {
        pays: 'CG',
        nomEcole: 'Complexe Scolaire La Renaissance',
        adresseEcole: 'Brazzaville, Bacongo',
        telephone: '+242 05 555 12 34',
        numeroAutorisation: '0842/MEPPSA/DDE/CAB',
        anneeScolaire: '2025-2026',
        periodeLibelle: '1er Trimestre',
        eleve: 'NGOUABI Yannick',
        matricule: 'MAT-2025-0104',
        dateNaissance: new Date('2011-04-12'),
        lieuNaissance: 'Brazzaville',
        sexe: 'M',
        statutEleve: 'Non redoublant',
        classe: '3ème A',
        effectifClasse: 45,
        moyenneGenerale: 14.85,
        rang: 3,
        moyenneForte: 17.5,
        moyenneFaible: 6.2,
        moyenneClasse: 11.4,
        absencesHeures: 2,
        notesDetaillees: [
          { matiereNom: 'Français', coefficient: 4, moyenne: 14.5, composition: 15.0 },
          { matiereNom: 'Mathématiques', coefficient: 4, moyenne: 16.0, composition: 17.0 },
          { matiereNom: 'Sciences Physiques', coefficient: 2, moyenne: 13.5, composition: 14.0 },
          { matiereNom: 'Histoire-Géographie', coefficient: 2, moyenne: 15.0, composition: 15.5 },
          { matiereNom: 'Anglais', coefficient: 2, moyenne: 12.0, composition: 13.0 },
          { matiereNom: 'EPS', coefficient: 1, moyenne: 18.0, composition: 18.0 },
        ],
      };

      const buffer = await buildBulletinMinisterielPdf(mockBulletin);
      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThan(2000);
      expect(buffer.toString('utf-8', 0, 4)).toBe('%PDF');
    });
  });
});
