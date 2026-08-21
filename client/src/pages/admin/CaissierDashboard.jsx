import { useEffect, useState, useCallback, useMemo } from 'react';
import { useAxios } from '../../hooks/useAxios';
import { useTenant } from '../../contexts/TenantContext';
import { Wallet, TrendingDown, AlertTriangle, TrendingUp, Users, ArrowUpRight, Printer } from 'lucide-react';
import { KpiCard, Card, DataTable, PageHeader, Badge, Skeleton, EmptyState, Button, SegmentedControl } from '../../components/ui';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import { useNavigate } from 'react-router-dom';
import { openPdf } from '../../utils/pdf';

const PIE_COLORS = ['var(--color-primary)', 'var(--color-success)', 'var(--color-warning)', 'var(--color-danger)', 'var(--chart-5)'];

const CaissierDashboard = () => {
  const { formatPrice } = useTenant();
  const { get } = useAxios();
  const navigate = useNavigate();
  const [kpis, setKpis] = useState(null);
  const [evolution, setEvolution] = useState([]);
  const [retards, setRetards] = useState([]);
  const [derniersPaiements, setDerniersPaiements] = useState([]);
  const [depensesStats, setDepensesStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
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

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    const yearQs = resolvedAnneeId ? `anneeScolaireId=${resolvedAnneeId}` : '';
    const yearParam = resolvedAnneeId ? `?${yearQs}` : '';
    const yearAmp = resolvedAnneeId ? `&${yearQs}` : '';
    try {
      const [kpiRes, evoRes, retardRes, paiementsRes, depRes] = await Promise.allSettled([
        get(`/api/dashboard/kpis${yearParam}`),
        get(`/api/dashboard/evolution?periode=30${yearAmp}`, { silent: true }),
        get(`/api/paiements/echeances-retard${yearParam}`, { silent: true }),
        get(`/api/paiements?limit=5${yearAmp}`, { silent: true }),
        get('/api/depenses/stats', { silent: true }),
      ]);

      if (kpiRes.status === 'fulfilled') setKpis(kpiRes.value);
      else setError('Impossible de charger les indicateurs');

      if (evoRes.status === 'fulfilled') {
        const rows = Array.isArray(evoRes.value) ? evoRes.value : (evoRes.value?.data || []);
        setEvolution(rows.map((d) => ({
          mois: d.date
            ? new Date(d.date + 'T12:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
            : (d.mois || ''),
          recettes: Number(d.montant) || 0,
        })));
      }

      if (retardRes.status === 'fulfilled') setRetards(retardRes.value?.data || retardRes.value || []);
      if (paiementsRes.status === 'fulfilled') setDerniersPaiements(paiementsRes.value?.data || paiementsRes.value || []);
      if (depRes.status === 'fulfilled') setDepensesStats(depRes.value);
    } catch (err) {
      setError('Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [get, resolvedAnneeId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  if (loading) {
    return (
      <div className="space-y-8">
        <Skeleton height={28} width={260} />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl p-5" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
              <div className="space-y-3">
                <Skeleton height={12} width={96} />
                <Skeleton height={32} width={140} />
                <Skeleton height={12} width={80} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !kpis) {
    return (
      <div className="space-y-6">
        <PageHeader title="Tableau de bord" subtitle="Gestion financière de l'établissement" />
        <EmptyState icon={AlertTriangle} title="Impossible de charger" description={error || 'Erreur inconnue'}
          action={<Button size="sm" onClick={fetchAll}>Réessayer</Button>} />
      </div>
    );
  }

  const totalDepensesMois = depensesStats?.totalMois || 0;
  const recettesMois = Number(kpis.recettesMois ?? kpis.paiements?.month?.montant ?? 0);
  const beneficeMois = recettesMois - totalDepensesMois;

  const stats = [
    {
      label: 'Recettes du mois', value: formatPrice(recettesMois),
      subtitle: `Objectif: ${formatPrice(kpis.objectifMois || 0)}`, icon: Wallet, color: 'primary', delay: 0,
    },
    {
      label: 'Dépenses du mois', value: formatPrice(totalDepensesMois),
      subtitle: 'Toutes catégories', icon: TrendingDown, color: 'red', delay: 100,
    },
    {
      label: 'Bénéfice net', value: formatPrice(beneficeMois),
      subtitle: beneficeMois >= 0 ? 'Bilan positif ✓' : 'Déficit !', icon: TrendingUp,
      color: beneficeMois >= 0 ? 'green' : 'red', delay: 200,
    },
    {
      label: 'Taux d\'impayés', value: `${kpis.tauxImpayes ?? 0}%`,
      subtitle: `${retards.length} échéance(s) en retard`, icon: AlertTriangle, color: 'red', delay: 300,
    },
  ];

  // Pie chart: répartition dépenses par catégorie
  const depensePieData = (depensesStats?.parCategorie || []).slice(0, 5);

  // Evolution chart with dépenses overlay
  const chartData = evolution.map((e) => ({ ...e, depenses: 0 }));

  return (
    <div className="space-y-8">
      <PageHeader
        title="Tableau de bord Gestionnaire"
        subtitle="Vue financière complète de l'établissement"
        actions={
          isArchiveView ? (
            <Badge variant="neutral">Lecture seule</Badge>
          ) : (
            <Button icon={Users} onClick={() => navigate('/caissier/eleves')}>
              Élèves & Finances
            </Button>
          )
        }
      />

      {yearOptions.length > 1 && (
        <div className="flex flex-wrap items-center gap-3">
          <SegmentedControl value={yearScope} onChange={setYearScope} options={yearOptions} />
          {isArchiveView && <Badge variant="neutral">Consultation archive</Badge>}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {stats.map((stat, i) => <KpiCard key={i} {...stat} />)}
      </div>

      {/* Graphiques */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Évolution recettes */}
        {evolution.length > 0 && (
          <Card title="Évolution des recettes — 30 derniers jours" className="lg:col-span-2">
            <div style={{ height: 240 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                  <XAxis dataKey="mois" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} width={60} />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      return (
                        <div className="rounded-lg px-3 py-2 text-xs shadow-lg" style={{ background: 'var(--surface-raised)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}>
                          <p className="font-medium mb-1">{label}</p>
                          {payload.map((p) => (
                            <p key={p.dataKey} style={{ color: p.fill }}>{p.name}: {formatPrice(p.value)}</p>
                          ))}
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="recettes" name="Recettes" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}

        {/* Dépenses par catégorie */}
        {depensePieData.length > 0 && (
          <Card title="Dépenses par catégorie (ce mois)">
            <div style={{ height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={depensePieData} dataKey="montant" nameKey="categorie" cx="50%" cy="50%" outerRadius={75}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {depensePieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(val) => formatPrice(val)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}
      </div>

      {/* Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Derniers paiements */}
        <Card
          title="5 derniers paiements"
          actions={
            <button onClick={() => navigate('/caissier/historique')}
              className="text-xs flex items-center gap-1"
              style={{ color: 'var(--color-primary)' }}>
              Voir tout <ArrowUpRight className="h-3 w-3" />
            </button>
          }
        >
          <DataTable
            columns={[
              { key: 'eleve', label: 'Élève', render: (_, row) => (
                <div>
                  <p className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{row.elevePrenom} {row.eleveNom}</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Reçu n°{row.numeroRecu}</p>
                </div>
              )},
              { key: 'montant', label: 'Montant', render: (val) => (
                <span className="font-semibold" style={{ color: 'var(--color-success)' }}>{formatPrice(val)}</span>
              )},
              { key: 'modePaiement', label: 'Mode', render: (val) => <Badge variant="info">{val === 'especes' ? 'Espèces' : val}</Badge> },
              { key: 'recu', label: '', render: (_, row) => (
                <button
                  type="button"
                  className="p-1 rounded-md hover:bg-[var(--surface-hover)]"
                  title="Imprimer le reçu"
                  onClick={() => openPdf(`/api/paiements/${row.id}/recu-pdf`, `recu-${row.numeroRecu}.pdf`)}
                >
                  <Printer className="h-3.5 w-3.5" style={{ color: 'var(--text-muted)' }} />
                </button>
              )},
            ]}
            data={derniersPaiements.slice(0, 5)}
            emptyMessage="Aucun paiement récent"
            emptyDescription="Les encaissements récents s'afficheront ici."
            mobileCards={false}
          />
        </Card>

        {/* Échéances en retard */}
        <Card
          title="Échéances en retard"
          actions={
            retards.length > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: 'color-mix(in srgb, var(--color-danger) 15%, transparent)', color: 'var(--color-danger)' }}>
                {retards.length}
              </span>
            )
          }
        >
          <DataTable
            columns={[
              { key: 'eleve', label: 'Élève', render: (_, row) => (
                <div>
                  <p className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{row.elevePrenom} {row.eleveNom}</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{row.libelle} · {new Date(row.dateEcheance).toLocaleDateString('fr-FR')}</p>
                </div>
              )},
              { key: 'reste', label: 'Reste dû', render: (val) => (
                <span className="font-semibold" style={{ color: 'var(--color-danger)' }}>{formatPrice(val)}</span>
              )},
              { key: 'action', label: '', render: (_, row) => (
                !isArchiveView ? (
                  <button className="text-xs px-2 py-1 rounded-md" style={{ background: 'var(--surface-overlay)', color: 'var(--color-primary)', border: '1px solid var(--border-subtle)' }}
                    onClick={() => navigate(`/caissier/eleves?search=${row.eleveNom}`)}>
                    Régler
                  </button>
                ) : null
              )},
            ]}
            data={retards.slice(0, 5)}
            emptyMessage="Aucun impayé"
            emptyDescription="Toutes les échéances sont à jour ✓"
            mobileCards={false}
          />
        </Card>
      </div>
    </div>
  );
};

export default CaissierDashboard;
