import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  TrendingUp,
  Wallet,
  GraduationCap,
  Percent,
  Download,
  FileText,
  Banknote,
  Smartphone,
  CreditCard,
  BarChart3,
  TrendingDown,
} from 'lucide-react';
import { useAxios } from '../../hooks/useAxios';
import { useTenant } from '../../contexts/TenantContext';
import { Button, Card, KpiCard, DataTable, PageHeader, SegmentedControl, Badge } from '../../components/ui';

const PERIODES = [
  { label: '7 jours', value: '7j' },
  { label: '30 jours', value: '30j' },
  { label: '90 jours', value: '90j' },
  { label: 'Personnalisé', value: 'custom' },
];

const MODE_LABELS = {
  especes: 'Espèces',
  mobile_money: 'Mobile Money',
  carte: 'Carte bancaire',
  credit: 'Crédit',
};

const MODE_ICONS = {
  especes: Banknote,
  mobile_money: Smartphone,
  carte: CreditCard,
  credit: Wallet,
};

function formatTrend(pct) {
  if (pct === null || pct === undefined) return null;
  return { value: Math.abs(pct).toFixed(1), up: pct >= 0 };
}

function formatMontantAbrege(val) {
  const n = Number(val) || 0;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return n.toString();
}

function formatDateChart(isoDate) {
  if (!isoDate) return '';
  const d = new Date(isoDate);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
}

function CustomTooltip({ active, payload, label, formatPrice }) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-lg px-3 py-2 text-xs shadow-lg"
      style={{
        background: '#1e293b',
        border: '1px solid #334155',
        color: '#f1f5f9',
      }}
    >
      <p className="font-medium mb-1">{formatDateChart(label)}</p>
      <p className="mono" style={{ color: 'var(--color-primary)' }}>
        {formatPrice(payload[0].value)}
      </p>
      {payload[0].payload?.nb != null && (
        <p style={{ color: '#94a3b8' }}>{payload[0].payload.nb} paiement(s)</p>
      )}
    </div>
  );
}

