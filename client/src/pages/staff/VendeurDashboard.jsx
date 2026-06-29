import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAxios } from '../../hooks/useAxios';
import { useTenant } from '../../contexts/TenantContext';
import { useAuth } from '../../contexts/AuthContext';
import { Badge, Button, DataTable, KpiCard, PageHeader } from '../../components/ui';
import { AlertTriangle, FileText, Package, Plus, ShoppingCart, TrendingUp } from 'lucide-react';

const VendeurDashboard = () => {
  const { get, loading } = useAxios();
  const { formatPrice } = useTenant();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [kpis, setKpis] = useState(null);
  const [alertes, setAlertes] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const [kpisRes, alertesRes] = await Promise.all([
        get('/api/dashboard/kpis', { silent: true }),
        get('/api/stock/alertes', { silent: true }),
      ]);
      setKpis(kpisRes);
      setAlertes(alertesRes);
    } catch {
      // silent
    }
  }, [get]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const canViewStock = ['pharmacien', 'admin'].includes(user?.role);
  const dernierVentes = kpis?.dernieres_ventes ?? [];
  const ruptures = alertes?.ruptures ?? [];
  const peremptions = alertes?.peremptions_proches ?? [];
  const nbAlertes = ruptures.length + peremptions.length;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Tableau de bord"
        subtitle="Vue d’ensemble de votre activité"
        actions={
          <div className="flex items-center gap-2">
            <Button icon={FileText} variant="secondary" size="sm" onClick={() => navigate('/staff/ordonnance')}>
              Scanner ordonnance
            </Button>
            <Button icon={Plus} variant="primary" size="sm" onClick={() => navigate('/staff/vente')}>
              Nouvelle vente
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <KpiCard
          label="Ventes aujourd'hui"
          value={loading && !kpis ? '…' : (kpis?.mes_ventes_jour ?? 0)}
          icon={ShoppingCart}
          color="primary"
        />
        <KpiCard
          label="CA personnel du jour"
          value={loading && !kpis ? '…' : formatPrice(kpis?.ca_personnel ?? 0)}
          icon={TrendingUp}
          color="green"
        />
        <KpiCard
          label="Alertes stock"
          value={loading && !kpis ? '…' : (kpis?.alertes_stock ?? 0)}
          icon={AlertTriangle}
          color="orange"
        />
      </div>

      {nbAlertes > 0 && (
        <div
          className="rounded-xl p-4"
          style={{
            background: 'color-mix(in srgb, var(--color-warning) 8%, transparent)',
            border: '1px solid color-mix(in srgb, var(--color-warning) 25%, transparent)',
          }}
        >
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 animate-pulse" style={{ color: 'var(--color-warning)' }} />
              <p className="text-sm font-semibold" style={{ color: 'var(--color-warning)' }}>
                {nbAlertes} alerte{nbAlertes > 1 ? 's' : ''} stock
              </p>
            </div>
            {canViewStock && (
              <Button size="sm" variant="ghost" icon={Package} onClick={() => navigate('/admin/stock')}>
                Voir tout le stock
              </Button>
            )}
          </div>
          <div className="space-y-1.5">
            {ruptures.slice(0, 3).map((r) => (
              <div key={r.id} className="flex items-center justify-between text-sm">
                <span style={{ color: 'var(--text-primary)' }}>
                  {r.dci}{r.nomCommercial ? ` — ${r.nomCommercial}` : ''}
                </span>
                <Badge variant="danger">Rupture ({r.stockTotal ?? 0})</Badge>
              </div>
            ))}
            {peremptions.slice(0, 3).map((p) => (
              <div key={p.id} className="flex items-center justify-between text-sm">
                <span style={{ color: 'var(--text-primary)' }}>
                  {p.dci}{p.nomCommercial ? ` — ${p.nomCommercial}` : ''}
                </span>
                <Badge variant="warning">Expire bientôt</Badge>
              </div>
            ))}
            {nbAlertes > 6 && (
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                + {nbAlertes - 6} autre{nbAlertes - 6 > 1 ? 's' : ''}…
              </p>
            )}
          </div>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
            Mes dernières ventes
          </h2>
          <Button size="sm" variant="ghost" onClick={() => navigate('/staff/mes-ventes')}>
            Voir tout →
          </Button>
        </div>
        <DataTable
          loading={loading && !kpis}
          columns={[
            {
              key: 'numeroVente',
              label: 'N° vente',
              render: (val) => (
                <span className="mono text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                  {val || '—'}
                </span>
              ),
            },
            {
              key: 'createdAt',
              label: 'Heure',
              render: (val) => (
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {val ? new Date(val).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—'}
                </span>
              ),
            },
            {
              key: 'montantTotal',
              label: 'Montant',
              render: (val) => (
                <span className="mono font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {formatPrice(val)}
                </span>
              ),
            },
            {
              key: 'statut',
              label: 'Statut',
              render: (val) => {
                const variants = { finalisee: 'success', annulee: 'danger', en_cours: 'warning' };
                const labels = { finalisee: 'Finalisée', annulee: 'Annulée', en_cours: 'En cours' };
                return <Badge variant={variants[val] ?? 'neutral'}>{labels[val] ?? val}</Badge>;
              },
            },
          ]}
          data={dernierVentes}
          emptyMessage="Aucune vente aujourd'hui"
        />
      </div>
    </div>
  );
};

export default VendeurDashboard;

