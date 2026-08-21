import { useEffect, useState, useCallback, useMemo } from 'react';
import { useAxios } from '../../hooks/useAxios';
import { useAuth } from '../../contexts/AuthContext';
import { PageHeader, Badge, Button, Modal } from '../../components/ui';
import { Calendar, Plus, Trash2, Pencil, Lock, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';

const TYPE_CONFIG = {
  rentree: { label: 'Rentrée', variant: 'success' },
  reprise_cours: { label: 'Reprise des cours', variant: 'success' },
  vacances: { label: 'Vacances', variant: 'neutral' },
  examen: { label: 'Examen', variant: 'danger' },
  jour_ferie: { label: 'Jour férié', variant: 'warning' },
  conseil_classe: { label: 'Conseil de classe', variant: 'primary' },
  evenement_scolaire: { label: 'Événement', variant: 'primary' },
  composition: { label: 'Composition', variant: 'danger' },
};

const TYPE_SELECTABLE = Object.keys(TYPE_CONFIG).filter((k) => k !== 'rentree');

const toDateInput = (v) => {
  if (!v) return '';
  const d = typeof v === 'string' ? v.slice(0, 10) : new Date(v).toISOString().slice(0, 10);
  return d;
};

const CalendrierScolaire = () => {
  const { get, post, put, delete: del } = useAxios();
  const { hasRole } = useAuth();
  const canWrite = hasRole('directeur', 'directeur_etudes');

  const [events, setEvents] = useState([]);
  const [alertes, setAlertes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [annees, setAnnees] = useState([]);
  const [selectedAnnee, setSelectedAnnee] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    titre: '',
    type: 'composition',
    dateDebut: '',
    dateFin: '',
    description: '',
    anneeScolaireId: '',
    concerneCycles: '',
  });

  const anneeCourante = useMemo(
    () => annees.find((a) => a.id === selectedAnnee) || annees.find((a) => a.actif) || null,
    [annees, selectedAnnee]
  );

  const minDate = anneeCourante ? toDateInput(anneeCourante.dateDebut) : undefined;
  const maxDate = anneeCourante ? toDateInput(anneeCourante.dateFin) : undefined;

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedAnnee) params.set('anneeScolaireId', selectedAnnee);
      const res = await get(`/api/calendrier?${params.toString()}`, { silent: true });
      setEvents(res?.data || res || []);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Impossible de charger le calendrier');
    }
    setLoading(false);
  }, [selectedAnnee, get]);

  const fetchAlertes = useCallback(async () => {
    try {
      const res = await get('/api/calendrier/alertes?jours=14', { silent: true });
      setAlertes(res?.data || []);
    } catch {
      setAlertes([]);
    }
  }, [get]);

  const fetchAnnees = async () => {
    try {
      const res = await get('/api/annees-scolaires', { silent: true });
      const data = res?.data || res || [];
      setAnnees(data);
      const active = data.find((a) => a.actif);
      if (active) setSelectedAnnee(active.id);
    } catch {
      toast.error('Impossible de charger les années scolaires');
    }
  };

  useEffect(() => { fetchAnnees(); }, []);
  useEffect(() => { fetchEvents(); }, [fetchEvents]);
  useEffect(() => { fetchAlertes(); }, [fetchAlertes]);

  const openCreate = () => {
    setEditing(null);
    setForm({
      titre: '',
      type: 'composition',
      dateDebut: minDate || new Date().toISOString().split('T')[0],
      dateFin: '',
      description: '',
      anneeScolaireId: selectedAnnee,
      concerneCycles: '',
    });
    setModalOpen(true);
  };

  const openEdit = (event) => {
    if (event.type === 'rentree') {
      toast.error('La rentrée se modifie via la date de début de l\'année scolaire');
      return;
    }
    setEditing(event);
    setForm({
      titre: event.titre,
      type: event.type,
      dateDebut: toDateInput(event.dateDebut),
      dateFin: toDateInput(event.dateFin),
      description: event.description || '',
      anneeScolaireId: event.anneeScolaireId || selectedAnnee,
      concerneCycles: Array.isArray(event.concerneCycles) ? event.concerneCycles.join(',') : '',
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const payload = {
        ...form,
        concerneCycles: form.concerneCycles
          ? form.concerneCycles.split(',').map((s) => s.trim()).filter(Boolean)
          : null,
        dateFin: form.dateFin || null,
      };
      if (editing) {
        await put(`/api/calendrier/${editing.id}`, payload);
        toast.success('Événement mis à jour');
      } else {
        await post('/api/calendrier', payload);
        toast.success('Événement créé');
      }
      setModalOpen(false);
      fetchEvents();
      fetchAlertes();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Enregistrement impossible');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (event) => {
    if (event.type === 'rentree') {
      toast.error('La rentrée ne peut pas être supprimée');
      return;
    }
    try {
      await del(`/api/calendrier/${event.id}`);
      toast.success('Événement supprimé');
      fetchEvents();
      fetchAlertes();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Suppression impossible');
    }
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
        title="Calendrier scolaire"
        subtitle="Référence de l'année : rentrée, reprises, vacances, compositions et examens"
        actions={
          canWrite ? (
            <div className="flex gap-2 flex-wrap">
              <Button
                variant="secondary"
                disabled={!selectedAnnee}
                onClick={async () => {
                  try {
                    const res = await post('/api/referentiel/calendrier/generate-from-periodes', {
                      anneeScolaireId: selectedAnnee,
                    });
                    toast.success(`${res?.count ?? 0} événement(s) synchronisé(s)`);
                    fetchEvents();
                    fetchAlertes();
                  } catch (err) {
                    toast.error(err.response?.data?.error || 'Génération impossible');
                  }
                }}
              >
                Générer depuis périodes
              </Button>
              <Button icon={Plus} onClick={openCreate}>Nouvel événement</Button>
            </div>
          ) : (
            <span className="text-xs flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
              <Lock className="h-3.5 w-3.5" /> Lecture seule — modification réservée à la direction
            </span>
          )
        }
      />

      {alertes.length > 0 && (
        <div
          className="rounded-lg px-4 py-3 space-y-1.5"
          style={{ background: 'color-mix(in srgb, var(--color-warning) 12%, transparent)', border: '1px solid var(--color-warning)' }}
        >
          {alertes.map((a) => (
            <div key={a.id} className="flex items-start gap-2 text-sm" style={{ color: 'var(--text-primary)' }}>
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" style={{ color: 'var(--color-warning)' }} />
              <span>{a.message}</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-3 items-center flex-wrap">
        <select style={inputStyle} value={selectedAnnee} onChange={(e) => setSelectedAnnee(e.target.value)} className="max-w-xs">
          <option value="">Toutes les années</option>
          {annees.map((an) => (
            <option key={an.id} value={an.id}>{an.libelle}{an.actif ? ' (active)' : ''}</option>
          ))}
        </select>
        {anneeCourante && (
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Fenêtre autorisée : {new Date(anneeCourante.dateDebut).toLocaleDateString('fr-FR')}
            {' → '}
            {new Date(anneeCourante.dateFin).toLocaleDateString('fr-FR')}
          </span>
        )}
      </div>

      <div
        className="rounded-lg overflow-hidden"
        style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}
      >
        {loading ? (
          <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>Chargement...</div>
        ) : events.length === 0 ? (
          <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>Aucun événement</div>
        ) : (
          events.map((event, idx) => {
            const cfg = TYPE_CONFIG[event.type] || { label: event.type, variant: 'neutral' };
            const isRentree = event.type === 'rentree';
            return (
              <div
                key={event.id}
                className="flex items-center gap-3 px-3 py-2"
                style={{
                  borderTop: idx === 0 ? 'none' : '1px solid var(--border-subtle)',
                  minHeight: 48,
                }}
              >
                <Calendar className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--color-primary)' }} />
                <span className="shrink-0"><Badge variant={cfg.variant}>{cfg.label}</Badge></span>
                <span className="text-sm font-medium truncate flex-1 min-w-0" style={{ color: 'var(--text-primary)' }}>
                  {event.titre}
                  {isRentree && (
                    <span className="text-xs ml-2 font-normal" style={{ color: 'var(--text-muted)' }}>
                      (auto — année scolaire)
                    </span>
                  )}
                </span>
                <span className="text-xs shrink-0 hidden sm:inline" style={{ color: 'var(--text-muted)' }}>
                  {new Date(event.dateDebut).toLocaleDateString('fr-FR')}
                  {event.dateFin && event.dateFin !== event.dateDebut
                    ? ` → ${new Date(event.dateFin).toLocaleDateString('fr-FR')}`
                    : ''}
                </span>
                {canWrite && (
                  <div className="flex items-center gap-0.5 shrink-0">
                    {isRentree ? (
                      <span title="Non modifiable" className="p-1">
                        <Lock className="h-3.5 w-3.5" style={{ color: 'var(--text-muted)' }} />
                      </span>
                    ) : (
                      <>
                        <button onClick={() => openEdit(event)} className="p-1 rounded-md hover:bg-[var(--surface-hover)]" title="Modifier">
                          <Pencil className="h-3.5 w-3.5" style={{ color: 'var(--text-secondary)' }} />
                        </button>
                        <button onClick={() => handleDelete(event)} className="p-1 rounded-md hover:bg-[var(--surface-hover)]" title="Supprimer">
                          <Trash2 className="h-3.5 w-3.5" style={{ color: 'var(--color-danger)' }} />
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Modifier l\'événement' : 'Nouvel événement'}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Annuler</Button>
            <Button onClick={handleSubmit} disabled={saving || !form.titre || !form.dateDebut || !form.anneeScolaireId}>
              {editing ? 'Enregistrer' : 'Créer'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Titre *</label>
            <input style={inputStyle} value={form.titre} onChange={(e) => setForm({ ...form, titre: e.target.value })} placeholder="ex: Composition du 1er trimestre" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Type</label>
              <select style={inputStyle} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                {TYPE_SELECTABLE.map((key) => (
                  <option key={key} value={key}>{TYPE_CONFIG[key].label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Année scolaire</label>
              <select style={inputStyle} value={form.anneeScolaireId} onChange={(e) => setForm({ ...form, anneeScolaireId: e.target.value })}>
                <option value="">Sélectionner</option>
                {annees.map((an) => <option key={an.id} value={an.id}>{an.libelle}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Date début *</label>
              <input
                type="date"
                style={inputStyle}
                min={minDate}
                max={maxDate}
                value={form.dateDebut}
                onChange={(e) => setForm({ ...form, dateDebut: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Date fin</label>
              <input
                type="date"
                style={inputStyle}
                min={form.dateDebut || minDate}
                max={maxDate}
                value={form.dateFin}
                onChange={(e) => setForm({ ...form, dateFin: e.target.value })}
              />
            </div>
          </div>
          {minDate && maxDate && (
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Dates autorisées : {new Date(minDate + 'T12:00:00').toLocaleDateString('fr-FR')} → {new Date(maxDate + 'T12:00:00').toLocaleDateString('fr-FR')}
            </p>
          )}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Cycles concernés</label>
            <input style={inputStyle} value={form.concerneCycles} onChange={(e) => setForm({ ...form, concerneCycles: e.target.value })} placeholder="ex: primaire,college (vide = tous)" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Description</label>
            <input style={inputStyle} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default CalendrierScolaire;
