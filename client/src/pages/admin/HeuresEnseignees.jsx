import { useCallback, useEffect, useState } from 'react';
import { useAxios } from '../../hooks/useAxios';
import { PageHeader, DataTable, Badge, Button } from '../../components/ui';
import { Timer, Check, X, CheckCheck } from 'lucide-react';
import toast from 'react-hot-toast';

const HeuresEnseignees = () => {
  const { get, put, post } = useAxios();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState([]);
  const [filters, setFilters] = useState({
    validee: 'false',
    mois: String(new Date().getMonth() + 1),
    annee: String(new Date().getFullYear()),
  });

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.validee) params.set('validee', filters.validee);
      if (filters.mois) params.set('mois', filters.mois);
      if (filters.annee) params.set('annee', filters.annee);
      const res = await get(`/api/heures-enseignees?${params.toString()}`);
      setRows(res?.data || []);
      setSelected([]);
    } catch {
      toast.error('Erreur de chargement');
    }
    setLoading(false);
  }, [filters, get]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  const valider = async (id) => {
    try {
      await put(`/api/heures-enseignees/${id}/valider`);
      toast.success('Heure validée');
      fetchRows();
    } catch {
      toast.error('Validation impossible');
    }
  };

  const rejeter = async (id) => {
    try {
      await put(`/api/heures-enseignees/${id}/rejeter`);
      toast.success('Heure rejetée');
      fetchRows();
    } catch {
      toast.error('Rejet impossible');
    }
  };

  const validerLot = async () => {
    if (!selected.length) return;
    try {
      await post('/api/heures-enseignees/valider-lot', { ids: selected });
      toast.success(`${selected.length} heure(s) validée(s)`);
      fetchRows();
    } catch {
      toast.error('Validation groupée impossible');
    }
  };

  const toggleSelect = (id) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Validation des heures"
        subtitle="Heures issues du pointage — à valider avant la paie"
        icon={Timer}
        actions={
          selected.length > 0 && (
            <Button icon={CheckCheck} onClick={validerLot}>
              Valider la sélection ({selected.length})
            </Button>
          )
        }
      />

      <div className="flex gap-3 flex-wrap">
        <select style={selectStyle} value={filters.validee} onChange={(e) => setFilters({ ...filters, validee: e.target.value })}>
          <option value="">Toutes</option>
          <option value="false">En attente</option>
          <option value="true">Validées</option>
        </select>
        <select style={selectStyle} value={filters.mois} onChange={(e) => setFilters({ ...filters, mois: e.target.value })}>
          {Array.from({ length: 12 }, (_, i) => (
            <option key={i + 1} value={String(i + 1)}>
              {new Date(2000, i, 1).toLocaleDateString('fr-FR', { month: 'long' })}
            </option>
          ))}
        </select>
        <input
          type="number"
          min="2020"
          max="2100"
          value={filters.annee}
          onChange={(e) => setFilters({ ...filters, annee: e.target.value })}
          style={{ ...selectStyle, width: 100 }}
        />
      </div>

      <DataTable
        loading={loading}
        data={rows}
        emptyMessage="Aucune heure enregistrée"
        columns={[
          {
            key: 'select',
            label: '',
            render: (_, row) => !row.validee && (
              <input
                type="checkbox"
                checked={selected.includes(row.id)}
                onChange={() => toggleSelect(row.id)}
              />
            ),
          },
          {
            key: 'enseignant',
            label: 'Enseignant',
            render: (_, row) => (
              <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                {row.enseignant?.prenom} {row.enseignant?.nom}
              </span>
            ),
          },
          {
            key: 'date',
            label: 'Date',
            render: (val) => new Date(val).toLocaleDateString('fr-FR'),
          },
          {
            key: 'creneau',
            label: 'Créneau',
            render: (_, row) => `${row.heureDebut || '—'} – ${row.heureFin || '—'}`,
          },
          {
            key: 'classe',
            label: 'Classe / Matière',
            render: (_, row) => `${row.classe?.nom || '—'} · ${row.matiere?.nom || '—'}`,
          },
          {
            key: 'dureeHeures',
            label: 'Durée (h)',
            render: (val) => Number(val || 0).toFixed(2),
          },
          {
            key: 'validee',
            label: 'Statut',
            render: (val) => val
              ? <Badge variant="success">Validée</Badge>
              : <Badge variant="warning" dot>En attente</Badge>,
          },
          {
            key: 'actions',
            label: 'Actions',
            render: (_, row) => !row.validee && (
              <div className="flex gap-1">
                <button type="button" onClick={() => valider(row.id)} className="p-1.5 rounded-md hover:bg-[var(--surface-hover)]" title="Valider">
                  <Check className="h-4 w-4" style={{ color: 'var(--color-success)' }} />
                </button>
                <button type="button" onClick={() => rejeter(row.id)} className="p-1.5 rounded-md hover:bg-[var(--surface-hover)]" title="Rejeter">
                  <X className="h-4 w-4" style={{ color: 'var(--color-error)' }} />
                </button>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
};

export default HeuresEnseignees;
