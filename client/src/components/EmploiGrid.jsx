import { Fragment, useMemo } from 'react';
import { Coffee, Plus } from 'lucide-react';

export const JOURS_SEMAINE = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

/** "7:10" → 430 ; null si invalide */
export const toMinutes = (value) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(value ?? '').trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
};

const pad = (v) => {
  const min = toMinutes(v);
  if (min === null) return v || '';
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
};

const plageKey = (debut, fin) => `${pad(debut)}-${pad(fin)}`;

/**
 * Lignes de la grille = créneaux de la grille horaire de l'école
 * + toute plage de cours qui ne correspond à aucun créneau (horaires « hors grille »).
 */
function buildRows(grille, cours) {
  const rows = new Map();
  for (const c of grille) {
    const key = plageKey(c.heureDebut, c.heureFin);
    rows.set(key, {
      key,
      debut: pad(c.heureDebut),
      fin: pad(c.heureFin),
      type: c.type || 'cours',
      libelle: c.libelle || null,
      horsGrille: false,
    });
  }
  for (const c of cours) {
    const key = plageKey(c.heureDebut, c.heureFin);
    if (!rows.has(key)) {
      rows.set(key, { key, debut: pad(c.heureDebut), fin: pad(c.heureFin), type: 'cours', libelle: null, horsGrille: grille.length > 0 });
    }
  }
  return [...rows.values()].sort((a, b) => (toMinutes(a.debut) - toMinutes(b.debut)) || (toMinutes(a.fin) - toMinutes(b.fin)));
}

/**
 * Grille hebdomadaire : une ligne par créneau (début–fin à la minute),
 * pauses/récréations en bandeau sur toute la largeur.
 *
 * props:
 * - cours: [{ id, jourSemaine, heureDebut, heureFin, ... }]
 * - grille: créneaux de la grille horaire [{ heureDebut, heureFin, type, libelle }]
 * - renderCours(cours) → contenu de la carte
 * - onCoursClick(cours), onEmptyClick({ jourSemaine, heureDebut, heureFin }) (optionnels)
 */
export default function EmploiGrid({ cours = [], grille = [], renderCours, onCoursClick, onEmptyClick, minWidth = 760 }) {
  const rows = useMemo(() => buildRows(grille, cours), [grille, cours]);
  const nbJours = cours.some((c) => c.jourSemaine === 7) ? 7 : 6;
  const jours = JOURS_SEMAINE.slice(0, nbJours);

  const coursIndex = useMemo(() => {
    const map = new Map();
    for (const c of cours) {
      const k = `${c.jourSemaine}|${plageKey(c.heureDebut, c.heureFin)}`;
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(c);
    }
    return map;
  }, [cours]);

  const cellStyle = {
    borderBottom: '1px solid var(--border-subtle)',
    borderRight: '1px solid var(--border-subtle)',
    padding: 4,
    verticalAlign: 'top',
  };

  if (!rows.length) return null;

  return (
    <div className="overflow-x-auto rounded-lg" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
      <table className="w-full" style={{ borderCollapse: 'collapse', minWidth }}>
        <thead>
          <tr style={{ borderBottom: '2px solid var(--border-subtle)' }}>
            <th className="text-left py-3 px-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)', width: 96 }}>Horaire</th>
            {jours.map((jour, i) => (
              <th
                key={jour}
                className="text-center py-3 px-2 text-xs font-semibold uppercase tracking-wider"
                style={{ color: 'var(--text-muted)', ...(i < jours.length - 1 ? { borderRight: '1px solid var(--border-subtle)' } : {}) }}
              >
                {jour}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <Fragment key={row.key}>
              {row.type !== 'cours' ? (
                <tr>
                  <td colSpan={jours.length + 1} style={{ ...cellStyle, padding: 0 }}>
                    <div
                      className="flex items-center justify-center gap-2 py-1.5 text-xs font-medium"
                      style={{ background: 'color-mix(in srgb, var(--color-warning) 12%, transparent)', color: 'var(--text-secondary)' }}
                    >
                      <Coffee className="h-3.5 w-3.5" />
                      <span>{row.libelle || (row.type === 'recreation' ? 'Récréation' : 'Pause')}</span>
                      <span style={{ fontFamily: 'var(--font-mono, monospace)' }}>{row.debut} – {row.fin}</span>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr>
                  <td className="text-xs font-medium py-2 px-2" style={{ ...cellStyle, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    <div style={{ fontFamily: 'var(--font-mono, monospace)' }}>{row.debut}</div>
                    <div style={{ fontFamily: 'var(--font-mono, monospace)' }}>{row.fin}</div>
                    {row.horsGrille && <div className="text-[10px]" style={{ color: 'var(--color-warning)' }}>hors grille</div>}
                  </td>
                  {jours.map((_, jourIndex) => {
                    const jourSemaine = jourIndex + 1;
                    const items = coursIndex.get(`${jourSemaine}|${row.key}`) || [];
                    return (
                      <td key={jourIndex} style={{ ...cellStyle, minWidth: 110 }}>
                        {items.length > 0 ? (
                          <div className="space-y-1">
                            {items.map((c) => (
                              <div
                                key={c.id}
                                className={`rounded-lg p-2 text-xs ${onCoursClick ? 'cursor-pointer' : ''}`}
                                style={{ background: 'color-mix(in srgb, var(--color-primary) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--color-primary) 30%, transparent)' }}
                                onClick={onCoursClick ? () => onCoursClick(c) : undefined}
                              >
                                <p className="text-[10px] font-medium mb-0.5" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono, monospace)' }}>
                                  {pad(c.heureDebut)} – {pad(c.heureFin)}
                                </p>
                                {renderCours ? renderCours(c) : null}
                              </div>
                            ))}
                          </div>
                        ) : onEmptyClick ? (
                          <button
                            type="button"
                            className="w-full h-full min-h-[44px] rounded-md flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
                            style={{ border: '1px dashed var(--border-subtle)', color: 'var(--text-muted)' }}
                            onClick={() => onEmptyClick({ jourSemaine, heureDebut: row.debut, heureFin: row.fin })}
                            title={`Ajouter un cours ${JOURS_SEMAINE[jourIndex]} ${row.debut} – ${row.fin}`}
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        ) : (
                          <div style={{ minHeight: 44 }} />
                        )}
                      </td>
                    );
                  })}
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
