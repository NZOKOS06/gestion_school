import { useEffect, useState } from 'react';
import { useAxios } from '../../hooks/useAxios';
import { useTenant } from '../../contexts/TenantContext';
import { Users, TrendingUp, Wallet, AlertTriangle } from 'lucide-react';
import { KpiCard, Card, DataTable, PageHeader, Badge, Skeleton, EmptyState, Button } from '../../components/ui';
import {
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Legend
} from 'recharts';

const CYCLE_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
];

const Dashboard = () => {
  const { formatPrice } = useTenant();
  const { get } = useAxios();
  const [data, setData] = useState(null);
  const [evolution, setEvolution] = useState([]);
  const [alertes, setAlertes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchKPIs();
    fetchEvolution();
    fetchAlertes();
  }, []);

  const fetchKPIs = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await get('/api/dashboard/kpis');
      setData(response);
    } catch (err) {
      setError(err.response?.data?.error || 'Impossible de charger le tableau de bord');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchEvolution = async () => {
    try {
      const response = await get('/api/dashboard/evolution?periode=30', { silent: true });
      const rows = Array.isArray(response) ? response : (response?.data || []);
      setEvolution(rows.map((d) => ({
        mois: d.date
          ? new Date(d.date + 'T12:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
          : (d.mois || ''),
        montant: Number(d.montant) || 0,
      })));
    } catch {
      setEvolution([]);
    }
  };

  const fetchAlertes = async () => {
    try {
      const res = await get('/api/calendrier/alertes?jours=14', { silent: true });
      setAlertes(res?.data || []);
    } catch {
      setAlertes([]);
    }
  };

  if (loading) {
    return (
      <div className="space-y-8" data-testid="page-dashboard">
        <Skeleton height={28} width={220} />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl p-5" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
              <div className="flex items-start justify-between">
                <div className="flex-1 space-y-3">
                  <Skeleton height={12} width={96} />
                  <Skeleton height={32} width={140} />
                  <Skeleton height={12} width={80} />
                </div>
                <Skeleton height={44} width={44} rounded="lg" className="ml-4" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-6">
        <PageHeader title="Tableau de bord" subtitle="Vue d'ensemble de votre établissement" data-testid="page-dashboard" />
        <EmptyState
          icon={AlertTriangle}
          title="Impossible de charger le tableau de bord"
          description={error || 'Une erreur est survenue.'}
          action={<Button size="sm" onClick={() => { fetchKPIs(); fetchEvolution(); fetchAlertes(); }}>Réessayer</Button>}
        />
      </div>
    );
  }

  const { totalEleves, tauxPresence, recettesMois, objectifMois, tauxImpayes, repartitionCycles, dernieresAbsences, derniersPaiements } = data;

  const stats = [
    { label: 'Élèves inscrits', value: totalEleves ?? 0, subtitle: 'Cette année', icon: Users, color: 'blue', delay: 0 },
    { label: 'Taux de présence', value: `${tauxPresence ?? 0}%`, subtitle: "Aujourd'hui", icon: TrendingUp, color: 'green', delay: 100 },
    { label: 'Recettes du mois', value: formatPrice(recettesMois ?? 0), subtitle: `Objectif: ${formatPrice(objectifMois ?? 0)}`, icon: Wallet, color: 'primary', delay: 200 },
    { label: 'Taux d\'impayés', value: `${tauxImpayes ?? 0}%`, subtitle: 'Échéances en retard', icon: AlertTriangle, color: 'red', delay: 300 },
  ];

  const cycleData = (repartitionCycles || []).map((c) => ({
    name: c.cycle,
    value: c.count,
  }));

  return (
    <div className="space-y-8">
      <PageHeader
        title="Tableau de bord"
        subtitle="Vue d'ensemble de votre établissement"
        data-testid="page-dashboard"
      />

      {alertes.length > 0 && (
        <div
          className="rounded-lg px-4 py-3 space-y-1.5"
          style={{ background: 'color-mix(in srgb, var(--color-warning) 12%, transparent)', border: '1px solid var(--color-warning)' }}
        >
          {alertes.map((a) => (
            <div key={a.id} className="flex items-start gap-2 text-sm" style={{ color: 'var(--text-primary)' }}>
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" style={{ color: 'var(--color-warning)' }} />
              <span>{a.message}</span>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {stats.map((stat, index) => (
          <KpiCard key={index} {...stat} />
        ))}
      </div>

      {(cycleData.length > 0 || evolution.length > 0) && (
        <div className={`grid grid-cols-1 gap-6 ${cycleData.length > 0 && evolution.length > 0 ? 'lg:grid-cols-2' : ''}`}>
          {cycleData.length > 0 && (
            <Card title="Répartition par cycle" className={evolution.length === 0 ? 'lg:col-span-1' : ''}>
              <div style={{ height: 240 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={cycleData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {cycleData.map((entry, i) => (
                        <Cell key={i} fill={CYCLE_COLORS[i % CYCLE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}

          {evolution.length > 0 && (
            <Card title="Évolution des paiements — 30 derniers jours">
              <div style={{ height: cycleData.length === 0 ? 280 : 240 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={evolution}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                    <XAxis dataKey="mois" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} width={60} tickFormatter={(val) => `${val >= 1000 ? (val / 1000) + 'k' : val}`} />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null;
                        return (
                          <div className="rounded-lg px-3 py-2 text-xs shadow-lg" style={{ background: 'var(--surface-raised)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}>
                            <p className="font-medium mb-1">{label}</p>
                            <p style={{ color: 'var(--color-primary)' }}>{formatPrice(payload[0].value)}</p>
                          </div>
                        );
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                    <Bar dataKey="montant" name="Recettes" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="5 dernières absences non justifiées">
          <DataTable
            columns={[
              {
                key: 'eleve',
                label: 'Élève',
                render: (_, row) => (
                  <div>
                    <p className="font-medium" style={{ color: 'var(--text-primary)' }}>
                      {row.elevePrenom} {row.eleveNom}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{row.classeNom}</p>
                  </div>
                ),
              },
              {
                key: 'dateAbsence',
                label: 'Date',
                render: (val) => (
                  <span style={{ color: 'var(--text-secondary)' }}>
                    {new Date(val).toLocaleDateString('fr-FR')}
                  </span>
                ),
              },
              {
                key: 'statut',
                label: 'Statut',
                render: () => <Badge variant="danger">Non justifiée</Badge>,
              },
            ]}
            data={dernieresAbsences || []}
            emptyMessage="Aucune absence non justifiée"
            emptyDescription="Tout est en ordre pour le moment."
            mobileCards={false}
          />
        </Card>

        <Card title="5 derniers paiements encaissés">
          <DataTable
            columns={[
              {
                key: 'eleve',
                label: 'Élève',
                render: (_, row) => (
                  <div>
                    <p className="font-medium" style={{ color: 'var(--text-primary)' }}>
                      {row.elevePrenom} {row.eleveNom}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Reçu n°{row.numeroRecu}</p>
                  </div>
                ),
              },
              {
                key: 'montant',
                label: 'Montant',
                render: (val) => (
                  <span className="font-medium" style={{ color: 'var(--color-success)' }}>
                    {formatPrice(val)}
                  </span>
                ),
              },
              {
                key: 'modePaiement',
                label: 'Mode',
                render: (val) => <Badge variant="info">{val === 'especes' ? 'Espèces' : val}</Badge>,
              },
            ]}
            data={derniersPaiements || []}
            emptyMessage="Aucun paiement récent"
            emptyDescription="Les encaissements récents s'afficheront ici."
            mobileCards={false}
          />
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
