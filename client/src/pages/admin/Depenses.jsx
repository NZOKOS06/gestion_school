import { useEffect, useState, useCallback, useMemo } from 'react';
import { useAxios } from '../../hooks/useAxios';
import { useTenant } from '../../contexts/TenantContext';
import {
  PageHeader, DataTable, Badge, Button, Modal,
  Input, Select, FormField, FilterBar, Card, SegmentedControl, KpiCard, KpiGrid,
} from '../../components/ui';
import { TrendingDown, Plus, Pencil, Trash2, BarChart3, FileDown } from 'lucide-react';
import toast from 'react-hot-toast';
import { openPdf } from '../../utils/pdf';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
} from 'recharts';

const CATEGORIES = [
  'Salaires', 'Loyer', 'Électricité / Eau', 'Fournitures', 'Entretien',
  'Communication', 'Transport', 'Alimentation (cantine)', 'Frais bancaires', 'Autre',
];

const PIE_COLORS = ['#2563eb', '#ef4444', '#f59e0b', '#22c55e', '#8b5cf6'];

const EMPTY_FORM = { categorie: '', montant: '', motif: '', reference: '', dateDepense: '' };

const Depenses = () => {
  const { get, post, put, del } = useAxios();
  const { formatPrice } = useTenant();
  const [depenses, setDepenses] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ categorie: '' });
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
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

  const fetchDepenses = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.categorie) params.set('categorie', filters.categorie);
      if (resolvedAnneeId) params.set('anneeScolaireId', resolvedAnneeId);
      params.set('limit', '200');
      const res = await get(`/api/depenses?${params.toString()}`);
      setDepenses(res?.data || res || []);
    } catch { /* silent */ }
    setLoading(false);
  }, [filters, get, resolvedAnneeId]);

  const fetchStats = useCallback(async () => {
    try {
      const qs = resolvedAnneeId ? `?anneeScolaireId=${resolvedAnneeId}` : '';
      const res = await get(`/api/depenses/stats${qs}`, { silent: true });
      setStats(res);
    } catch { /* silent */ }
  }, [get, resolvedAnneeId]);

  useEffect(() => { fetchDepenses(); fetchStats(); }, [fetchDepenses, fetchStats]);

  const openCreate = () => {
    if (isArchiveView) {
      toast.error('Impossible d’ajouter une dépense sur une année archivée');
      return;
    }
    setEditing(null);
    setForm({ ...EMPTY_FORM, dateDepense: new Date().toISOString().slice(0, 10) });
    setModalOpen(true);
  };

  const openEdit = (dep) => {
    if (isArchiveView) {
      toast.error('Consultation archive — modification désactivée');
      return;
    }
    setEditing(dep);
    setForm({
      categorie: dep.categorie || '',
      montant: String(dep.montant || ''),
      motif: dep.motif || '',
      reference: dep.reference || '',
      dateDepense: dep.dateDepense ? String(dep.dateDepense).slice(0, 10) : '',
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.categorie || !form.montant || !form.motif) {
      toast.error('Catégorie, montant et motif sont requis');
      return;
    }
    const amount = parseFloat(form.montant);
    if (isNaN(amount) || amount <= 0) { toast.error('Montant invalide'); return; }
    setSaving(true);
    try {
      const payload = {
        categorie: form.categorie,
        montant: amount,
        motif: form.motif,
        reference: form.reference || undefined,
        dateDepense: form.dateDepense || undefined,
        anneeScolaireId: resolvedAnneeId || undefined,
      };
      if (editing) {
        await put(`/api/depenses/${editing.id}`, payload);
        toast.success('Dépense mise à jour');
      } else {
        await post('/api/depenses', payload);
        toast.success('Dépense enregistrée');
      }
      setModalOpen(false);
      setEditing(null);
      fetchDepenses();
      fetchStats();
    } catch { /* toast via useAxios */ }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteId || isArchiveView) return;
    try {
      await del(`/api/depenses/${deleteId}`);
      toast.success('Dépense supprimée');
      setDeleteId(null);
      fetchDepenses();
      fetchStats();
    } catch { /* toast */ }
  };

  const pieData = stats?.parCategorie?.slice(0, 5) || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dépenses"
        subtitle={isArchiveView
          ? `Archive — ${anneePrev?.libelle || 'année précédente'}`
          : 'Suivi des sorties de caisse de l’année en cours'}
        actions={
          <>
            <Button variant="secondary" icon={FileDown} onClick={() => {
              const params = new URLSearchParams();
              if (filters.categorie) params.set('categorie', filters.categorie);
              if (resolvedAnneeId) params.set('anneeScolaireId', resolvedAnneeId);
              openPdf(`/api/depenses/export-pdf?${params.toString()}`, 'depenses.pdf');
            }}>Export PDF</Button>
            {!isArchiveView && (
              <Button icon={Plus} onClick={openCreate}>Nouvelle dépense</Button>
            )}
          </>
        }
      />

      {yearOptions.length > 1 && (
        <div className="flex flex-wrap items-center gap-3">
          <SegmentedControl value={yearScope} onChange={setYearScope} options={yearOptions} />
          {isArchiveView && <Badge variant="neutral">Consultation archive</Badge>}
        </div>
      )}

      {/* KPI + Pie */}
      {stats && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
          <div className="lg:col-span-2">
            <KpiGrid cols={2}>
              <KpiCard label="Dépenses ce mois" value={formatPrice(stats.totalMois)} icon={TrendingDown} color="red" />
              <KpiCard label="Dépenses année scolaire" value={formatPrice(stats.totalAnnee)} icon={BarChart3} color="orange" />
            </KpiGrid>
          </div>

          {pieData.length > 0 && (
            <Card title="Par catégorie (ce mois)">
              <div style={{ height: 180 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} dataKey="montant" nameKey="categorie" cx="50%" cy="50%" outerRadius={70}
                      label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`} labelLine={false}>
                      {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(val) => formatPrice(val)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Filtres */}
      <FilterBar>
        <Select fullWidth={false} style={{ height: 36, width: 200 }} value={filters.categorie} onChange={(e) => setFilters({ ...filters, categorie: e.target.value })}>
          <option value="">Toutes les catégories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </Select>
      </FilterBar>

      {/* Table */}
      <DataTable
        sortable
        pagination
        pageSize={15}
        columns={[
          {
            key: 'dateDepense',
            label: 'Date',
            sortable: true,
            render: (val) => (
              <span style={{ color: 'var(--text-secondary)' }}>
                {new Date(val).toLocaleDateString('fr-FR')}
              </span>
            ),
          },
          {
            key: 'categorie',
            label: 'Catégorie',
            render: (val) => <Badge variant="info">{val}</Badge>,
          },
          {
            key: 'motif',
            label: 'Motif',
            render: (val) => <span style={{ color: 'var(--text-primary)' }}>{val}</span>,
          },
          {
            key: 'reference',
            label: 'Référence',
            render: (val) => val
              ? <span className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>{val}</span>
              : <span style={{ color: 'var(--text-muted)' }}>—</span>,
          },
          {
            key: 'montant',
            label: 'Montant',
            sortable: true,
            render: (val) => (
              <span className="font-semibold" style={{ color: 'var(--color-danger)' }}>
                − {formatPrice(val)}
              </span>
            ),
          },
          {
            key: 'saisiePar',
            label: 'Saisi par',
            render: (val) => val
              ? <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{val.prenom} {val.nom}</span>
              : null,
          },
          {
            key: 'actions',
            label: '',
            render: (_, row) => (
              <div className="flex items-center gap-1">
                <button onClick={(e) => { e.stopPropagation(); openEdit(row); }}
                  className="p-1.5 rounded-md hover:bg-[var(--surface-hover)]" title="Modifier">
                  <Pencil className="h-4 w-4" style={{ color: 'var(--text-secondary)' }} />
                </button>
                <button onClick={(e) => { e.stopPropagation(); setDeleteId(row.id); }}
                  className="p-1.5 rounded-md hover:bg-[var(--surface-hover)]" title="Supprimer">
                  <Trash2 className="h-4 w-4" style={{ color: 'var(--color-danger)' }} />
                </button>
              </div>
            ),
          },
        ]}
        data={depenses}
        loading={loading}
        emptyMessage="Aucune dépense enregistrée"
        emptyDescription="Cliquez sur 'Nouvelle dépense' pour commencer le suivi des charges."
        emptyAction={<Button icon={Plus} size="sm" onClick={openCreate}>Nouvelle dépense</Button>}
      />

      {/* Modal Créer/Modifier */}
      <Modal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null); }}
        title={editing ? 'Modifier la dépense' : 'Nouvelle dépense'}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setModalOpen(false); setEditing(null); }}>Annuler</Button>
            <Button icon={TrendingDown} onClick={handleSave} disabled={saving}>
              {saving ? 'Enregistrement...' : editing ? 'Mettre à jour' : 'Enregistrer'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Catégorie" required>
              <Select value={form.categorie} onChange={(e) => setForm({ ...form, categorie: e.target.value })}>
                <option value="">Sélectionner</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
            </FormField>
            <FormField label="Montant (FCFA)" required>
              <Input type="number" value={form.montant} onChange={(e) => setForm({ ...form, montant: e.target.value })} placeholder="0" min={0} />
            </FormField>
          </div>
          <FormField label="Motif / Description" required>
            <Input value={form.motif} onChange={(e) => setForm({ ...form, motif: e.target.value })} placeholder="Ex: Salaire enseignant vacataire - Août" />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Référence (optionnel)">
              <Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder="N° facture, reçu..." />
            </FormField>
            <FormField label="Date">
              <Input type="date" value={form.dateDepense} onChange={(e) => setForm({ ...form, dateDepense: e.target.value })} />
            </FormField>
          </div>
        </div>
      </Modal>

      {/* Modal confirmation suppression */}
      <Modal
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="Supprimer cette dépense ?"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteId(null)}>Annuler</Button>
            <Button variant="danger" icon={Trash2} onClick={handleDelete}>Supprimer</Button>
          </>
        }
      >
        <p style={{ color: 'var(--text-secondary)' }}>
          Cette action est irréversible. La dépense sera définitivement supprimée.
        </p>
      </Modal>
    </div>
  );
};

export default Depenses;
