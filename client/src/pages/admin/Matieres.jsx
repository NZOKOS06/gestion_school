import { useEffect, useState, useCallback } from 'react';
import { useAxios } from '../../hooks/useAxios';
import { PageHeader, DataTable, Badge, Button, Modal } from '../../components/ui';
import { BookOpen, Plus, Pencil, Trash2, Link2 } from 'lucide-react';

const Matieres = () => {
  const { get, post, put, delete: del } = useAxios();
  const [matieres, setMatieres] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [affectOpen, setAffectOpen] = useState(false);
  const [classes, setClasses] = useState([]);
  const [staff, setStaff] = useState([]);
  const [affectations, setAffectations] = useState([]);
  const [selectedMatiere, setSelectedMatiere] = useState(null);
  const [affectForm, setAffectForm] = useState({ enseignantId: '', classeId: '' });
  const [form, setForm] = useState({ nom: '', code: '', coefficient: 1, description: '' });

  const fetchMatieres = useCallback(async () => {
    setLoading(true);
    try {
      const res = await get('/api/matieres');
      setMatieres(res?.data || res || []);
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchMatieres(); }, [fetchMatieres]);

  const handleSave = async () => {
    try {
      if (editItem) {
        await put(`/api/matieres/${editItem.id}`, form);
      } else {
        await post('/api/matieres', form);
      }
      setCreateOpen(false);
      setEditItem(null);
      setForm({ nom: '', code: '', coefficient: 1, description: '' });
      fetchMatieres();
    } catch { /* silent */ }
  };

  const handleEdit = (matiere) => {
    setEditItem(matiere);
    setForm({ nom: matiere.nom, code: matiere.code, coefficient: matiere.coefficient, description: matiere.description || '' });
    setCreateOpen(true);
  };

  const handleDelete = async (matiere) => {
    if (!confirm(`Supprimer la matière "${matiere.nom}" ?`)) return;
    try {
      await del(`/api/matieres/${matiere.id}`);
      fetchMatieres();
    } catch { /* silent */ }
  };

  const openAffect = async (matiere) => {
    setSelectedMatiere(matiere);
    setAffectOpen(true);
    try {
      const [cl, st, aff] = await Promise.all([
        get('/api/classes', { silent: true }),
        get('/api/staff?role=enseignant', { silent: true }),
        get(`/api/matieres/${matiere.id}/affectations`, { silent: true }),
      ]);
      setClasses(cl?.data || cl || []);
      setStaff(st?.data || st || []);
      setAffectations(aff?.data || aff || []);
    } catch { /* silent */ }
  };

  const handleAffect = async () => {
    try {
      await post(`/api/matieres/${selectedMatiere.id}/affectations`, affectForm);
      const aff = await get(`/api/matieres/${selectedMatiere.id}/affectations`, { silent: true });
      setAffectations(aff?.data || aff || []);
      setAffectForm({ enseignantId: '', classeId: '' });
    } catch { /* silent */ }
  };

  const removeAffect = async (affId) => {
    try {
      await del(`/api/matieres/affectations/${affId}`);
      const aff = await get(`/api/matieres/${selectedMatiere.id}/affectations`, { silent: true });
      setAffectations(aff?.data || aff || []);
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
        title="Matières"
        subtitle="Gestion des matières et affectations"
        actions={<Button icon={Plus} onClick={() => { setEditItem(null); setForm({ nom: '', code: '', coefficient: 1, description: '' }); setCreateOpen(true); }}>Nouvelle matière</Button>}
      />

      <DataTable
        columns={[
          {
            key: 'code',
            label: 'Code',
            render: (v) => <span className="font-mono text-xs font-semibold" style={{ color: 'var(--color-primary)' }}>{v}</span>,
          },
          {
            key: 'nom',
            label: 'Matière',
            render: (v) => <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{v}</span>,
          },
          {
            key: 'coefficient',
            label: 'Coefficient',
            render: (v) => <Badge variant="info">Coef. {v}</Badge>,
          },
          {
            key: 'actif',
            label: 'Statut',
            render: (v) => v ? <Badge variant="success" dot>Active</Badge> : <Badge variant="neutral">Inactive</Badge>,
          },
          {
            key: 'actions',
            label: 'Actions',
            render: (_, row) => (
              <div className="flex items-center gap-1">
                <button onClick={() => openAffect(row)} className="p-1.5 rounded-md hover:bg-[var(--surface-hover)]" title="Affecter">
                  <Link2 className="h-4 w-4" style={{ color: 'var(--text-secondary)' }} />
                </button>
                <button onClick={() => handleEdit(row)} className="p-1.5 rounded-md hover:bg-[var(--surface-hover)]" title="Modifier">
                  <Pencil className="h-4 w-4" style={{ color: 'var(--text-secondary)' }} />
                </button>
                <button onClick={() => handleDelete(row)} className="p-1.5 rounded-md hover:bg-[var(--surface-hover)]" title="Supprimer">
                  <Trash2 className="h-4 w-4" style={{ color: 'var(--color-danger)' }} />
                </button>
              </div>
            ),
          },
        ]}
        data={matieres}
        loading={loading}
        emptyMessage="Aucune matière"
      />

      <Modal
        open={createOpen}
        onClose={() => { setCreateOpen(false); setEditItem(null); }}
        title={editItem ? 'Modifier la matière' : 'Nouvelle matière'}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setCreateOpen(false); setEditItem(null); }}>Annuler</Button>
            <Button onClick={handleSave}>{editItem ? 'Enregistrer' : 'Créer'}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Nom</label>
            <input style={inputStyle} value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} placeholder="ex: Mathématiques" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Code</label>
              <input style={inputStyle} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="ex: MATH" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Coefficient</label>
              <input type="number" min="1" style={inputStyle} value={form.coefficient} onChange={(e) => setForm({ ...form, coefficient: parseInt(e.target.value) || 1 })} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Description (optionnel)</label>
            <textarea style={{ ...inputStyle, height: 80, paddingTop: 10 }} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
        </div>
      </Modal>

      <Modal
        open={affectOpen}
        onClose={() => setAffectOpen(false)}
        title={`Affectations — ${selectedMatiere?.nom || ''}`}
        subtitle="Enseignant ↔ Classe"
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <select style={inputStyle} value={affectForm.enseignantId} onChange={(e) => setAffectForm({ ...affectForm, enseignantId: e.target.value })}>
              <option value="">Sélectionner un enseignant</option>
              {staff.map((s) => <option key={s.id} value={s.id}>{s.prenom} {s.nom}</option>)}
            </select>
            <select style={inputStyle} value={affectForm.classeId} onChange={(e) => setAffectForm({ ...affectForm, classeId: e.target.value })}>
              <option value="">Sélectionner une classe</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>
          </div>
          <Button icon={Plus} onClick={handleAffect} disabled={!affectForm.enseignantId || !affectForm.classeId}>Affecter</Button>

          <div className="space-y-2">
            {affectations.map((aff) => (
              <div key={aff.id} className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'var(--surface-overlay)' }}>
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{aff.enseignantPrenom} {aff.enseignantNom}</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{aff.classeNom}</p>
                </div>
                <button onClick={() => removeAffect(aff.id)} className="p-1.5 rounded-md hover:bg-[var(--surface-hover)]">
                  <Trash2 className="h-4 w-4" style={{ color: 'var(--color-danger)' }} />
                </button>
              </div>
            ))}
            {affectations.length === 0 && (
              <p className="text-sm text-center py-4" style={{ color: 'var(--text-muted)' }}>Aucune affectation</p>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Matieres;
