import { useEffect, useState } from 'react';
import { useAxios } from '../../hooks/useAxios';
import { useAuth } from '../../contexts/AuthContext';
import { useTenant } from '../../contexts/TenantContext';
import { PageHeader, Card, KpiCard, Badge, Skeleton, EmptyState, Button } from '../../components/ui';
import { Users, FileText, Wallet, CalendarX } from 'lucide-react';
import { Link } from 'react-router-dom';

const ParentDashboard = () => {
  const { get } = useAxios();
  const { user } = useAuth();
  const { formatPrice } = useTenant();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await get('/api/parent/dashboard', { silent: true });
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
        <PageHeader title="Espace parent" subtitle={`Bonjour ${user?.prenom || ''}`} />
        <EmptyState
          title="Impossible de charger le tableau de bord"
          description={error || 'Réessayez dans un instant.'}
          action={<Button size="sm" onClick={() => window.location.reload()}>Réessayer</Button>}
        />
      </div>
    );
  }

  const stats = [
    { label: 'Mes enfants', value: data.nbEnfants ?? 0, icon: Users, color: 'blue', delay: 0 },
    { label: 'Bulletins disponibles', value: data.nbBulletins ?? 0, icon: FileText, color: 'green', delay: 100 },
    { label: 'Solde à payer', value: formatPrice(data.soldeTotal ?? 0), icon: Wallet, color: 'red', delay: 200 },
    { label: 'Absences non justifiées', value: data.nbAbsencesNonJustifiees ?? 0, icon: CalendarX, color: 'orange', delay: 300 },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Bonjour ${user?.prenom || ''}`}
        subtitle="Suivez la scolarité de vos enfants"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {stats.map((stat, i) => <KpiCard key={i} {...stat} />)}
      </div>

      {data.enfants?.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.enfants.map((enfant) => (
            <Card key={enfant.id}>
              <div className="flex items-center gap-4 mb-4">
                <div className="h-12 w-12 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                  style={{ background: 'color-mix(in srgb, var(--color-primary) 15%, transparent)', color: 'var(--color-primary)' }}>
                  {enfant.prenom?.[0]}{enfant.nom?.[0]}
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{enfant.prenom} {enfant.nom}</h3>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{enfant.classeNom} · {enfant.matricule}</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-2 rounded-lg" style={{ background: 'var(--surface-overlay)' }}>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Moyenne</p>
                  <p className="font-bold" style={{ color: 'var(--color-primary)' }}>{enfant.moyenneGenerale ? Number(enfant.moyenneGenerale).toFixed(2) : '—'}</p>
                </div>
                <div className="p-2 rounded-lg" style={{ background: 'var(--surface-overlay)' }}>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Rang</p>
                  <p className="font-bold" style={{ color: 'var(--text-primary)' }}>{enfant.rang ? `${enfant.rang}e` : '—'}</p>
                </div>
                <div className="p-2 rounded-lg" style={{ background: 'var(--surface-overlay)' }}>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Absences</p>
                  <p className="font-bold" style={{ color: enfant.nbAbsencesNonJustifiees > 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>
                    {enfant.nbAbsencesNonJustifiees ?? 0}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <Link to="/parent/bulletins" className="flex-1">
                  <span className="block text-center text-xs font-medium py-2 rounded-md" style={{ background: 'color-mix(in srgb, var(--color-primary) 10%, transparent)', color: 'var(--color-primary)' }}>
                    Voir bulletins
                  </span>
                </Link>
                <Link to="/parent/facturation" className="flex-1">
                  <span className="block text-center text-xs font-medium py-2 rounded-md" style={{ background: 'var(--surface-overlay)', color: 'var(--text-secondary)' }}>
                    Facturation
                  </span>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}

      {data.notifications?.length > 0 && (
        <Card title="Notifications récentes">
          <div className="space-y-2">
            {data.notifications.slice(0, 5).map((notif) => (
              <div key={notif.id} className="flex items-start gap-3 p-3 rounded-lg" style={{ background: 'var(--surface-overlay)' }}>
                <div className="h-2 w-2 rounded-full mt-1.5 shrink-0" style={{ background: notif.lu ? 'var(--text-muted)' : 'var(--color-primary)' }} />
                <div className="flex-1">
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{notif.titre}</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{notif.message}</p>
                </div>
                {!notif.lu && <Badge variant="info" dot>Nouveau</Badge>}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};

export default ParentDashboard;
