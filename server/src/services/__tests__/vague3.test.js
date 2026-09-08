import { describe, it, expect } from 'vitest';
import { generateCarteScolairePdf } from '../pdf/carteScolaire.pdf.js';
import { formatPhoneNumber, sendSms } from '../sms.service.js';
import { sendWhatsApp } from '../whatsapp.service.js';
import { calculerEcheancesTranches } from '../facturation.service.js';

describe('Vague 3 — Flywheel Croissance', () => {
  describe('Pilier 1 : Carte Scolaire QR Code', () => {
    it('génère un PDF valide avec les dimensions ID Card et un QR code', async () => {
      const pdfBuffer = await generateCarteScolairePdf({
        eleve: {
          nom: 'MOUKOKO',
          prenom: 'Armel',
          matricule: 'GS-2026-0042',
          dateNaissance: new Date('2014-05-18'),
          sexe: 'M',
        },
        classe: {
          nom: '6ème A',
          niveau: '6eme',
        },
        anneeScolaire: {
          libelle: '2025-2026',
        },
        ecole: {
          nomEcole: 'Complexe Scolaire La Renaissance',
          telephone: '+242 06 900 11 22',
          adresse: 'Brazzaville, Bacongo',
        },
        qrUrl: 'https://gestschool.app/portail-parent?token=mock-jwt-token',
      });

      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(pdfBuffer.length).toBeGreaterThan(1000);
      // Signature PDF '%PDF-'
      const header = pdfBuffer.slice(0, 5).toString('ascii');
      expect(header).toBe('%PDF-');
    });
  });

  describe('Pilier 2 : SMS & WhatsApp Services', () => {
    it('normalise correctement les numéros de téléphone africains', () => {
      expect(formatPhoneNumber('06 900 11 22', '242')).toBe('+24269001122');
      expect(formatPhoneNumber('+243 81 234 5678')).toBe('+243812345678');
      expect(formatPhoneNumber('00237 670 00 11 22')).toBe('+237670001122');
      expect(formatPhoneNumber('+242069001122')).toBe('+242069001122');
      expect(formatPhoneNumber(null)).toBeNull();
    });

    it('envoie un SMS en mode simulation sans erreur quand aucune clé n est fournie', async () => {
      const result = await sendSms({
        to: '+242069001122',
        message: 'Rappel solde scolarité GestSchool',
      });

      expect(result.success).toBe(true);
      expect(result.provider).toBeDefined();
    });

    it('envoie un WhatsApp en mode simulation sans erreur', async () => {
      const result = await sendWhatsApp({
        to: '+242069001122',
        message: 'Alerte absence élève',
      });

      expect(result.success).toBe(true);
      expect(result.provider).toBeDefined();
    });
  });

  describe('Pilier 3 : Facturation Annuelle Indexée', () => {
    it('découpe le montant total en tranches régulières sans perte de centimes', () => {
      const start = new Date('2025-10-01');
      const end = new Date('2026-06-30');
      const montantTotal = 150000; // 150 000 FCFA

      const tranches = calculerEcheancesTranches(start, end, 3, montantTotal);

      expect(tranches).toHaveLength(3);
      expect(tranches[0].libelle).toBe('Tranche 1');
      expect(tranches[1].libelle).toBe('Tranche 2');
      expect(tranches[2].libelle).toBe('Tranche 3');

      const sum = tranches.reduce((acc, t) => acc + t.montantAttendu, 0);
      expect(sum).toBe(montantTotal);
    });

    it('gère les divisions non rondes sans écart de centimes', () => {
      const start = new Date('2025-10-01');
      const end = new Date('2026-06-30');
      const montantTotal = 100000; // 100 000 / 3 = 33333.33 x 2 + 33333.34

      const tranches = calculerEcheancesTranches(start, end, 3, montantTotal);
      const sum = tranches.reduce((acc, t) => acc + t.montantAttendu, 0);
      expect(Math.round(sum)).toBe(100000);
    });
  });
});
