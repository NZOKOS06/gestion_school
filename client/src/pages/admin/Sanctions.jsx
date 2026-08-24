import { useEffect, useState, useCallback, useMemo } from 'react';
import { useAxios } from '../../hooks/useAxios';
import { PageHeader, DataTable, Badge, Button, Modal, QuickSearchSelect, SegmentedControl } from '../../components/ui';
import { Gavel, Plus } from 'lucide-react';
import toast from 'react-hot-toast';

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
  const [annees, setAnnees] = useState([]);
  const [yearScope, setYearScope] = useState('active');

  const anneeActive = useMemo(
    () => annees.find((a) => a.actif || a.statut === 'active'),
    [annees],
  );
  const anneePrev = useMemo(
    () => annees
      .filter((a) => a.statut === 'archivee' || (!a.actif && a.id !== anneeActive?.id))
      .sort((a, b) => new Date(b.dateFin || 0) - new Date(a.dateFin || 0))[0],
    [annees, anneeActive],
  );
  const resolvedAnneeId = yearScope === 'archive' ? anneePrev?.id : anneeActive?.id;
  const isArchiveView = yearScope === 'archive';
  const yearOptions = useMemo(() => {
    const opts = [{ value: 'active', label: anneeActive?.libelle || 'Année en cours' }];
    if (anneePrev) opts.push({ value: 'archive', label: anneePrev.libelle || 'Année précédente' });
    return opts;
  }, [anneeActive, anneePrev]);

  useEffect(() => {
    (async () => {
      try {
        const res = await get('/api/annees-scolaires', { silent: true });
        setAnnees(res?.data || res || []);
      } catch { /* silent */ }
    })();
  }, [get]);

  const fetchSanctions = useCallback(async () => {
    setLoading(true);
    try {
      const qs = resolvedAnneeId ? `?anneeScolaireId=${resolvedAnneeId}` : '';
      const res = await get(`/api/sanctions${qs}`);
      setSanctions(res?.data || res || []);
    } catch { /* silent */ }
    setLoading(false);
  }, [get, resolvedAnneeId]);

  useEffect(() => { fetchSanctions(); }, [fetchSanctions]);

  const openCreate = async () => {
    if (isArchiveView) {
      toast.error('Impossible d’ajouter une sanction sur une année archivée');
      return;
    }
    try {
      const res = await get('/api/eleves?limit=500', { silent: true });
      setEleves(res?.data || res || []);
    } catch { /* silent */ }
    setForm({ eleveId: '', type: 'avertissement', motif: '', dureeJours: '' });
    setCreateOpen(true);
  };

  const handleCreate = async () => {
    try {
      const payload = {
        eleveId: form.eleveId,
        type: form.type,
        motif: form.motif,
        anneeScolaireId: resolvedAnneeId || undefined,
      };
      if (form.dureeJours) payload.dureeJours = parseInt(form.dureeJours, 10);
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
        subtitle={isArchiveView
          ? `Archive — ${anneePrev?.libelle || 'année précédente'}`
          : 'Suivi disciplinaire de l’année en cours'}
        actions={!isArchiveView ? <Button icon={Plus} onClick={openCreate}>Nouvelle sanction</Button> : null}
      />

      {yearOptions.length > 1 && (
        <div className="flex flex-wrap items-center gap-3">
          <SegmentedControl value={yearScope} onChange={setYearScope} options={yearOptions} />
          {isArchiveView && <Badge variant="neutral">Consultation archive</Badge>}
        </div>
      )}

      <DataTable
        columns={[
          {
            key: 'eleve',
            label: 'Élève',
            primary: true,
            render: (_, row) => (
              <div>
                <p className="font-medium" style={{ color: 'var(--text-primary)' }}>
                  {row.elevePrenom || row.eleve?.prenom} {row.eleveNom || row.eleve?.nom}
                </p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{row.classeNom || row.eleve?.classe?.nom}</p>
              </div>
            ),
            mobileRender: (_, row) => `${row.elevePrenom || row.eleve?.prenom || ''} ${row.eleveNom || row.eleve?.nom || ''}`.trim(),
          },
          {
            key: 'type',
            label: 'Type',
            badge: true,
            render: (val) => <Badge variant={TYPE_VARIANT[val] || 'neutral'}>{TYPE_LABEL[val] || val}</Badge>,
          },
          {
            key: 'motif',
            label: 'Motif',
            secondary: true,
            render: (val) => <span style={{ color: 'var(--text-secondary)' }}>{val}</span>,
          },
          {
            key: 'dateSanction',
            label: 'Date',
            render: (val) => (
              <span style={{ color: 'var(--text-muted)' }}>
                {val ? new Date(val).toLocaleDateString('fr-FR') : '—'}
              </span>
            ),
          },
          {
            key: 'dureeJours',
            label: 'Durée',
            hideOnMobile: true,
            render: (val) => (val ? `${val} j` : '—'),
          },
        ]}
        data={sanctions}
        loading={loading}
        emptyMessage={isArchiveView ? 'Aucune sanction archivée' : 'Aucune sanction cette année'}
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
            <QuickSearchSelect
              items={eleves}
              value={form.eleveId}
              onChange={(id) => setForm({ ...form, eleveId: id })}
              placeholder="Nom, prénom ou matricule…"
            />
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
