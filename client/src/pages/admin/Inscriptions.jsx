import { useEffect, useState, useCallback } from 'react';
import { useAxios } from '../../hooks/useAxios';
import { useTenant } from '../../contexts/TenantContext';
import { useAuth } from '../../contexts/AuthContext';
import { PageHeader, DataTable, Badge, Button, Modal, SearchInput } from '../../components/ui';
import { Plus, Check, X, Pause } from 'lucide-react';
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
  const { user } = useAuth();
  const canDecideFinAnnee = ['directeur', 'directeur_etudes'].includes(user?.role);
  const [inscriptions, setInscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [createOpen, setCreateOpen] = useState(false);
  const [decisionOpen, setDecisionOpen] = useState(null);
  const [eleves, setEleves] = useState([]);
  const [classes, setClasses] = useState([]);
  const [annees, setAnnees] = useState([]);
  const [niveaux, setNiveaux] = useState([]);
  const [form, setForm] = useState({ eleveId: '', classeId: '', anneeScolaireId: '' });
  const [decisionForm, setDecisionForm] = useState({
    decisionFinAnnee: 'passage',
    niveauCibleId: '',
    classeCibleId: '',
    motifDecision: '',
    anneeCibleId: '',
    genererInscription: true,
  });

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

  const openDecision = async (insc) => {
    setDecisionOpen(insc);
    try {
      const an = await get('/api/annees-scolaires', { silent: true });
      const anneesList = an?.data || an || [];
      setAnnees(anneesList);
      const cible = anneesList.find((a) => !a.actif) || anneesList.find((a) => a.actif);
      const qs = cible?.id ? `?anneeScolaireId=${cible.id}` : '';
      const [niv, cl] = await Promise.all([
        get(`/api/referentiel/niveaux${qs}`, { silent: true }),
        get(cible?.id ? `/api/classes?anneeScolaireId=${cible.id}&limit=200` : '/api/classes?limit=200', { silent: true }),
      ]);
      setNiveaux(niv?.data || niv || []);
      setClasses(cl?.data || cl || []);
      setDecisionForm({
        decisionFinAnnee: insc.decisionFinAnnee || 'passage',
        niveauCibleId: insc.niveauCibleId || '',
        classeCibleId: insc.classeCibleId || '',
        motifDecision: insc.motifDecision || '',
        anneeCibleId: cible?.id || '',
        genererInscription: true,
      });
    } catch { /* silent */ }
  };

  const submitDecision = async () => {
    if (!decisionOpen) return;
    try {
      await put(`/api/inscriptions/${decisionOpen.id}/decision-fin-annee`, {
        ...decisionForm,
        niveauCibleId: decisionForm.niveauCibleId || null,
        classeCibleId: decisionForm.classeCibleId || null,
        anneeCibleId: decisionForm.anneeCibleId || null,
      });
      setDecisionOpen(null);
      fetchInscriptions();
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
                {canDecideFinAnnee && (
                  <button
                    onClick={() => openDecision(row)}
                    className="px-2 py-1 rounded-md text-xs font-medium"
                    style={{ background: 'var(--surface-overlay)', color: 'var(--color-primary)', border: '1px solid var(--border-subtle)' }}
                    title="Décision fin d'année"
                  >
                    Fin d'année
                  </button>
                )}
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
        open={!!decisionOpen}
        onClose={() => setDecisionOpen(null)}
        title="Décision de fin d'année"
        subtitle={decisionOpen ? `${decisionOpen.elevePrenom || decisionOpen.eleve?.prenom || ''} ${decisionOpen.eleveNom || decisionOpen.eleve?.nom || ''}` : ''}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDecisionOpen(null)}>Annuler</Button>
            <Button onClick={submitDecision}>Enregistrer</Button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Décision</label>
            <select
              style={inputStyle}
              value={decisionForm.decisionFinAnnee}
              onChange={(e) => setDecisionForm({ ...decisionForm, decisionFinAnnee: e.target.value })}
            >
              <option value="passage">Passage</option>
              <option value="redoublement">Redoublement</option>
              <option value="orientation">Orientation</option>
              <option value="exclusion">Exclusion</option>
            </select>
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Niveau cible</label>
            <select
              style={inputStyle}
              value={decisionForm.niveauCibleId}
              onChange={(e) => setDecisionForm({ ...decisionForm, niveauCibleId: e.target.value })}
            >
              <option value="">Auto (niveau suivant) / inchangé</option>
              {niveaux.map((n) => <option key={n.id} value={n.id}>{n.libelle} ({n.code})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Classe cible (année N+1)</label>
            <select
              style={inputStyle}
              value={decisionForm.classeCibleId}
              onChange={(e) => setDecisionForm({ ...decisionForm, classeCibleId: e.target.value })}
            >
              <option value="">Sans inscription auto</option>
              {classes
                .filter((c) => !decisionForm.anneeCibleId || c.anneeScolaireId === decisionForm.anneeCibleId)
                .map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Année cible</label>
            <select
              style={inputStyle}
              value={decisionForm.anneeCibleId}
              onChange={(e) => setDecisionForm({ ...decisionForm, anneeCibleId: e.target.value })}
            >
              <option value="">—</option>
              {annees.map((a) => <option key={a.id} value={a.id}>{a.libelle}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Motif / justificatif</label>
            <input
              style={inputStyle}
              value={decisionForm.motifDecision}
              onChange={(e) => setDecisionForm({ ...decisionForm, motifDecision: e.target.value })}
              placeholder="Ex: admis CEPE, décision interne GS→CP1…"
            />
          </div>
        </div>
      </Modal>

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
