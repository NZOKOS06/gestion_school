import { useEffect, useState, useCallback } from 'react';
import { useAxios } from '../../hooks/useAxios';
import { PageHeader, DataTable, Badge, Button, Modal } from '../../components/ui';
import { Gavel, Plus } from 'lucide-react';

const TYPE_VARIANT = {
  avertissement: 'warning',
  blame: 'warning',
  retenue: 'info',
  exclusion_temporaire: 'danger',
  exclusion_definitive: 'danger',
};

const TYPE_LABEL = {
  avertissement: 'Avertissement',
  blame: 'Blâme',
  retenue: 'Retenue',
  exclusion_temporaire: 'Exclusion temp.',
  exclusion_definitive: 'Exclusion définitive',
};

const Sanctions = () => {
  const { get, post } = useAxios();
  const [sanctions, setSanctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [eleves, setEleves] = useState([]);
  const [form, setForm] = useState({ eleveId: '', type: 'avertissement', motif: '', dureeJours: '' });

  const fetchSanctions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await get('/api/sanctions');
      setSanctions(res?.data || res || []);
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchSanctions(); }, [fetchSanctions]);

  const openCreate = async () => {
    try {
      const res = await get('/api/eleves', { silent: true });
      setEleves(res?.data || res || []);
    } catch { /* silent */ }
    setCreateOpen(true);
  };

  const handleCreate = async () => {
    try {
      const payload = { ...form };
      if (form.dureeJours) payload.dureeJours = parseInt(form.dureeJours);
      delete payload.dureeJours;
      if (form.dureeJours) payload.dureeJours = parseInt(form.dureeJours);
      await post('/api/sanctions', payload);
      setCreateOpen(false);
      setForm({ eleveId: '', type: 'avertissement', motif: '', dureeJours: '' });
      fetchSanctions();
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
        title="Sanctions"
        subtitle="Suivi disciplinaire des élèves"
        actions={<Button icon={Plus} onClick={openCreate}>Nouvelle sanction</Button>}
      />

      <DataTable
        columns={[
          {
            key: 'eleve',
            label: 'Élève',
            render: (_, row) => (
              <div>
                <p className="font-medium" style={{ color: 'var(--text-primary)' }}>
                  {row.elevePrenom || row.eleve?.prenom} {row.eleveNom || row.eleve?.nom}
                </p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{row.classeNom || row.eleve?.classe?.nom}</p>
              </div>
            ),
          },
          {
            key: 'type',
            label: 'Type',
            render: (val) => <Badge variant={TYPE_VARIANT[val] || 'neutral'}>{TYPE_LABEL[val] || val}</Badge>,
          },
          {
            key: 'motif',
            label: 'Motif',
            render: (val) => <span style={{ color: 'var(--text-secondary)' }}>{val}</span>,
          },
          {
            key: 'dureeJours',
            label: 'Durée',
            render: (val) => val ? <span style={{ color: 'var(--text-secondary)' }}>{val} jour(s)</span> : <span style={{ color: 'var(--text-muted)' }}>—</span>,
          },
          {
            key: 'dateSanction',
            label: 'Date',
            render: (val) => <span style={{ color: 'var(--text-muted)' }}>{new Date(val).toLocaleDateString('fr-FR')}</span>,
          },
        ]}
        data={sanctions}
        loading={loading}
        emptyMessage="Aucune sanction"
      />

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Nouvelle sanction"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>Annuler</Button>
            <Button onClick={handleCreate} disabled={!form.eleveId || !form.motif}>Enregistrer</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Élève</label>
            <select style={inputStyle} value={form.eleveId} onChange={(e) => setForm({ ...form, eleveId: e.target.value })}>
              <option value="">Sélectionner</option>
              {eleves.map((el) => <option key={el.id} value={el.id}>{el.prenom} {el.nom} ({el.matricule})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Type de sanction</label>
            <select style={inputStyle} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {Object.entries(TYPE_LABEL).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </div>
          {(form.type === 'exclusion_temporaire' || form.type === 'exclusion_definitive') && (
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Durée (jours)</label>
              <input type="number" min="1" style={inputStyle} value={form.dureeJours} onChange={(e) => setForm({ ...form, dureeJours: e.target.value })} />
            </div>
          )}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Motif</label>
            <textarea style={{ ...inputStyle, height: 80, paddingTop: 10 }} value={form.motif} onChange={(e) => setForm({ ...form, motif: e.target.value })} placeholder="Décrire le motif de la sanction..." />
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Sanctions;
