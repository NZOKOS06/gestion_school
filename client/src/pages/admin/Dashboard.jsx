import { useEffect, useState } from 'react';
import { useAxios } from '../../hooks/useAxios';
import { useTenant } from '../../contexts/TenantContext';
import { Users, TrendingUp, Wallet, AlertTriangle, CalendarX } from 'lucide-react';
import { KpiCard, Card, DataTable, PageHeader, Badge } from '../../components/ui';
import {
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar,
} from 'recharts';

const CYCLE_COLORS = {
  préscolaire: '#8B5CF6',
  primaire: '#3B82F6',
  collège: '#10B981',
  lycée: '#F59E0B',
};

const Dashboard = () => {
  const { formatPrice } = useTenant();
  const { get, loading } = useAxios();
  const [data, setData] = useState(null);
  const [evolution, setEvolution] = useState([]);

  useEffect(() => {
    fetchKPIs();
    fetchEvolution();
  }, []);

  const fetchKPIs = async () => {
    try {
      const response = await get('/api/dashboard/kpis');
      setData(response);
    } catch (error) {
      console.error('Error fetching KPIs:', error);
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
    } catch { /* silent */ }
  };

  if (loading || !data) {
    return (
      <div className="space-y-8">
        <div className="skeleton h-8 w-56 rounded-lg" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl p-5" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
              <div className="flex items-start justify-between">
                <div className="flex-1 space-y-3">
                  <div className="skeleton h-3 w-24 rounded" />
                  <div className="skeleton h-8 w-36 rounded" />
                  <div className="skeleton h-3 w-20 rounded" />
                </div>
                <div className="skeleton h-11 w-11 rounded-xl ml-4" />
              </div>
            </div>
          ))}
        </div>
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
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {stats.map((stat, index) => (
          <KpiCard key={index} {...stat} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {cycleData.length > 0 && (
          <Card title="Répartition par cycle">
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
                      <Cell key={i} fill={CYCLE_COLORS[entry.name] || '#94A3B8'} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}

        {evolution.length > 0 && (
          <Card title="Évolution des paiements — 6 derniers mois">
            <div style={{ height: 240 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={evolution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                  <XAxis dataKey="mois" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} width={60} />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      return (
                        <div className="rounded-lg px-3 py-2 text-xs shadow-lg" style={{ background: '#1e293b', color: '#f1f5f9' }}>
                          <p className="font-medium mb-1">{label}</p>
                          <p style={{ color: 'var(--color-primary)' }}>{formatPrice(payload[0].value)}</p>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="montant" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}
      </div>

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
                render: (val) => <Badge variant="info">{val}</Badge>,
              },
            ]}
            data={derniersPaiements || []}
            emptyMessage="Aucun paiement récent"
          />
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
