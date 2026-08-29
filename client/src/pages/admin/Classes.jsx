import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAxios } from '../../hooks/useAxios';
import { useTenant } from '../../contexts/TenantContext';
import { CYCLE_LABELS, resolveAllowedCycles } from '../../constants/cycles.js';
import { PageHeader, Badge, Button, Modal, Input, Select, FormField, SegmentedControl, EmptyState, Skeleton, DataTable } from '../../components/ui';
import { School, Plus, Users, BookOpen, Printer, BarChart3, Pencil } from 'lucide-react';
import toast from 'react-hot-toast';

const Classes = () => {
  const { get, post, put } = useAxios();
  const { formatPrice, config } = useTenant();
  const allowedCycles = useMemo(
    () => resolveAllowedCycles(config?.concerneCycles),
    [config?.concerneCycles],
  );
  const navigate = useNavigate();
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterCycle, setFilterCycle] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(null);
  const [editForm, setEditForm] = useState({ nom: '', capacite: 40, fraisScolarite: 0 });
  const [detail, setDetail] = useState(null);
  const [niveaux, setNiveaux] = useState([]);
  const [filieres, setFilieres] = useState([]);
  const [anneeId, setAnneeId] = useState('');
  const [form, setForm] = useState({
    nom: '', niveauOfficielId: '', filiereOfficielleId: '', capacite: 40, fraisScolarite: 0,
  });

  const printClasseListe = () => {
    if (!detail) return;
    const rows = detail.inscriptions || detail.eleves || [];
    const body = rows.map((r, i) => {
      const mat = r.eleve?.matricule || r.matricule || '';
      const nom = r.eleve ? `${r.eleve.prenom} ${r.eleve.nom}` : `${r.prenom || ''} ${r.nom || ''}`;
      return `<tr><td>${i + 1}</td><td>${mat}</td><td>${nom}</td></tr>`;
    }).join('');
    const w = window.open('', '_blank', 'noopener,noreferrer,width=900,height=700');
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><title>Liste ${detail.nom}</title>
      <style>
        body{font-family:system-ui,sans-serif;padding:24px;color:#111}
        h1{font-size:18px;margin:0 0 4px}.meta{font-size:12px;color:#555;margin-bottom:16px}
        table{width:100%;border-collapse:collapse;font-size:12px}
        th,td{border:1px solid #ddd;padding:6px 8px;text-align:left}th{background:#f5f5f5}
      </style></head><body>
      <h1>Liste de classe — ${detail.nom}</h1>
      <p class="meta">${detail.anneeScolaire?.libelle || ''} · ${rows.length} élève(s) · ${new Date().toLocaleDateString('fr-FR')}</p>
      <table><thead><tr><th>#</th><th>Matricule</th><th>Nom</th></tr></thead><tbody>${body || '<tr><td colspan="3">Aucun élève</td></tr>'}</tbody></table>
      <script>window.onload=function(){window.print();}</script>
      </body></html>`);
    w.document.close();
  };

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

  const openCreate = async () => {
    setCreateOpen(true);
    try {
      const an = await get('/api/annees-scolaires', { silent: true });
      const annees = an?.data || an || [];
      const active = annees.find((a) => a.statut === 'active' || a.actif) || annees[0];
      const activeId = active?.id || '';
      setAnneeId(activeId);
      const qs = activeId ? `?anneeScolaireId=${activeId}` : '';
      const [niv, fil] = await Promise.all([
        get(`/api/referentiel/niveaux${qs}`, { silent: true }),
        get(`/api/referentiel/filieres${qs}`, { silent: true }),
      ]);
      setNiveaux(niv?.data || niv || []);
      setFilieres(fil?.data || fil || []);
    } catch { /* silent */ }
  };

  const handleCreate = async () => {
    try {
      await post('/api/classes', {
        ...form,
        anneeScolaireId: anneeId,
        filiereOfficielleId: form.filiereOfficielleId || null,
      });
      setCreateOpen(false);
      setForm({ nom: '', niveauOfficielId: '', filiereOfficielleId: '', capacite: 40, fraisScolarite: 0 });
      toast.success('Classe créée');
      fetchClasses();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Création impossible');
    }
  };

  const openEdit = (classe, e) => {
    e?.stopPropagation();
    setEditOpen(classe);
    setEditForm({
      nom: classe.nom || '',
      capacite: classe.capacite ?? 40,
      fraisScolarite: Number(classe.fraisScolarite) || 0,
    });
  };

  const handleEdit = async () => {
    if (!editOpen) return;
    try {
      await put(`/api/classes/${editOpen.id}`, {
        nom: editForm.nom,
        capacite: editForm.capacite,
        fraisScolarite: editForm.fraisScolarite,
      });
      toast.success('Classe mise à jour');
      setEditOpen(null);
      fetchClasses();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Modification impossible');
    }
  };

  const openDetail = async (classe) => {
    try {
      const res = await get(`/api/classes/${classe.id}`);
      setDetail(res);
    } catch { /* silent */ }
  };

  const selectedNiveau = niveaux.find((n) => n.id === form.niveauOfficielId);
  const showFiliere = selectedNiveau?.cycle === 'lycee';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Classes & Niveaux"
        subtitle={
          allowedCycles.length < 4
            ? `Niveaux : ${allowedCycles.map((c) => CYCLE_LABELS[c]).join(', ')}`
            : 'Niveaux officiels Congo (selon cycles de l\'établissement)'
        }
        actions={<Button icon={Plus} onClick={openCreate}>Nouvelle classe</Button>}
      />

      <SegmentedControl
        value={filterCycle || 'all'}
        onChange={(v) => setFilterCycle(v === 'all' ? '' : v)}
        options={[
          { value: 'all', label: 'Tous' },
          ...allowedCycles.map((c) => ({ value: c, label: CYCLE_LABELS[c] })),
        ]}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl p-5" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
              <Skeleton height={20} width="40%" className="mb-3" />
              <Skeleton height={12} width="30%" className="mb-2" />
              <Skeleton height={12} width="50%" />
            </div>
          ))
        ) : classes.length === 0 ? (
          <div className="col-span-full">
            <EmptyState
              icon={School}
              title="Aucune classe trouvée"
              description="Créez une classe pour démarrer l'année scolaire."
              action={<Button icon={Plus} size="sm" onClick={openCreate}>Nouvelle classe</Button>}
            />
          </div>
        ) : (
          classes.map((classe) => (
            <div
              key={classe.id}
              onClick={() => openDetail(classe)}
              className="rounded-xl p-5 cursor-pointer card-hover"
              style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-card)' }}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{classe.nom}</h3>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {classe.niveauOfficiel?.libelle || classe.niveau}
                    {classe.filiere ? ` · ${classe.filiere}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={(e) => openEdit(classe, e)}
                    className="p-1.5 rounded-md hover:bg-[var(--surface-hover)]"
                    title="Modifier"
                  >
                    <Pencil className="h-3.5 w-3.5" style={{ color: 'var(--text-secondary)' }} />
                  </button>
                  <Badge variant="info">{CYCLE_LABELS[classe.cycle] || classe.cycle}</Badge>
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--text-muted)' }}>
                <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {classe.effectif || 0}/{classe.capacite}</span>
                <span className="flex items-center gap-1"><BookOpen className="h-3.5 w-3.5" /> {classe.nbAffectations ?? classe.nbMatieres ?? 0} affectations</span>
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
            <Button onClick={handleCreate} disabled={!form.nom || !form.niveauOfficielId || !anneeId}>Créer</Button>
          </>
        }
      >
        <div className="space-y-4">
          <FormField label="Nom de la classe" required>
            <Input
              value={form.nom}
              onChange={(e) => setForm({ ...form, nom: e.target.value })}
              placeholder={
                allowedCycles.includes('primaire') && !allowedCycles.includes('college')
                  ? 'ex: CP1 A, CE2 B, CM2 A'
                  : allowedCycles.includes('lycee')
                  ? 'ex: 2nde C, 1ère D, Terminale S1'
                  : 'ex: 6ème A, 3ème B'
              }
            />
          </FormField>
          <FormField label="Niveau officiel" required hint={selectedNiveau ? `Cycle : ${CYCLE_LABELS[selectedNiveau.cycle]}${selectedNiveau.typeExamenSortie ? ` · Examen de sortie : ${selectedNiveau.typeExamenSortie}` : ''}` : undefined}>
            <Select
              value={form.niveauOfficielId}
              onChange={(e) => setForm({ ...form, niveauOfficielId: e.target.value, filiereOfficielleId: '' })}
            >
              <option value="">
                {allowedCycles.length === 1
                  ? `Sélectionner le niveau (${CYCLE_LABELS[allowedCycles[0]]})`
                  : 'Sélectionner un niveau officiel'}
              </option>
              {niveaux
                .filter((n) => !allowedCycles.length || allowedCycles.includes(n.cycle))
                .map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.libelle} ({n.code}) — {CYCLE_LABELS[n.cycle] || n.cycle}
                  </option>
                ))}
            </Select>
          </FormField>
          {showFiliere && allowedCycles.includes('lycee') && (
            <FormField label="Filière officielle" hint="Filière spécifique au lycée (Scientifique, Littéraire, etc.)">
              <Select value={form.filiereOfficielleId} onChange={(e) => setForm({ ...form, filiereOfficielleId: e.target.value })}>
                <option value="">Générale / Non spécifiée</option>
                {filieres.map((f) => <option key={f.id} value={f.id}>{f.libelle}</option>)}
              </Select>
            </FormField>
          )}
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Capacité">
              <Input type="number" value={form.capacite} onChange={(e) => setForm({ ...form, capacite: parseInt(e.target.value) || 0 })} />
            </FormField>
            <FormField label="Frais de scolarité">
              <Input type="number" value={form.fraisScolarite} onChange={(e) => setForm({ ...form, fraisScolarite: parseFloat(e.target.value) || 0 })} />
            </FormField>
          </div>
        </div>
      </Modal>

      <Modal
        open={!!editOpen}
        onClose={() => setEditOpen(null)}
        title="Modifier la classe"
        subtitle={editOpen?.anneeScolaire?.libelle}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditOpen(null)}>Annuler</Button>
            <Button onClick={handleEdit} disabled={!editForm.nom}>Enregistrer</Button>
          </>
        }
      >
        <div className="space-y-4">
          <FormField label="Nom de la classe" required>
            <Input value={editForm.nom} onChange={(e) => setEditForm({ ...editForm, nom: e.target.value })} />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Capacité">
              <Input type="number" value={editForm.capacite} onChange={(e) => setEditForm({ ...editForm, capacite: parseInt(e.target.value, 10) || 0 })} />
            </FormField>
            <FormField label="Frais de scolarité">
              <Input type="number" value={editForm.fraisScolarite} onChange={(e) => setEditForm({ ...editForm, fraisScolarite: parseFloat(e.target.value) || 0 })} />
            </FormField>
          </div>
        </div>
      </Modal>

      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail?.nom || 'Détail classe'}
        subtitle={detail?.anneeScolaire?.libelle}
        size="xl"
        footer={detail ? (
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" icon={Printer} onClick={printClasseListe}>Imprimer la liste</Button>
            <Button
              variant="secondary"
              icon={BarChart3}
              onClick={() => {
                const qs = new URLSearchParams();
                if (detail.id) qs.set('classeId', detail.id);
                if (detail.anneeScolaireId || detail.anneeScolaire?.id) {
                  qs.set('anneeScolaireId', detail.anneeScolaireId || detail.anneeScolaire.id);
                }
                navigate(`/admin/bulletins?${qs.toString()}`);
              }}
            >
              Moyennes / Bulletins
            </Button>
            <Button variant="ghost" onClick={() => setDetail(null)}>Fermer</Button>
          </div>
        ) : null}
      >
        {detail && (
          <div className="space-y-6">
            {(detail.enseignants?.length > 0) && (
              <div>
                <h4 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                  Affectations ({detail.enseignants.length})
                </h4>
                <div className="flex flex-wrap gap-2">
                  {detail.enseignants.map((a) => (
                    <span
                      key={a.id}
                      className="text-xs px-2 py-1 rounded-md"
                      style={{ background: 'var(--surface-overlay)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}
                    >
                      {a.matiere?.nom || a.matiere?.code || 'Matière'}
                      {a.enseignant ? ` · ${a.enseignant.prenom} ${a.enseignant.nom}` : ''}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div>
              <h4 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
                Élèves inscrits ({detail.inscriptions?.length || detail.eleves?.length || 0})
              </h4>
              <DataTable
                columns={[
                  { key: 'matricule', label: 'Matricule', render: (_, r) => <span className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>{r.eleve?.matricule || r.matricule}</span> },
                  { key: 'nom', label: 'Nom', render: (_, r) => <span style={{ color: 'var(--text-primary)' }}>{r.eleve ? `${r.eleve.prenom} ${r.eleve.nom}` : `${r.prenom} ${r.nom}`}</span> },
                ]}
                data={detail.inscriptions || detail.eleves || []}
                emptyMessage="Aucun élève inscrit"
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Classes;
