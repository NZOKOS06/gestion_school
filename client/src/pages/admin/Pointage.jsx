import { useCallback, useEffect, useState } from 'react';
import { useAxios } from '../../hooks/useAxios';
import { PageHeader, DataTable, Badge, Button } from '../../components/ui';
import { Clock, LogIn, LogOut, UserX, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

const STATUT_CONFIG = {
  prevue: { label: 'Prévue', variant: 'neutral' },
  en_cours: { label: 'En cours', variant: 'warning' },
  terminee: { label: 'Terminée', variant: 'success' },
  absente: { label: 'Absente', variant: 'danger' },
  annulee: { label: 'Annulée', variant: 'neutral' },
};

const selectStyle = {
  height: 36,
  background: 'var(--surface-overlay)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-md)',
  color: 'var(--text-primary)',
  fontSize: 13,
  padding: '0 8px',
};

const Pointage = () => {
  const { get, post } = useAxios();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [filters, setFilters] = useState({ statut: '', enseignantId: '', salleId: '' });
  const [acting, setActing] = useState(null);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ date });
      if (filters.statut) params.set('statut', filters.statut);
      if (filters.enseignantId) params.set('enseignantId', filters.enseignantId);
      if (filters.salleId) params.set('salleId', filters.salleId);
      const res = await get(`/api/pointage/sessions?${params.toString()}`);
      setSessions(res?.data || []);
    } catch {
      toast.error('Impossible de charger les sessions');
    }
    setLoading(false);
  }, [date, filters, get]);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  const runAction = async (id, action) => {
    setActing(id);
    try {
      await post(`/api/pointage/sessions/${id}/${action}`);
      toast.success(action === 'absent' ? 'Absence enregistrée' : 'Pointage enregistré');
      fetchSessions();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Action impossible');
    }
    setActing(null);
  };

  const fmtTime = (val) => (val ? new Date(val).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pointage du jour"
        subtitle="Sessions de cours liées à l'emploi du temps — arrivée, départ, absence"
        icon={Clock}
        actions={
          <Button variant="secondary" icon={RefreshCw} onClick={fetchSessions} loading={loading}>
            Actualiser
          </Button>
        }
      />

      <div className="flex gap-3 flex-wrap items-center">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          style={selectStyle}
        />
        <select
          style={selectStyle}
          value={filters.statut}
          onChange={(e) => setFilters({ ...filters, statut: e.target.value })}
        >
          <option value="">Tous statuts</option>
          {Object.entries(STATUT_CONFIG).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      <DataTable
        loading={loading}
        data={sessions}
        emptyMessage="Aucune session pour cette date"
        columns={[
          {
            key: 'creneau',
            label: 'Créneau',
            render: (_, row) => (
              <div>
                <p className="font-medium" style={{ color: 'var(--text-primary)' }}>
                  {row.heurePrevueDebut} – {row.heurePrevueFin}
                </p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {row.matiere?.nom || row.matiere?.code} · {row.classe?.nom}
                </p>
              </div>
            ),
          },
          {
            key: 'enseignant',
            label: 'Enseignant',
            render: (_, row) => (
              <span style={{ color: 'var(--text-secondary)' }}>
                {row.enseignant?.prenom} {row.enseignant?.nom}
              </span>
            ),
          },
          {
            key: 'salle',
            label: 'Salle',
            render: (_, row) => (
              <span style={{ color: 'var(--text-secondary)' }}>{row.salle?.nom || row.emploiDuTemps?.salle || '—'}</span>
            ),
          },
          {
            key: 'pointage',
            label: 'Arrivée / Départ',
            render: (_, row) => (
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                {fmtTime(row.heureArrivee)} → {fmtTime(row.heureDepart)}
                {row.dureeHeures != null && row.dureeHeures > 0 && (
                  <span className="ml-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                    ({row.dureeHeures} h)
                  </span>
                )}
              </span>
            ),
          },
          {
            key: 'statut',
            label: 'Statut',
            render: (val) => {
              const c = STATUT_CONFIG[val] || STATUT_CONFIG.prevue;
              return <Badge variant={c.variant} dot>{c.label}</Badge>;
            },
          },
          {
            key: 'actions',
            label: 'Actions',
            render: (_, row) => (
              <div className="flex items-center gap-1">
                {!row.heureArrivee && row.statut !== 'absente' && row.statut !== 'terminee' && (
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={LogIn}
                    loading={acting === row.id}
                    onClick={() => runAction(row.id, 'arrivee')}
                  >
                    Arrivée
                  </Button>
                )}
                {row.heureArrivee && !row.heureDepart && (
                  <Button
                    size="sm"
                    icon={LogOut}
                    loading={acting === row.id}
                    onClick={() => runAction(row.id, 'depart')}
                  >
                    Départ
                  </Button>
                )}
                {!row.heureArrivee && row.statut !== 'absente' && row.statut !== 'terminee' && (
                  <button
                    type="button"
                    onClick={() => runAction(row.id, 'absent')}
                    disabled={acting === row.id}
                    className="p-1.5 rounded-md hover:bg-[var(--surface-hover)]"
                    title="Marquer absent"
                  >
                    <UserX className="h-4 w-4" style={{ color: 'var(--color-error)' }} />
                  </button>
                )}
              </div>
            ),
          },
        ]}
      />
    </div>
  );
};

export default Pointage;
