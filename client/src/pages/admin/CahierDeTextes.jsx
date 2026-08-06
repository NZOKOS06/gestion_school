import { useEffect, useState, useCallback } from 'react';
import { useAxios } from '../../hooks/useAxios';
import { PageHeader, DataTable, Badge, Button, Modal } from '../../components/ui';
import { BookOpen, Plus, Trash2, Pencil } from 'lucide-react';

const CahierDeTextes = () => {
  const { get, post, put, delete: del } = useAxios();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState([]);
  const [matieres, setMatieres] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ classeId: '', matiereId: '', dateCours: '', lecon: '', devoirsDonnes: '', observations: '' });

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const res = await get('/api/cahier-de-textes');
      setEntries(res?.data || res || []);
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  const fetchOptions = async () => {
    try {
      const [cl, ma] = await Promise.all([
        get('/api/classes', { silent: true }),
        get('/api/matieres', { silent: true }),
      ]);
      setClasses(cl?.data || cl || []);
      setMatieres(ma?.data || ma || []);
    } catch { /* silent */ }
  };

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  const openCreate = () => {
    setEditing(null);
    setForm({ classeId: '', matiereId: '', dateCours: new Date().toISOString().split('T')[0], lecon: '', devoirsDonnes: '', observations: '' });
    fetchOptions();
    setModalOpen(true);
  };

  const openEdit = (entry) => {
    setEditing(entry);
    setForm({
      classeId: entry.classeId || '',
      matiereId: entry.matiereId || '',
      dateCours: entry.dateCours ? new Date(entry.dateCours).toISOString().split('T')[0] : '',
      lecon: entry.lecon || '',
      devoirsDonnes: entry.devoirsDonnes || '',
      observations: entry.observations || '',
    });
    fetchOptions();
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      if (editing) {
        await put(`/api/cahier-de-textes/${editing.id}`, { lecon: form.lecon, devoirsDonnes: form.devoirsDonnes, observations: form.observations });
      } else {
        await post('/api/cahier-de-textes', form);
      }
      setModalOpen(false);
      fetchEntries();
    } catch { /* silent */ }
  };

  const handleDelete = async (entry) => {
    try {
      await del(`/api/cahier-de-textes/${entry.id}`);
      fetchEntries();
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
        title="Cahier de textes"
        subtitle="Suivi quotidien des leçons — obligatoire pour l'inspection"
        actions={<Button icon={Plus} onClick={openCreate}>Nouvelle entrée</Button>}
      />

      <DataTable
        columns={[
          {
            key: 'dateCours',
            label: 'Date',
            render: (val) => <span style={{ color: 'var(--text-secondary)' }}>{new Date(val).toLocaleDateString('fr-FR')}</span>,
          },
          {
            key: 'classe',
            label: 'Classe',
            render: (_, row) => <span style={{ color: 'var(--text-primary)' }}>{row.classe?.nom || '—'}</span>,
          },
          {
            key: 'matiere',
            label: 'Matière',
            render: (_, row) => <span style={{ color: 'var(--text-secondary)' }}>{row.matiere?.nom || '—'}</span>,
          },
          {
            key: 'enseignant',
            label: 'Enseignant',
            render: (_, row) => <span style={{ color: 'var(--text-secondary)' }}>{row.enseignant?.prenom} {row.enseignant?.nom}</span>,
          },
          {
            key: 'lecon',
            label: 'Leçon',
            render: (val) => <span className="text-sm" style={{ color: 'var(--text-primary)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{val}</span>,
          },
          {
            key: 'devoirsDonnes',
            label: 'Devoirs',
            render: (val) => val ? <Badge variant="warning">Donnés</Badge> : <span style={{ color: 'var(--text-muted)' }}>—</span>,
          },
          {
            key: 'actions',
            label: 'Actions',
            render: (_, row) => (
              <div className="flex items-center gap-1">
                <button onClick={() => openEdit(row)} className="p-1.5 rounded-md hover:bg-[var(--surface-hover)]" title="Modifier">
                  <Pencil className="h-4 w-4" style={{ color: 'var(--text-secondary)' }} />
                </button>
                <button onClick={() => handleDelete(row)} className="p-1.5 rounded-md hover:bg-[var(--surface-hover)]" title="Supprimer">
                  <Trash2 className="h-4 w-4" style={{ color: 'var(--color-danger)' }} />
                </button>
              </div>
            ),
          },
        ]}
        data={entries}
        loading={loading}
        emptyMessage="Aucune entrée dans le cahier de textes"
      />

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Modifier l\'entrée' : 'Nouvelle entrée — Cahier de textes'}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Annuler</Button>
            <Button onClick={handleSubmit} disabled={!form.lecon || (!editing && (!form.classeId || !form.matiereId))}>
              {editing ? 'Enregistrer' : 'Créer'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {!editing && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Classe</label>
                  <select style={inputStyle} value={form.classeId} onChange={(e) => setForm({ ...form, classeId: e.target.value })}>
                    <option value="">Sélectionner</option>
                    {classes.map((cl) => <option key={cl.id} value={cl.id}>{cl.nom}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Matière</label>
                  <select style={inputStyle} value={form.matiereId} onChange={(e) => setForm({ ...form, matiereId: e.target.value })}>
                    <option value="">Sélectionner</option>
                    {matieres.map((ma) => <option key={ma.id} value={ma.id}>{ma.nom} ({ma.code})</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Date du cours</label>
                <input type="date" style={inputStyle} value={form.dateCours} onChange={(e) => setForm({ ...form, dateCours: e.target.value })} />
              </div>
            </>
          )}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Leçon enseignée *</label>
            <textarea
              rows={4}
              value={form.lecon}
              onChange={(e) => setForm({ ...form, lecon: e.target.value })}
              style={{ ...inputStyle, height: 'auto', padding: '8px 12px', resize: 'vertical' }}
              placeholder="Contenu de la leçon du jour..."
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Devoirs donnés</label>
            <textarea
              rows={2}
              value={form.devoirsDonnes}
              onChange={(e) => setForm({ ...form, devoirsDonnes: e.target.value })}
              style={{ ...inputStyle, height: 'auto', padding: '8px 12px', resize: 'vertical' }}
              placeholder="Exercices et devoirs à faire à la maison..."
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Observations</label>
            <input style={inputStyle} value={form.observations} onChange={(e) => setForm({ ...form, observations: e.target.value })} placeholder="Remarques pédagogiques..." />
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default CahierDeTextes;
