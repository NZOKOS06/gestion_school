import { useEffect, useState, useCallback } from 'react';
import { useAxios } from '../../hooks/useAxios';
import { useTenant } from '../../contexts/TenantContext';
import { PageHeader, Card, DataTable, Badge, Button } from '../../components/ui';
import { Wallet, FileDown, AlertCircle, CheckCircle, Smartphone } from 'lucide-react';
import toast from 'react-hot-toast';

const FacturationParent = () => {
  const { get, post } = useAxios();
  const { formatPrice } = useTenant();
  const [echeances, setEcheances] = useState([]);
  const [paiements, setPaiements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [payingId, setPayingId] = useState(null);
  const [selectedEnfant, setSelectedEnfant] = useState('');
  const [enfants, setEnfants] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const res = await get('/api/parent/mes-enfants', { silent: true });
        const data = res?.data || res || [];
        setEnfants(data);
        if (data.length > 0) setSelectedEnfant(data[0].id);
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
        get(`/api/parent/enfants/${selectedEnfant}/echeances`, { silent: true }),
        get(`/api/parent/enfants/${selectedEnfant}/paiements`, { silent: true }),
      ]);
      setEcheances(ech?.data || ech || []);
      setPaiements(paie?.data || paie || []);
    } catch {
      toast.error('Impossible de charger la facturation');
    }
    setLoading(false);
  }, [selectedEnfant, get]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const payerMomo = async (echeance) => {
    const reste = Math.max(0, Number(echeance.montantAttendu) - Number(echeance.montantPaye));
    if (reste <= 0 || !selectedEnfant) return;
    setPayingId(echeance.id);
    try {
      const intent = await post(`/api/parent/enfants/${selectedEnfant}/paiements/init`, {
        echeanceId: echeance.id,
        montant: reste,
      });
      const ref = intent?.reference || intent?.paymentId;
      if (!ref) {
        toast.error('Initiation Mobile Money échouée');
        setPayingId(null);
        return;
      }
      await post(`/api/parent/paiements/${ref}/confirm`, {});
      toast.success('Paiement Mobile Money confirmé');
      await fetchData();
    } catch { /* toast via useAxios */ }
    setPayingId(null);
  };

  const selectStyle = {
    height: 38,
    background: 'var(--surface-overlay)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)',
    fontSize: 14,
    padding: '0 12px',
  };

  const totalDu = echeances.reduce((sum, e) => sum + Math.max(0, Number(e.montantAttendu) - Number(e.montantPaye)), 0);
  const totalPaye = paiements.reduce((sum, p) => sum + Number(p.montant), 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Facturation" subtitle="Échéances et historique des paiements" />

      <div className="flex items-center gap-3">
        <select style={selectStyle} value={selectedEnfant} onChange={(e) => setSelectedEnfant(e.target.value)}>
          {enfants.map((e) => <option key={e.id} value={e.id}>{e.prenom} {e.nom}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg flex items-center justify-center" style={{ background: 'color-mix(in srgb, var(--color-danger) 12%, transparent)' }}>
              <AlertCircle className="h-5 w-5" style={{ color: 'var(--color-danger)' }} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Reste à payer</p>
              <p className="text-xl font-bold" style={{ color: 'var(--color-danger)' }}>{formatPrice(totalDu)}</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg flex items-center justify-center" style={{ background: 'color-mix(in srgb, var(--color-success) 12%, transparent)' }}>
              <CheckCircle className="h-5 w-5" style={{ color: 'var(--color-success)' }} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Total payé</p>
              <p className="text-xl font-bold" style={{ color: 'var(--color-success)' }}>{formatPrice(totalPaye)}</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg flex items-center justify-center" style={{ background: 'color-mix(in srgb, var(--color-primary) 12%, transparent)' }}>
              <Wallet className="h-5 w-5" style={{ color: 'var(--color-primary)' }} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Total facturé</p>
              <p className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{formatPrice(totalDu + totalPaye)}</p>
            </div>
          </div>
        </Card>
      </div>

      <Card title="Échéances">
        <DataTable
          columns={[
            { key: 'libelle', label: 'Libellé', render: (v) => <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{v}</span> },
            { key: 'dateEcheance', label: 'Date', render: (v) => <span style={{ color: 'var(--text-secondary)' }}>{new Date(v).toLocaleDateString('fr-FR')}</span> },
            { key: 'montantAttendu', label: 'Montant', render: (v) => <span style={{ color: 'var(--text-primary)' }}>{formatPrice(v)}</span> },
            { key: 'montantPaye', label: 'Payé', render: (v) => <span style={{ color: 'var(--color-success)' }}>{formatPrice(v)}</span> },
            {
              key: 'statut',
              label: 'Statut',
              render: (_, row) => {
                const restant = Number(row.montantAttendu) - Number(row.montantPaye);
                if (restant <= 0) return <Badge variant="success" dot>Payé</Badge>;
                const overdue = new Date(row.dateEcheance) < new Date();
                return <Badge variant={overdue ? 'danger' : 'warning'}>{overdue ? 'En retard' : 'À venir'}</Badge>;
              },
            },
            {
              key: 'actions',
              label: 'Payer',
              render: (_, row) => {
                const restant = Number(row.montantAttendu) - Number(row.montantPaye);
                if (restant <= 0) return <span style={{ color: 'var(--text-muted)' }}>—</span>;
                return (
                  <Button
                    icon={Smartphone}
                    size="sm"
                    loading={payingId === row.id}
                    onClick={() => payerMomo(row)}
                    title="Payer via Mobile Money (démo)"
                  >
                    MoMo
                  </Button>
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
            { key: 'numeroRecu', label: 'Reçu', render: (v) => <span className="font-mono text-xs font-semibold" style={{ color: 'var(--color-primary)' }}>#{v}</span> },
            { key: 'datePaiement', label: 'Date', render: (v) => <span style={{ color: 'var(--text-secondary)' }}>{new Date(v).toLocaleDateString('fr-FR')}</span> },
            { key: 'montant', label: 'Montant', render: (v) => <span className="font-semibold" style={{ color: 'var(--color-success)' }}>{formatPrice(v)}</span> },
            { key: 'modePaiement', label: 'Mode', render: (v) => <Badge variant="info">{v}</Badge> },
            {
              key: 'actions',
              label: 'Reçu',
              render: (_, row) => row.pdfUrl ? (
                <a href={row.pdfUrl} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-md hover:bg-[var(--surface-hover)] inline-flex">
                  <FileDown className="h-4 w-4" style={{ color: 'var(--text-secondary)' }} />
                </a>
              ) : <span style={{ color: 'var(--text-muted)' }}>—</span>,
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
