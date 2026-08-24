import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAxios } from '../../hooks/useAxios';
import { useTenant } from '../../contexts/TenantContext';
import { PageHeader, DataTable, Badge, Button, SearchInput, Modal, Input, Select, FormField, FilterBar, Spinner } from '../../components/ui';
import { Eye, Pencil, Ban, Check, UserPlus, ClipboardList, Printer } from 'lucide-react';
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
  const navigate = useNavigate();
  const [eleves, setEleves] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [filters, setFilters] = useState({ cycle: '', classe: '', sexe: '', statut: '', inscription: '' });
  const [selected, setSelected] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [printOpen, setPrintOpen] = useState(false);
  const [printMode, setPrintMode] = useState('all'); // all | classe | custom
  const [printClasseId, setPrintClasseId] = useState('');
  const [printSelected, setPrintSelected] = useState(() => new Set());

  const fetchEleves = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (filters.cycle) params.set('cycle', filters.cycle);
      if (filters.classe) params.set('classe', filters.classe);
      if (filters.sexe) params.set('sexe', filters.sexe);
      if (filters.inscription) params.set('inscription', filters.inscription);
      if (filters.statut) params.set('statut', filters.statut);
      const res = await get(`/api/eleves?${params.toString()}`);
      setEleves(res?.data || res || []);
    } catch { /* handled by useAxios */ }
    setLoading(false);
  }, [debouncedSearch, filters, get]);

  useEffect(() => { fetchEleves(); }, [fetchEleves]);

  useEffect(() => {
    (async () => {
      try {
        const res = await get('/api/classes?limit=200', { silent: true });
        setClasses(res?.data || res || []);
      } catch { /* silent */ }
    })();
  }, [get]);

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

  const openEdit = (eleve) => {
    setEditing(eleve);
    setForm({
      matricule: eleve.matricule || '',
      nom: eleve.nom || '',
      prenom: eleve.prenom || '',
      dateNaissance: eleve.dateNaissance ? String(eleve.dateNaissance).slice(0, 10) : '',
      sexe: eleve.sexe || 'M',
      lieuNaissance: eleve.lieuNaissance || '',
      adresse: eleve.adresse || '',
    });
    setEditOpen(true);
  };

  const handleUpdate = async () => {
    if (!editing) return;
    if (!form.matricule.trim() || !form.nom.trim() || !form.prenom.trim() || !form.dateNaissance || !form.sexe) {
      toast.error('Matricule, nom, prénom, date de naissance et sexe sont requis');
      return;
    }
    const errAge = validateNaissance(form.dateNaissance);
    if (errAge) { toast.error(errAge); return; }
    setSaving(true);
    try {
      await put(`/api/eleves/${editing.id}`, {
        matricule: form.matricule.trim(),
        nom: form.nom.trim(),
        prenom: form.prenom.trim(),
        dateNaissance: form.dateNaissance,
        sexe: form.sexe,
        lieuNaissance: form.lieuNaissance.trim() || undefined,
        adresse: form.adresse.trim() || undefined,
      });
      toast.success('Élève mis à jour');
      setEditOpen(false);
      setEditing(null);
      setForm(EMPTY_FORM);
      fetchEleves();
    } catch { /* toast via useAxios */ }
    setSaving(false);
  };

  const validateNaissance = (dateStr) => {
    if (!dateStr) return 'Date de naissance requise';
    const birth = new Date(dateStr);
    if (Number.isNaN(birth.getTime())) return 'Date de naissance invalide';
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (birth > today) return 'La date de naissance ne peut pas être dans le futur';
    let age = today.getFullYear() - birth.getFullYear();
    const md = today.getMonth() - birth.getMonth();
    if (md < 0 || (md === 0 && today.getDate() < birth.getDate())) age--;
    if (age < 2 || age > 25) return "L'âge de l'élève doit être compris entre 2 et 25 ans";
    return null;
  };

  const handleCreate = async () => {
    if (!form.matricule.trim() || !form.nom.trim() || !form.prenom.trim() || !form.dateNaissance || !form.sexe) {
      toast.error('Matricule, nom, prénom, date de naissance et sexe sont requis');
      return;
    }
    const errAge = validateNaissance(form.dateNaissance);
    if (errAge) { toast.error(errAge); return; }
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

  const goInscrire = (eleveId) => {
    navigate(eleveId ? `/admin/inscriptions?eleveId=${eleveId}` : '/admin/inscriptions');
  };

  const displayedEleves = eleves.filter((row) => {
    if (filters.inscription === 'sans') return !row.inscriptions?.length;
    if (filters.inscription === 'en_attente') return row.inscriptions?.[0]?.statut === 'en_attente';
    if (filters.inscription === 'validee') return row.inscriptions?.[0]?.statut === 'validee';
    return true;
  });

  const selectStyle = { height: 36, width: 150, minWidth: 130, maxWidth: 180, flexShrink: 0 };

  const openPrint = () => {
    setPrintMode('all');
    setPrintClasseId(filters.classe || '');
    setPrintSelected(new Set(displayedEleves.map((e) => e.id)));
    setPrintOpen(true);
  };

  const togglePrintSelect = (id) => {
    setPrintSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const runPrint = () => {
    let rows = [];
    if (printMode === 'all') {
      rows = [...displayedEleves];
    } else if (printMode === 'classe') {
      if (!printClasseId) {
        toast.error('Sélectionnez une classe');
        return;
      }
      rows = displayedEleves.filter((e) => e.inscriptions?.[0]?.classe?.id === printClasseId);
    } else {
      rows = displayedEleves.filter((e) => printSelected.has(e.id));
    }
    if (!rows.length) {
      toast.error('Aucun élève à imprimer');
      return;
    }

    const byClasse = {};
    for (const e of rows) {
      const key = e.inscriptions?.[0]?.classe?.nom || 'Sans classe';
      if (!byClasse[key]) byClasse[key] = [];
      byClasse[key].push(e);
    }
    const sections = Object.keys(byClasse).sort().map((classeNom) => {
      const list = byClasse[classeNom]
        .sort((a, b) => `${a.nom} ${a.prenom}`.localeCompare(`${b.nom} ${b.prenom}`, 'fr'))
        .map((e, i) => `<tr><td>${i + 1}</td><td>${e.matricule}</td><td>${e.prenom} ${e.nom}</td><td>${e.sexe === 'M' ? 'G' : 'F'}</td><td>${new Date(e.dateNaissance).toLocaleDateString('fr-FR')}</td></tr>`)
        .join('');
      return `<h2>${classeNom} (${byClasse[classeNom].length})</h2><table><thead><tr><th>#</th><th>Matricule</th><th>Nom</th><th>Sexe</th><th>Naissance</th></tr></thead><tbody>${list}</tbody></table>`;
    }).join('');

    const w = window.open('', '_blank', 'noopener,noreferrer,width=900,height=700');
    if (!w) {
      toast.error('Autorisez les pop-ups pour imprimer');
      return;
    }
    w.document.write(`<!DOCTYPE html><html><head><title>Liste des élèves</title>
      <style>
        body{font-family:system-ui,sans-serif;padding:24px;color:#111}
        h1{font-size:18px;margin:0 0 4px} h2{font-size:14px;margin:20px 0 8px;border-bottom:1px solid #ccc;padding-bottom:4px}
        .meta{font-size:12px;color:#555;margin-bottom:16px}
        table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:8px}
        th,td{border:1px solid #ddd;padding:6px 8px;text-align:left}
        th{background:#f5f5f5}
        @media print{body{padding:0}}
      </style></head><body>
      <h1>Liste des élèves</h1>
      <p class="meta">GestSchool · ${new Date().toLocaleDateString('fr-FR')} · ${rows.length} élève(s)</p>
      ${sections}
      <script>window.onload=function(){window.print();}</script>
      </body></html>`);
    w.document.close();
    setPrintOpen(false);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Élèves"
        subtitle="Annuaire des élèves — la scolarisation passe par une inscription"
        actions={
          <div className="flex gap-2 flex-wrap">
            <Button variant="secondary" icon={Printer} onClick={openPrint}>Imprimer</Button>
            <Button variant="secondary" icon={ClipboardList} onClick={() => goInscrire()}>Nouvelle inscription</Button>
            <Button icon={UserPlus} onClick={() => { setForm(EMPTY_FORM); setCreateOpen(true); }}>Fiche identité</Button>
          </div>
        }
      />

      <FilterBar>
        <div className="min-w-[180px] w-[220px] shrink-0">
          <SearchInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nom, prénom, matricule..." />
        </div>
        <Select fullWidth={false} style={selectStyle} value={filters.cycle} onChange={(e) => setFilters({ ...filters, cycle: e.target.value })}>
          <option value="">Tous les cycles</option>
          <option value="prescolaire">Préscolaire</option>
          <option value="primaire">Primaire</option>
          <option value="college">Collège</option>
          <option value="lycee">Lycée</option>
        </Select>
        <Select fullWidth={false} style={selectStyle} value={filters.classe} onChange={(e) => setFilters({ ...filters, classe: e.target.value })}>
          <option value="">Toutes les classes</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
        </Select>
        <Select fullWidth={false} style={selectStyle} value={filters.sexe} onChange={(e) => setFilters({ ...filters, sexe: e.target.value })}>
          <option value="">Tous</option>
          <option value="M">Garçons</option>
          <option value="F">Filles</option>
        </Select>
        <Select fullWidth={false} style={{ ...selectStyle, width: 160 }} value={filters.inscription} onChange={(e) => setFilters({ ...filters, inscription: e.target.value })}>
          <option value="">Toutes inscriptions</option>
          <option value="sans">Non inscrit</option>
          <option value="en_attente">En attente</option>
          <option value="validee">Scolarisé</option>
        </Select>
        <Select fullWidth={false} style={selectStyle} value={filters.statut} onChange={(e) => setFilters({ ...filters, statut: e.target.value })}>
          <option value="">Tous statuts</option>
          <option value="actif">Actif</option>
          <option value="inactif">Inactif</option>
        </Select>
      </FilterBar>

      <DataTable
        columns={[
          {
            key: 'matricule',
            label: 'Matricule',
            secondary: true,
            render: (val) => <span className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>{val}</span>,
          },
          {
            key: 'nom',
            label: 'Nom',
            primary: true,
            render: (_, row) => (
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                  style={{ background: 'color-mix(in srgb, var(--color-primary) 15%, transparent)', color: 'var(--color-primary)' }}>
                  {row.prenom?.[0]}{row.nom?.[0]}
                </div>
                <div>
                  <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{row.prenom} {row.nom}</p>
                  <p className="text-xs md:block hidden" style={{ color: 'var(--text-muted)' }}>
                    {new Date(row.dateNaissance).toLocaleDateString('fr-FR')} · {row.sexe === 'M' ? 'Garçon' : 'Fille'}
                  </p>
                </div>
              </div>
            ),
            mobileRender: (_, row) => `${row.prenom} ${row.nom}`,
          },
          {
            key: 'classe',
            label: 'Classe',
            render: (_, row) => {
              const insc = row.inscriptions?.[0];
              if (!insc?.classe?.nom) return <span style={{ color: 'var(--text-secondary)' }}>—</span>;
              const suffix = insc.statut === 'en_attente' ? ' (en attente)' : '';
              return (
                <span style={{ color: 'var(--text-secondary)' }}>
                  {insc.classe.nom}{suffix}
                </span>
              );
            },
          },
          {
            key: 'inscription',
            label: 'Scolarité',
            badge: true,
            render: (_, row) => {
              const insc = row.inscriptions?.[0];
              if (!insc) return <Badge variant="warning">Non inscrit</Badge>;
              if (insc.statut === 'validee') return <Badge variant="success" dot>Scolarisé</Badge>;
              if (insc.statut === 'en_attente') return <Badge variant="warning">En attente</Badge>;
              return <Badge variant="neutral">{insc.statut}</Badge>;
            },
          },
          {
            key: 'actif',
            label: 'Fiche',
            hideOnMobile: true,
            render: (val) => val ? <Badge variant="success" dot>Actif</Badge> : <Badge variant="neutral">Inactif</Badge>,
          },
          {
            key: 'actions',
            label: 'Actions',
            actions: true,
            render: (_, row) => (
              <div className="flex items-center gap-1">
                {!row.inscriptions?.length && (
                  <button
                    onClick={(e) => { e.stopPropagation(); goInscrire(row.id); }}
                    className="px-2 py-1.5 rounded-md text-xs font-medium min-h-[36px]"
                    style={{ background: 'var(--surface-overlay)', color: 'var(--color-primary)', border: '1px solid var(--border-subtle)' }}
                    title="Inscrire pour l'année active"
                  >
                    Inscrire
                  </button>
                )}
                <button onClick={(e) => { e.stopPropagation(); openDetail(row); }} className="p-2 rounded-md hover:bg-[var(--surface-hover)] min-h-[40px] min-w-[40px] flex items-center justify-center" title="Voir fiche">
                  <Eye className="h-4 w-4" style={{ color: 'var(--text-secondary)' }} />
                </button>
                <button onClick={(e) => { e.stopPropagation(); openEdit(row); }} className="p-2 rounded-md hover:bg-[var(--surface-hover)] min-h-[40px] min-w-[40px] flex items-center justify-center" title="Modifier">
                  <Pencil className="h-4 w-4" style={{ color: 'var(--text-secondary)' }} />
                </button>
                <button onClick={(e) => { e.stopPropagation(); toggleActif(row); }} className="p-2 rounded-md hover:bg-[var(--surface-hover)] min-h-[40px] min-w-[40px] flex items-center justify-center" title={row.actif ? 'Désactiver' : 'Activer'}>
                  {row.actif ? <Ban className="h-4 w-4" style={{ color: 'var(--color-danger)' }} /> : <Check className="h-4 w-4" style={{ color: 'var(--color-success)' }} />}
                </button>
              </div>
            ),
          },
        ]}
        data={displayedEleves}
        loading={loading}
        emptyMessage="Aucun élève trouvé"
        emptyDescription="Inscrivez un élève ou ajustez vos filtres."
        emptyAction={<Button icon={ClipboardList} size="sm" onClick={() => goInscrire()}>Nouvelle inscription</Button>}
        onRowClick={openDetail}
        sortable
        pagination
        pageSize={15}
      />

      <Modal
        open={createOpen}
        onClose={() => { setCreateOpen(false); setForm(EMPTY_FORM); }}
        title="Fiche identité"
        subtitle="Crée uniquement l'identité — pour scolariser, utilisez Nouvelle inscription"
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => { setCreateOpen(false); setForm(EMPTY_FORM); }}>Annuler</Button>
            <Button onClick={handleCreate} disabled={saving}>{saving ? 'Création...' : 'Créer'}</Button>
          </div>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Matricule" required>
            <Input value={form.matricule} onChange={(e) => setForm({ ...form, matricule: e.target.value })} placeholder="EX: ELV-2026-001" />
          </FormField>
          <FormField label="Sexe" required>
            <Select value={form.sexe} onChange={(e) => setForm({ ...form, sexe: e.target.value })}>
              <option value="M">Garçon</option>
              <option value="F">Fille</option>
            </Select>
          </FormField>
          <FormField label="Nom" required>
            <Input value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} />
          </FormField>
          <FormField label="Prénom" required>
            <Input value={form.prenom} onChange={(e) => setForm({ ...form, prenom: e.target.value })} />
          </FormField>
          <FormField label="Date de naissance" required>
            <Input type="date" value={form.dateNaissance} onChange={(e) => setForm({ ...form, dateNaissance: e.target.value })} />
          </FormField>
          <FormField label="Lieu de naissance">
            <Input value={form.lieuNaissance} onChange={(e) => setForm({ ...form, lieuNaissance: e.target.value })} />
          </FormField>
          <FormField label="Adresse" className="sm:col-span-2">
            <Input value={form.adresse} onChange={(e) => setForm({ ...form, adresse: e.target.value })} />
          </FormField>
        </div>
      </Modal>

      <Modal
        open={editOpen}
        onClose={() => { setEditOpen(false); setEditing(null); setForm(EMPTY_FORM); }}
        title="Modifier l'élève"
        subtitle={editing?.matricule}
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => { setEditOpen(false); setEditing(null); setForm(EMPTY_FORM); }}>Annuler</Button>
            <Button onClick={handleUpdate} disabled={saving}>{saving ? 'Enregistrement...' : 'Enregistrer'}</Button>
          </div>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Matricule" required>
            <Input value={form.matricule} onChange={(e) => setForm({ ...form, matricule: e.target.value })} />
          </FormField>
          <FormField label="Sexe" required>
            <Select value={form.sexe} onChange={(e) => setForm({ ...form, sexe: e.target.value })}>
              <option value="M">Garçon</option>
              <option value="F">Fille</option>
            </Select>
          </FormField>
          <FormField label="Nom" required>
            <Input value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} />
          </FormField>
          <FormField label="Prénom" required>
            <Input value={form.prenom} onChange={(e) => setForm({ ...form, prenom: e.target.value })} />
          </FormField>
          <FormField label="Date de naissance" required>
            <Input type="date" value={form.dateNaissance} onChange={(e) => setForm({ ...form, dateNaissance: e.target.value })} />
          </FormField>
          <FormField label="Lieu de naissance">
            <Input value={form.lieuNaissance} onChange={(e) => setForm({ ...form, lieuNaissance: e.target.value })} />
          </FormField>
          <FormField label="Adresse" className="sm:col-span-2">
            <Input value={form.adresse} onChange={(e) => setForm({ ...form, adresse: e.target.value })} />
          </FormField>
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
                {(() => {
                  const insc = detail.inscriptions?.find((i) => i.anneeScolaire?.actif) || detail.inscriptions?.[0];
                  const solde = insc?.soldeScolarite;
                  const statut = insc?.statut;
                  return (
                    <>
                      <p className="text-sm font-semibold" style={{ color: (solde || 0) > 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>
                        {formatPrice(solde || 0)}
                      </p>
                      {statut && (
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                          {statut === 'validee' ? 'Scolarisé' : statut === 'en_attente' ? 'Inscription en attente' : statut}
                        </p>
                      )}
                    </>
                  );
                })()}
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
            <div className="flex justify-center py-12"><Spinner className="h-8 w-8" /></div>
          </div>
        )}
      </Modal>

      <Modal
        open={printOpen}
        onClose={() => setPrintOpen(false)}
        title="Imprimer la liste des élèves"
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setPrintOpen(false)}>Annuler</Button>
            <Button icon={Printer} onClick={runPrint}>Imprimer</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="space-y-2">
            {[
              { id: 'all', label: 'Toutes les classes (regroupées)' },
              { id: 'classe', label: 'Une seule classe' },
              { id: 'custom', label: 'Sélection personnalisée' },
            ].map((opt) => (
              <label key={opt.id} className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--text-primary)' }}>
                <input
                  type="radio"
                  name="printMode"
                  checked={printMode === opt.id}
                  onChange={() => setPrintMode(opt.id)}
                />
                {opt.label}
              </label>
            ))}
          </div>
          {printMode === 'classe' && (
            <Select value={printClasseId} onChange={(e) => setPrintClasseId(e.target.value)}>
              <option value="">Sélectionner une classe</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </Select>
          )}
          {printMode === 'custom' && (
            <div className="max-h-56 overflow-y-auto rounded-lg p-2 space-y-1" style={{ border: '1px solid var(--border-subtle)' }}>
              {displayedEleves.map((e) => (
                <label key={e.id} className="flex items-center gap-2 text-sm px-2 py-1 rounded cursor-pointer hover:bg-[var(--surface-hover)]" style={{ color: 'var(--text-primary)' }}>
                  <input
                    type="checkbox"
                    checked={printSelected.has(e.id)}
                    onChange={() => togglePrintSelect(e.id)}
                  />
                  <span className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>{e.matricule}</span>
                  <span>{e.prenom} {e.nom}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default Eleves;
