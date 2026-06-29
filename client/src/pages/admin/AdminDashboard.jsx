import { useEffect, useState } from 'react';
import axios from 'axios';
import { useAxios } from '../../hooks/useAxios';
import { useTenant } from '../../contexts/TenantContext';
import { TrendingUp, AlertTriangle, Clock, FileText, FileCheck, XCircle } from 'lucide-react';
import { KpiCard, Card, DataTable, PageHeader } from '../../components/ui';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

const AdminDashboard = () => {
  const { formatPrice } = useTenant();
  const { get, loading } = useAxios();
  const [data, setData] = useState(null);
  const [evolution, setEvolution] = useState([]);
  const [factureKpi, setFactureKpi] = useState({ total: 0, conformes: 0, ecarts: 0, litiges: 0 });

  useEffect(() => {
    fetchKPIs();
    fetchFactureKpi();
    axios.get('/api/dashboard/evolution?periode=7', { withCredentials: true })
      .then((res) => setEvolution(
        res.data.map((d) => ({
          jour: new Date(d.date + 'T12:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
          montant: Number(d.montant),
          nb: d.count,
        }))
      ))
      .catch(() => {});
  }, []);

  const fetchKPIs = async () => {
    try {
      const response = await get('/api/dashboard/kpis');
      setData(response);
    } catch (error) {
      console.error('Error fetching KPIs:', error);
    }
  };

  const fetchFactureKpi = async () => {
    try {
      const res = await get('/api/factures/tableau-rapprochement?periode=365j', { silent: true });
      setFactureKpi({
        total: res.total || 0,
        conformes: res.conformes || 0,
        ecarts: res.ecarts || 0,
        litiges: res.litiges || 0,
      });
    } catch (e) { /* silent */ }
  };

  if (loading || !data) {
    return (
      <div className="space-y-8">
        <div className="skeleton h-8 w-56 rounded-lg" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
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
        <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
          <div className="p-5" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            <div className="skeleton h-4 w-48 rounded" />
          </div>
          <div className="p-4 space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-4">
                <div className="skeleton h-4 rounded" style={{ flex: 2 }} />
                <div className="skeleton h-4 w-16 rounded" />
                <div className="skeleton h-4 w-24 rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const { ventes, alertes, topVentes } = data;

  const weekAvg = ventes.week.montant / 7 || 1;
  const todayTrend = Math.round(((ventes.today.montant - weekAvg) / weekAvg) * 100);

  const stats = [
    {
      label: 'Ventes du jour',
      value: formatPrice(ventes.today.montant),
      subtitle: `${ventes.today.count} ventes`,
      icon: TrendingUp,
      trend: todayTrend,
      delay: 0,
    },
    {
      label: 'Cette semaine',
      value: formatPrice(ventes.week.montant),
      subtitle: `${ventes.week.count} ventes`,
      icon: TrendingUp,
      delay: 100,
    },
    {
      label: 'Ce mois',
      value: formatPrice(ventes.month.montant),
      subtitle: `${ventes.month.count} ventes`,
      icon: TrendingUp,
      delay: 200,
    },
  ];

  const formatAbrege = (val) => {
    const n = Number(val) || 0;
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
    return n.toString();
  };

  const alertCards = [
    {
      label: 'Stock critique',
      value: alertes.stock,
      icon: AlertTriangle,
      color: 'red',
      link: '/admin/stock',
      delay: 300,
    },
    {
      label: 'Péremptions',
      value: alertes.peremptions,
      icon: Clock,
      color: 'orange',
      link: '/admin/lots',
      delay: 400,
    },
    {
      label: 'Ordonnances',
      value: alertes.ordonnances,
      icon: FileText,
      color: 'blue',
      link: '/admin/ordonnances',
      delay: 500,
    },
    {
      label: 'Factures en attente',
      value: factureKpi.total - factureKpi.conformes - factureKpi.litiges,
      icon: FileCheck,
      color: 'blue',
      link: '/admin/factures',
      delay: 600,
    },
    {
      label: 'Litiges non résolus',
      value: factureKpi.litiges,
      icon: XCircle,
      color: 'red',
      link: '/admin/factures',
      delay: 700,
    },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Tableau de bord"
        subtitle="Vue d’ensemble de votre activité"
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {stats.map((stat, index) => (
          <KpiCard
            key={index}
            {...stat}
            color="primary"
            data-testid={index === 0 ? 'kpi-ca-jour' : index === 1 ? 'kpi-nb-ventes' : undefined}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-5">
        {alertCards.map((alert, index) => (
          <a key={index} href={alert.link} className="block group">
            <KpiCard {...alert} />
          </a>
        ))}
      </div>

      {evolution.length > 0 && (
        <Card title="Évolution des ventes — 7 derniers jours">
          <div style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={evolution} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                <XAxis dataKey="jour" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} width={52} tickFormatter={formatAbrege} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div className="rounded-lg px-3 py-2 text-xs shadow-lg" style={{ background: '#1e293b', border: '1px solid #334155', color: '#f1f5f9' }}>
                        <p className="font-medium mb-1">{label}</p>
                        <p style={{ color: 'var(--color-primary)' }}>{formatPrice(payload[0].value)}</p>
                        {payload[0].payload?.nb != null && <p style={{ color: '#94a3b8' }}>{payload[0].payload.nb} vente(s)</p>}
                      </div>
                    );
                  }}
                />
                <Line type="monotone" dataKey="montant" stroke="var(--color-primary)" strokeWidth={2.5} dot={{ r: 3, fill: 'var(--color-primary)', strokeWidth: 0 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      <Card title="Top produits du mois">
        <DataTable
          columns={[
            {
              key: 'produit',
              label: 'Produit',
              render: (_, row) => (
                <div>
                  <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{row.dci}</p>
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{row.nomCommercial}</p>
                </div>
              ),
            },
            {
              key: 'quantiteVendue',
              label: 'Quantité',
              render: (val) => (
                <span className="font-mono" style={{ color: 'var(--text-secondary)' }}>{val}</span>
              ),
            },
            {
              key: 'ca',
              label: 'CA',
              render: (val) => (
                <span className="font-medium" style={{ color: 'var(--color-success)' }}>{formatPrice(val)}</span>
              ),
            },
          ]}
          data={topVentes || []}
          emptyMessage="Aucune vente ce mois-ci"
        />
      </Card>
    </div>
  );
};

export default AdminDashboard;
