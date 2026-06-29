import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAxios } from '../../hooks/useAxios';
import { useTenant } from '../../contexts/TenantContext';
import { Badge, Button, DataTable, KpiCard, Modal, PageHeader } from '../../components/ui';
import { CheckCircle2, CreditCard, DollarSign, Clock, Eye, RefreshCw } from 'lucide-react';

const CaisseHome = () => {
  const { get, loading } = useAxios();
  const { formatPrice } = useTenant();
  const navigate = useNavigate();

  const [caisse, setCaisse] = useState(null);
  const [ventes, setVentes] = useState([]);
  const [selectedVente, setSelectedVente] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const fetchData = useCallback(async () => {
    try {
      const [caisseRes, ventesRes] = await Promise.all([
        get('/api/dashboard/caisse', { silent: true }),
        get('/api/ventes?statut=en_cours&limit=50', { silent: true }),
      ]);
      setCaisse(caisseRes);
      setVentes(ventesRes?.data ?? ventesRes?.ventes ?? []);
      setLastRefresh(new Date());
    } catch {
      // silent
    }
  }, [get]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const nbAttente = caisse?.ventes?.enAttente?.count ?? ventes.length;
  const totalAttente = caisse?.ventes?.enAttente?.total ?? 0;
  const nbFinalisees = caisse?.ventes?.finalisees?.count ?? 0;
  const caJour = caisse?.ventes?.finalisees?.total ?? 0;

  const lignes = selectedVente?.lignesVente ?? selectedVente?.lignes ?? [];
  const sousTotalLignes = lignes.reduce(
    (s, l) => s + parseFloat(l.sousTotal ?? parseFloat(l.prixUnitaire) * l.quantite ?? 0),
    0
  );

  const columns = [
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
      key: 'nomClient',
      label: 'Client',
      render: (val, row) => (
        <span style={{ color: 'var(--text-primary)' }}>
          {val || (row.user ? `${row.user.prenom} ${row.user.nom}` : 'Client comptoir')}
        </span>
      ),
    },
    {
      key: 'lignesVente',
      label: 'Articles',
      render: (val, row) => {
        const count = val?.length ?? row.lignes?.length ?? 0;
        return (
          <span className="mono text-xs" style={{ color: 'var(--text-muted)' }}>
            {count} article{count !== 1 ? 's' : ''}
          </span>
        );
      },
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
      render: () => <Badge variant="warning" dot>En cours</Badge>,
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, row) => (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            icon={Eye}
            onClick={(e) => { e.stopPropagation(); setSelectedVente(row); }}
          >
            Détail
          </Button>
          <Button
            data-testid="btn-encaisser"
            size="sm"
            variant="primary"
            icon={CheckCircle2}
            onClick={(e) => { e.stopPropagation(); navigate(`/caissier/encaisser/${row.id}`); }}
          >
            Encaisser
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Caisse"
        subtitle={`Actualisé à ${lastRefresh.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`}
        actions={
          <Button variant="secondary" size="sm" icon={RefreshCw} onClick={fetchData} loading={loading}>
            Actualiser
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <KpiCard
          label="Ventes en attente"
          value={<span data-testid="nb-ventes-attente">{nbAttente}</span>}
          subtitle={nbAttente > 0 ? 'En attente d\'encaissement' : 'Aucune vente en attente'}
          icon={Clock}
          color="orange"
        />
        <KpiCard
          label="CA du jour"
          value={formatPrice(caJour)}
          subtitle={`${nbFinalisees} vente${nbFinalisees !== 1 ? 's' : ''} finalisée${nbFinalisees !== 1 ? 's' : ''}`}
          icon={DollarSign}
          color="primary"
        />
        <KpiCard
          label="Total à encaisser"
          value={formatPrice(totalAttente)}
          subtitle="Montant des ventes en cours"
          icon={CreditCard}
          color="blue"
        />
      </div>

      {nbAttente > 0 && (
        <div
          className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium"
          style={{
            background: 'color-mix(in srgb, var(--color-warning) 10%, transparent)',
            border: '1px solid color-mix(in srgb, var(--color-warning) 30%, transparent)',
            color: 'var(--color-warning)',
          }}
        >
          <span className="inline-flex h-2 w-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
          {nbAttente} vente{nbAttente > 1 ? 's' : ''} en attente d'encaissement
        </div>
      )}

      <DataTable
        columns={columns}
        data={ventes}
        loading={loading && ventes.length === 0}
        emptyMessage="Aucune vente en attente d'encaissement"
        onRowClick={setSelectedVente}
      />

      <Modal
        open={!!selectedVente}
        onClose={() => setSelectedVente(null)}
        title={`Vente ${selectedVente?.numeroVente || ''}`}
        subtitle={
          selectedVente
            ? `Client : ${selectedVente.nomClient || (selectedVente.user ? `${selectedVente.user.prenom} ${selectedVente.user.nom}` : 'Comptoir')}`
            : ''
        }
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setSelectedVente(null)}>Fermer</Button>
            <Button
              variant="primary"
              icon={CheckCircle2}
              onClick={() => { setSelectedVente(null); navigate(`/caissier/encaisser/${selectedVente?.id}`); }}
            >
              Encaisser cette vente
            </Button>
          </>
        }
      >
        {selectedVente && (
          <div className="space-y-4">
            <div className="overflow-x-auto rounded-lg" style={{ border: '1px solid var(--border-subtle)' }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--surface-overlay)' }}>
                    {['Médicament', 'Qté', 'Prix unit.', 'Sous-total'].map((h) => (
                      <th
                        key={h}
                        className="py-2.5 px-4 text-left text-[11px] font-semibold uppercase tracking-wider"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lignes.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                        Aucune ligne de vente
                      </td>
                    </tr>
                  ) : (
                    lignes.map((l, i) => (
                      <tr
                        key={i}
                        style={{ borderBottom: i < lignes.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}
                      >
                        <td className="py-3 px-4" style={{ color: 'var(--text-primary)' }}>
                          {l.medicament?.dci || l.medicament?.nomCommercial || '—'}
                        </td>
                        <td className="py-3 px-4 mono text-sm" style={{ color: 'var(--text-secondary)' }}>
                          {l.quantite}
                        </td>
                        <td className="py-3 px-4 mono text-sm" style={{ color: 'var(--text-secondary)' }}>
                          {formatPrice(l.prixUnitaire)}
                        </td>
                        <td className="py-3 px-4 mono font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                          {formatPrice(l.sousTotal ?? parseFloat(l.prixUnitaire) * l.quantite)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div
              className="rounded-lg p-4 space-y-2"
              style={{ background: 'var(--surface-overlay)', border: '1px solid var(--border-subtle)' }}
            >
              <div className="flex justify-between text-sm" style={{ color: 'var(--text-secondary)' }}>
                <span>Sous-total</span>
                <span className="mono">{formatPrice(sousTotalLignes)}</span>
              </div>
              <div
                className="flex justify-between font-bold text-base"
                style={{ color: 'var(--text-primary)', borderTop: '1px solid var(--border-default)', paddingTop: 8 }}
              >
                <span>Total</span>
                <span className="mono" style={{ color: 'var(--color-primary)' }}>
                  {formatPrice(selectedVente.montantTotal)}
                </span>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default CaisseHome;

