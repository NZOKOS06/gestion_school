import { formatMontant } from '../src/services/pdf/pdfHelpers.js';
import { montantEnLettres } from '../src/services/pdf/montantLettres.js';

const cas = [0, 5000, 50000, 175000, 199000, 1234567, -50000];

console.log('=== SÉPARATEUR DE MILLIERS (PDF) ===');
for (const n of cas) {
  const s = formatMontant(n);
  const codes = [...s].map((c) => c.charCodeAt(0));
  const suspects = codes.filter((c) => c > 127 && c !== 233);
  console.log(`${String(n).padStart(9)} → "${s}"  ${suspects.length ? `❌ caractères hors ASCII: ${suspects}` : '✅'}`);
}

console.log('\n=== ANCIEN COMPORTEMENT (pour comparaison) ===');
const ancien = (50000).toLocaleString('fr-FR');
console.log(`toLocaleString('fr-FR') → "${ancien}" — séparateur U+${ancien.charCodeAt(2).toString(16).toUpperCase().padStart(4, '0')}`);

console.log('\n=== MONTANT EN LETTRES ===');
for (const n of [5000, 50000, 199000]) {
  console.log(`${n} → ${montantEnLettres(n)}`);
}
