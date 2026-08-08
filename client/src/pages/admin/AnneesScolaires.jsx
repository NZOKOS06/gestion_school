import { useEffect, useState, useCallback } from 'react';
import { useAxios } from '../../hooks/useAxios';
import { PageHeader, Card, Badge, Button, Modal } from '../../components/ui';
import { CalendarRange, Plus, Save } from 'lucide-react';

const CYCLES_OPTS = [
  { value: 'prescolaire', label: 'Préscolaire' },
  { value: 'primaire', label: 'Primaire' },
  { value: 'college', label: 'Collège' },
  { value: 'lycee', label: 'Lycée' },
];

const emptyPeriode = (index) => ({
  index,
  libelle: index === 1 ? '1er trimestre' : `${index}e trimestre`,
  dateDebut: '',
  dateFin: '',
  dateEvaluationDebut: '',
  dateEvaluationFin: '',
  poids: 1,
  concerneCycles: [],
});

const AnneesScolaires = () => {
  const { get, post, put } = useAxios();
  const [annees, setAnnees] = useState([]);
  const [versions, setVersions] = useState([]);
  const [selected, setSelected] = useState(null);
  const [periodes, setPeriodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ libelle: '', dateDebut: '', dateFin: '', referentielVersionId: '' });

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

  const fetchAnnees = useCallback(async () => {
    setLoading(true);
    try {
      const [an, ver] = await Promise.all([
        get('/api/annees-scolaires', { silent: true }),
        get('/api/referentiel/versions', { silent: true }),
      ]);
      const list = an?.data || an || [];
      setAnnees(list);
      setVersions(ver?.data || ver || []);
      const active = list.find((a) => a.actif) || list[0];
      if (active) {
        setSelected(active);
        setPeriodes(active.periodes?.length ? active.periodes.map((p) => ({
          ...p,
          dateDebut: p.dateDebut?.slice?.(0, 10) || p.dateDebut,
          dateFin: p.dateFin?.slice?.(0, 10) || p.dateFin,
          dateEvaluationDebut: p.dateEvaluationDebut?.slice?.(0, 10) || '',
          dateEvaluationFin: p.dateEvaluationFin?.slice?.(0, 10) || '',
          concerneCycles: Array.isArray(p.concerneCycles) ? p.concerneCycles : [],
        })) : [emptyPeriode(1), emptyPeriode(2), emptyPeriode(3)]);
      }
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAnnees(); }, [fetchAnnees]);

  const selectAnnee = (annee) => {
    setSelected(annee);
    setPeriodes(annee.periodes?.length ? annee.periodes.map((p) => ({
      ...p,
      dateDebut: typeof p.dateDebut === 'string' ? p.dateDebut.slice(0, 10) : new Date(p.dateDebut).toISOString().slice(0, 10),
      dateFin: typeof p.dateFin === 'string' ? p.dateFin.slice(0, 10) : new Date(p.dateFin).toISOString().slice(0, 10),
      dateEvaluationDebut: p.dateEvaluationDebut
        ? (typeof p.dateEvaluationDebut === 'string' ? p.dateEvaluationDebut.slice(0, 10) : new Date(p.dateEvaluationDebut).toISOString().slice(0, 10))
        : '',
      dateEvaluationFin: p.dateEvaluationFin
        ? (typeof p.dateEvaluationFin === 'string' ? p.dateEvaluationFin.slice(0, 10) : new Date(p.dateEvaluationFin).toISOString().slice(0, 10))
        : '',
      concerneCycles: Array.isArray(p.concerneCycles) ? p.concerneCycles : [],
    })) : [emptyPeriode(1), emptyPeriode(2), emptyPeriode(3)]);
  };

  const savePeriodes = async () => {
    if (!selected) return;
    try {
      for (const p of periodes) {
        if (!p.dateDebut || !p.dateFin || !p.libelle) continue;
        await post('/api/referentiel/periodes', {
          id: p.id,
          anneeScolaireId: selected.id,
          index: p.index,
          libelle: p.libelle,
          dateDebut: p.dateDebut,
          dateFin: p.dateFin,
          dateEvaluationDebut: p.dateEvaluationDebut || null,
          dateEvaluationFin: p.dateEvaluationFin || null,
          poids: p.poids,
          concerneCycles: Array.isArray(p.concerneCycles) && p.concerneCycles.length ? p.concerneCycles : null,
        });
      }
      fetchAnnees();
    } catch { /* silent */ }
  };

  const toggleCycle = (idx, cycle) => {
    const next = [...periodes];
    const p = next[idx];
    const set = new Set(p.concerneCycles || []);
    if (set.has(cycle)) set.delete(cycle);
    else set.add(cycle);
    next[idx] = { ...p, concerneCycles: [...set] };
    setPeriodes(next);
  };

  const handleCreate = async () => {
    try {
      await post('/api/annees-scolaires', form);
      setCreateOpen(false);
      setForm({ libelle: '', dateDebut: '', dateFin: '', referentielVersionId: '' });
      fetchAnnees();
    } catch { /* silent */ }
  };

  const activate = async (id) => {
    try {
      await put(`/api/annees-scolaires/${id}/activate`, {});
      fetchAnnees();
    } catch { /* silent */ }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Années scolaires & périodes"
        subtitle="Référentiel Congo — trimestres datés par année"
        actions={<Button icon={Plus} onClick={() => setCreateOpen(true)}>Nouvelle année</Button>}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-1 p-4 space-y-2">
          <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Années</h3>
          {loading ? <p style={{ color: 'var(--text-muted)' }}>Chargement…</p> : annees.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => selectAnnee(a)}
              className="w-full text-left px-3 py-2 rounded-lg text-sm"
              style={{
                background: selected?.id === a.id ? 'var(--color-primary)' : 'var(--surface-overlay)',
                color: selected?.id === a.id ? '#fff' : 'var(--text-primary)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <span>{a.libelle}</span>
                {a.actif && <Badge variant="success">Active</Badge>}
              </div>
              {a.referentielVersion && (
                <p className="text-xs opacity-80 mt-0.5">{a.referentielVersion.libelle}</p>
              )}
            </button>
          ))}
        </Card>

        <Card className="lg:col-span-2 p-4 space-y-4">
          {!selected ? (
            <p style={{ color: 'var(--text-muted)' }}>Sélectionnez une année</p>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                    <CalendarRange className="inline h-4 w-4 mr-1" />
                    Périodes — {selected.libelle}
                  </h3>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    Trimestres (collège/lycée) et/ou compositions mensuelles (préscolaire/primaire)
                  </p>
                </div>
                <div className="flex gap-2">
                  {!selected.actif && (
                    <Button variant="secondary" onClick={() => activate(selected.id)}>Activer</Button>
                  )}
                  <Button icon={Save} onClick={savePeriodes}>Enregistrer périodes</Button>
                </div>
              </div>

              {periodes.map((p, idx) => (
                <div key={p.id || p.index || idx} className="rounded-lg p-3 space-y-2" style={{ border: '1px solid var(--border-subtle)' }}>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Libellé</label>
                      <input
                        style={inputStyle}
                        value={p.libelle}
                        onChange={(e) => {
                          const next = [...periodes];
                          next[idx] = { ...p, libelle: e.target.value };
                          setPeriodes(next);
                        }}
                      />
                    </div>
                    <div>
                      <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Index</label>
                      <input style={inputStyle} value={p.index} disabled />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {[
                      ['dateDebut', 'Début'],
                      ['dateFin', 'Fin'],
                      ['dateEvaluationDebut', 'Éval. début'],
                      ['dateEvaluationFin', 'Éval. fin'],
                    ].map(([key, label]) => (
                      <div key={key}>
                        <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>{label}</label>
                        <input
                          type="date"
                          style={inputStyle}
                          value={p[key] || ''}
                          onChange={(e) => {
                            const next = [...periodes];
                            next[idx] = { ...p, [key]: e.target.value };
                            setPeriodes(next);
                          }}
                        />
                      </div>
                    ))}
                  </div>
                  <div>
                    <label className="block text-xs mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                      Cycles concernés <span style={{ color: 'var(--text-muted)' }}>(vide = tous)</span>
                    </label>
                    <div className="flex flex-wrap gap-3">
                      {CYCLES_OPTS.map((c) => (
                        <label key={c.value} className="flex items-center gap-1.5 text-xs cursor-pointer" style={{ color: 'var(--text-primary)' }}>
                          <input
                            type="checkbox"
                            checked={(p.concerneCycles || []).includes(c.value)}
                            onChange={() => toggleCycle(idx, c.value)}
                          />
                          {c.label}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}
        </Card>
      </div>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Nouvelle année scolaire"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>Annuler</Button>
            <Button onClick={handleCreate} disabled={!form.libelle || !form.dateDebut || !form.dateFin}>Créer</Button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Libellé</label>
            <input style={inputStyle} placeholder="2026-2027" value={form.libelle} onChange={(e) => setForm({ ...form, libelle: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Début</label>
              <input type="date" style={inputStyle} value={form.dateDebut} onChange={(e) => setForm({ ...form, dateDebut: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Fin</label>
              <input type="date" style={inputStyle} value={form.dateFin} onChange={(e) => setForm({ ...form, dateFin: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Version du référentiel</label>
            <select
              style={{ ...inputStyle, appearance: 'auto' }}
              value={form.referentielVersionId}
              onChange={(e) => setForm({ ...form, referentielVersionId: e.target.value })}
            >
              <option value="">Version active par défaut</option>
              {versions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.libelle} ({v.code}){v.actif ? ' — actif' : ''}
                </option>
              ))}
            </select>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              Pour une réforme, choisissez une nouvelle version à l’ouverture de l’année — jamais sur une année close.
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default AnneesScolaires;
