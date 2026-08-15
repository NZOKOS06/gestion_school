import { useEffect, useState, useCallback } from 'react';
import { useAxios } from '../../hooks/useAxios';
import {
  PageHeader, DataTable, Badge, Button, Modal,
  QuickSearchSelect, QuickSearchChecklist,
} from '../../components/ui';
import { Users, Plus, Lock, Check, Trash2 } from 'lucide-react';

const ConseilDeClasse = () => {
  const { get, post, put, delete: del } = useAxios();
  const [conseils, setConseils] = useState([]);
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState([]);
  const [annees, setAnnees] = useState([]);
  const [staff, setStaff] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [detailModal, setDetailModal] = useState(null);
  const [form, setForm] = useState({
    classeId: '', anneeScolaireId: '', periodeIndex: 1, dateConseil: '',
    presidentId: '', participantIds: [], compteRendu: '',
  });

  const fetchConseils = useCallback(async () => {
    setLoading(true);
    try {
      const res = await get('/api/conseil-de-classe');
      setConseils(res?.data || res || []);
    } catch { /* silent */ }
    setLoading(false);
  }, [get]);

  useEffect(() => { fetchConseils(); }, [fetchConseils]);

  const fetchOptions = async () => {
    try {
      const [cl, an, st] = await Promise.all([
        get('/api/classes?limit=200', { silent: true }),
        get('/api/annees-scolaires', { silent: true }),
        get('/api/personnel?limit=200', { silent: true }),
      ]);
      setClasses(cl?.data || cl || []);
      setAnnees(an?.data || an || []);
      setStaff(st?.staff || st?.data || st || []);
      const activeAnnee = (an?.data || an || []).find((a) => a.actif);
      if (activeAnnee) setForm((f) => ({ ...f, anneeScolaireId: activeAnnee.id }));
    } catch { /* silent */ }
  };

  const openCreate = () => {
    setForm({
      classeId: '', anneeScolaireId: '', periodeIndex: 1,
      dateConseil: new Date().toISOString().split('T')[0],
      presidentId: '', participantIds: [], compteRendu: '',
    });
    fetchOptions();
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      await post('/api/conseil-de-classe', form);
      setModalOpen(false);
      fetchConseils();
    } catch { /* silent */ }
  };

  const toggleCloture = async (conseil) => {
    try {
      await put(`/api/conseil-de-classe/${conseil.id}`, { cloture: !conseil.cloture });
      fetchConseils();
    } catch { /* silent */ }
  };

  const handleDelete = async (conseil) => {
    try {
      await del(`/api/conseil-de-classe/${conseil.id}`);
      fetchConseils();
    } catch { /* silent */ }
  };

  const staffLabel = (s) => `${s.prenom || ''} ${s.nom || ''} (${s.role || ''})`.trim();

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
        title="Conseil de classe"
        subtitle="Réunion collective des enseignants — décisions et mentions"
        actions={<Button icon={Plus} onClick={openCreate}>Nouveau conseil</Button>}
      />

      <DataTable
        columns={[
          {
            key: 'classe',
            label: 'Classe',
            render: (_, row) => <span style={{ color: 'var(--text-primary)' }}>{row.classe?.nom || '—'}</span>,
          },
          {
            key: 'periodeIndex',
            label: 'Période',
            render: (val) => <Badge variant="neutral">Période {val}</Badge>,
          },
          {
            key: 'dateConseil',
            label: 'Date',
            render: (val) => <span style={{ color: 'var(--text-secondary)' }}>{new Date(val).toLocaleDateString('fr-FR')}</span>,
          },
          {
            key: 'president',
            label: 'Président',
            render: (_, row) => <span style={{ color: 'var(--text-secondary)' }}>{row.president?.prenom} {row.president?.nom}</span>,
          },
          {
            key: 'participants',
            label: 'Participants',
            render: (_, row) => <span style={{ color: 'var(--text-muted)' }}>{row.participants?.length || 0} présent(s)</span>,
          },
          {
            key: 'cloture',
            label: 'Statut',
            render: (val) => val ? <Badge variant="success">Clôturé</Badge> : <Badge variant="warning" dot>En cours</Badge>,
          },
          {
            key: 'actions',
            label: 'Actions',
            render: (_, row) => (
              <div className="flex items-center gap-1">
                <button onClick={() => setDetailModal(row)} className="p-1.5 rounded-md hover:bg-[var(--surface-hover)]" title="Détails">
                  <Users className="h-4 w-4" style={{ color: 'var(--text-secondary)' }} />
                </button>
                <button onClick={() => toggleCloture(row)} className="p-1.5 rounded-md hover:bg-[var(--surface-hover)]" title={row.cloture ? 'Rouvrir' : 'Clôturer'}>
                  {row.cloture ? <Lock className="h-4 w-4" style={{ color: 'var(--color-success)' }} /> : <Check className="h-4 w-4" style={{ color: 'var(--color-warning)' }} />}
                </button>
                <button onClick={() => handleDelete(row)} className="p-1.5 rounded-md hover:bg-[var(--surface-hover)]" title="Supprimer">
                  <Trash2 className="h-4 w-4" style={{ color: 'var(--color-danger)' }} />
                </button>
              </div>
            ),
          },
        ]}
        data={conseils}
        loading={loading}
        emptyMessage="Aucun conseil de classe"
      />

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Nouveau conseil de classe"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Annuler</Button>
            <Button onClick={handleSubmit} disabled={!form.classeId || !form.anneeScolaireId || !form.presidentId}>Créer</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Classe</label>
              <select style={inputStyle} value={form.classeId} onChange={(e) => setForm({ ...form, classeId: e.target.value })}>
                <option value="">Sélectionner</option>
                {classes.map((cl) => <option key={cl.id} value={cl.id}>{cl.nom}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Année scolaire</label>
              <select style={inputStyle} value={form.anneeScolaireId} onChange={(e) => setForm({ ...form, anneeScolaireId: e.target.value })}>
                <option value="">Sélectionner</option>
                {annees.map((an) => <option key={an.id} value={an.id}>{an.libelle}{an.actif ? ' (active)' : ''}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Période</label>
              <select style={inputStyle} value={form.periodeIndex} onChange={(e) => setForm({ ...form, periodeIndex: parseInt(e.target.value, 10) })}>
                <option value={1}>Période 1</option>
                <option value={2}>Période 2</option>
                <option value={3}>Période 3</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Date du conseil</label>
              <input type="date" style={inputStyle} value={form.dateConseil} onChange={(e) => setForm({ ...form, dateConseil: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Président du conseil</label>
            <QuickSearchSelect
              items={staff}
              value={form.presidentId}
              onChange={(id) => setForm({ ...form, presidentId: id })}
              getLabel={staffLabel}
              placeholder="Rechercher le président…"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Participants</label>
            <QuickSearchChecklist
              items={staff}
              values={form.participantIds}
              onChange={(ids) => setForm({ ...form, participantIds: ids })}
              getLabel={staffLabel}
              placeholder="Rechercher puis cocher…"
            />
          </div>
        </div>
      </Modal>

      <Modal
        open={!!detailModal}
        onClose={() => setDetailModal(null)}
        title={`Conseil — ${detailModal?.classe?.nom || ''} (Période ${detailModal?.periodeIndex})`}
        size="md"
        footer={<Button variant="secondary" onClick={() => setDetailModal(null)}>Fermer</Button>}
      >
        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Participants</p>
            <div className="space-y-1">
              {detailModal?.participants?.map((p) => (
                <div key={p.id} className="flex items-center gap-2">
                  <Badge variant={p.present ? 'success' : 'neutral'}>{p.present ? 'Présent' : 'Absent'}</Badge>
                  <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{p.staff?.prenom} {p.staff?.nom}</span>
                </div>
              ))}
            </div>
          </div>
          {detailModal?.compteRendu && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Compte-rendu</p>
              <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{detailModal.compteRendu}</p>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default ConseilDeClasse;
