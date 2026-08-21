import fs from 'fs';
import { buildRecuPdf } from '../src/services/pdf/recu.pdf.js';

const buffer = await buildRecuPdf({
  nomEcole: 'École Démo',
  adresse: 'Avenue de la Paix, Brazzaville',
  telephone: '+242 06 000 0000',
  email: 'contact@ecole-demo.cg',
  numeroRecu: 12,
  datePaiement: new Date(),
  montant: 50000,
  modePaiement: 'mobile_money',
  reference: 'MOMO-SIM-4383ED41B8FA',
  motif: 'Paiement Mobile Money sandbox',
  eleve: 'David Ossobi',
  matricule: 'GS-2026-0001',
  classe: '6ème A',
  anneeScolaire: '2025-2026',
  parent: 'Joseph Ossobi',
  recuPar: 'Sarah Lingui',
  echeances: [
    { libelle: 'Frais d\'inscription', montantAttendu: 25000, montantPaye: 25000 },
    ...Array.from({ length: 10 }, (_, i) => ({
      libelle: `Mois ${i + 1}`,
      montantAttendu: 15000,
      montantPaye: i < 9 ? 15000 : 9000,
    })),
  ],
});

fs.writeFileSync('preview-recu.pdf', buffer);

const raw = buffer.toString('latin1');
const pages = (raw.match(/\/Type\s*\/Page[^s]/g) || []).length;
const mediaBox = raw.match(/\/MediaBox\s*\[([^\]]+)\]/)?.[1]?.trim();

console.log(`✓ preview-recu.pdf généré (${buffer.length} octets)`);
console.log(`  Pages      : ${pages} ${pages === 1 ? '✅' : '❌ le reçu déborde'}`);
console.log(`  Format     : [${mediaBox}] ${/595/.test(mediaBox || '') ? '(A4)' : ''}`);
