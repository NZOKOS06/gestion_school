import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAxios } from '../../hooks/useAxios';
import { useTenant } from '../../contexts/TenantContext';
import { useAuth } from '../../contexts/AuthContext';
import { PageHeader, DataTable, Badge, Button, Modal, SearchInput, FilterBar, Select, QuickSearchSelect } from '../../components/ui';
import { useDebounce } from '../../hooks/useDebounce';
import InscriptionWizard from './InscriptionWizard.jsx';
import toast from 'react-hot-toast';

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

const EMPTY_ELEVE = {
  matricule: '',
  nom: '',
  prenom: '',
  dateNaissance: '',
  sexe: 'M',
  lieuNaissance: '',
  adresse: '',
};

const suggestMatricule = () => {
  const y = new Date().getFullYear();
  const n = String(Math.floor(Math.random() * 9000) + 1000);
  return `GS-${y}-${n}`;
};

const Inscriptions = () => {
  const { get, post, put } = useAxios();
  const { formatPrice } = useTenant();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const canDecideFinAnnee = ['directeur', 'directeur_etudes'].includes(user?.role);
  const [inscriptions, setInscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [createOpen, setCreateOpen] = useState(false);
  const [mode, setMode] = useState('nouveau'); // nouveau | existant
  const [decisionOpen, setDecisionOpen] = useState(null);
  const [eleves, setEleves] = useState([]);
  const [classes, setClasses] = useState([]);
  const [annees, setAnnees] = useState([]);
  const [niveaux, setNiveaux] = useState([]);
  const [parents, setParents] = useState([]);
  const [form, setForm] = useState({
    eleveId: '',
    classeId: '',
    anneeScolaireId: '',
    parentId: '',
    eleve: { ...EMPTY_ELEVE, matricule: suggestMatricule() },
  });
  const [decisionForm, setDecisionForm] = useState({
    decisionFinAnnee: 'passage',
    niveauCibleId: '',
    classeCibleId: '',
    motifDecision: '',
    anneeCibleId: '',
    genererInscription: true,
  });
  const [saving, setSaving] = useState(false);
  const [listFilters, setListFilters] = useState({ classeId: '', statut: '' });
  const [filterClasses, setFilterClasses] = useState([]);
  const [fraisInscriptionDefault, setFraisInscriptionDefault] = useState(0);
  const [parentQuickOpen, setParentQuickOpen] = useState(false);
  const [parentForm, setParentForm] = useState({ nom: '', prenom: '', email: '', telephone: '' });
  const [reinscriptionOpen, setReinscriptionOpen] = useState(false);
  const [reinscriptionLoading, setReinscriptionLoading] = useState(false);
  const [reinscriptionSaving, setReinscriptionSaving] = useState(false);
  const [reinscriptionMeta, setReinscriptionMeta] = useState({ data: [], anneeSourceId: '', anneeCibleId: '', classesCibles: [] });
  const [reinscriptionRows, setReinscriptionRows] = useState({});

  const fetchInscriptions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (listFilters.classeId) params.set('classeId', listFilters.classeId);
      if (listFilters.statut) params.set('statut', listFilters.statut);
      params.set('limit', '100');
      const res = await get(`/api/inscriptions?${params.toString()}`);
      setInscriptions(res?.data || res || []);
    } catch { /* silent */ }
    setLoading(false);
  }, [debouncedSearch, listFilters, get]);

  useEffect(() => { fetchInscriptions(); }, [fetchInscriptions]);

  useEffect(() => {
    (async () => {
      try {
        const [cl, cfg] = await Promise.all([
          get('/api/classes?limit=200', { silent: true }),
          get('/api/config/demo', { silent: true }).catch(() => null),
        ]);
        setFilterClasses(cl?.data || cl || []);
        // Prefer tenant slug from storage when available
        const slug = localStorage.getItem('tenantSlug') || 'demo';
        let configPayload = cfg;
        if (slug && slug !== 'demo') {
          try {
            configPayload = await get(`/api/config/${slug}`, { silent: true });
          } catch { /* keep demo cfg */ }
        }
        setFraisInscriptionDefault(Number(configPayload?.fraisInscriptionDefault ?? configPayload?.config?.fraisInscriptionDefault ?? 0));
      } catch { /* silent */ }
    })();
  }, [get]);

  const fetchOptions = async (preselectEleveId) => {
    const results = await Promise.allSettled([
      get('/api/eleves?limit=500', { silent: true }),
      get('/api/classes?limit=200', { silent: true }),
      get('/api/annees-scolaires', { silent: true }),
      get('/api/parents?limit=500', { silent: true }),
      get(`/api/config/${localStorage.getItem('tenantSlug') || 'demo'}`, { silent: true }),
    ]);
    const val = (i) => (results[i].status === 'fulfilled' ? results[i].value : null);
    const elevesList = val(0)?.data || val(0) || [];
    const classesList = val(1)?.data || val(1) || [];
    const anneesList = val(2)?.data || val(2) || [];
    const parentsList = val(3)?.data || val(3) || [];
    const cfg = val(4);
    setEleves(Array.isArray(elevesList) ? elevesList : []);
    setClasses(Array.isArray(classesList) ? classesList : []);
    setFilterClasses(Array.isArray(classesList) ? classesList : []);
    setAnnees(Array.isArray(anneesList) ? anneesList : []);
    setParents(Array.isArray(parentsList) ? parentsList : []);
    setFraisInscriptionDefault(Number(cfg?.fraisInscriptionDefault ?? cfg?.config?.fraisInscriptionDefault ?? 0));
    const activeAnnee = anneesList.find?.((a) => a.actif) || (Array.isArray(anneesList) ? anneesList[0] : null);
    setForm((f) => ({
      ...f,
      anneeScolaireId: activeAnnee?.id || f.anneeScolaireId,
      eleveId: preselectEleveId || f.eleveId,
      eleve: { ...EMPTY_ELEVE, matricule: suggestMatricule() },
    }));
    if (preselectEleveId) setMode('existant');
  };

  const createParentQuick = async () => {
    if (!parentForm.nom.trim() || !parentForm.prenom.trim() || !parentForm.email.trim()) {
      toast.error('Nom, prénom et email requis');
      return;
    }
    try {
      const created = await post('/api/parents', {
        nom: parentForm.nom.trim(),
        prenom: parentForm.prenom.trim(),
        email: parentForm.email.trim(),
        telephone: parentForm.telephone.trim() || undefined,
      });
      setParents((prev) => [...prev, created].sort((a, b) => a.nom.localeCompare(b.nom, 'fr')));
      setForm((f) => ({ ...f, parentId: created.id }));
      setParentQuickOpen(false);
      setParentForm({ nom: '', prenom: '', email: '', telephone: '' });
      if (created.temporaryPassword) {
        toast.success(`Parent créé — mot de passe temporaire : ${created.temporaryPassword}`);
      } else {
        toast.success('Parent créé');
      }
    } catch { /* toast via useAxios */ }
  };

  useEffect(() => {
    const eleveId = searchParams.get('eleveId');
    if (eleveId) {
      setCreateOpen(true);
      fetchOptions(eleveId);
      setSearchParams({}, { replace: true });
    }
  }, []);

  const openCreate = () => {
    setMode('nouveau');
    setForm({
      eleveId: '',
      classeId: '',
      anneeScolaireId: '',
      parentId: '',
      eleve: { ...EMPTY_ELEVE, matricule: suggestMatricule() },
    });
    setCreateOpen(true);
    fetchOptions();
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
      toast.success('Décision enregistrée');
      setDecisionOpen(null);
      fetchInscriptions();
    } catch { /* silent */ }
  };

  const handleCreate = async () => {
    if (!form.classeId || !form.anneeScolaireId) {
      toast.error('Classe et année scolaire requises');
      return;
    }
    if (mode === 'existant' && !form.eleveId) {
      toast.error('Sélectionnez un élève');
      return;
    }
    if (mode === 'nouveau') {
      const e = form.eleve;
      if (!e.matricule.trim() || !e.nom.trim() || !e.prenom.trim() || !e.dateNaissance || !e.sexe) {
        toast.error('Complétez l\'identité de l\'élève');
        return;
      }
      const birth = new Date(e.dateNaissance);
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      if (Number.isNaN(birth.getTime()) || birth > today) {
        toast.error('Date de naissance invalide ou dans le futur');
        return;
      }
      let age = today.getFullYear() - birth.getFullYear();
      const md = today.getMonth() - birth.getMonth();
      if (md < 0 || (md === 0 && today.getDate() < birth.getDate())) age--;
      if (age < 2 || age > 25) {
        toast.error("L'âge de l'élève doit être compris entre 2 et 25 ans");
        return;
      }
    }
    if (!form.parentId) {
      toast('Aucun parent lié — recommandé pour les mineurs', { icon: '!' });
    }
    setSaving(true);
    try {
      const payload = {
        classeId: form.classeId,
        anneeScolaireId: form.anneeScolaireId,
        parentId: form.parentId || undefined,
      };
      if (mode === 'existant') {
        payload.eleveId = form.eleveId;
      } else {
        payload.eleve = {
          ...form.eleve,
          matricule: form.eleve.matricule.trim(),
          nom: form.eleve.nom.trim(),
          prenom: form.eleve.prenom.trim(),
          parentId: form.parentId || undefined,
        };
      }
      await post('/api/inscriptions/avec-eleve', payload);
      toast.success('Inscription créée (en attente de validation)');
      setCreateOpen(false);
      fetchInscriptions();
    } catch { /* toast via useAxios */ }
    setSaving(false);
  };

  const validateInscription = async (insc) => {
    try {
      await put(`/api/inscriptions/${insc.id}/validate`, {});
      toast.success('Inscription validée — élève scolarisé');
      fetchInscriptions();
    } catch { /* silent */ }
  };

  const changeStatut = async (insc, statut) => {
    try {
      await put(`/api/inscriptions/${insc.id}`, { statut });
      fetchInscriptions();
    } catch { /* silent */ }
  };

  const loadEligiblesReinscription = async () => {
    setReinscriptionLoading(true);
    try {
      const res = await get('/api/inscriptions/eligibles-reinscription', { silent: true });
      const list = res?.data || [];
      const rows = {};
      list.forEach((item) => {
        rows[item.inscriptionSourceId] = {
          selected: !item.dejaInscrit,
          decisionFinAnnee: item.suggestedDecision || 'passage',
          classeCibleId: item.suggestedClasseId || '',
        };
      });
      setReinscriptionMeta({
        data: list,
        anneeSourceId: res?.anneeSourceId || '',
        anneeCibleId: res?.anneeCibleId || '',
        classesCibles: res?.classesCibles || [],
      });
      setReinscriptionRows(rows);
    } catch {
      setReinscriptionMeta({ data: [], anneeSourceId: '', anneeCibleId: '', classesCibles: [] });
      setReinscriptionRows({});
    }
    setReinscriptionLoading(false);
  };

  const openReinscription = () => {
    setReinscriptionOpen(true);
    loadEligiblesReinscription();
  };

  const updateReinscriptionRow = (inscriptionSourceId, patch) => {
    setReinscriptionRows((prev) => ({
      ...prev,
      [inscriptionSourceId]: { ...prev[inscriptionSourceId], ...patch },
    }));
  };

  const selectableReinscriptionIds = reinscriptionMeta.data
    .filter((item) => !item.dejaInscrit)
    .map((item) => item.inscriptionSourceId);
  const allSelectableSelected = selectableReinscriptionIds.length > 0
    && selectableReinscriptionIds.every((id) => reinscriptionRows[id]?.selected);
  const selectedReinscriptionCount = selectableReinscriptionIds.filter((id) => reinscriptionRows[id]?.selected).length;

  const toggleAllReinscription = () => {
    const next = !allSelectableSelected;
    setReinscriptionRows((prev) => {
      const updated = { ...prev };
      selectableReinscriptionIds.forEach((id) => {
        updated[id] = { ...updated[id], selected: next };
      });
      return updated;
    });
  };

  const submitReinscriptionLot = async () => {
    const items = reinscriptionMeta.data
      .filter((item) => !item.dejaInscrit && reinscriptionRows[item.inscriptionSourceId]?.selected)
      .map((item) => {
        const row = reinscriptionRows[item.inscriptionSourceId];
        return {
          inscriptionSourceId: item.inscriptionSourceId,
          decisionFinAnnee: row.decisionFinAnnee,
          classeCibleId: row.decisionFinAnnee === 'exclusion' ? undefined : (row.classeCibleId || undefined),
        };
      });

    if (!items.length) {
      toast.error('Sélectionnez au moins un élève');
      return;
    }

    const missingClasse = items.find(
      (it) => it.decisionFinAnnee !== 'exclusion' && !it.classeCibleId
    );
    if (missingClasse) {
      toast.error('Classe cible requise pour chaque élève (sauf exclusion)');
      return;
    }

    setReinscriptionSaving(true);
    try {
      const result = await post('/api/inscriptions/reinscription-lot', {
        anneeCibleId: reinscriptionMeta.anneeCibleId,
        items,
      });
      const created = result?.created ?? 0;
      const skipped = result?.skipped ?? 0;
      const decisionsOnly = result?.decisionsOnly ?? 0;
      const errCount = result?.errors?.length ?? 0;
      let msg = `${created} inscription(s) créée(s)`;
      if (skipped) msg += `, ${skipped} ignorée(s)`;
      if (decisionsOnly) msg += `, ${decisionsOnly} décision(s) seule(s)`;
      if (errCount) msg += `, ${errCount} erreur(s)`;
      toast.success(msg);
      await fetchInscriptions();
      await loadEligiblesReinscription();
      if (created === 0 && skipped === 0 && errCount === 0) {
        setReinscriptionOpen(false);
      }
    } catch { /* toast via useAxios */ }
    setReinscriptionSaving(false);
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

  const classesForAnnee = classes.filter(
    (c) => !form.anneeScolaireId || c.anneeScolaireId === form.anneeScolaireId
  );
  const selectedClasse = classesForAnnee.find((c) => c.id === form.classeId);
  const fraisScolaritePreview = Number(selectedClasse?.fraisScolarite ?? 0);
  const totalFraisPreview = fraisInscriptionDefault + fraisScolaritePreview;

  return (
    <div className="space-y-6" data-testid="page-inscriptions">
      <PageHeader
        title="Inscriptions / Réinscriptions"
        subtitle="L'inscription lie l'élève à une classe et ouvre le dossier financier"
        data-testid="page-inscriptions"
        actions={
          <div className="flex items-center gap-2">
            {(canDecideFinAnnee || user?.role === 'secretaire') && (
              <Button variant="secondary" icon={RefreshCw} onClick={openReinscription}>
                Réinscription
              </Button>
            )}
            <Button icon={Plus} onClick={openCreate}>Nouvelle inscription</Button>
          </div>
        }
      />

      <FilterBar>
        <div className="min-w-[180px] w-[220px] shrink-0">
          <SearchInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un élève..." />
        </div>
        <Select
          fullWidth={false}
          style={{ height: 36, width: 160, flexShrink: 0 }}
          value={listFilters.classeId}
          onChange={(e) => setListFilters({ ...listFilters, classeId: e.target.value })}
        >
          <option value="">Toutes les classes</option>
          {filterClasses.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
        </Select>
        <Select
          fullWidth={false}
          style={{ height: 36, width: 140, flexShrink: 0 }}
          value={listFilters.statut}
          onChange={(e) => setListFilters({ ...listFilters, statut: e.target.value })}
        >
          <option value="">Tous statuts</option>
          <option value="en_attente">En attente</option>
          <option value="validee">Validée</option>
          <option value="suspendue">Suspendue</option>
          <option value="annulee">Annulée</option>
        </Select>
      </FilterBar>

      <DataTable
        columns={[
          {
            key: 'eleve',
            label: 'Élève',
            primary: true,
            render: (_, row) => (
              <div>
                <p className="font-medium" style={{ color: 'var(--text-primary)' }}>
                  {row.elevePrenom || row.eleve?.prenom} {row.eleveNom || row.eleve?.nom}
                </p>
                <p className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{row.eleveMatricule || row.eleve?.matricule}</p>
              </div>
            ),
            mobileRender: (_, row) => `${row.elevePrenom || row.eleve?.prenom || ''} ${row.eleveNom || row.eleve?.nom || ''}`.trim(),
          },
          {
            key: 'classe',
            label: 'Classe',
            secondary: true,
            render: (_, row) => <span style={{ color: 'var(--text-secondary)' }}>{row.classeNom || row.classe?.nom}</span>,
          },
          {
            key: 'anneeScolaire',
            label: 'Année',
            hideOnMobile: true,
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
            badge: true,
            render: (val) => <Badge variant={STATUT_VARIANT[val] || 'neutral'}>{STATUT_LABEL[val] || val}</Badge>,
          },
          {
            key: 'decisionFinAnnee',
            label: 'Décision fin d\'année',
            hideOnMobile: true,
            render: (val) => {
              if (!val) return <span style={{ color: 'var(--text-muted)' }}>—</span>;
              const d = DECISION_LABEL[val] || { label: val, variant: 'neutral' };
              return <Badge variant={d.variant}>{d.label}</Badge>;
            },
          },
          {
            key: 'actions',
            label: 'Actions',
            actions: true,
            render: (_, row) => (
              <div className="flex items-center gap-1 flex-wrap">
                {canDecideFinAnnee && row.statut === 'validee' && (
                  <button
                    onClick={() => openDecision(row)}
                    className="px-2 py-1.5 rounded-md text-xs font-medium min-h-[36px]"
                    style={{ background: 'var(--surface-overlay)', color: 'var(--color-primary)', border: '1px solid var(--border-subtle)' }}
                    title="Décision fin d'année"
                  >
                    Fin d'année
                  </button>
                )}
                {row.statut === 'en_attente' && (
                  <button onClick={() => validateInscription(row)} className="p-2 rounded-md hover:bg-[var(--surface-hover)] min-h-[40px] min-w-[40px] flex items-center justify-center" title="Valider l'inscription">
                    <Check className="h-4 w-4" style={{ color: 'var(--color-success)' }} />
                  </button>
                )}
                {row.statut !== 'suspendue' && row.statut !== 'annulee' && row.statut === 'validee' && (
                  <button onClick={() => changeStatut(row, 'suspendue')} className="p-2 rounded-md hover:bg-[var(--surface-hover)] min-h-[40px] min-w-[40px] flex items-center justify-center" title="Suspendre">
                    <Pause className="h-4 w-4" style={{ color: 'var(--color-warning)' }} />
                  </button>
                )}
                {row.statut !== 'annulee' && (
                  <button onClick={() => changeStatut(row, 'annulee')} className="p-2 rounded-md hover:bg-[var(--surface-hover)] min-h-[40px] min-w-[40px] flex items-center justify-center" title="Annuler">
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
            <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Année cible</label>
            <select
              style={inputStyle}
              value={decisionForm.anneeCibleId}
              onChange={(e) => setDecisionForm({ ...decisionForm, anneeCibleId: e.target.value, classeCibleId: '' })}
            >
              <option value="">—</option>
              {annees.map((a) => <option key={a.id} value={a.id}>{a.libelle}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Classe cible (génère inscription N+1)</label>
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

      {/* Modal Wizard Inscription Multi-étapes avec Tuteur Obligatoire */}
      <InscriptionWizard
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        classes={classes}
        annees={annees}
        eleves={eleves}
        parents={parents}
        fraisInscriptionDefault={fraisInscriptionDefault}
        formatPrice={formatPrice}
        onSuccess={fetchInscriptions}
        post={post}
      />

      <Modal
        open={reinscriptionOpen}
        onClose={() => setReinscriptionOpen(false)}
        title="Réinscription en lot"
        subtitle={
          reinscriptionLoading
            ? 'Chargement des élèves éligibles…'
            : `${reinscriptionMeta.data.length} élève(s) — ${selectedReinscriptionCount} sélectionné(s)`
        }
        size="xl"
        footer={
          <>
            <Button variant="secondary" onClick={() => setReinscriptionOpen(false)}>Fermer</Button>
            {canDecideFinAnnee && (
              <Button
                onClick={submitReinscriptionLot}
                disabled={reinscriptionSaving || reinscriptionLoading || selectedReinscriptionCount === 0}
              >
                {reinscriptionSaving ? 'Traitement…' : 'Valider la sélection'}
              </Button>
            )}
          </>
        }
      >
        {reinscriptionLoading ? (
          <p className="text-sm py-8 text-center" style={{ color: 'var(--text-muted)' }}>Chargement…</p>
        ) : reinscriptionMeta.data.length === 0 ? (
          <p className="text-sm py-8 text-center" style={{ color: 'var(--text-muted)' }}>
            Aucun élève éligible à la réinscription.
          </p>
        ) : (
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <th className="py-2 px-2 w-10">
                    <input
                      type="checkbox"
                      checked={allSelectableSelected}
                      onChange={toggleAllReinscription}
                      disabled={!canDecideFinAnnee || selectableReinscriptionIds.length === 0}
                      title="Tout sélectionner"
                    />
                  </th>
                  <th className="py-2 px-2 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Élève</th>
                  <th className="py-2 px-2 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Classe source</th>
                  <th className="py-2 px-2 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Décision</th>
                  <th className="py-2 px-2 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Classe cible</th>
                  <th className="py-2 px-2 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Statut</th>
                </tr>
              </thead>
              <tbody>
                {reinscriptionMeta.data.map((item) => {
                  const row = reinscriptionRows[item.inscriptionSourceId] || {};
                  const isExclusion = row.decisionFinAnnee === 'exclusion';
                  const classeDisabled = item.dejaInscrit || isExclusion || !canDecideFinAnnee;
                  const rowDisabled = item.dejaInscrit || !canDecideFinAnnee;
                  return (
                    <tr
                      key={item.inscriptionSourceId}
                      style={{
                        borderBottom: '1px solid var(--border-subtle)',
                        opacity: item.dejaInscrit ? 0.65 : 1,
                      }}
                    >
                      <td className="py-2 px-2">
                        <input
                          type="checkbox"
                          checked={!!row.selected}
                          disabled={item.dejaInscrit || !canDecideFinAnnee}
                          onChange={(e) => updateReinscriptionRow(item.inscriptionSourceId, { selected: e.target.checked })}
                        />
                      </td>
                      <td className="py-2 px-2">
                        <p className="font-medium" style={{ color: 'var(--text-primary)' }}>
                          {item.eleve?.prenom} {item.eleve?.nom}
                        </p>
                        <p className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{item.eleve?.matricule}</p>
                      </td>
                      <td className="py-2 px-2" style={{ color: 'var(--text-secondary)' }}>
                        {item.classeSource?.nom || '—'}
                      </td>
                      <td className="py-2 px-2 min-w-[140px]">
                        <select
                          style={{ ...inputStyle, height: 34, opacity: rowDisabled ? 0.7 : 1 }}
                          value={row.decisionFinAnnee || 'passage'}
                          disabled={rowDisabled}
                          onChange={(e) => {
                            const decisionFinAnnee = e.target.value;
                            updateReinscriptionRow(item.inscriptionSourceId, {
                              decisionFinAnnee,
                              ...(decisionFinAnnee === 'exclusion' ? { classeCibleId: '' } : {}),
                            });
                          }}
                        >
                          <option value="passage">Passage</option>
                          <option value="redoublement">Redoublement</option>
                          <option value="orientation">Orientation</option>
                          <option value="exclusion">Exclusion</option>
                        </select>
                      </td>
                      <td className="py-2 px-2 min-w-[160px]">
                        <select
                          style={{ ...inputStyle, height: 34, opacity: classeDisabled ? 0.6 : 1 }}
                          value={row.classeCibleId || ''}
                          disabled={classeDisabled}
                          onChange={(e) => updateReinscriptionRow(item.inscriptionSourceId, { classeCibleId: e.target.value })}
                        >
                          <option value="">{isExclusion ? '—' : 'Sélectionner'}</option>
                          {reinscriptionMeta.classesCibles.map((c) => (
                            <option key={c.id} value={c.id}>{c.nom}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 px-2">
                        {item.dejaInscrit ? (
                          <Badge variant="neutral">Déjà inscrit</Badge>
                        ) : item.decisionExistante ? (
                          <Badge variant={(DECISION_LABEL[item.decisionExistante] || {}).variant || 'neutral'}>
                            {(DECISION_LABEL[item.decisionExistante] || {}).label || item.decisionExistante}
                          </Badge>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {!canDecideFinAnnee && reinscriptionMeta.data.length > 0 && (
          <p className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>
            Consultation seule — seule la direction peut valider la réinscription.
          </p>
        )}
      </Modal>

      <Modal
        open={parentQuickOpen}
        onClose={() => setParentQuickOpen(false)}
        title="Créer un parent"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setParentQuickOpen(false)}>Annuler</Button>
            <Button onClick={createParentQuick}>Créer</Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Nom</label>
              <input style={inputStyle} value={parentForm.nom} onChange={(e) => setParentForm({ ...parentForm, nom: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Prénom</label>
              <input style={inputStyle} value={parentForm.prenom} onChange={(e) => setParentForm({ ...parentForm, prenom: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Email</label>
            <input type="email" style={inputStyle} value={parentForm.email} onChange={(e) => setParentForm({ ...parentForm, email: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Téléphone</label>
            <input style={inputStyle} value={parentForm.telephone} onChange={(e) => setParentForm({ ...parentForm, telephone: e.target.value })} />
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Inscriptions;
