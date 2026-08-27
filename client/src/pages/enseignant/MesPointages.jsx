import { useCallback, useEffect, useState } from 'react';
import { useAxios } from '../../hooks/useAxios';
import { PageHeader, DataTable, Badge } from '../../components/ui';
import { Clock } from 'lucide-react';

const STATUT_CONFIG = {
  prevue: { label: 'Prévue', variant: 'neutral' },
  en_cours: { label: 'En cours', variant: 'warning' },
  terminee: { label: 'Terminée', variant: 'success' },
  absente: { label: 'Absente', variant: 'danger' },
  annulee: { label: 'Annulée', variant: 'neutral' },
};

const MesPointages = () => {
  const { get } = useAxios();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ from, to });
      const res = await get(`/api/pointage/mes-sessions?${params.toString()}`);
      setSessions(res?.data || []);
    } catch { /* silent */ }
    setLoading(false);
  }, [from, to, get]);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  const fmtTime = (val) => (val ? new Date(val).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—');

  const selectStyle = {
    height: 36,
    background: 'var(--surface-overlay)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)',
    fontSize: 13,
    padding: '0 8px',
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mes pointages"
        subtitle="Historique de vos sessions de cours (lecture seule)"
        icon={Clock}
      />

      <div className="flex gap-3 flex-wrap">
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={selectStyle} />
        <span className="self-center text-[var(--text-muted)]">→</span>
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={selectStyle} />
      </div>

      <DataTable
        loading={loading}
        data={sessions}
        emptyMessage="Aucun pointage sur cette période"
        columns={[
          {
            key: 'date',
            label: 'Date',
            render: (val) => new Date(val).toLocaleDateString('fr-FR'),
          },
          {
            key: 'creneau',
            label: 'Créneau',
            render: (_, row) => `${row.heurePrevueDebut} – ${row.heurePrevueFin}`,
          },
          {
            key: 'classe',
            label: 'Classe / Matière',
            render: (_, row) => `${row.classe?.nom || '—'} · ${row.matiere?.nom || '—'}`,
          },
          {
            key: 'pointage',
            label: 'Arrivée / Départ',
            render: (_, row) => `${fmtTime(row.heureArrivee)} → ${fmtTime(row.heureDepart)}`,
          },
          {
            key: 'dureeHeures',
            label: 'Durée (h)',
            render: (val) => (val != null ? Number(val).toFixed(2) : '—'),
          },
          {
            key: 'statut',
            label: 'Statut',
            render: (val) => {
              const c = STATUT_CONFIG[val] || STATUT_CONFIG.prevue;
              return <Badge variant={c.variant}>{c.label}</Badge>;
            },
          },
        ]}
      />
    </div>
  );
};

export default MesPointages;
