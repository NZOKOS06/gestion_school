import { useEffect, useState, useCallback } from 'react';
import { useAxios } from '../../hooks/useAxios';
import { PageHeader, Card, DataTable, Badge } from '../../components/ui';
import { CalendarX } from 'lucide-react';

const AbsencesParent = () => {
  const { get } = useAxios();
  const [absences, setAbsences] = useState([]);
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

  const fetchAbsences = useCallback(async () => {
    if (!selectedEnfant) return;
    setLoading(true);
    try {
      const res = await get(`/api/parent/enfants/${selectedEnfant}/absences`);
      setAbsences(res?.data || res || []);
    } catch { /* silent */ }
    setLoading(false);
  }, [selectedEnfant]);

  useEffect(() => { fetchAbsences(); }, [fetchAbsences]);

  const selectStyle = {
    height: 38,
    background: 'var(--surface-overlay)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)',
    fontSize: 14,
    padding: '0 12px',
  };

  const nonJustifiees = absences.filter((a) => !a.justifiee).length;

  return (
    <div className="space-y-6">
      <PageHeader title="Absences" subtitle="Suivi des absences de vos enfants" />

      <div className="flex items-center gap-3">
        <select style={selectStyle} value={selectedEnfant} onChange={(e) => setSelectedEnfant(e.target.value)}>
          {enfants.map((e) => <option key={e.id} value={e.id}>{e.prenom} {e.nom}</option>)}
        </select>
        {nonJustifiees > 0 && (
          <Badge variant="danger" dot>{nonJustifiees} non justifiée(s)</Badge>
        )}
      </div>

      <DataTable
        columns={[
          { key: 'dateAbsence', label: 'Date', render: (v) => <span style={{ color: 'var(--text-primary)' }}>{new Date(v).toLocaleDateString('fr-FR')}</span> },
          { key: 'cours', label: 'Cours', render: (_, row) => <span style={{ color: 'var(--text-secondary)' }}>{row.matiereNom || row.coursNom || '—'}</span> },
          { key: 'motifJustif', label: 'Motif', render: (v) => <span style={{ color: 'var(--text-secondary)' }}>{v || '—'}</span> },
          { key: 'justifiee', label: 'Statut', render: (v) => <Badge variant={v ? 'success' : 'danger'}>{v ? 'Justifiée' : 'Non justifiée'}</Badge> },
        ]}
        data={absences}
        loading={loading}
        emptyMessage="Aucune absence"
      />
    </div>
  );
};

export default AbsencesParent;
