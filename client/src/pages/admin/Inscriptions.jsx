import { useEffect, useState, useCallback } from 'react';
import { useAxios } from '../../hooks/useAxios';
import { useTenant } from '../../contexts/TenantContext';
import { PageHeader, DataTable, Badge, Button, Modal, SearchInput } from '../../components/ui';
import { ClipboardList, Plus, Check, X, Pause } from 'lucide-react';
import { useDebounce } from '../../hooks/useDebounce';

const STATUT_VARIANT = {
  validee: 'success',
  en_attente: 'warning',
  annulee: 'danger',
  suspendue: 'warning',
};

const STATUT_LABEL = {
  validee: 'Validée',
  en_attente: 'En attente',
  annulee: 'Annulée',
  suspendue: 'Suspendue',
};

const DECISION_LABEL = {
  passage: { label: 'Passage', variant: 'success' },
  redoublement: { label: 'Redoublement', variant: 'danger' },
  orientation: { label: 'Orientation', variant: 'warning' },
  exclusion: { label: 'Exclusion', variant: 'danger' },
};

const Inscriptions = () => {
  const { get, post, put } = useAxios();
  const { formatPrice } = useTenant();
  const [inscriptions, setInscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [createOpen, setCreateOpen] = useState(false);
  const [eleves, setEleves] = useState([]);
  const [classes, setClasses] = useState([]);
  const [annees, setAnnees] = useState([]);
  const [form, setForm] = useState({ eleveId: '', classeId: '', anneeScolaireId: '' });

  const fetchInscriptions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set('search', debouncedSearch);
      const res = await get(`/api/inscriptions?${params.toString()}`);
      setInscriptions(res?.data || res || []);
    } catch { /* silent */ }
    setLoading(false);
  }, [debouncedSearch]);

  useEffect(() => { fetchInscriptions(); }, [fetchInscriptions]);

  const fetchOptions = async () => {
    try {
      const [el, cl, an] = await Promise.all([
        get('/api/eleves', { silent: true }),
        get('/api/classes', { silent: true }),
        get('/api/annees-scolaires', { silent: true }),
      ]);
      setEleves(el?.data || el || []);
      setClasses(cl?.data || cl || []);
      setAnnees(an?.data || an || []);
      const activeAnnee = (an?.data || an || []).find((a) => a.actif);
      if (activeAnnee) setForm((f) => ({ ...f, anneeScolaireId: activeAnnee.id }));
    } catch { /* silent */ }
  };

  const handleCreate = async () => {
    try {
      await post('/api/inscriptions', form);
      setCreateOpen(false);
      setForm({ eleveId: '', classeId: '', anneeScolaireId: '' });
      fetchInscriptions();
    } catch { /* silent */ }
  };

  const changeStatut = async (insc, statut) => {
    try {
      await put(`/api/inscriptions/${insc.id}`, { statut });
      fetchInscriptions();
    } catch { /* silent */ }
  };

  const inputStyle = {
    width: '100%',
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
      <PageHeader
        title="Inscriptions"
        subtitle="Dossiers d'inscription et suivi des soldes"
        actions={<Button icon={Plus} onClick={() => { setCreateOpen(true); fetchOptions(); }}>Nouvelle inscription</Button>}
      />

      <div className="max-w-xs">
        <SearchInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un élève..." />
      </div>

      <DataTable
        columns={[
          {
            key: 'eleve',
            label: 'Élève',
            render: (_, row) => (
              <div>
                <p className="font-medium" style={{ color: 'var(--text-primary)' }}>
                  {row.elevePrenom || row.eleve?.prenom} {row.eleveNom || row.eleve?.nom}
                </p>
                <p className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{row.eleveMatricule || row.eleve?.matricule}</p>
              </div>
            ),
          },
          {
            key: 'classe',
            label: 'Classe',
            render: (_, row) => <span style={{ color: 'var(--text-secondary)' }}>{row.classeNom || row.classe?.nom}</span>,
          },
          {
            key: 'anneeScolaire',
            label: 'Année',
            render: (_, row) => <span style={{ color: 'var(--text-muted)' }}>{row.anneeScolaireLibelle || row.anneeScolaire?.libelle}</span>,
          },
          {
            key: 'soldeScolarite',
            label: 'Solde restant',
            render: (val) => (
              <span className="font-semibold" style={{ color: val > 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>
                {formatPrice(val || 0)}
              </span>
            ),
          },
          {
            key: 'statut',
            label: 'Statut',
            render: (val) => <Badge variant={STATUT_VARIANT[val] || 'neutral'}>{STATUT_LABEL[val] || val}</Badge>,
          },
          {
            key: 'decisionFinAnnee',
            label: 'Décision fin d\'année',
            render: (val) => {
              if (!val) return <span style={{ color: 'var(--text-muted)' }}>—</span>;
              const d = DECISION_LABEL[val] || { label: val, variant: 'neutral' };
              return <Badge variant={d.variant}>{d.label}</Badge>;
            },
          },
          {
            key: 'actions',
            label: 'Actions',
            render: (_, row) => (
              <div className="flex items-center gap-1">
                {row.statut !== 'validee' && (
                  <button onClick={() => changeStatut(row, 'validee')} className="p-1.5 rounded-md hover:bg-[var(--surface-hover)]" title="Valider">
                    <Check className="h-4 w-4" style={{ color: 'var(--color-success)' }} />
                  </button>
                )}
                {row.statut !== 'suspendue' && row.statut !== 'annulee' && (
                  <button onClick={() => changeStatut(row, 'suspendue')} className="p-1.5 rounded-md hover:bg-[var(--surface-hover)]" title="Suspendre">
                    <Pause className="h-4 w-4" style={{ color: 'var(--color-warning)' }} />
                  </button>
                )}
                {row.statut !== 'annulee' && (
                  <button onClick={() => changeStatut(row, 'annulee')} className="p-1.5 rounded-md hover:bg-[var(--surface-hover)]" title="Annuler">
                    <X className="h-4 w-4" style={{ color: 'var(--color-danger)' }} />
                  </button>
                )}
              </div>
            ),
          },
        ]}
        data={inscriptions}
        loading={loading}
        emptyMessage="Aucune inscription"
      />

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Nouvelle inscription"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>Annuler</Button>
            <Button onClick={handleCreate} disabled={!form.eleveId || !form.classeId || !form.anneeScolaireId}>Inscrire</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Élève</label>
            <select style={inputStyle} value={form.eleveId} onChange={(e) => setForm({ ...form, eleveId: e.target.value })}>
              <option value="">Sélectionner un élève</option>
              {eleves.map((el) => <option key={el.id} value={el.id}>{el.prenom} {el.nom} ({el.matricule})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Classe</label>
            <select style={inputStyle} value={form.classeId} onChange={(e) => setForm({ ...form, classeId: e.target.value })}>
              <option value="">Sélectionner une classe</option>
              {classes.map((cl) => <option key={cl.id} value={cl.id}>{cl.nom} ({cl.niveau})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Année scolaire</label>
            <select style={inputStyle} value={form.anneeScolaireId} onChange={(e) => setForm({ ...form, anneeScolaireId: e.target.value })}>
              <option value="">Sélectionner une année</option>
              {annees.map((an) => <option key={an.id} value={an.id}>{an.libelle}{an.actif ? ' (active)' : ''}</option>)}
            </select>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Inscriptions;
