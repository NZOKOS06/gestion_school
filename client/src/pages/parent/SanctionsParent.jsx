import { useEffect, useState, useCallback } from 'react';
import { useAxios } from '../../hooks/useAxios';
import { PageHeader, DataTable, Badge } from '../../components/ui';

const TYPE_LABEL = {
  avertissement: 'Avertissement',
  blame: 'Blâme',
  retenue: 'Retenue',
  exclusion_temporaire: 'Exclusion temp.',
  exclusion_definitive: 'Exclusion définitive',
};

const TYPE_VARIANT = {
  avertissement: 'warning',
  blame: 'warning',
  retenue: 'info',
  exclusion_temporaire: 'danger',
  exclusion_definitive: 'danger',
};

const SanctionsParent = () => {
  const { get } = useAxios();
  const [sanctions, setSanctions] = useState([]);
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

  const fetchSanctions = useCallback(async () => {
    if (!selectedEnfant) return;
    setLoading(true);
    try {
      const res = await get(`/api/parent/enfants/${selectedEnfant}/sanctions`);
      setSanctions(res?.data || res || []);
    } catch { /* silent */ }
    setLoading(false);
  }, [selectedEnfant]);

  useEffect(() => { fetchSanctions(); }, [fetchSanctions]);

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
      <PageHeader title="Sanctions" subtitle="Suivi disciplinaire de vos enfants" />

      <div className="flex items-center gap-3">
        <select style={selectStyle} value={selectedEnfant} onChange={(e) => setSelectedEnfant(e.target.value)}>
          {enfants.map((e) => <option key={e.id} value={e.id}>{e.prenom} {e.nom}</option>)}
        </select>
      </div>

      <DataTable
        columns={[
          { key: 'dateSanction', label: 'Date', render: (v) => <span style={{ color: 'var(--text-primary)' }}>{new Date(v).toLocaleDateString('fr-FR')}</span> },
          { key: 'type', label: 'Type', render: (v) => <Badge variant={TYPE_VARIANT[v] || 'neutral'}>{TYPE_LABEL[v] || v}</Badge> },
          { key: 'motif', label: 'Motif', render: (v) => <span style={{ color: 'var(--text-secondary)' }}>{v}</span> },
          { key: 'dureeJours', label: 'Durée', render: (v) => v ? <span style={{ color: 'var(--text-secondary)' }}>{v} jour(s)</span> : <span style={{ color: 'var(--text-muted)' }}>—</span> },
        ]}
        data={sanctions}
        loading={loading}
        emptyMessage="Aucune sanction"
      />
    </div>
  );
};

export default SanctionsParent;
