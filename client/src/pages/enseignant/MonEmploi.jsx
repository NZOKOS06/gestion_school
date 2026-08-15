import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAxios } from '../../hooks/useAxios';
import { PageHeader, Badge } from '../../components/ui';
import { CalendarDays } from 'lucide-react';

const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const HEURES = Array.from({ length: 12 }, (_, i) => i + 7);

const MonEmploi = () => {
  const { get } = useAxios();
  const navigate = useNavigate();
  const [creneaux, setCreneaux] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchCreneaux = useCallback(async () => {
    setLoading(true);
    try {
      const res = await get('/api/enseignant/emploi-du-temps');
      setCreneaux(res?.data || res || []);
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchCreneaux(); }, [fetchCreneaux]);

  const getCreneau = (jour, heure) => {
    return creneaux.find((c) => {
      if (c.jourSemaine !== jour) return false;
      const cDebut = parseInt(c.heureDebut.split(':')[0]);
      const cFin = parseInt(c.heureFin.split(':')[0]);
      return heure >= cDebut && heure < cFin;
    });
  };

  const cellStyle = {
    borderBottom: '1px solid var(--border-subtle)',
    borderRight: '1px solid var(--border-subtle)',
    minHeight: 48,
    padding: 4,
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Mon emploi du temps" subtitle="Grille hebdomadaire de vos cours" />

      <div className="overflow-x-auto rounded-lg" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
        <table className="w-full" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border-subtle)' }}>
              <th className="text-left py-3 px-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)', width: 60 }}>Heure</th>
              {JOURS.map((jour, i) => (
                <th key={jour} className="text-center py-3 px-2 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)', ...i < JOURS.length - 1 && { borderRight: '1px solid var(--border-subtle)' } }}>
                  {jour}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {HEURES.map((heure) => (
              <tr key={heure}>
                <td className="text-center text-xs font-medium py-2" style={{ color: 'var(--text-muted)', ...cellStyle }}>
                  {heure.toString().padStart(2, '0')}:00
                </td>
                {JOURS.map((_, jourIndex) => {
                  const jourNum = jourIndex + 1;
                  const creneau = getCreneau(jourNum, heure);
                  const isStart = creneau && parseInt(creneau.heureDebut.split(':')[0]) === heure;
                  return (
                    <td key={jourIndex} style={cellStyle}>
                      {creneau && isStart ? (
                        <div
                          className="rounded-lg p-2 text-xs cursor-pointer"
                          style={{ background: 'color-mix(in srgb, var(--color-primary) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--color-primary) 30%, transparent)' }}
                          title="Cahier de textes / Appel"
                          onClick={() => {
                            const today = new Date().getDay();
                            const jsDay = today === 0 ? 7 : today;
                            if (jsDay === jourNum) {
                              navigate(`/enseignant/appel?coursId=${creneau.id}`);
                            } else {
                              navigate(`/enseignant/cahier-de-textes?classeId=${creneau.classeId || ''}&matiereId=${creneau.matiereId || ''}&nouveau=1`);
                            }
                          }}
                        >
                          <p className="font-semibold" style={{ color: 'var(--color-primary)' }}>{creneau.matiereNom}</p>
                          <p style={{ color: 'var(--text-secondary)' }}>{creneau.classeNom}</p>
                          {creneau.salle && <p style={{ color: 'var(--text-muted)' }}>Salle {creneau.salle}</p>}
                        </div>
                      ) : creneau ? (
                        <div style={{ background: 'color-mix(in srgb, var(--color-primary) 6%, transparent)', height: '100%', minHeight: 44 }} />
                      ) : null}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {loading && creneaux.length === 0 && (
        <p className="text-sm text-center" style={{ color: 'var(--text-muted)' }}>Chargement...</p>
      )}

      {!loading && creneaux.length === 0 && (
        <div className="text-center py-16">
          <CalendarDays className="h-12 w-12 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} strokeWidth={1.25} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Aucun cours programmé</p>
        </div>
      )}
    </div>
  );
};

export default MonEmploi;
