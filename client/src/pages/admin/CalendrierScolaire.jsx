import { useEffect, useState, useCallback } from 'react';
import { useAxios } from '../../hooks/useAxios';
import { PageHeader, Badge, Button, Modal } from '../../components/ui';
import { Calendar, Plus, Trash2, Pencil } from 'lucide-react';

const TYPE_CONFIG = {
  rentree: { label: 'Rentrée', variant: 'success' },
  vacances: { label: 'Vacances', variant: 'neutral' },
  examen: { label: 'Examen', variant: 'danger' },
  jour_ferie: { label: 'Jour férié', variant: 'warning' },
  conseil_classe: { label: 'Conseil de classe', variant: 'primary' },
  evenement_scolaire: { label: 'Événement', variant: 'primary' },
  composition: { label: 'Composition', variant: 'danger' },
};

const CalendrierScolaire = () => {
  const { get, post, put, delete: del } = useAxios();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [annees, setAnnees] = useState([]);
  const [selectedAnnee, setSelectedAnnee] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ titre: '', type: 'rentree', dateDebut: '', dateFin: '', description: '', anneeScolaireId: '', concerneCycles: '' });

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedAnnee) params.set('anneeScolaireId', selectedAnnee);
      const res = await get(`/api/calendrier?${params.toString()}`);
      setEvents(res?.data || res || []);
    } catch { /* silent */ }
    setLoading(false);
  }, [selectedAnnee]);

  const fetchAnnees = async () => {
    try {
      const res = await get('/api/annees-scolaires', { silent: true });
      const data = res?.data || res || [];
      setAnnees(data);
      const active = data.find((a) => a.actif);
      if (active) setSelectedAnnee(active.id);
    } catch { /* silent */ }
  };

  useEffect(() => { fetchAnnees(); }, []);
  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const openCreate = () => {
    setEditing(null);
    setForm({ titre: '', type: 'rentree', dateDebut: new Date().toISOString().split('T')[0], dateFin: '', description: '', anneeScolaireId: selectedAnnee, concerneCycles: '' });
    setModalOpen(true);
  };

  const openEdit = (event) => {
    setEditing(event);
    setForm({
      titre: event.titre,
      type: event.type,
      dateDebut: event.dateDebut ? new Date(event.dateDebut).toISOString().split('T')[0] : '',
      dateFin: event.dateFin ? new Date(event.dateFin).toISOString().split('T')[0] : '',
      description: event.description || '',
      anneeScolaireId: event.anneeScolaireId || selectedAnnee,
      concerneCycles: event.concerneCycles ? event.concerneCycles.join(',') : '',
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const payload = {
        ...form,
        concerneCycles: form.concerneCycles ? form.concerneCycles.split(',').map((s) => s.trim()) : null,
        dateFin: form.dateFin || null,
      };
      if (editing) {
        await put(`/api/calendrier/${editing.id}`, payload);
      } else {
        await post('/api/calendrier', payload);
      }
      setModalOpen(false);
      fetchEvents();
    } catch { /* silent */ }
  };

  const handleDelete = async (event) => {
    try {
      await del(`/api/calendrier/${event.id}`);
      fetchEvents();
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
        title="Calendrier scolaire"
        subtitle="Rentrée, vacances, examens, jours fériés et événements"
        actions={
          <div className="flex gap-2">
            <Button
              variant="secondary"
              disabled={!selectedAnnee}
              onClick={async () => {
                try {
                  await post('/api/referentiel/calendrier/generate-from-periodes', { anneeScolaireId: selectedAnnee });
                  fetchEvents();
                } catch { /* silent */ }
              }}
            >
              Générer depuis périodes
            </Button>
            <Button icon={Plus} onClick={openCreate}>Nouvel événement</Button>
          </div>
        }
      />

      <div className="flex gap-3 items-center">
        <select style={inputStyle} value={selectedAnnee} onChange={(e) => setSelectedAnnee(e.target.value)} className="max-w-xs">
          <option value="">Toutes les années</option>
          {annees.map((an) => <option key={an.id} value={an.id}>{an.libelle}{an.actif ? ' (active)' : ''}</option>)}
        </select>
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>Chargement...</div>
        ) : events.length === 0 ? (
          <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>Aucun événement</div>
        ) : (
          events.map((event) => {
            const cfg = TYPE_CONFIG[event.type] || { label: event.type, variant: 'neutral' };
            return (
              <div
                key={event.id}
                className="flex items-center gap-4 p-4 rounded-xl"
                style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}
              >
                <div className="flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center" style={{ background: 'var(--surface-hover)' }}>
                  <Calendar className="h-5 w-5" style={{ color: 'var(--color-primary)' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{event.titre}</span>
                    <Badge variant={cfg.variant}>{cfg.label}</Badge>
                  </div>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {new Date(event.dateDebut).toLocaleDateString('fr-FR')}
                    {event.dateFin && ` → ${new Date(event.dateFin).toLocaleDateString('fr-FR')}`}
                    {event.anneeScolaire?.libelle && ` · ${event.anneeScolaire.libelle}`}
                  </p>
                  {event.description && (
                    <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{event.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => openEdit(event)} className="p-1.5 rounded-md hover:bg-[var(--surface-hover)]" title="Modifier">
                    <Pencil className="h-4 w-4" style={{ color: 'var(--text-secondary)' }} />
                  </button>
                  <button onClick={() => handleDelete(event)} className="p-1.5 rounded-md hover:bg-[var(--surface-hover)]" title="Supprimer">
                    <Trash2 className="h-4 w-4" style={{ color: 'var(--color-danger)' }} />
                  </button>
                </div>
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
            <Button onClick={handleSubmit} disabled={!form.titre || !form.dateDebut || !form.anneeScolaireId}>
              {editing ? 'Enregistrer' : 'Créer'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Titre *</label>
            <input style={inputStyle} value={form.titre} onChange={(e) => setForm({ ...form, titre: e.target.value })} placeholder="ex: Rentrée scolaire 2026" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Type</label>
              <select style={inputStyle} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                {Object.entries(TYPE_CONFIG).map(([key, cfg]) => <option key={key} value={key}>{cfg.label}</option>)}
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
              <input type="date" style={inputStyle} value={form.dateDebut} onChange={(e) => setForm({ ...form, dateDebut: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Date fin</label>
              <input type="date" style={inputStyle} value={form.dateFin} onChange={(e) => setForm({ ...form, dateFin: e.target.value })} />
            </div>
          </div>
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
