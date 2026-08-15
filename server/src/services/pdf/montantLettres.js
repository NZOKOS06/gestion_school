const UNITS = [
  'zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf',
  'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize',
];

function belowHundred(n) {
  if (n < 17) return UNITS[n];
  if (n < 20) return `dix-${UNITS[n - 10]}`;
  const tens = Math.floor(n / 10);
  const unit = n % 10;
  const tensWords = {
    2: 'vingt', 3: 'trente', 4: 'quarante', 5: 'cinquante',
    6: 'soixante', 7: 'soixante', 8: 'quatre-vingt', 9: 'quatre-vingt',
  };
  if (tens === 7 || tens === 9) {
    const base = tens === 7 ? 'soixante' : 'quatre-vingt';
    const rest = n - tens * 10 + 10;
    if (rest === 11 && tens === 7) return 'soixante et onze';
    return `${base}-${belowHundred(rest)}`;
  }
  if (unit === 0) return tens === 8 ? 'quatre-vingts' : tensWords[tens];
  if (unit === 1 && tens !== 8) return `${tensWords[tens]} et un`;
  return `${tensWords[tens]}-${UNITS[unit]}`;
}

function belowThousand(n) {
  if (n < 100) return belowHundred(n);
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const hWord = hundreds === 1 ? 'cent' : `${UNITS[hundreds]} cent${rest === 0 ? 's' : ''}`;
  if (rest === 0) return hWord;
  return `${hundreds === 1 ? 'cent' : `${UNITS[hundreds]} cent`} ${belowHundred(rest)}`;
}

function convert(n) {
  if (n < 1000) return belowThousand(n);
  if (n < 1_000_000) {
    const thousands = Math.floor(n / 1000);
    const rest = n % 1000;
    const tWord = thousands === 1 ? 'mille' : `${belowThousand(thousands)} mille`;
    return rest ? `${tWord} ${belowThousand(rest)}` : tWord;
  }
  const millions = Math.floor(n / 1_000_000);
  const rest = n % 1_000_000;
  const mWord = millions === 1 ? 'un million' : `${belowThousand(millions)} millions`;
  return rest ? `${mWord} ${convert(rest)}` : mWord;
}

export function montantEnLettres(montant, devise = 'francs CFA') {
  const n = Math.round(Math.abs(Number(montant) || 0));
  const words = n === 0 ? 'zéro' : convert(n);
  return `${words.charAt(0).toUpperCase()}${words.slice(1)} ${devise}`;
}
