import { useEffect, useState, useCallback } from 'react';
import { useAxios } from '../../hooks/useAxios';
import { useTenant } from '../../contexts/TenantContext';
import { PageHeader, Badge, Button, Modal, Input, Select, FormField, SegmentedControl, EmptyState, Skeleton, DataTable } from '../../components/ui';
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
  const [niveaux, setNiveaux] = useState([]);
  const [filieres, setFilieres] = useState([]);
  const [anneeId, setAnneeId] = useState('');
  const [form, setForm] = useState({
    nom: '', niveauOfficielId: '', filiereOfficielleId: '', capacite: 40, fraisScolarite: 0,
  });

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
      const active = annees.find((a) => a.actif) || annees[0];
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
      fetchClasses();
    } catch { /* silent */ }
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
        subtitle="Niveaux officiels Congo (PS → Tle)"
        actions={<Button icon={Plus} onClick={openCreate}>Nouvelle classe</Button>}
      />

      <SegmentedControl
        value={filterCycle || 'all'}
        onChange={(v) => setFilterCycle(v === 'all' ? '' : v)}
        options={[
          { value: 'all', label: 'Tous' },
          ...CYCLES.map((c) => ({ value: c, label: CYCLE_LABELS[c] })),
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
            <Button onClick={handleCreate} disabled={!form.nom || !form.niveauOfficielId || !anneeId}>Créer</Button>
          </>
        }
      >
        <div className="space-y-4">
          <FormField label="Nom de la classe" required>
            <Input value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} placeholder="ex: 6ème A" />
          </FormField>
          <FormField label="Niveau officiel" required hint={selectedNiveau ? `Cycle : ${CYCLE_LABELS[selectedNiveau.cycle]}${selectedNiveau.typeExamenSortie ? ` · Examen : ${selectedNiveau.typeExamenSortie}` : ''}` : undefined}>
            <Select
              value={form.niveauOfficielId}
              onChange={(e) => setForm({ ...form, niveauOfficielId: e.target.value, filiereOfficielleId: '' })}
            >
              <option value="">Sélectionner (PS → Tle)</option>
              {niveaux.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.libelle} ({n.code}) — {CYCLE_LABELS[n.cycle] || n.cycle}
                </option>
              ))}
            </Select>
          </FormField>
          {showFiliere && (
            <FormField label="Filière officielle">
              <Select value={form.filiereOfficielleId} onChange={(e) => setForm({ ...form, filiereOfficielleId: e.target.value })}>
                <option value="">Optionnel</option>
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
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail?.nom || 'Détail classe'}
        subtitle={detail?.anneeScolaire?.libelle}
        size="xl"
      >
        {detail && (
          <div className="space-y-6">
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
