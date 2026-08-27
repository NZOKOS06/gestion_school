/** Helpers pointage enseignant (EDT -> session journaliere). */

/** JS Date -> jourSemaine EDT (1=lundi ... 7=dimanche). */
export function jsDateToJourSemaine(d) {
  const day = d.getDay();
  return day === 0 ? 7 : day;
}

export function startOfDayUTC(dateInput) {
  const d = new Date(dateInput);
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

export function parseTimeOnDate(dateBase, hhmm) {
  const [h, m] = String(hhmm || '00:00').split(':').map(Number);
  const d = new Date(dateBase);
  d.setHours(h || 0, m || 0, 0, 0);
  return d;
}

export function formatHHMM(d) {
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

/** Duree en heures entre deux Date, bornee au creneau prevu +/- tolerance. */
export function computeDureeHeures({ heureArrivee, heureDepart, heurePrevueDebut, heurePrevueFin, date, toleranceMinutes = 15 }) {
  if (!heureArrivee || !heureDepart) return 0;
  const day = startOfDayUTC(date);
  const prevDebut = parseTimeOnDate(day, heurePrevueDebut);
  const prevFin = parseTimeOnDate(day, heurePrevueFin);
  const tolMs = (toleranceMinutes || 0) * 60 * 1000;

  let start = new Date(heureArrivee);
  let end = new Date(heureDepart);
  const boundStart = new Date(prevDebut.getTime() - tolMs);
  const boundEnd = new Date(prevFin.getTime() + tolMs);
  if (start < boundStart) start = boundStart;
  if (end > boundEnd) end = boundEnd;
  if (end <= start) return 0;
  const ms = end.getTime() - start.getTime();
  return Math.round((ms / 3600000) * 100) / 100;
}

export function serializePointageSession(s) {
  if (!s) return s;
  return {
    ...s,
    dureeHeures: s.dureeHeures != null ? Number(s.dureeHeures) : null,
    enseignant: s.enseignant ? {
      id: s.enseignant.id,
      nom: s.enseignant.nom,
      prenom: s.enseignant.prenom,
    } : undefined,
    classe: s.classe ? { id: s.classe.id, nom: s.classe.nom } : undefined,
    matiere: s.matiere ? { id: s.matiere.id, nom: s.matiere.nom, code: s.matiere.code } : undefined,
    salle: s.salle ? { id: s.salle.id, nom: s.salle.nom } : (s.emploiDuTemps?.salle ? { nom: s.emploiDuTemps.salle } : undefined),
    emploiDuTemps: s.emploiDuTemps ? {
      id: s.emploiDuTemps.id,
      heureDebut: s.emploiDuTemps.heureDebut,
      heureFin: s.emploiDuTemps.heureFin,
      salle: s.emploiDuTemps.salle,
    } : undefined,
  };
}
