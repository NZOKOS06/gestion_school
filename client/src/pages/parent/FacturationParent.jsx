import { useEffect, useState, useCallback } from 'react';
import { useAxios } from '../../hooks/useAxios';
import { useTenant } from '../../contexts/TenantContext';
import {
  PageHeader,
  Card,
  DataTable,
  Badge,
  KpiCard,
  KpiGrid,
} from '../../components/ui';
import { Wallet, FileDown, AlertCircle, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { openPdf } from '../../utils/pdf';

const FacturationParent = () => {
  const { get } = useAxios();
  const { formatPrice } = useTenant();

  const [echeances, setEcheances] = useState([]);
  const [paiements, setPaiements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEnfant, setSelectedEnfant] = useState('');
  const [enfants, setEnfants] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const res = await get('/api/parent/mes-enfants', { silent: true });
        const data = res?.data || res || [];

        setEnfants(data);

        if (data.length > 0) {
          setSelectedEnfant(data[0].id);
        }
      } catch {
        toast.error('Impossible de charger les enfants');
      }
    })();
  }, []);

  const fetchData = useCallback(async () => {
    if (!selectedEnfant) return;

    setLoading(true);

    try {
      const [ech, paie] = await Promise.all([
        get(`/api/parent/enfants/${selectedEnfant}/echeances`, {
          silent: true,
        }),
        get(`/api/parent/enfants/${selectedEnfant}/paiements`, {
          silent: true,
        }),
      ]);

      setEcheances(ech?.data || ech || []);
      setPaiements(paie?.data || paie || []);
    } catch {
      toast.error('Impossible de charger la facturation');
    } finally {
      setLoading(false);
    }
  }, [selectedEnfant, get]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const selectStyle = {
    height: 38,
    background: 'var(--surface-overlay)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)',
    fontSize: 14,
    padding: '0 12px',
  };

  const totalDu = echeances.reduce(
    (sum, e) =>
      sum +
      Math.max(
        0,
        Number(e.montantAttendu) - Number(e.montantPaye)
      ),
    0
  );

  const totalPaye = paiements.reduce(
    (sum, p) => sum + Number(p.montant),
    0
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Facturation"
        subtitle="Échéances et historique des paiements"
      />

      <div className="flex items-center gap-3">
        <select
          style={selectStyle}
          value={selectedEnfant}
          onChange={(e) => setSelectedEnfant(e.target.value)}
        >
          {enfants.map((e) => (
            <option key={e.id} value={e.id}>
              {e.prenom} {e.nom}
            </option>
          ))}
        </select>
      </div>

      <KpiGrid cols={3}>
        <KpiCard
          label="Reste à payer"
          value={formatPrice(totalDu)}
          icon={AlertCircle}
          color="red"
        />

        <KpiCard
          label="Total payé"
          value={formatPrice(totalPaye)}
          icon={CheckCircle}
          color="green"
        />

        <KpiCard
          label="Total facturé"
          value={formatPrice(totalDu + totalPaye)}
          icon={Wallet}
          color="primary"
        />
      </KpiGrid>

      <Card title="Échéances">
        <DataTable
          columns={[
            {
              key: 'libelle',
              label: 'Libellé',
              render: (v) => (
                <span
                  className="font-medium"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {v}
                </span>
              ),
            },
            {
              key: 'dateEcheance',
              label: 'Date',
              render: (v) => (
                <span style={{ color: 'var(--text-secondary)' }}>
                  {new Date(v).toLocaleDateString('fr-FR')}
                </span>
              ),
            },
            {
              key: 'montantAttendu',
              label: 'Montant',
              render: (v) => (
                <span style={{ color: 'var(--text-primary)' }}>
                  {formatPrice(v)}
                </span>
              ),
            },
            {
              key: 'montantPaye',
              label: 'Payé',
              render: (v) => (
                <span style={{ color: 'var(--color-success)' }}>
                  {formatPrice(v)}
                </span>
              ),
            },
            {
              key: 'statut',
              label: 'Statut',
              render: (_, row) => {
                const restant =
                  Number(row.montantAttendu) -
                  Number(row.montantPaye);

                if (restant <= 0) {
                  return (
                    <Badge variant="success" dot>
                      Payé
                    </Badge>
                  );
                }

                const overdue =
                  new Date(row.dateEcheance) < new Date();

                return (
                  <Badge variant={overdue ? 'danger' : 'warning'}>
                    {overdue ? 'En retard' : 'À venir'}
                  </Badge>
                );
              },
            },
          ]}
          data={echeances}
          loading={loading}
          emptyMessage="Aucune échéance"
        />
      </Card>

      <Card title="Historique des paiements">
        <DataTable
          columns={[
            {
              key: 'numeroRecu',
              label: 'Reçu',
              render: (v) => (
                <span
                  className="font-mono text-xs font-semibold"
                  style={{ color: 'var(--color-primary)' }}
                >
                  #{v}
                </span>
              ),
            },
            {
              key: 'datePaiement',
              label: 'Date',
              render: (v) => (
                <span style={{ color: 'var(--text-secondary)' }}>
                  {new Date(v).toLocaleDateString('fr-FR')}
                </span>
              ),
            },
            {
              key: 'montant',
              label: 'Montant',
              render: (v) => (
                <span
                  className="font-semibold"
                  style={{ color: 'var(--color-success)' }}
                >
                  {formatPrice(v)}
                </span>
              ),
            },
            {
              key: 'modePaiement',
              label: 'Mode',
              render: (v) => (
                <Badge variant="info">{v}</Badge>
              ),
            },
            {
              key: 'actions',
              label: 'Reçu',
              render: (_, row) => (
                <button
                  type="button"
                  onClick={() =>
                    openPdf(
                      `/api/paiements/${row.id}/recu-pdf`,
                      `recu-${row.numeroRecu}.pdf`
                    )
                  }
                  className="p-1.5 rounded-md hover:bg-[var(--surface-hover)] inline-flex"
                  title="Télécharger le reçu"
                >
                  <FileDown
                    className="h-4 w-4"
                    style={{ color: 'var(--text-secondary)' }}
                  />
                </button>
              ),
            },
          ]}
          data={paiements}
          loading={loading}
          emptyMessage="Aucun paiement"
        />
      </Card>
    </div>
  );
};

export default FacturationParent;

