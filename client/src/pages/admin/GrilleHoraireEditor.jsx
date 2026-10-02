import { useEffect, useState } from 'react';
import { Button, Modal } from '../../components/ui';
import { Plus, Trash2, Wand2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { toMinutes } from '../../components/EmploiGrid.jsx';

const CYCLE_LABELS = {
  prescolaire: 'Préscolaire',
  primaire: 'Primaire',
  college: 'Collège',
  lycee: 'Lycée',
};

const TYPES = [
  { value: 'cours', label: 'Cours' },
  { value: 'recreation', label: 'Récréation' },
  { value: 'pause', label: 'Pause' },
];

const fromMinutes = (t) => `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;

/** Génère une journée type : N cours de X min, récréation après K cours. */
function genererGrille({ debut, dureeCours, nbCours, interCours, recreApres, dureeRecre }) {
  let t = toMinutes(debut);
  if (t === null) return [];
  const rows = [];
  for (let i = 1; i <= nbCours; i += 1) {
    rows.push({ heureDebut: fromMinutes(t), heureFin: fromMinutes(t + dureeCours), type: 'cours', libelle: '' });
    t += dureeCours;
    if (recreApres > 0 && i === recreApres && i < nbCours && dureeRecre > 0) {
      rows.push({ heureDebut: fromMinutes(t), heureFin: fromMinutes(t + dureeRecre), type: 'recreation', libelle: 'Récréation' });
      t += dureeRecre;
    } else if (i < nbCours && interCours > 0) {
      t += interCours;
    }
  }
  return rows.filter((r) => toMinutes(r.heureFin) < 24 * 60);
}

export default function GrilleHoraireEditor({ open, onClose, get, put, cycles = [], defaultCycle = '', onSaved }) {
  const [cycle, setCycle] = useState(defaultCycle || '');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [gen, setGen] = useState({ debut: '07:30', dureeCours: 55, nbCours: 6, interCours: 0, recreApres: 3, dureeRecre: 20 });

  useEffect(() => {
    if (open) setCycle(defaultCycle || '');
  }, [open, defaultCycle]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams({ strict: '1' });
    if (cycle) params.set('cycle', cycle);
    get(`/api/emplois-du-temps/creneaux?${params.toString()}`, { silent: true })
      .then((res) => {
        if (cancelled) return;
        setRows((res?.data || []).map((c) => ({
          heureDebut: c.heureDebut, heureFin: c.heureFin, type: c.type || 'cours', libelle: c.libelle || '',
        })));
      })
      .catch(() => { if (!cancelled) setRows([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, cycle, get]);

  const updateRow = (i, patch) => setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const removeRow = (i) => setRows((prev) => prev.filter((_, idx) => idx !== i));
  const addRow = () => setRows((prev) => {
    const last = prev[prev.length - 1];
    const start = last ? toMinutes(last.heureFin) : toMinutes('07:30');
    return [...prev, { heureDebut: fromMinutes(start), heureFin: fromMinutes(Math.min(start + 55, 23 * 60 + 59)), type: 'cours', libelle: '' }];
  });

  const generer = () => {
    const out = genererGrille({
      debut: gen.debut,
      dureeCours: Math.max(5, parseInt(gen.dureeCours, 10) || 55),
      nbCours: Math.min(14, Math.max(1, parseInt(gen.nbCours, 10) || 6)),
      interCours: Math.max(0, parseInt(gen.interCours, 10) || 0),
      recreApres: Math.max(0, parseInt(gen.recreApres, 10) || 0),
      dureeRecre: Math.max(0, parseInt(gen.dureeRecre, 10) || 0),
    });
    if (!out.length) {
      toast.error('Heure de début invalide');
      return;
    }
    setRows(out);
  };

  const save = async () => {
    setSaving(true);
    try {
      await put('/api/emplois-du-temps/creneaux', { cycle: cycle || null, creneaux: rows });
      toast.success(rows.length ? 'Grille horaire enregistrée' : 'Grille supprimée');
      onSaved?.();
      onClose();
    } catch { /* toast via useAxios */ }
    setSaving(false);
  };

  const input = 'w-full px-2 py-1.5 border rounded-md text-sm bg-[var(--surface-overlay)]';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Grille horaire"
      subtitle="Créneaux de cours, récréations et pauses (à la minute près)"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button onClick={save} loading={saving}>Enregistrer</Button>
        </>
      }
    >
      <div className="space-y-5">
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>S'applique à</label>
          <select className={input} value={cycle} onChange={(e) => setCycle(e.target.value)}>
            <option value="">Tous les cycles (grille commune)</option>
            {cycles.map((c) => <option key={c} value={c}>{CYCLE_LABELS[c] || c} uniquement</option>)}
          </select>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            Une grille propre à un cycle remplace la grille commune pour les classes de ce cycle. Une grille vide revient à la grille commune.
          </p>
        </div>

        <div className="rounded-lg p-3 space-y-2" style={{ background: 'var(--surface-overlay)', border: '1px solid var(--border-subtle)' }}>
          <p className="text-xs font-semibold flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
            <Wand2 className="h-3.5 w-3.5" /> Générer une journée type
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
            {[
              { key: 'debut', label: 'Début', type: 'time' },
              { key: 'dureeCours', label: 'Durée d\'un cours (min)', type: 'number' },
              { key: 'nbCours', label: 'Nombre de cours', type: 'number' },
              { key: 'interCours', label: 'Intercours (min)', type: 'number' },
              { key: 'recreApres', label: 'Récréation après le cours n°', type: 'number' },
              { key: 'dureeRecre', label: 'Durée récréation (min)', type: 'number' },
            ].map((f) => (
              <label key={f.key} className="block">
                <span className="block mb-1" style={{ color: 'var(--text-muted)' }}>{f.label}</span>
                <input type={f.type} min="0" className={input} value={gen[f.key]} onChange={(e) => setGen({ ...gen, [f.key]: e.target.value })} />
              </label>
            ))}
          </div>
          <Button size="sm" variant="secondary" icon={Wand2} onClick={generer}>Générer (remplace la liste)</Button>
        </div>

        <div className="space-y-2">
          {loading ? (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Chargement…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Aucun créneau. Générez une journée type ou ajoutez des lignes.</p>
          ) : (
            rows.map((r, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-center">
                <input type="time" className={`${input} col-span-3`} value={r.heureDebut} onChange={(e) => updateRow(i, { heureDebut: e.target.value })} />
                <input type="time" className={`${input} col-span-3`} value={r.heureFin} onChange={(e) => updateRow(i, { heureFin: e.target.value })} />
                <select className={`${input} col-span-2`} value={r.type} onChange={(e) => updateRow(i, { type: e.target.value })}>
                  {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <input
                  className={`${input} col-span-3`}
                  placeholder={r.type === 'cours' ? `Cours ${i + 1}` : 'Libellé'}
                  value={r.libelle}
                  onChange={(e) => updateRow(i, { libelle: e.target.value })}
                />
                <button type="button" className="col-span-1 p-1.5 rounded-md hover:bg-[var(--surface-hover)] flex justify-center" onClick={() => removeRow(i)} title="Supprimer">
                  <Trash2 className="h-4 w-4" style={{ color: 'var(--color-danger)' }} />
                </button>
              </div>
            ))
          )}
          <Button size="sm" variant="secondary" icon={Plus} onClick={addRow}>Ajouter un créneau</Button>
        </div>
      </div>
    </Modal>
  );
}
