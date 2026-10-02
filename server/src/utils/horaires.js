/**
 * Utilitaires horaires (emploi du temps, pointage) — tout est comparé en minutes
 * pour gérer les créneaux non alignés sur l'heure (ex. 07:10 → 07:45).
 */

const HHMM_RE = /^(\d{1,2}):(\d{2})$/;

/** "7:10" | "07:10" → 430 ; null si invalide. */
export function toMinutes(value) {
  const match = HHMM_RE.exec(String(value ?? '').trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
}

/** 430 → "07:10" */
export function fromMinutes(total) {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** "7:10" → "07:10" ; null si invalide. */
export function normalizeHHMM(value) {
  const min = toMinutes(value);
  return min === null ? null : fromMinutes(min);
}

/**
 * Chevauchement strict de deux intervalles [debut, fin[ en minutes.
 * Des créneaux contigus (07:10-07:45 puis 07:45-08:10) ne se chevauchent pas.
 */
export function overlaps(debutA, finA, debutB, finB) {
  return debutA < finB && debutB < finA;
}

/**
 * Valide un couple début/fin. Retourne { debut, fin, debutMin, finMin } normalisés
 * ou { error } avec un message français.
 */
export function parsePlage(heureDebut, heureFin) {
  const debutMin = toMinutes(heureDebut);
  const finMin = toMinutes(heureFin);
  if (debutMin === null || finMin === null) {
    return { error: 'Heures invalides (format attendu HH:MM)' };
  }
  if (finMin <= debutMin) {
    return { error: "L'heure de fin doit être après l'heure de début" };
  }
  return {
    debut: fromMinutes(debutMin),
    fin: fromMinutes(finMin),
    debutMin,
    finMin,
  };
}
