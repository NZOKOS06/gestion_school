import { useEffect, useState, useCallback, useMemo } from 'react';
import { useAxios } from '../../hooks/useAxios';
import { useAuth } from '../../contexts/AuthContext';
import { PageHeader, Button, Modal } from '../../components/ui';
import { Plus, AlertCircle, Clock, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import EmploiGrid, { JOURS_SEMAINE, toMinutes } from '../../components/EmploiGrid.jsx';
import GrilleHoraireEditor from './GrilleHoraireEditor.jsx';

const JOURS = JOURS_SEMAINE.slice(0, 6);
const WRITE_ROLES = ['directeur', 'directeur_etudes', 'secretaire'];

const normalizeCours = (c) => {
  const matiereNom = c.matiereNom || c.matiere?.nom || c.matiere?.code || '';
  const enseignantNom = c.enseignantNom
    || (c.enseignant ? `${c.enseignant.prenom || ''} ${c.enseignant.nom || ''}`.trim() : '');
  const salleNom = c.salleRef?.nom || c.salle || '';
  return { ...c, matiereNom, enseignantNom, salleNom };
};

const EMPTY_FORM = {
  id: null,
  jourSemaine: 1,
  creneauKey: '',
  heureDebut: '08:00',
  heureFin: '09:00',
  matiereId: '',
  enseignantId: '',
  salleId: '',
};

const EmploiDuTemps = () => {
  const { get, post, put, delete: del } = useAxios();
  const { user } = useAuth();
  const canWrite = WRITE_ROLES.includes(user?.role);

  const [classes, setClasses] = useState([]);
  const [selectedClasse, setSelectedClasse] = useState('');
  const [cours, setCours] = useState([]);
  const [grille, setGrille] = useState([]);
  const [grilleOpen, setGrilleOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [erreur, setErreur] = useState('');
  const [matieres, setMatieres] = useState([]);
  const [staff, setStaff] = useState([]);
  const [salles, setSalles] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    (async () => {
      try {
        const res = await get('/api/classes?limit=200', { silent: true });
        const data = res?.data || res || [];
        setClasses(data);
        if (data.length > 0) setSelectedClasse(data[0].id);
      } catch { /* silent */ }
    })();
  }, [get]);

  const selectedClasseObj = useMemo(
    () => classes.find((c) => c.id === selectedClasse),
    [classes, selectedClasse]
  );
  const cycle = selectedClasseObj?.cycle || '';
  const isPrimaryCycle = ['prescolaire', 'primaire'].includes(cycle);
  const cyclesEcole = useMemo(() => [...new Set(classes.map((c) => c.cycle).filter(Boolean))], [classes]);

  const fetchCours = useCallback(async () => {
    if (!selectedClasse) return;
    try {
      const res = await get(`/api/emplois-du-temps?classeId=${selectedClasse}`);
      setCours((res?.data || res || []).map(normalizeCours));
    } catch { /* silent */ }
  }, [selectedClasse, get]);

  const fetchGrille = useCallback(async () => {
    try {
      const qs = cycle ? `?cycle=${cycle}` : '';
      const res = await get(`/api/emplois-du-temps/creneaux${qs}`, { silent: true });
      setGrille(res?.data || []);
    } catch {
      setGrille([]);
    }
  }, [cycle, get]);

  useEffect(() => { fetchCours(); }, [fetchCours]);
  useEffect(() => { fetchGrille(); }, [fetchGrille]);

  const creneauxCours = useMemo(() => grille.filter((c) => c.type === 'cours'), [grille]);

  const loadReferentiels = async () => {
    if (matieres.length && salles.length) return;
    try {
      const [m, s, sa] = await Promise.all([
        get('/api/matieres', { silent: true }),
        get('/api/staff/enseignants', { silent: true }),
        get('/api/salles', { silent: true }),
      ]);
      setMatieres(m?.data || m || []);
      const staffList = Array.isArray(s) ? s : (s?.staff || s?.data || []);
      setStaff(staffList.filter((x) => x.actif !== false));
      setSalles(sa?.data || sa || []);
    } catch { /* silent */ }
  };

  const openForm = async (preset = {}) => {
    await loadReferentiels();
    const heureDebut = preset.heureDebut || creneauxCours[0]?.heureDebut || EMPTY_FORM.heureDebut;
    const heureFin = preset.heureFin || creneauxCours[0]?.heureFin || EMPTY_FORM.heureFin;
    const match = creneauxCours.find((c) => c.heureDebut === heureDebut && c.heureFin === heureFin);
    setForm({
      ...EMPTY_FORM,
      ...preset,
      heureDebut,
      heureFin,
      creneauKey: match ? `${match.heureDebut}-${match.heureFin}` : '',
    });
    setErreur('');
    setFormOpen(true);
  };

  const openEdit = (c) => openForm({
    id: c.id,
    jourSemaine: c.jourSemaine,
    heureDebut: c.heureDebut,
    heureFin: c.heureFin,
    matiereId: c.matiereId || '',
    enseignantId: c.enseignantId || '',
    salleId: c.salleId || '',
  });

  const onCreneauChange = (key) => {
    if (!key) {
      setForm((f) => ({ ...f, creneauKey: '' }));
      return;
    }
    const [heureDebut, heureFin] = key.split('-');
    setForm((f) => ({ ...f, creneauKey: key, heureDebut, heureFin }));
  };

  const plageInvalide = (() => {
    const d = toMinutes(form.heureDebut);
    const f = toMinutes(form.heureFin);
    return d === null || f === null || f <= d;
  })();

  const handleSave = async () => {
    if (!form.matiereId || plageInvalide) return;
    if (!isPrimaryCycle && !form.enseignantId) return;
    setSaving(true);
    setErreur('');
    const salle = salles.find((x) => x.id === form.salleId);
    const payload = {
      jourSemaine: parseInt(form.jourSemaine, 10),
      heureDebut: form.heureDebut,
      heureFin: form.heureFin,
      matiereId: form.matiereId,
      enseignantId: form.enseignantId || null,
      salleId: form.salleId || null,
      salle: salle?.nom || null,
    };
    try {
      if (form.id) {
        await put(`/api/emplois-du-temps/${form.id}`, payload, { silent: true });
        toast.success('Cours modifié');
      } else {
        await post('/api/emplois-du-temps', { ...payload, classeId: selectedClasse }, { silent: true });
        toast.success('Cours ajouté');
      }
      setFormOpen(false);
      fetchCours();
    } catch (err) {
      // Conflit (409) ou validation (400) : message précis du serveur affiché dans le formulaire
      setErreur(err?.response?.data?.error || 'Enregistrement impossible');
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!form.id) return;
    if (!window.confirm('Supprimer ce cours de l\'emploi du temps ?')) return;
    try {
      await del(`/api/emplois-du-temps/${form.id}`);
      toast.success('Cours supprimé');
      setFormOpen(false);
      fetchCours();
    } catch { /* toast via useAxios */ }
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

  const hasContent = cours.length > 0 || grille.length > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Emploi du temps"
        subtitle="Grille hebdomadaire : horaires à la minute, pauses et récréations"
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <select style={{ ...inputStyle, width: 200 }} value={selectedClasse} onChange={(e) => setSelectedClasse(e.target.value)}>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>
            {canWrite && (
              <Button variant="secondary" icon={Clock} onClick={() => setGrilleOpen(true)}>Grille horaire</Button>
            )}
            {canWrite && (
              <Button icon={Plus} onClick={() => openForm()} disabled={!selectedClasse}>Ajouter un cours</Button>
            )}
          </div>
        }
      />

      {classes.length > 0 && grille.length === 0 && canWrite && (
        <div className="flex items-center gap-2 p-3 rounded-lg text-sm" style={{ background: 'color-mix(in srgb, var(--color-warning) 10%, transparent)', color: 'var(--text-secondary)' }}>
          <Clock className="h-4 w-4 shrink-0" />
          <span>
            Aucune grille horaire définie : configurez vos créneaux (ex. 07:10–07:45, récréation…) via « Grille horaire » pour obtenir un tableau aligné.
          </span>
        </div>
      )}

      {classes.length === 0 ? (
        <div className="text-center py-16 rounded-xl" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
          <AlertCircle className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Aucune classe disponible</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Veuillez créer une classe d'abord.</p>
        </div>
      ) : !hasContent ? (
        <div className="text-center py-16 rounded-xl" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
          <Plus className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Emploi du temps vide</p>
          <p className="text-xs mt-1 mb-4" style={{ color: 'var(--text-muted)' }}>Aucun cours n'est planifié pour cette classe.</p>
          {canWrite && <Button icon={Plus} onClick={() => openForm()}>Ajouter le premier cours</Button>}
        </div>
      ) : (
        <EmploiGrid
          cours={cours}
          grille={grille}
          onCoursClick={canWrite ? openEdit : undefined}
          onEmptyClick={canWrite ? (preset) => openForm(preset) : undefined}
          renderCours={(c) => (
            <>
              <p className="font-semibold" style={{ color: 'var(--color-primary)' }}>{c.matiereNom || '—'}</p>
              {!isPrimaryCycle && c.enseignantNom && <p style={{ color: 'var(--text-secondary)' }}>{c.enseignantNom}</p>}
              {c.salleNom && <p style={{ color: 'var(--text-muted)' }}>Salle {c.salleNom}</p>}
            </>
          )}
        />
      )}

      <GrilleHoraireEditor
        open={grilleOpen}
        onClose={() => setGrilleOpen(false)}
        get={get}
        put={put}
        cycles={cyclesEcole}
        defaultCycle=""
        onSaved={fetchGrille}
      />

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={form.id ? 'Modifier le cours' : 'Ajouter un cours'}
        subtitle={selectedClasseObj?.nom}
        size="md"
        footer={
          <div className="flex items-center justify-between w-full">
            <div>
              {form.id && (
                <Button variant="danger" icon={Trash2} onClick={handleDelete}>Supprimer</Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setFormOpen(false)}>Annuler</Button>
              <Button
                onClick={handleSave}
                loading={saving}
                disabled={!form.matiereId || plageInvalide || (!isPrimaryCycle && !form.enseignantId)}
              >
                {form.id ? 'Enregistrer' : 'Ajouter'}
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          {erreur && (
            <div className="flex items-start gap-2 p-3 rounded-lg" style={{ background: 'color-mix(in srgb, var(--color-danger) 10%, transparent)' }}>
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" style={{ color: 'var(--color-danger)' }} />
              <span className="text-sm" style={{ color: 'var(--color-danger)' }}>{erreur}</span>
            </div>
          )}
          {isPrimaryCycle && (
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Cycle primaire / préscolaire : la matière suffit. Salle et enseignant sont optionnels ; sans sélection, le titulaire assigné à la classe est utilisé.
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Jour</label>
              <select style={inputStyle} value={form.jourSemaine} onChange={(e) => setForm({ ...form, jourSemaine: e.target.value })}>
                {JOURS.map((j, i) => <option key={j} value={i + 1}>{j}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Créneau de la grille</label>
              <select style={inputStyle} value={form.creneauKey} onChange={(e) => onCreneauChange(e.target.value)}>
                <option value="">Horaire personnalisé</option>
                {creneauxCours.map((c) => (
                  <option key={c.id} value={`${c.heureDebut}-${c.heureFin}`}>
                    {c.libelle ? `${c.libelle} · ` : ''}{c.heureDebut} – {c.heureFin}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Heure de début</label>
              <input type="time" style={inputStyle} value={form.heureDebut} onChange={(e) => setForm({ ...form, heureDebut: e.target.value, creneauKey: '' })} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Heure de fin</label>
              <input type="time" style={inputStyle} value={form.heureFin} onChange={(e) => setForm({ ...form, heureFin: e.target.value, creneauKey: '' })} />
            </div>
          </div>
          {plageInvalide && (
            <p className="text-xs" style={{ color: 'var(--color-danger)' }}>L'heure de fin doit être après l'heure de début.</p>
          )}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Matière</label>
            <select style={inputStyle} value={form.matiereId} onChange={(e) => setForm({ ...form, matiereId: e.target.value })}>
              <option value="">Sélectionner</option>
              {matieres.map((m) => <option key={m.id} value={m.id}>{m.nom}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                Enseignant{isPrimaryCycle ? ' (optionnel)' : ''}
              </label>
              <select style={inputStyle} value={form.enseignantId} onChange={(e) => setForm({ ...form, enseignantId: e.target.value })}>
                <option value="">{isPrimaryCycle ? 'Auto (titulaire classe)' : 'Sélectionner'}</option>
                {staff.map((s) => <option key={s.id} value={s.id}>{s.prenom} {s.nom}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Salle (optionnel)</label>
              <select style={inputStyle} value={form.salleId} onChange={(e) => setForm({ ...form, salleId: e.target.value })}>
                <option value="">Aucune</option>
                {salles.map((s) => <option key={s.id} value={s.id}>{s.nom}{s.batiment ? ` (${s.batiment})` : ''}</option>)}
              </select>
            </div>
          </div>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Le système refuse : un enseignant dans deux cours qui se chevauchent le même jour (quelle que soit la classe ou la matière),
            deux cours simultanés dans la classe, une salle occupée, ou un cours sur une récréation. Les mêmes horaires un autre jour sont acceptés.
          </p>
        </div>
      </Modal>
    </div>
  );
};

export default EmploiDuTemps;
