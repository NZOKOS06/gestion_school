import crypto from 'crypto';

const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const LOWER = 'abcdefghijklmnopqrstuvwxyz';
const DIGITS = '0123456789';
const SPECIAL = '!@#$%^&*()_+-=[]{}|;:,.<>?';
const ALL = UPPER + LOWER + DIGITS + SPECIAL;

/**
 * Génère un mot de passe aléatoire robuste.
 * @param {number} length - Longueur du mot de passe (min 8)
 * @returns {string} Mot de passe généré
 */
export const generateRandomPassword = (length = 12) => {
  const len = Math.max(length, 8);
  const chars = [];

  // Au moins un caractère de chaque catégorie
  chars.push(UPPER[crypto.randomInt(UPPER.length)]);
  chars.push(LOWER[crypto.randomInt(LOWER.length)]);
  chars.push(DIGITS[crypto.randomInt(DIGITS.length)]);
  chars.push(SPECIAL[crypto.randomInt(SPECIAL.length)]);

  // Compléter avec des caractères aléatoires
  for (let i = chars.length; i < len; i++) {
    chars.push(ALL[crypto.randomInt(ALL.length)]);
  }

  // Mélanger
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join('');
};

export default { generateRandomPassword };
