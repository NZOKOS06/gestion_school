import { useEffect, useState, useCallback } from 'react';
import { useAxios } from '../../hooks/useAxios';
import { useTenant } from '../../contexts/TenantContext';
import { PageHeader, DataTable, Badge, Button, SearchInput, Modal } from '../../components/ui';
import { Eye, Pencil, Ban, Check, UserPlus } from 'lucide-react';
import { useDebounce } from '../../hooks/useDebounce';
import toast from 'react-hot-toast';

const EMPTY_FORM = {
  matricule: '',
  nom: '',
  prenom: '',
  dateNaissance: '',
  sexe: 'M',
  lieuNaissance: '',
  adresse: '',
};

const Eleves = () => {
  const { get, post, put } = useAxios();
  const { formatPrice } = useTenant();
  const [eleves, setEleves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [filters, setFilters] = useState({ cycle: '', classe: '', sexe: '', statut: '' });
  const [selected, setSelected] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const fetchEleves = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (filters.cycle) params.set('cycle', filters.cycle);
      if (filters.classe) params.set('classe', filters.classe);
      if (filters.sexe) params.set('sexe', filters.sexe);
      if (filters.statut) params.set('statut', filters.statut);
      const res = await get(`/api/eleves?${params.toString()}`);
      setEleves(res?.data || res || []);
    } catch { /* handled by useAxios */ }
    setLoading(false);
  }, [debouncedSearch, filters, get]);

  useEffect(() => { fetchEleves(); }, [fetchEleves]);

  const openDetail = async (eleve) => {
    setSelected(eleve);
    setDetailOpen(true);
    setDetail(null);
    try {
      const res = await get(`/api/eleves/${eleve.id}`);
      setDetail(res);
    } catch { /* silent */ }
  };

  const toggleActif = async (eleve) => {
    try {
      await put(`/api/eleves/${eleve.id}`, { actif: !eleve.actif });
      fetchEleves();
    } catch { /* silent */ }
  };

  const handleCreate = async () => {
    if (!form.matricule.trim() || !form.nom.trim() || !form.prenom.trim() || !form.dateNaissance || !form.sexe) {
      toast.error('Matricule, nom, prénom, date de naissance et sexe sont requis');
      return;
    }
    setSaving(true);
    try {
      await post('/api/eleves', {
        matricule: form.matricule.trim(),
        nom: form.nom.trim(),
        prenom: form.prenom.trim(),
        dateNaissance: form.dateNaissance,
        sexe: form.sexe,
        lieuNaissance: form.lieuNaissance.trim() || undefined,
        adresse: form.adresse.trim() || undefined,
      });
      toast.success('Élève créé');
      setCreateOpen(false);
      setForm(EMPTY_FORM);
      fetchEleves();
    } catch { /* toast via useAxios */ }
    setSaving(false);
  };

  const selectStyle = {
    height: 36,
    background: 'var(--surface-overlay)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)',
    fontSize: 13,
    padding: '0 8px',
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
        title="Élèves"
        subtitle="Gestion des élèves inscrits"
        actions={<Button icon={UserPlus} onClick={() => setCreateOpen(true)}>Nouvel élève</Button>}
      />

      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="flex-1 max-w-xs">
          <SearchInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nom, prénom, matricule..." />
        </div>
        <select style={selectStyle} value={filters.cycle} onChange={(e) => setFilters({ ...filters, cycle: e.target.value })}>
          <option value="">Tous les cycles</option>
          <option value="prescolaire">Préscolaire</option>
          <option value="primaire">Primaire</option>
          <option value="college">Collège</option>
          <option value="lycee">Lycée</option>
        </select>
        <select style={selectStyle} value={filters.sexe} onChange={(e) => setFilters({ ...filters, sexe: e.target.value })}>
          <option value="">Tous</option>
          <option value="M">Garçons</option>
          <option value="F">Filles</option>
        </select>
        <select style={selectStyle} value={filters.statut} onChange={(e) => setFilters({ ...filters, statut: e.target.value })}>
          <option value="">Tous statuts</option>
          <option value="actif">Actif</option>
          <option value="inactif">Inactif</option>
        </select>
      </div>

      <DataTable
        columns={[
          {
            key: 'matricule',
            label: 'Matricule',
            render: (val) => <span className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>{val}</span>,
          },
          {
            key: 'nom',
            label: 'Nom',
            render: (_, row) => (
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                  style={{ background: 'color-mix(in srgb, var(--color-primary) 15%, transparent)', color: 'var(--color-primary)' }}>
                  {row.prenom?.[0]}{row.nom?.[0]}
                </div>
                <div>
                  <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{row.prenom} {row.nom}</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {new Date(row.dateNaissance).toLocaleDateString('fr-FR')} · {row.sexe === 'M' ? 'Garçon' : 'Fille'}
                  </p>
                </div>
              </div>
            ),
          },
          {
            key: 'classe',
            label: 'Classe',
            render: (_, row) => (
              <span style={{ color: 'var(--text-secondary)' }}>
                {row.inscriptions?.[0]?.classe?.nom || row.classeNom || row.classe || '—'}
              </span>
            ),
          },
          {
            key: 'actif',
            label: 'Statut',
            render: (val) => val ? <Badge variant="success" dot>Actif</Badge> : <Badge variant="neutral">Inactif</Badge>,
          },
          {
            key: 'actions',
            label: 'Actions',
            render: (_, row) => (
              <div className="flex items-center gap-1">
                <button onClick={(e) => { e.stopPropagation(); openDetail(row); }} className="p-1.5 rounded-md hover:bg-[var(--surface-hover)]" title="Voir fiche">
                  <Eye className="h-4 w-4" style={{ color: 'var(--text-secondary)' }} />
                </button>
                <button className="p-1.5 rounded-md hover:bg-[var(--surface-hover)]" title="Modifier">
                  <Pencil className="h-4 w-4" style={{ color: 'var(--text-secondary)' }} />
                </button>
                <button onClick={(e) => { e.stopPropagation(); toggleActif(row); }} className="p-1.5 rounded-md hover:bg-[var(--surface-hover)]" title={row.actif ? 'Désactiver' : 'Activer'}>
                  {row.actif ? <Ban className="h-4 w-4" style={{ color: 'var(--color-danger)' }} /> : <Check className="h-4 w-4" style={{ color: 'var(--color-success)' }} />}
                </button>
              </div>
            ),
          },
        ]}
        data={eleves}
        loading={loading}
        emptyMessage="Aucun élève trouvé"
        onRowClick={openDetail}
      />

      <Modal
        open={createOpen}
        onClose={() => { setCreateOpen(false); setForm(EMPTY_FORM); }}
        title="Nouvel élève"
        subtitle="Créer un dossier élève"
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => { setCreateOpen(false); setForm(EMPTY_FORM); }}>Annuler</Button>
            <Button onClick={handleCreate} disabled={saving}>{saving ? 'Création...' : 'Créer'}</Button>
          </div>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Matricule *</label>
            <input style={inputStyle} value={form.matricule} onChange={(e) => setForm({ ...form, matricule: e.target.value })} placeholder="EX: ELV-2026-001" />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Sexe *</label>
            <select style={{ ...inputStyle, appearance: 'auto' }} value={form.sexe} onChange={(e) => setForm({ ...form, sexe: e.target.value })}>
              <option value="M">Garçon</option>
              <option value="F">Fille</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Nom *</label>
            <input style={inputStyle} value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Prénom *</label>
            <input style={inputStyle} value={form.prenom} onChange={(e) => setForm({ ...form, prenom: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Date de naissance *</label>
            <input type="date" style={inputStyle} value={form.dateNaissance} onChange={(e) => setForm({ ...form, dateNaissance: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Lieu de naissance</label>
            <input style={inputStyle} value={form.lieuNaissance} onChange={(e) => setForm({ ...form, lieuNaissance: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Adresse</label>
            <input style={inputStyle} value={form.adresse} onChange={(e) => setForm({ ...form, adresse: e.target.value })} />
          </div>
        </div>
      </Modal>

      <Modal
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        title={selected ? `${selected.prenom} ${selected.nom}` : 'Fiche élève'}
        subtitle={selected?.matricule}
        size="xl"
      >
        {detail ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Date de naissance</p>
                <p className="text-sm" style={{ color: 'var(--text-primary)' }}>
                  {new Date(detail.dateNaissance).toLocaleDateString('fr-FR')}
                  {detail.lieuNaissance ? ` à ${detail.lieuNaissance}` : ''}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Sexe</p>
                <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{detail.sexe === 'M' ? 'Garçon' : 'Fille'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Parent</p>
                <p className="text-sm" style={{ color: 'var(--text-primary)' }}>
                  {detail.parent ? `${detail.parent.prenom} ${detail.parent.nom}` : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Solde scolarité</p>
                <p className="text-sm font-semibold" style={{ color: detail.soldeScolarite > 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>
                  {formatPrice(detail.soldeScolarite || 0)}
                </p>
              </div>
            </div>

            {detail.inscriptions?.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Historique des inscriptions</h4>
                <div className="space-y-2">
                  {detail.inscriptions.map((insc) => (
                    <div key={insc.id} className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'var(--surface-overlay)' }}>
                      <div>
                        <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{insc.classe?.nom || '—'}</p>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{insc.anneeScolaire?.libelle}</p>
                      </div>
                      <Badge variant={insc.statut === 'validee' ? 'success' : insc.statut === 'en_attente' ? 'warning' : 'danger'}>
                        {insc.statut}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {detail.notes?.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Notes récentes</h4>
                <div className="space-y-2">
                  {detail.notes.slice(0, 5).map((note) => (
                    <div key={note.id} className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'var(--surface-overlay)' }}>
                      <div>
                        <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{note.evaluation?.nom}</p>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{note.evaluation?.matiere?.nom}</p>
                      </div>
                      <span className="font-mono font-semibold" style={{ color: 'var(--color-primary)' }}>
                        {Number(note.valeur).toFixed(2)}/{Number(note.evaluation?.noteMaximale || 20).toFixed(0)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {detail.absences?.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Absences</h4>
                <div className="space-y-2">
                  {detail.absences.slice(0, 5).map((abs) => (
                    <div key={abs.id} className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'var(--surface-overlay)' }}>
                      <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
                        {new Date(abs.dateAbsence).toLocaleDateString('fr-FR')}
                      </span>
                      <Badge variant={abs.justifiee ? 'success' : 'danger'}>
                        {abs.justifiee ? 'Justifiée' : 'Non justifiée'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: 'var(--color-primary)' }} />
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Eleves;
