import { useEffect, useState, useCallback } from 'react';
import { useAxios } from '../../hooks/useAxios';
import { PageHeader, DataTable, Badge, Button, Modal } from '../../components/ui';
import { DoorOpen, Plus, Pencil, Trash2 } from 'lucide-react';

const Salles = () => {
  const { get, post, put, delete: del } = useAxios();
  const [salles, setSalles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ nom: '', batiment: '', capacite: 40, type: 'cours', actif: true });

  const fetchSalles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await get('/api/salles');
      setSalles(res?.data || res || []);
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchSalles(); }, [fetchSalles]);

  const openCreate = () => {
    setEditing(null);
    setForm({ nom: '', batiment: '', capacite: 40, type: 'cours', actif: true });
    setModalOpen(true);
  };

  const openEdit = (salle) => {
    setEditing(salle);
    setForm({ nom: salle.nom, batiment: salle.batiment || '', capacite: salle.capacite, type: salle.type, actif: salle.actif });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      if (editing) {
        await put(`/api/salles/${editing.id}`, form);
      } else {
        await post('/api/salles', form);
      }
      setModalOpen(false);
      fetchSalles();
    } catch { /* silent */ }
  };

  const handleDelete = async (salle) => {
    try {
      await del(`/api/salles/${salle.id}`);
      fetchSalles();
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

  const TYPE_LABEL = { cours: 'Salle de cours', labo: 'Laboratoire', informatique: 'Salle informatique', sport: 'Gymnase', reunion: 'Salle de réunion' };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Salles de cours"
        subtitle="Gestion des salles et de leur capacité"
        actions={<Button icon={Plus} onClick={openCreate}>Nouvelle salle</Button>}
      />

      <DataTable
        columns={[
          { key: 'nom', label: 'Nom', render: (val) => <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{val}</span> },
          { key: 'batiment', label: 'Bâtiment', render: (val) => <span style={{ color: 'var(--text-secondary)' }}>{val || '—'}</span> },
          { key: 'type', label: 'Type', render: (val) => <Badge variant="neutral">{TYPE_LABEL[val] || val}</Badge> },
          { key: 'capacite', label: 'Capacité', render: (val) => <span style={{ color: 'var(--text-secondary)' }}>{val} places</span> },
          {
            key: '_count',
            label: 'Créneaux',
            render: (_, row) => <span style={{ color: 'var(--text-muted)' }}>{row._count?.emploisDuTemps || 0}</span>,
          },
          {
            key: 'actif',
            label: 'Statut',
            render: (val) => val ? <Badge variant="success">Active</Badge> : <Badge variant="neutral">Inactive</Badge>,
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
        data={salles}
        loading={loading}
        emptyMessage="Aucune salle configurée"
      />

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Modifier la salle' : 'Nouvelle salle'}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Annuler</Button>
            <Button onClick={handleSubmit} disabled={!form.nom}>{editing ? 'Enregistrer' : 'Créer'}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Nom *</label>
              <input style={inputStyle} value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} placeholder="ex: A12, Labo Sciences" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Bâtiment</label>
              <input style={inputStyle} value={form.batiment} onChange={(e) => setForm({ ...form, batiment: e.target.value })} placeholder="ex: Bloc A" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Capacité</label>
              <input type="number" style={inputStyle} value={form.capacite} onChange={(e) => setForm({ ...form, capacite: parseInt(e.target.value) || 40 })} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Type</label>
              <select style={inputStyle} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                <option value="cours">Salle de cours</option>
                <option value="labo">Laboratoire</option>
                <option value="informatique">Salle informatique</option>
                <option value="sport">Gymnase</option>
                <option value="reunion">Salle de réunion</option>
              </select>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Salles;
