import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAxios } from '../../hooks/useAxios';
import { PageHeader, Badge } from '../../components/ui';
import { CalendarDays } from 'lucide-react';
import EmploiGrid from '../../components/EmploiGrid.jsx';


const MonEmploi = () => {
  const { get } = useAxios();
  const navigate = useNavigate();
  const [creneaux, setCreneaux] = useState([]);
  const [loading, setLoading] = useState(true);
  const [grille, setGrille] = useState([]);

  const fetchCreneaux = useCallback(async () => {
    setLoading(true);
    try {
      const res = await get('/api/enseignant/emploi-du-temps');
      setCreneaux(res?.data || res || []);
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchCreneaux(); }, [fetchCreneaux]);

  // Grille horaire commune de l'école (pauses / récréations)
  useEffect(() => {
    get('/api/emplois-du-temps/creneaux', { silent: true })
      .then((res) => setGrille(res?.data || []))
      .catch(() => setGrille([]));
  }, [get]);

  // Clic sur un cours : appel si c'est aujourd'hui, sinon cahier de textes
  const ouvrirCours = (creneau) => {
    const today = new Date().getDay();
    const jsDay = today === 0 ? 7 : today;
    if (jsDay === creneau.jourSemaine) {
      navigate(`/enseignant/appel?coursId=${creneau.id}`);
    } else {
      navigate(`/enseignant/cahier-de-textes?classeId=${creneau.classeId || ''}&matiereId=${creneau.matiereId || ''}&nouveau=1`);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Mon emploi du temps" subtitle="Grille hebdomadaire de vos cours" />

      {creneaux.length > 0 && (
        <EmploiGrid
          cours={creneaux}
          grille={grille}
          onCoursClick={ouvrirCours}
          renderCours={(c) => (
            <>
              <p className="font-semibold" style={{ color: 'var(--color-primary)' }}>{c.matiereNom}</p>
              <p style={{ color: 'var(--text-secondary)' }}>{c.classeNom}</p>
              {c.salle && <p style={{ color: 'var(--text-muted)' }}>Salle {c.salle}</p>}
            </>
          )}
        />
      )}

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
