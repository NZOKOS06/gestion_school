import { useEffect, useState, useCallback } from 'react';
import { useAxios } from '../../hooks/useAxios';
import { useTenant } from '../../contexts/TenantContext';
import { PageHeader, Card, DataTable, Badge } from '../../components/ui';
import { FileText, FileDown, Eye } from 'lucide-react';

const BulletinsParent = () => {
  const { get } = useAxios();
  const { formatPrice } = useTenant();
  const [bulletins, setBulletins] = useState([]);
  const [blocage, setBlocage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedEnfant, setSelectedEnfant] = useState('');
  const [enfants, setEnfants] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const res = await get('/api/parent/mes-enfants', { silent: true });
        const data = res?.data || res || [];
        setEnfants(data);
        if (data.length > 0) setSelectedEnfant(data[0].id);
      } catch { /* silent */ }
    })();
  }, []);

  const fetchBulletins = useCallback(async () => {
    if (!selectedEnfant) return;
    setLoading(true);
    try {
      const res = await get(`/api/parent/enfants/${selectedEnfant}/bulletins`);
      // Bulletins masqués tant que la scolarité du mois écoulé n'est pas réglée
      setBlocage(res?.bloque ? { message: res.message, montantDu: res.montantDu } : null);
      setBulletins(Array.isArray(res) ? res : (res?.bulletins || []));
    } catch { /* silent */ }
    setLoading(false);
  }, [selectedEnfant]);

  useEffect(() => { fetchBulletins(); }, [fetchBulletins]);

  const selectStyle = {
    height: 38,
    background: 'var(--surface-overlay)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)',
    fontSize: 14,
    padding: '0 12px',
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Bulletins" subtitle="Bulletins de vos enfants" />

      <div className="flex items-center gap-3">
        <select style={selectStyle} value={selectedEnfant} onChange={(e) => setSelectedEnfant(e.target.value)}>
          {enfants.map((e) => <option key={e.id} value={e.id}>{e.prenom} {e.nom}</option>)}
        </select>
      </div>

      {blocage && (
        <div className="rounded-xl p-4 text-sm" style={{ background: 'color-mix(in srgb, var(--color-warning) 12%, transparent)', color: 'var(--text-primary)' }}>
          <p className="font-medium">{blocage.message}</p>
          <p className="mt-1" style={{ color: 'var(--text-secondary)' }}>
            Montant à régulariser : <strong>{formatPrice(blocage.montantDu)}</strong> —{' '}
            <a href="/parent/facturation" style={{ color: 'var(--color-primary)' }}>voir la facturation</a>
          </p>
        </div>
      )}

      {!blocage && (
      <DataTable
        columns={[
          { key: 'anneeScolaireLibelle', label: 'Année', render: (v) => <span style={{ color: 'var(--text-primary)' }}>{v}</span> },
          { key: 'periodeIndex', label: 'Période', render: (v) => <Badge variant="info">Période {v}</Badge> },
          { key: 'moyenneGenerale', label: 'Moyenne', render: (v) => <span className="font-mono font-semibold" style={{ color: 'var(--color-primary)' }}>{Number(v).toFixed(2)}</span> },
          { key: 'rang', label: 'Rang', render: (v) => <span style={{ color: 'var(--text-secondary)' }}>{v ? `${v}e` : '—'}</span> },
          { key: 'mention', label: 'Mention', render: (v) => <Badge variant={v === 'felicitations' || v === 'tableau_honneur' ? 'success' : v === 'encouragements' ? 'info' : v ? 'warning' : 'neutral'}>{v || '—'}</Badge> },
          {
            key: 'actions',
            label: 'PDF',
            render: (_, row) => row.pdfUrl ? (
              <a href={row.pdfUrl} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-md hover:bg-[var(--surface-hover)] inline-flex">
                <FileDown className="h-4 w-4" style={{ color: 'var(--text-secondary)' }} />
              </a>
            ) : <span style={{ color: 'var(--text-muted)' }}>—</span>,
          },
        ]}
        data={bulletins}
        loading={loading}
        emptyMessage="Aucun bulletin disponible"
      />
      )}
    </div>
  );
};

export default BulletinsParent;
