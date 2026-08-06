import { useEffect, useState, useCallback } from 'react';
import { useAxios } from '../../hooks/useAxios';
import { useTenant } from '../../contexts/TenantContext';
import { PageHeader, Card, DataTable, Badge, Button, Modal } from '../../components/ui';
import { School, Plus, Users, BookOpen } from 'lucide-react';

const CYCLES = ['prescolaire', 'primaire', 'college', 'lycee'];
const CYCLE_LABELS = { prescolaire: 'Préscolaire', primaire: 'Primaire', college: 'Collège', lycee: 'Lycée' };

const Classes = () => {
  const { get, post } = useAxios();
  const { formatPrice } = useTenant();
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterCycle, setFilterCycle] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [form, setForm] = useState({ nom: '', niveau: '', filiere: '', capacite: 40, fraisScolarite: 0, cycle: 'primaire' });

  const fetchClasses = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterCycle) params.set('cycle', filterCycle);
      const res = await get(`/api/classes?${params.toString()}`);
      setClasses(res?.data || res || []);
    } catch { /* silent */ }
    setLoading(false);
  }, [filterCycle]);

  useEffect(() => { fetchClasses(); }, [fetchClasses]);

  const handleCreate = async () => {
    try {
      await post('/api/classes', form);
      setCreateOpen(false);
      setForm({ nom: '', niveau: '', filiere: '', capacite: 40, fraisScolarite: 0, cycle: 'primaire' });
      fetchClasses();
    } catch { /* silent */ }
  };

  const openDetail = async (classe) => {
    try {
      const res = await get(`/api/classes/${classe.id}`);
      setDetail(res);
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

  const selectStyle = { ...inputStyle, appearance: 'auto' };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Classes & Niveaux"
        subtitle="Classes de l'année scolaire active"
        actions={<Button icon={Plus} onClick={() => setCreateOpen(true)}>Nouvelle classe</Button>}
      />

      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setFilterCycle('')}
          className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
          style={!filterCycle
            ? { background: 'var(--color-primary)', color: '#fff' }
            : { background: 'var(--surface-overlay)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}
        >Tous</button>
        {CYCLES.map((c) => (
          <button
            key={c}
            onClick={() => setFilterCycle(c)}
            className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
            style={filterCycle === c
              ? { background: 'var(--color-primary)', color: '#fff' }
              : { background: 'var(--surface-overlay)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}
          >{CYCLE_LABELS[c]}</button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl p-5" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
              <div className="skeleton h-5 w-32 rounded mb-3" />
              <div className="skeleton h-3 w-20 rounded mb-2" />
              <div className="skeleton h-3 w-24 rounded" />
            </div>
          ))
        ) : classes.length === 0 ? (
          <div className="col-span-full text-center py-16">
            <School className="h-12 w-12 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} strokeWidth={1.25} />
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Aucune classe trouvée</p>
          </div>
        ) : (
          classes.map((classe) => (
            <div
              key={classe.id}
              onClick={() => openDetail(classe)}
              className="rounded-xl p-5 cursor-pointer transition-all"
              style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.08)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'var(--shadow-card)'; }}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{classe.nom}</h3>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{classe.niveau} {classe.filiere ? `· ${classe.filiere}` : ''}</p>
                </div>
                <Badge variant="info">{CYCLE_LABELS[classe.cycle] || classe.cycle}</Badge>
              </div>
              <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--text-muted)' }}>
                <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {classe.effectif || 0}/{classe.capacite}</span>
                <span className="flex items-center gap-1"><BookOpen className="h-3.5 w-3.5" /> {classe.nbMatieres || 0} matières</span>
                <span>{formatPrice(classe.fraisScolarite || 0)}</span>
              </div>
            </div>
          ))
        )}
      </div>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Nouvelle classe"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>Annuler</Button>
            <Button onClick={handleCreate}>Créer</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Nom de la classe</label>
            <input style={inputStyle} value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} placeholder="ex: 6ème A" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Niveau</label>
              <input style={inputStyle} value={form.niveau} onChange={(e) => setForm({ ...form, niveau: e.target.value })} placeholder="ex: 6eme" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Cycle</label>
              <select style={selectStyle} value={form.cycle} onChange={(e) => setForm({ ...form, cycle: e.target.value })}>
                {CYCLES.map((c) => <option key={c} value={c}>{CYCLE_LABELS[c]}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Filière (optionnel)</label>
              <input style={inputStyle} value={form.filiere} onChange={(e) => setForm({ ...form, filiere: e.target.value })} placeholder="ex: Scientifique" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Capacité</label>
              <input type="number" style={inputStyle} value={form.capacite} onChange={(e) => setForm({ ...form, capacite: parseInt(e.target.value) || 0 })} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Frais de scolarité</label>
            <input type="number" style={inputStyle} value={form.fraisScolarite} onChange={(e) => setForm({ ...form, fraisScolarite: parseFloat(e.target.value) || 0 })} />
          </div>
        </div>
      </Modal>

      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail?.nom || 'Détail classe'}
        subtitle={detail?.anneeScolaire?.libelle}
        size="xl"
      >
        {detail && (
          <div className="space-y-6">
            <div>
              <h4 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Élèves inscrits ({detail.eleves?.length || 0})</h4>
              <DataTable
                columns={[
                  { key: 'matricule', label: 'Matricule', render: (v) => <span className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>{v}</span> },
                  { key: 'nom', label: 'Nom', render: (_, r) => <span style={{ color: 'var(--text-primary)' }}>{r.prenom} {r.nom}</span> },
                  { key: 'sexe', label: 'Sexe', render: (v) => <span style={{ color: 'var(--text-secondary)' }}>{v === 'M' ? 'Garçon' : 'Fille'}</span> },
                ]}
                data={detail.eleves || []}
                emptyMessage="Aucun élève inscrit"
              />
            </div>
            <div>
              <h4 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Enseignants affectés</h4>
              <DataTable
                columns={[
                  { key: 'enseignant', label: 'Enseignant', render: (_, r) => <span style={{ color: 'var(--text-primary)' }}>{r.enseignantPrenom} {r.enseignantNom}</span> },
                  { key: 'matiere', label: 'Matière', render: (_, r) => <Badge variant="info">{r.matiereNom}</Badge> },
                ]}
                data={detail.enseignants || []}
                emptyMessage="Aucun enseignant affecté"
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Classes;
