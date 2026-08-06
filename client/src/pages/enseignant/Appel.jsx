import { useEffect, useState, useCallback } from 'react';
import { useAxios } from '../../hooks/useAxios';
import { PageHeader, Card, Button, Badge, DataTable } from '../../components/ui';
import { CalendarCheck, Check, X, Clock, Save } from 'lucide-react';

const STATUTS = {
  present: { variant: 'success', label: 'Présent', icon: Check },
  absent: { variant: 'danger', label: 'Absent', icon: X },
  retard: { variant: 'warning', label: 'Retard', icon: Clock },
  excuse: { variant: 'info', label: 'Excusé', icon: Clock },
};

const Appel = () => {
  const { get, post } = useAxios();
  const [cours, setCours] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCours, setSelectedCours] = useState(null);
  const [eleves, setEleves] = useState([]);
  const [presences, setPresences] = useState({});
  const [saving, setSaving] = useState(false);

  const fetchCours = useCallback(async () => {
    setLoading(true);
    try {
      const res = await get('/api/enseignant/cours-aujourdhui');
      setCours(res?.data || res || []);
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchCours(); }, [fetchCours]);

  const openAppel = async (c) => {
    setSelectedCours(c);
    try {
      const res = await get(`/api/emplois-du-temps/${c.id}/eleves`, { silent: true });
      const data = res?.data || res || [];
      setEleves(data);
      const initial = {};
      data.forEach((el) => { initial[el.id] = 'present'; });
      setPresences(initial);
    } catch { setEleves([]); }
  };

  const setStatut = (eleveId, statut) => {
    setPresences({ ...presences, [eleveId]: statut });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = Object.entries(presences).map(([eleveId, statut]) => ({ eleveId, statut }));
      await post(`/api/absences/appel`, { coursId: selectedCours.id, presences: payload });
      setSelectedCours(null);
    } catch { /* silent */ }
    setSaving(false);
  };

  const markAll = (statut) => {
    const all = {};
    eleves.forEach((el) => { all[el.id] = statut; });
    setPresences(all);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Faire l'appel" subtitle="Enregistrer les présences pour vos cours du jour" />

      {!selectedCours ? (
        <div className="space-y-3">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="rounded-xl p-5" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
                  <div className="skeleton h-5 w-40 rounded mb-2" />
                  <div className="skeleton h-3 w-24 rounded" />
                </div>
              ))}
            </div>
          ) : cours.length === 0 ? (
            <div className="text-center py-16">
              <CalendarCheck className="h-12 w-12 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} strokeWidth={1.25} />
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Aucun cours aujourd'hui</p>
            </div>
          ) : (
            cours.map((c) => (
              <div
                key={c.id}
                onClick={() => openAppel(c)}
                className="rounded-xl p-5 cursor-pointer transition-all"
                style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.08)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'var(--shadow-card)'; }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg flex items-center justify-center" style={{ background: 'color-mix(in srgb, var(--color-primary) 12%, transparent)' }}>
                      <CalendarCheck className="h-5 w-5" style={{ color: 'var(--color-primary)' }} />
                    </div>
                    <div>
                      <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{c.matiereNom}</p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{c.classeNom} · Salle {c.salle || '—'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="info">{c.heureDebut} — {c.heureFin}</Badge>
                    {c.appelFait ? <Badge variant="success" dot>Fait</Badge> : <Badge variant="warning">À faire</Badge>}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <Card
          title={`Appel — ${selectedCours.matiereNom}`}
          subtitle={`${selectedCours.classeNom} · ${selectedCours.heureDebut}—${selectedCours.heureFin}`}
          action={
            <div className="flex items-center gap-2">
              <Button size="sm" variant="secondary" onClick={() => markAll('present')}>Tous présents</Button>
              <Button size="sm" variant="secondary" onClick={() => setSelectedCours(null)}>Retour</Button>
              <Button size="sm" icon={Save} onClick={handleSave} loading={saving}>Enregistrer</Button>
            </div>
          }
        >
          <div className="space-y-2">
            {eleves.map((el) => (
              <div key={el.id} className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'var(--surface-overlay)' }}>
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                    style={{ background: 'color-mix(in srgb, var(--color-primary) 15%, transparent)', color: 'var(--color-primary)' }}>
                    {el.prenom?.[0]}{el.nom?.[0]}
                  </div>
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{el.prenom} {el.nom}</p>
                    <p className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{el.matricule}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {Object.entries(STATUTS).map(([key, conf]) => {
                    const isActive = presences[el.id] === key;
                    return (
                      <button
                        key={key}
                        onClick={() => setStatut(el.id, key)}
                        className="px-2.5 py-1 rounded-md text-xs font-medium transition-all"
                        style={isActive
                          ? { background: `color-mix(in srgb, ${conf.variant === 'success' ? '#10B981' : conf.variant === 'danger' ? '#EF4444' : conf.variant === 'warning' ? '#F59E0B' : '#3B82F6'} 15%, transparent)`, color: conf.variant === 'success' ? '#10B981' : conf.variant === 'danger' ? '#EF4444' : conf.variant === 'warning' ? '#F59E0B' : '#3B82F6', fontWeight: 700 }
                          : { color: 'var(--text-muted)' }}
                      >
                        {conf.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            {eleves.length === 0 && (
              <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>Aucun élève</p>
            )}
          </div>
        </Card>
      )}
    </div>
  );
};

export default Appel;
