import { useEffect, useState, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAxios } from '../../hooks/useAxios';
import { PageHeader, Button, Badge, DataTable, Modal } from '../../components/ui';
import { ClipboardEdit, Save, Plus } from 'lucide-react';
import toast from 'react-hot-toast';

const TYPE_EVAL = {
  devoir: 'Devoir',
  interrogation: 'Interrogation',
  examen: 'Examen',
  rattrapage: 'Rattrapage',
  pratique: 'Pratique',
};

const SaisieNotes = () => {
  const { get, post } = useAxios();
  const [searchParams, setSearchParams] = useSearchParams();
  const [evaluations, setEvaluations] = useState([]);
  const [classes, setClasses] = useState([]);
  const [periodes, setPeriodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEval, setSelectedEval] = useState(null);
  const [eleves, setEleves] = useState([]);
  const [notes, setNotes] = useState({});
  const [saving, setSaving] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    classeId: '',
    matiereId: '',
    anneeScolaireId: '',
    periodeIndex: 1,
    nom: '',
    type: 'devoir',
    dateEvaluation: new Date().toISOString().split('T')[0],
    coefficient: 1,
    noteMaximale: 20,
  });

  const filterClasseId = searchParams.get('classeId') || '';

  const fetchEvaluations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await get('/api/enseignant/evaluations');
      setEvaluations(res?.data || res || []);
    } catch { /* silent */ }
    setLoading(false);
  }, [get]);

  const fetchClasses = useCallback(async () => {
    try {
      const res = await get('/api/enseignant/mes-classes', { silent: true });
      setClasses(res?.data || res || []);
    } catch { /* silent */ }
  }, [get]);

  useEffect(() => {
    fetchEvaluations();
    fetchClasses();
  }, [fetchEvaluations, fetchClasses]);

  const selectedClasse = useMemo(
    () => classes.find((c) => c.id === (form.classeId || filterClasseId)),
    [classes, form.classeId, filterClasseId]
  );

  useEffect(() => {
    (async () => {
      const anneeId = selectedClasse?.anneeScolaireId;
      if (!anneeId) {
        setPeriodes([]);
        return;
      }
      try {
        const qs = new URLSearchParams({ anneeScolaireId: anneeId });
        if (selectedClasse?.cycle) qs.set('cycle', selectedClasse.cycle);
        const res = await get(`/api/referentiel/periodes?${qs}`, { silent: true });
        const list = res?.data || res || [];
        setPeriodes(list);
        if (list.length) {
          setForm((f) => {
            if (list.some((p) => String(p.index) === String(f.periodeIndex))) return f;
            return { ...f, periodeIndex: list[0].index };
          });
        }
      } catch {
        setPeriodes([]);
      }
    })();
  }, [selectedClasse?.anneeScolaireId, selectedClasse?.cycle, get]);

  const openCreate = useCallback((prefillClasseId = '') => {
    const classe = classes.find((c) => c.id === (prefillClasseId || filterClasseId)) || classes[0];
    const matieres = classe?.matieres || [];
    setForm({
      classeId: classe?.id || '',
      matiereId: matieres[0]?.id || '',
      anneeScolaireId: classe?.anneeScolaireId || '',
      periodeIndex: periodes[0]?.index || 1,
      nom: '',
      type: 'devoir',
      dateEvaluation: new Date().toISOString().split('T')[0],
      coefficient: 1,
      noteMaximale: 20,
    });
    setCreateOpen(true);
  }, [classes, filterClasseId, periodes]);

  useEffect(() => {
    if (searchParams.get('nouveau') === '1' && classes.length) {
      openCreate(filterClasseId);
      const next = new URLSearchParams(searchParams);
      next.delete('nouveau');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, classes.length, filterClasseId, openCreate, setSearchParams]);

  const displayed = useMemo(() => {
    if (!filterClasseId) return evaluations;
    return evaluations.filter((e) => e.classeId === filterClasseId || e.classeNom === classes.find((c) => c.id === filterClasseId)?.nom);
  }, [evaluations, filterClasseId, classes]);

  const [saisieOuverte, setSaisieOuverte] = useState(true);

  const openSaisie = async (evaluation) => {
    setSelectedEval(evaluation);
    try {
      const res = await get(`/api/evaluations/${evaluation.id}/notes`, { silent: true });
      const notesData = res?.data || (Array.isArray(res) ? res : []);
      setSaisieOuverte(res?.saisieNotesOuverte !== false);
      const notesMap = {};
      notesData.forEach((n) => { notesMap[n.eleveId] = n.valeur != null ? String(n.valeur) : ''; });
      setNotes(notesMap);
      setEleves(notesData);
    } catch { setEleves([]); }
  };

  const handleNoteChange = (eleveId, value) => {
    setNotes({ ...notes, [eleveId]: value });
  };

  const handleSave = async () => {
    if (!saisieOuverte) {
      toast.error('Saisie des notes fermée par la direction');
      return;
    }
    setSaving(true);
    try {
      const max = Number(selectedEval?.noteMaximale || 20);
      const payload = Object.entries(notes)
        .filter(([, v]) => v !== '')
        .map(([eleveId, valeur]) => {
          const n = parseFloat(valeur);
          return { eleveId, valeur: Math.min(max, Math.max(0, n)) };
        });
      await post(`/api/evaluations/${selectedEval.id}/notes`, { notes: payload });
      toast.success('Notes enregistrées avec succès');
      setSelectedEval(null);
      fetchEvaluations();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Erreur lors de l’enregistrement');
    }
    setSaving(false);
  };

  const handleCreate = async (saisirApres = false) => {
    if (!form.classeId || !form.matiereId || !form.nom || !form.anneeScolaireId) {
      toast.error('Classe, matière, nom et année sont requis');
      return;
    }
    setCreating(true);
    try {
      const created = await post('/api/evaluations', {
        ...form,
        periodeIndex: parseInt(form.periodeIndex, 10),
        coefficient: parseInt(form.coefficient, 10) || 1,
        noteMaximale: parseFloat(form.noteMaximale) || 20,
        dateEvaluation: form.dateEvaluation,
      });
      setCreateOpen(false);
      toast.success('Évaluation programmée');
      await fetchEvaluations();
      if (saisirApres && created?.id) {
        const classe = classes.find((c) => c.id === form.classeId);
        const matiere = (classe?.matieres || []).find((m) => m.id === form.matiereId);
        await openSaisie({
          ...created,
          classeNom: classe?.nom,
          matiereNom: matiere?.nom,
        });
      }
    } catch { /* silent */ }
    setCreating(false);
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

  const noteInputStyle = {
    width: 80,
    height: 36,
    background: 'var(--surface-overlay)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)',
    fontSize: 14,
    padding: '0 8px',
    textAlign: 'center',
  };

  const matieresOfForm = classes.find((c) => c.id === form.classeId)?.matieres || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Saisie des notes"
        subtitle="Programmer un devoir et saisir les notes par classe"
        actions={<Button icon={Plus} onClick={() => openCreate(filterClasseId)}>Programmer un devoir</Button>}
      />

      {filterClasseId && (
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Filtré sur {classes.find((c) => c.id === filterClasseId)?.nom || 'la classe'} —{' '}
          <button type="button" className="underline" onClick={() => setSearchParams({})}>voir toutes</button>
        </p>
      )}

      <DataTable
        columns={[
          { key: 'nom', label: 'Évaluation', render: (v) => <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{v}</span> },
          { key: 'matiereNom', label: 'Matière', render: (v) => <Badge variant="info">{v}</Badge> },
          { key: 'classeNom', label: 'Classe', render: (v) => <span style={{ color: 'var(--text-secondary)' }}>{v}</span> },
          { key: 'dateEvaluation', label: 'Date', render: (v) => <span style={{ color: 'var(--text-muted)' }}>{new Date(v).toLocaleDateString('fr-FR')}</span> },
          { key: 'noteMaximale', label: 'Barème', render: (v) => <span className="font-mono" style={{ color: 'var(--text-secondary)' }}>/{v}</span> },
          { key: 'statut', label: 'Statut', render: (v) => <Badge variant={v === 'saisie_terminee' ? 'success' : 'warning'}>{v === 'saisie_terminee' ? 'Terminée' : 'En attente'}</Badge> },
          {
            key: 'actions',
            label: 'Actions',
            render: (_, row) => row.statut !== 'saisie_terminee' ? (
              <Button size="sm" icon={ClipboardEdit} onClick={() => openSaisie(row)}>Saisir</Button>
            ) : <Button size="sm" variant="secondary" onClick={() => openSaisie(row)}>Voir</Button>,
          },
        ]}
        data={displayed}
        loading={loading}
        emptyMessage="Aucune évaluation — programmez un devoir pour commencer"
      />

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Programmer un devoir / une évaluation"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>Annuler</Button>
            <Button variant="secondary" onClick={() => handleCreate(true)} loading={creating} disabled={!form.nom || !form.classeId || !form.matiereId}>
              Créer et saisir
            </Button>
            <Button onClick={() => handleCreate(false)} loading={creating} disabled={!form.nom || !form.classeId || !form.matiereId}>
              Programmer
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Classe</label>
              <select
                style={inputStyle}
                value={form.classeId}
                onChange={(e) => {
                  const cl = classes.find((c) => c.id === e.target.value);
                  setForm({
                    ...form,
                    classeId: e.target.value,
                    anneeScolaireId: cl?.anneeScolaireId || '',
                    matiereId: cl?.matieres?.[0]?.id || '',
                  });
                }}
              >
                <option value="">Sélectionner</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Matière</label>
              <select style={inputStyle} value={form.matiereId} onChange={(e) => setForm({ ...form, matiereId: e.target.value })}>
                <option value="">Sélectionner</option>
                {matieresOfForm.map((m) => <option key={m.id} value={m.id}>{m.nom}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Nom</label>
            <input style={inputStyle} value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} placeholder="ex: Devoir de table n°1" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Type</label>
              <select style={inputStyle} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                {Object.entries(TYPE_EVAL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Date</label>
              <input type="date" style={inputStyle} value={form.dateEvaluation} onChange={(e) => setForm({ ...form, dateEvaluation: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Période</label>
              <select style={inputStyle} value={form.periodeIndex} onChange={(e) => setForm({ ...form, periodeIndex: parseInt(e.target.value, 10) })}>
                {periodes.length === 0 && <option value={1}>Période 1</option>}
                {periodes.map((p) => <option key={p.id || p.index} value={p.index}>{p.libelle}</option>)}
              </select>
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        open={!!selectedEval}
        onClose={() => setSelectedEval(null)}
        title={selectedEval?.nom || 'Saisie des notes'}
        subtitle={`${selectedEval?.classeNom || ''} · ${selectedEval?.matiereNom || ''} · /${selectedEval?.noteMaximale}`}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setSelectedEval(null)}>Fermer</Button>
            <Button icon={Save} onClick={handleSave} loading={saving} disabled={!saisieOuverte}>
              Enregistrer
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {!saisieOuverte && (
            <div
              className="p-3 rounded-xl text-sm font-medium flex items-center gap-2 border"
              style={{
                background: 'rgba(239, 68, 68, 0.1)',
                borderColor: 'var(--color-danger, #ef4444)',
                color: 'var(--color-danger, #ef4444)',
              }}
            >
              <span>⛔</span>
              <span>La saisie des notes est actuellement fermée par la direction de l'établissement.</span>
            </div>
          )}

          {saisieOuverte && (
            <div
              className="p-2.5 rounded-lg text-xs flex items-center gap-2 border"
              style={{
                background: 'var(--surface-raised)',
                borderColor: 'var(--border-subtle)',
                color: 'var(--text-secondary)',
              }}
            >
              <span>ℹ️</span>
              <span>Règle anti-fraude : vous disposez d'un délai de <strong>2 heures</strong> après la première saisie pour modifier une note. Au-delà, seul le Directeur peut intervenir.</span>
            </div>
          )}

          {eleves.map((eleve) => (
            <div
              key={eleve.eleveId}
              className="flex items-center justify-between p-3 rounded-lg"
              style={{
                background: eleve.verrouillee ? 'var(--surface-hover)' : 'var(--surface-overlay)',
                opacity: eleve.verrouillee ? 0.8 : 1,
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                  style={{ background: 'color-mix(in srgb, var(--color-primary) 15%, transparent)', color: 'var(--color-primary)' }}
                >
                  {eleve.elevePrenom?.[0]}{eleve.eleveNom?.[0]}
                </div>
                <div>
                  <span className="text-sm font-medium block" style={{ color: 'var(--text-primary)' }}>
                    {eleve.elevePrenom} {eleve.eleveNom}
                  </span>
                  {eleve.verrouillee && (
                    <span className="text-[11px] font-medium" style={{ color: 'var(--color-warning, #f59e0b)' }}>
                      🔒 Verrouillé (&gt; 2h)
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.25"
                  min="0"
                  max={selectedEval?.noteMaximale || 20}
                  style={{
                    ...noteInputStyle,
                    ...(eleve.verrouillee || !saisieOuverte ? { opacity: 0.6, cursor: 'not-allowed' } : {}),
                  }}
                  disabled={eleve.verrouillee || !saisieOuverte}
                  value={notes[eleve.eleveId] || ''}
                  onChange={(e) => handleNoteChange(eleve.eleveId, e.target.value)}
                  placeholder="—"
                />
                <span className="text-sm" style={{ color: 'var(--text-muted)' }}>/{selectedEval?.noteMaximale || 20}</span>
              </div>
            </div>
          ))}
          {eleves.length === 0 && (
            <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>Aucun élève</p>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default SaisieNotes;
