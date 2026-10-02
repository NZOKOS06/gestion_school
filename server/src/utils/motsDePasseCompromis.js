/**
 * Mots de passe connus publiquement (anciens mots de passe par défaut).
 * Refusés au changement de mot de passe ; un parent qui se connecte avec l'un d'eux
 * voit son accès révoqué (l'école doit lui remettre un mot de passe provisoire).
 */
export const MOTS_DE_PASSE_COMPROMIS = new Set([
  'Parent123!',
  'Azerty123',
  'SuperAdmin123!',
  'Directeur123!',
  'Secretaire123!',
  'Enseignant123!',
  'Comptable123!',
  'Surveillant123!',
  'DirecteurEtudes123!',
]);

export const estCompromis = (motDePasse) => MOTS_DE_PASSE_COMPROMIS.has(String(motDePasse || ''));
