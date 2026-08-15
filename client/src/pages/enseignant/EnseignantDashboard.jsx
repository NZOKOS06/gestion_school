import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAxios } from '../../hooks/useAxios';
import { useAuth } from '../../contexts/AuthContext';
import { PageHeader, Card, KpiCard, Badge, DataTable, Skeleton, EmptyState, Button } from '../../components/ui';
import { Users, BookOpen, CalendarCheck, Clock, Plus, ClipboardEdit, NotebookPen } from 'lucide-react';

const EnseignantDashboard = () => {
  const { get } = useAxios();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await get('/api/enseignant/dashboard', { silent: true });
        setData(res);
      } catch {
        setError('Impossible de charger le tableau de bord');
        setData(null);
      }
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div className="space-y-8">
        <Skeleton height={28} width={220} />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl p-5" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
              <Skeleton height={12} width={96} className="mb-3" />
              <Skeleton height={32} width={140} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-6">
        <PageHeader title="Tableau de bord" subtitle={`Bonjour ${user?.prenom || ''}`} />
        <EmptyState
          title="Impossible de charger le tableau de bord"
          description={error || 'Réessayez dans un instant.'}
          action={<Button size="sm" onClick={() => window.location.reload()}>Réessayer</Button>}
        />
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

      <div className="flex flex-wrap gap-2">
        <Button icon={Plus} onClick={() => navigate('/enseignant/saisie-notes?nouveau=1')}>
          Programmer une évaluation
        </Button>
        <Button variant="secondary" icon={ClipboardEdit} onClick={() => navigate('/enseignant/saisie-notes')}>
          Saisir les notes
        </Button>
      </div>

      {data.coursAujourdhui?.length > 0 && (
        <Card title="Cours d'aujourd'hui" icon={CalendarCheck}>
          <div className="space-y-2">
            {data.coursAujourdhui.map((cours) => (
              <div key={cours.id} className="flex items-center justify-between gap-3 p-3 rounded-lg" style={{ background: 'var(--surface-overlay)' }}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'color-mix(in srgb, var(--color-primary) 12%, transparent)' }}>
                    <BookOpen className="h-5 w-5" style={{ color: 'var(--color-primary)' }} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{cours.matiereNom}</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{cours.classeNom} · Salle {cours.salle || '—'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="info">{cours.heureDebut} — {cours.heureFin}</Badge>
                  <Button size="sm" variant="secondary" icon={CalendarCheck} onClick={() => navigate(`/enseignant/appel?coursId=${cours.id}`)}>
                    Appel
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={NotebookPen}
                    onClick={() => navigate(`/enseignant/cahier-de-textes?classeId=${cours.classeId || ''}&matiereId=${cours.matiereId || ''}&nouveau=1`)}
                  >
                    Cahier
                  </Button>
                </div>
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
