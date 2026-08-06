import { useEffect, useState } from 'react';
import { useAxios } from '../../hooks/useAxios';
import { useAuth } from '../../contexts/AuthContext';
import { PageHeader, Card, KpiCard, Badge, DataTable } from '../../components/ui';
import { Users, BookOpen, CalendarCheck, Clock } from 'lucide-react';

const EnseignantDashboard = () => {
  const { get } = useAxios();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await get('/api/enseignant/dashboard', { silent: true });
        setData(res);
      } catch { /* silent */ }
      setLoading(false);
    })();
  }, []);

  if (loading || !data) {
    return (
      <div className="space-y-8">
        <div className="skeleton h-8 w-56 rounded-lg" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl p-5" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
              <div className="skeleton h-3 w-24 rounded mb-3" />
              <div className="skeleton h-8 w-36 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const stats = [
    { label: 'Mes classes', value: data.nbClasses ?? 0, icon: Users, color: 'blue', delay: 0 },
    { label: 'Mes matières', value: data.nbMatieres ?? 0, icon: BookOpen, color: 'green', delay: 100 },
    { label: 'Cours aujourd\'hui', value: data.coursAujourdhui?.length ?? 0, icon: CalendarCheck, color: 'primary', delay: 200 },
    { label: 'Évaluations à corriger', value: data.evaluationsACorriger ?? 0, icon: Clock, color: 'orange', delay: 300 },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Bonjour ${user?.prenom || ''}`}
        subtitle="Votre espace enseignant"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {stats.map((stat, i) => <KpiCard key={i} {...stat} />)}
      </div>

      {data.coursAujourdhui?.length > 0 && (
        <Card title="Cours d'aujourd'hui" icon={CalendarCheck}>
          <div className="space-y-2">
            {data.coursAujourdhui.map((cours) => (
              <div key={cours.id} className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'var(--surface-overlay)' }}>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg flex items-center justify-center" style={{ background: 'color-mix(in srgb, var(--color-primary) 12%, transparent)' }}>
                    <BookOpen className="h-5 w-5" style={{ color: 'var(--color-primary)' }} />
                  </div>
                  <div>
                    <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{cours.matiereNom}</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{cours.classeNom} · Salle {cours.salle || '—'}</p>
                  </div>
                </div>
                <Badge variant="info">{cours.heureDebut} — {cours.heureFin}</Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      {data.dernieresEvaluations?.length > 0 && (
        <Card title="Dernières évaluations">
          <DataTable
            columns={[
              { key: 'nom', label: 'Évaluation', render: (v) => <span style={{ color: 'var(--text-primary)' }}>{v}</span> },
              { key: 'matiereNom', label: 'Matière', render: (v) => <Badge variant="info">{v}</Badge> },
              { key: 'classeNom', label: 'Classe', render: (v) => <span style={{ color: 'var(--text-secondary)' }}>{v}</span> },
              { key: 'dateEvaluation', label: 'Date', render: (v) => <span style={{ color: 'var(--text-muted)' }}>{new Date(v).toLocaleDateString('fr-FR')}</span> },
              { key: 'statut', label: 'Statut', render: (v) => <Badge variant={v === 'saisie_terminee' ? 'success' : 'warning'}>{v === 'saisie_terminee' ? 'Saisie terminée' : 'En cours'}</Badge> },
            ]}
            data={data.dernieresEvaluations}
            emptyMessage="Aucune évaluation"
          />
        </Card>
      )}
    </div>
  );
};

export default EnseignantDashboard;
