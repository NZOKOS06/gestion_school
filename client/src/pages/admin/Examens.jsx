import { useEffect, useState, useCallback } from 'react';
import { useAxios } from '../../hooks/useAxios';
import { PageHeader, DataTable, Badge, Button, Modal } from '../../components/ui';
import { Award, Plus } from 'lucide-react';

const TYPE_LABELS = {
  CEPE: 'CEPE',
  BEPC: 'BEPC',
  BAC_GENERAL: 'BAC Général',
  BAC_TECHNIQUE: 'BAC Technique',
  CAP: 'CAP',
  BEP: 'BEP',
  BTS: 'BTS',
  CONCOURS_6E: 'Concours 6e',
  AUTRE: 'Autre',
};

const STATUT_VARIANT = {
  admis: 'success',
  ajourne: 'warning',
  refuse: 'danger',
  en_attente: 'neutral',
};

const Examens = () => {
  const { get, post, put } = useAxios();
  const [sessions, setSessions] = useState([]);
  const [annees, setAnnees] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [candidatures, setCandidatures] = useState([]);
  const [eleves, setEleves] = useState([]);
  const [filterClasseId, setFilterClasseId] = useState('');
  const [form, setForm] = useState({
    anneeScolaireId: '', typeExamen: 'CEPE', libelle: '', dateDebut: '', dateFin: '', centre: '', classeId: '',
  });
  const [candForm, setCandForm] = useState({ eleveId: '', serieFiliere: '' });
  const [resultForm, setResultForm] = useState({ candidatureId: '', statut: 'admis', mention: '', moyenne: '' });
  const [enrolling, setEnrolling] = useState(false);

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

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await get('/api/examens/sessions', { silent: true });
      setSessions(res?.data || res || []);
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchSessions();
    (async () => {
      try {
        const [an, cl] = await Promise.all([
          get('/api/annees-scolaires', { silent: true }),
          get('/api/classes?limit=200', { silent: true }),
        ]);
        const list = an?.data || an || [];
        setAnnees(list);
        setClasses(cl?.data || cl || []);
        const active = list.find((a) => a.actif);
        if (active) setForm((f) => ({ ...f, anneeScolaireId: active.id }));
      } catch { /* silent */ }
    })();
  }, [fetchSessions]);

  const loadElevesForClasse = async (classeId, anneeScolaireId) => {
    if (!classeId) {
      setEleves([]);
      return;
    }
    try {
      const qs = new URLSearchParams({ limit: '500', classe: classeId });
      if (anneeScolaireId) qs.set('anneeScolaireId', anneeScolaireId);
      const els = await get(`/api/eleves?${qs}`, { silent: true });
      setEleves(els?.data || els || []);
    } catch {
      setEleves([]);
    }
  };

  const openDetail = async (session, preferredClasseId = '') => {
    setDetail(session);
    const classeId = preferredClasseId || filterClasseId || '';
    setFilterClasseId(classeId);
    try {
      const cands = await get(`/api/examens/sessions/${session.id}/candidatures`, { silent: true });
      setCandidatures(cands?.data || cands || []);
      if (classeId) {
        await loadElevesForClasse(classeId, session.anneeScolaireId);
      } else {
        setEleves([]);
      }
    } catch { /* silent */ }
  };

  const handleCreate = async () => {
    try {
      const { classeId, ...payload } = form;
      const session = await post('/api/examens/sessions', payload);
      setCreateOpen(false);
      await fetchSessions();
      if (classeId && session?.id) {
        setFilterClasseId(classeId);
        await openDetail(session, classeId);
        // Inscrire toute la classe
        setEnrolling(true);
        try {
          const qs = new URLSearchParams({ limit: '500', classe: classeId });
          if (form.anneeScolaireId) qs.set('anneeScolaireId', form.anneeScolaireId);
          const els = await get(`/api/eleves?${qs}`, { silent: true });
          const list = els?.data || els || [];
          let n = 0;
          for (const el of list) {
            try {
              await post(`/api/examens/sessions/${session.id}/candidatures`, { eleveId: el.id });
              n += 1;
            } catch { /* déjà inscrit */ }
          }
          if (n) {
            const cands = await get(`/api/examens/sessions/${session.id}/candidatures`, { silent: true });
            setCandidatures(cands?.data || cands || []);
          }
        } finally {
          setEnrolling(false);
        }
      }
      setForm((f) => ({ ...f, libelle: '', classeId: '', centre: '' }));
    } catch { /* silent */ }
  };

  const addCandidat = async () => {
    if (!detail || !candForm.eleveId) return;
    try {
      await post(`/api/examens/sessions/${detail.id}/candidatures`, candForm);
      setCandForm({ eleveId: '', serieFiliere: '' });
      openDetail(detail, filterClasseId);
    } catch { /* silent */ }
  };

  const enrollWholeClass = async () => {
    if (!detail || !filterClasseId) return;
    setEnrolling(true);
    try {
      let n = 0;
      for (const el of eleves) {
        try {
          await post(`/api/examens/sessions/${detail.id}/candidatures`, { eleveId: el.id });
          n += 1;
        } catch { /* skip */ }
      }
      void n;
      const cands = await get(`/api/examens/sessions/${detail.id}/candidatures`, { silent: true });
      setCandidatures(cands?.data || cands || []);
    } finally {
      setEnrolling(false);
    }
  };

  const elevesDisponibles = eleves.filter(
    (e) => !candidatures.some((c) => c.eleveId === e.id)
  );

  const saveResultat = async () => {
    if (!resultForm.candidatureId) return;
    try {
      await put(`/api/examens/candidatures/${resultForm.candidatureId}/resultat`, {
        statut: resultForm.statut,
        mention: resultForm.mention || null,
        moyenne: resultForm.moyenne || null,
      });
      setResultForm({ candidatureId: '', statut: 'admis', mention: '', moyenne: '' });
      openDetail(detail);
    } catch { /* silent */ }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Examens nationaux"
        subtitle="CEPE, BEPC, BAC et autres sessions"
        actions={<Button icon={Plus} onClick={() => setCreateOpen(true)}>Nouvelle session</Button>}
      />

      <DataTable
        columns={[
          { key: 'libelle', label: 'Session', render: (v) => <span style={{ color: 'var(--text-primary)' }}>{v}</span> },
          {
            key: 'typeExamen',
            label: 'Type',
            render: (v) => <Badge variant="info">{TYPE_LABELS[v] || v}</Badge>,
          },
          {
            key: 'anneeScolaire',
            label: 'Année',
            render: (_, row) => row.anneeScolaire?.libelle || '—',
          },
          {
            key: '_count',
            label: 'Candidats',
            render: (v) => v?.candidatures ?? 0,
          },
          {
            key: 'actions',
            label: '',
            render: (_, row) => (
              <Button variant="secondary" onClick={() => openDetail(row)}>Gérer</Button>
            ),
          },
        ]}
        data={sessions}
        loading={loading}
        emptyMessage="Aucune session d'examen"
      />

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Nouvelle session" footer={
        <>
          <Button variant="secondary" onClick={() => setCreateOpen(false)}>Annuler</Button>
          <Button onClick={handleCreate} disabled={!form.libelle || !form.anneeScolaireId}>Créer</Button>
        </>
      }>
        <div className="space-y-3">
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Année</label>
            <select style={{ ...inputStyle, appearance: 'auto' }} value={form.anneeScolaireId} onChange={(e) => setForm({ ...form, anneeScolaireId: e.target.value })}>
              {annees.map((a) => <option key={a.id} value={a.id}>{a.libelle}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Type</label>
            <select style={{ ...inputStyle, appearance: 'auto' }} value={form.typeExamen} onChange={(e) => setForm({ ...form, typeExamen: e.target.value, libelle: form.libelle || `${TYPE_LABELS[e.target.value]} ${new Date().getFullYear()}` })}>
              {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Libellé</label>
            <input style={inputStyle} value={form.libelle} onChange={(e) => setForm({ ...form, libelle: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Classe concernée</label>
            <select style={{ ...inputStyle, appearance: 'auto' }} value={form.classeId} onChange={(e) => setForm({ ...form, classeId: e.target.value })}>
              <option value="">— Optionnel (filtrer les candidats) —</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              Si renseignée, les élèves de cette classe seront proposés / inscrits — pas ceux des autres classes.
            </p>
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Centre</label>
            <input style={inputStyle} value={form.centre} onChange={(e) => setForm({ ...form, centre: e.target.value })} placeholder="Brazzaville" />
          </div>
        </div>
      </Modal>

      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.libelle || 'Session'} size="xl">
        {detail && (
          <div className="space-y-4">
            {enrolling && <p className="text-sm" style={{ color: 'var(--color-primary)' }}>Inscription des candidats en cours…</p>}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Classe (filtre candidats)</label>
                <select
                  style={{ ...inputStyle, appearance: 'auto' }}
                  value={filterClasseId}
                  onChange={async (e) => {
                    const id = e.target.value;
                    setFilterClasseId(id);
                    setCandForm((f) => ({ ...f, eleveId: '' }));
                    await loadElevesForClasse(id, detail.anneeScolaireId);
                  }}
                >
                  <option value="">Sélectionner une classe…</option>
                  {classes.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
                </select>
              </div>
              <select style={{ ...inputStyle, appearance: 'auto' }} value={candForm.eleveId} onChange={(e) => setCandForm({ ...candForm, eleveId: e.target.value })} disabled={!filterClasseId}>
                <option value="">{filterClasseId ? 'Ajouter un candidat…' : 'Choisir d’abord une classe'}</option>
                {elevesDisponibles.map((e) => <option key={e.id} value={e.id}>{e.prenom} {e.nom}</option>)}
              </select>
              <input style={inputStyle} placeholder="Série / filière" value={candForm.serieFiliere} onChange={(e) => setCandForm({ ...candForm, serieFiliere: e.target.value })} />
              <div className="flex gap-2">
                <Button onClick={addCandidat} disabled={!candForm.eleveId}>Inscrire</Button>
                <Button variant="secondary" onClick={enrollWholeClass} disabled={!filterClasseId || !elevesDisponibles.length} loading={enrolling}>
                  Toute la classe
                </Button>
              </div>
            </div>

            <DataTable
              columns={[
                {
                  key: 'eleve',
                  label: 'Élève',
                  render: (_, r) => `${r.eleve?.prenom || ''} ${r.eleve?.nom || ''}`,
                },
                { key: 'serieFiliere', label: 'Série', render: (v) => v || '—' },
                {
                  key: 'resultat',
                  label: 'Résultat',
                  render: (v) => v ? <Badge variant={STATUT_VARIANT[v.statut] || 'neutral'}>{v.statut}</Badge> : '—',
                },
                {
                  key: 'actions',
                  label: 'Saisir résultat',
                  render: (_, r) => (
                    <Button variant="secondary" onClick={() => setResultForm({
                      candidatureId: r.id,
                      statut: r.resultat?.statut || 'admis',
                      mention: r.resultat?.mention || '',
                      moyenne: r.resultat?.moyenne || '',
                    })}>Résultat</Button>
                  ),
                },
              ]}
              data={candidatures}
              emptyMessage="Aucun candidat"
            />

            {resultForm.candidatureId && (
              <div className="rounded-lg p-3 space-y-2" style={{ border: '1px solid var(--border-subtle)' }}>
                <h4 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Résultat</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <select style={{ ...inputStyle, appearance: 'auto' }} value={resultForm.statut} onChange={(e) => setResultForm({ ...resultForm, statut: e.target.value })}>
                    <option value="admis">Admis</option>
                    <option value="ajourne">Ajourné</option>
                    <option value="refuse">Refusé</option>
                    <option value="en_attente">En attente</option>
                  </select>
                  <input style={inputStyle} placeholder="Mention" value={resultForm.mention} onChange={(e) => setResultForm({ ...resultForm, mention: e.target.value })} />
                  <input style={inputStyle} placeholder="Moyenne" value={resultForm.moyenne} onChange={(e) => setResultForm({ ...resultForm, moyenne: e.target.value })} />
                  <Button onClick={saveResultat} icon={Award}>Enregistrer</Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Examens;