function ProgressBar({ value, max, color = 'var(--color-primary)' }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div
      className="h-1.5 rounded-full overflow-hidden mt-2"
      style={{ background: 'var(--surface-overlay)' }}
    >
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${pct}%`, background: color }}
      />
    </div>
  );
}

const Rapports = () => {
  const { formatPrice } = useTenant();
  const { get, loading } = useAxios();
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [periode, setPeriode] = useState('30j');
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');
  const [exporting, setExporting] = useState(null);
  const [annees, setAnnees] = useState([]);
  const [yearScope, setYearScope] = useState('active');

  const anneeActive = useMemo(
    () => annees.find((a) => a.actif || a.statut === 'active'),
    [annees],
  );
  const anneePrev = useMemo(
    () => annees
      .filter((a) => a.statut === 'archivee' || (!a.actif && a.id !== anneeActive?.id))
      .sort((a, b) => new Date(b.dateFin || 0) - new Date(a.dateFin || 0))[0],
    [annees, anneeActive],
  );
  const resolvedAnneeId = yearScope === 'archive' ? anneePrev?.id : anneeActive?.id;
  const isArchiveView = yearScope === 'archive';
  const yearOptions = useMemo(() => {
    const opts = [{ value: 'active', label: anneeActive?.libelle || 'Année en cours' }];
    if (anneePrev) opts.push({ value: 'archive', label: anneePrev.libelle || 'Année précédente' });
    return opts;
  }, [anneeActive, anneePrev]);

  useEffect(() => {
    (async () => {
      try {
        const res = await get('/api/annees-scolaires', { silent: true });
        setAnnees(res?.data || res || []);
      } catch { /* silent */ }
    })();
  }, [get]);

  const queryParams = useMemo(() => {
    const params = { periode };
    if (periode === 'custom' && dateDebut && dateFin) {
      params.dateDebut = dateDebut;
      params.dateFin = dateFin;
    }
    if (resolvedAnneeId) params.anneeScolaireId = resolvedAnneeId;
    return params;
  }, [periode, dateDebut, dateFin, resolvedAnneeId]);

  const canFetch = periode !== 'custom' || (dateDebut && dateFin);

  const fetchRapports = useCallback(async () => {
    if (!canFetch) return;
    setLoadError(null);
    try {
      const qs = new URLSearchParams(queryParams).toString();
      const response = await get(`/api/rapports?${qs}`);
      setData(response);
    } catch (error) {
      setLoadError(error.response?.data?.error || 'Impossible de charger les rapports');
      setData(null);
    }
  }, [get, queryParams, canFetch]);

  useEffect(() => {
    fetchRapports();
  }, [fetchRapports]);

  const handleExport = async (format) => {
    if (!canFetch) {
      toast.error('Sélectionnez une période valide avant d\'exporter');
      return;
    }
    setExporting(format);
    try {
      const response = await axios.get('/api/rapports/export', {
        params: { format, ...queryParams },
        responseType: 'blob',
        withCredentials: true,
      });
      const mime = format === 'pdf' ? 'application/pdf' : 'text/csv;charset=utf-8';
      const blob = new Blob([response.data], { type: mime });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `rapports-${periode}.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success(`Export ${format.toUpperCase()} téléchargé`);
    } catch {
      toast.error('Erreur lors de l\'export');
    } finally {
      setExporting(null);
    }
  };

  const maxRecetteClasse = useMemo(() => {
    if (!data?.top_classes?.length) return 1;
    return Math.max(...data.top_classes.map((c) => c.montant));
  }, [data]);

  const totalPaiements = useMemo(() => {
    if (!data?.repartition_paiement) return 0;
    return data.repartition_paiement.reduce((sum, p) => sum + p.montant, 0);
  }, [data]);

  const chartData = useMemo(() => {
    return (data?.paiements_par_jour || data?.ventes_par_jour || []).map((j) => ({
      date: j.date,
      montant: Math.round(j.montant),
      nb: j.nb,
    }));
  }, [data]);

  const kpiCards = data
    ? [
        {
          label: 'Scolarités perçues',
          value: formatPrice(data.ca_total || data.total_paiements || 0),
          icon: TrendingUp,
          trend: data.ca_evolution_pct,
          delay: 0,
          color: 'primary',
        },
        {
          label: 'Nombre de paiements',
          value: (data.nb_ventes || data.nb_paiements || 0).toLocaleString('fr-FR'),
          icon: Wallet,
          trend: data.nb_ventes_evolution_pct,
          delay: 60,
          color: 'blue',
        },
        {
          label: 'Scolarités attendues',
          value: formatPrice(data.total_attendu || 0),
          icon: GraduationCap,
          delay: 120,
          color: 'green',
        },
        {
          label: 'Taux de recouvrement',
          value: `${data.taux_recouvrement || 0} %`,
          icon: Percent,
          delay: 180,
          color: 'orange',
        },
        {
          label: 'Dépenses',
          value: formatPrice(data.total_depenses || 0),
          icon: TrendingDown,
          delay: 240,
          color: 'red',
        },
        {
          label: 'Bénéfice net',
          value: formatPrice(data.benefice_net ?? ((data.ca_total || 0) - (data.total_depenses || 0))),
          icon: Wallet,
          delay: 300,
          color: (data.benefice_net ?? 0) >= 0 ? 'green' : 'red',
        },
      ]
    : [];

  const topColumns = [
    {
      key: 'rang',
      label: 'Rang',
      render: (_, row) => (
        <span className="mono font-semibold" style={{ color: 'var(--text-muted)' }}>
          {row.rang}
        </span>
      ),
    },
    {
      key: 'nom',
      label: 'Classe',
      render: (val) => (
        <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{val}</span>
      ),
    },
    {
      key: 'nb_eleves',
      label: 'Élèves',
      render: (val) => (
        <span className="mono" style={{ color: 'var(--text-primary)' }}>{val}</span>
      ),
    },
    {
      key: 'montant',
      label: 'Scolarités perçues',
      render: (val, row) => (
        <div className="min-w-[140px]">
          <span className="mono font-medium" style={{ color: 'var(--color-primary)' }}>
            {formatPrice(val)}
          </span>
          <ProgressBar value={val} max={maxRecetteClasse} />
        </div>
      ),
    },
    {
      key: 'taux_recouvrement',
      label: 'Taux recouvrement',
      render: (val) => (
        <span className="mono" style={{ color: 'var(--text-secondary)' }}>
          {val ? `${val} %` : '-'}
        </span>
      ),
    },
  ];

  const topData = (data?.top_classes || []).map((c, i) => ({
    ...c,
    rang: i + 1,
  }));

  return (
    <div data-testid={data ? 'rapports-loaded' : undefined} className="space-y-8">
      <PageHeader
        title="Rapports & Analyses"
        subtitle="Scolarités, dépenses et bénéfice réel de l'établissement"
        actions={
          <>
            <Button
              data-testid="btn-export-csv"
              variant="secondary"
              size="sm"
              icon={Download}
              loading={exporting === 'csv'}
              onClick={() => handleExport('csv')}
            >
              Export CSV
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={FileText}
              loading={exporting === 'pdf'}
              onClick={() => handleExport('pdf')}
            >
              Export PDF
            </Button>
          </>
        }
      />

      {yearOptions.length > 1 && (
        <div className="flex flex-wrap items-center gap-3">
          <SegmentedControl value={yearScope} onChange={setYearScope} options={yearOptions} />
          {isArchiveView && <Badge variant="neutral">Lecture seule</Badge>}
        </div>
      )}

      {loadError && (
        <Card>
          <p style={{ color: 'var(--color-danger)' }}>{loadError}</p>
          <button
            type="button"
            className="mt-2 text-sm font-medium underline"
            style={{ color: 'var(--color-primary)' }}
            onClick={fetchRapports}
          >
            Réessayer
          </button>
        </Card>
      )}

      {!loadError && !data && loading && (
        <p style={{ color: 'var(--text-muted)' }}>Chargement des rapports…</p>
      )}

      {!loadError && !data && !loading && (
        <Card>
          <p style={{ color: 'var(--text-secondary)' }}>Aucune donnée pour cette période.</p>
        </Card>
      )}
      {/* Sélecteur de période */}
      <div className="flex flex-wrap items-center gap-3">
        <div
          className="inline-flex flex-wrap gap-1 p-1 rounded-lg"
          style={{ background: 'var(--surface-overlay)', border: '1px solid var(--border-subtle)' }}
        >
          {PERIODES.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setPeriode(p.value)}
              className="px-4 py-2 rounded-md text-sm font-medium transition-all"
              style={{
                background: periode === p.value ? 'var(--surface-raised)' : 'transparent',
                color: periode === p.value ? 'var(--color-primary)' : 'var(--text-secondary)',
                boxShadow: periode === p.value ? 'var(--shadow-card)' : 'none',
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        {periode === 'custom' && (
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={dateDebut}
              onChange={(e) => setDateDebut(e.target.value)}
              className="h-9 px-3 rounded-md text-sm"
              style={{
                background: 'var(--surface-raised)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
              }}
            />
            <span style={{ color: 'var(--text-muted)' }}>→</span>
            <input
              type="date"
              value={dateFin}
              onChange={(e) => setDateFin(e.target.value)}
              className="h-9 px-3 rounded-md text-sm"
              style={{
                background: 'var(--surface-raised)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
              }}
            />
          </div>
        )}
      </div>

      {periode === 'custom' && !canFetch && (
        <div
          className="rounded-lg px-4 py-3 text-sm"
          style={{
            background: 'color-mix(in srgb, var(--color-warning) 10%, transparent)',
            border: '1px solid color-mix(in srgb, var(--color-warning) 25%, transparent)',
            color: 'var(--color-warning)',
          }}
        >
          Sélectionnez une date de début et une date de fin pour afficher le rapport.
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
        {loading && !data
          ? Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl p-5 skeleton"
                style={{ height: 140, background: 'var(--surface-raised)' }}
              />
            ))
          : kpiCards.map((kpi) => (
              <KpiCard
                key={kpi.label}
                label={kpi.label}
                value={kpi.value}
                icon={kpi.icon}
                color={kpi.color}
                delay={kpi.delay}
                trend={kpi.trend}
              />
            ))}
      </div>

      {/* Graphique paiements par jour */}
      <Card title="Scolarités perçues par jour" icon={BarChart3}>
        {loading && !data ? (
          <div className="flex items-center justify-center" style={{ height: 280 }}>
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent" />
          </div>
        ) : chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={formatDateChart}
                tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                axisLine={{ stroke: 'var(--border-subtle)' }}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tickFormatter={formatMontantAbrege}
                tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                axisLine={false}
                tickLine={false}
                width={48}
              />
              <Tooltip content={<CustomTooltip formatPrice={formatPrice} />} />
              <Line
                type="monotone"
                dataKey="montant"
                stroke="var(--color-primary)"
                strokeWidth={2.5}
                dot={{ r: 3, fill: 'var(--color-primary)', strokeWidth: 0 }}
                activeDot={{ r: 5, fill: 'var(--color-primary)', stroke: '#fff', strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div
            className="flex items-center justify-center text-sm"
            style={{ height: 280, color: 'var(--text-muted)' }}
          >
            Aucun paiement sur cette période
          </div>
        )}
      </Card>

      {/* Top classes par recettes */}
      <Card title="Top classes par scolarités perçues" subtitle="Classées par montant encaissé">
        <DataTable
          columns={topColumns}
          data={topData}
          loading={loading && !data}
          emptyMessage="Aucun paiement sur cette période"
        />
      </Card>

      {/* Répartition paiements */}
      <div>
        <h2
          className="text-base font-semibold mb-4"
          style={{ color: 'var(--text-primary)' }}
        >
          Répartition des paiements
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {(data?.repartition_paiement || MODES_PAIEMENT_KEYS()).map((p) => {
            const Icon = MODE_ICONS[p.mode];
            const pct = totalPaiements > 0 ? ((p.montant / totalPaiements) * 100).toFixed(1) : '0.0';
            return (
              <div
                key={p.mode}
                className="fade-up rounded-xl p-5"
                style={{
                  background: 'var(--surface-raised)',
                  border: '1px solid var(--border-subtle)',
                  boxShadow: 'var(--shadow-card)',
                }}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="h-10 w-10 rounded-lg flex items-center justify-center"
                    style={{
                      background: 'color-mix(in srgb, var(--color-primary) 12%, transparent)',
                    }}
                  >
                    <Icon className="h-5 w-5" style={{ color: 'var(--color-primary)' }} />
                  </div>
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      {MODE_LABELS[p.mode]}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {p.count} transaction{p.count !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                <p className="mono text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                  {pct} %
                </p>
                <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                  {formatPrice(p.montant)}
                </p>
                <ProgressBar value={p.montant} max={totalPaiements} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

function MODES_PAIEMENT_KEYS() {
  return ['especes', 'mobile_money', 'carte', 'credit'].map((mode) => ({
    mode,
    montant: 0,
    count: 0,
  }));
}

export default Rapports;
