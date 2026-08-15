import { useEffect, useState, useCallback } from 'react';
import { useAxios } from '../../hooks/useAxios';
import { PageHeader, DataTable, Badge, Button, Modal, SegmentedControl, QuickSearchSelect } from '../../components/ui';
import { Plus, Pencil, Trash2, Link2 } from 'lucide-react';
import toast from 'react-hot-toast';

const Matieres = () => {
  const { get, post, put, delete: del } = useAxios();
  const [tab, setTab] = useState('catalogue');
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
  const [form, setForm] = useState({ nom: '', code: '', coefficient: 1, description: '', enseignantId: '', classeId: '' });

  // Programme
  const [annees, setAnnees] = useState([]);
  const [niveaux, setNiveaux] = useState([]);
  const [progAnneeId, setProgAnneeId] = useState('');
  const [progNiveauId, setProgNiveauId] = useState('');
  const [programme, setProgramme] = useState([]);
  const [progForm, setProgForm] = useState({ matiereId: '', coefficient: 1 });
  const [editingProgId, setEditingProgId] = useState(null);
  const [editCoef, setEditCoef] = useState(1);
  const [progClasseId, setProgClasseId] = useState('');
  const [classeProgramme, setClasseProgramme] = useState([]);
  const [classeForm, setClasseForm] = useState({ matiereId: '', coefficient: 1 });

  const fetchMatieres = useCallback(async () => {
    setLoading(true);
    try {
      const res = await get('/api/matieres');
      setMatieres(res?.data || res || []);
    } catch { /* silent */ }
    setLoading(false);
  }, [get]);

  useEffect(() => { fetchMatieres(); }, [fetchMatieres]);

  useEffect(() => {
    if (tab !== 'programme' && tab !== 'classe') return;
    (async () => {
      try {
        const [an, niv, cl] = await Promise.all([
          get('/api/annees-scolaires', { silent: true }),
          get('/api/referentiel/niveaux', { silent: true }),
          get('/api/classes?limit=200', { silent: true }),
        ]);
        setClasses(cl?.data || cl || []);
        const anneesList = an?.data || an || [];
        setAnnees(anneesList);
        setNiveaux(niv?.data || niv || []);
        const active = anneesList.find((a) => a.actif);
        if (active && !progAnneeId) setProgAnneeId(active.id);
      } catch { /* silent */ }
    })();
  }, [tab, get, progAnneeId]);

  const fetchProgramme = useCallback(async () => {
    if (!progAnneeId || !progNiveauId) {
      setProgramme([]);
      return;
    }
    try {
      const res = await get(`/api/matieres/programme/niveau?anneeScolaireId=${progAnneeId}&niveauOfficielId=${progNiveauId}`, { silent: true });
      setProgramme(res?.data || res || []);
    } catch { setProgramme([]); }
  }, [progAnneeId, progNiveauId, get]);

  useEffect(() => { fetchProgramme(); }, [fetchProgramme]);

  const fetchClasseProgramme = useCallback(async () => {
    if (!progClasseId) {
      setClasseProgramme([]);
      return;
    }
    try {
      const res = await get(`/api/matieres/programme/classe?classeId=${progClasseId}`, { silent: true });
      setClasseProgramme(res?.data || []);
    } catch { setClasseProgramme([]); }
  }, [progClasseId, get]);

  useEffect(() => { fetchClasseProgramme(); }, [fetchClasseProgramme]);

  const handleSave = async () => {
    try {
      let matiereId = editItem?.id;
      if (editItem) {
        await put(`/api/matieres/${editItem.id}`, form);
      } else {
        const created = await post('/api/matieres', {
          nom: form.nom,
          code: form.code,
          coefficient: form.coefficient,
          description: form.description,
        });
        matiereId = created?.id || created?.data?.id;
        if (matiereId && form.enseignantId && form.classeId) {
          try {
            await post(`/api/matieres/${matiereId}/affectations`, {
              enseignantId: form.enseignantId,
              classeId: form.classeId,
            });
          } catch { /* affectation optionnelle */ }
        }
      }
      setCreateOpen(false);
      setEditItem(null);
      setForm({ nom: '', code: '', coefficient: 1, description: '', enseignantId: '', classeId: '' });
      fetchMatieres();
    } catch { /* silent */ }
  };

  const openCreateMatiere = async () => {
    setEditItem(null);
    setForm({ nom: '', code: '', coefficient: 1, description: '', enseignantId: '', classeId: '' });
    setCreateOpen(true);
    try {
      const [cl, st] = await Promise.all([
        get('/api/classes?limit=200', { silent: true }),
        get('/api/staff/enseignants', { silent: true }),
      ]);
      setClasses(cl?.data || cl || []);
      const staffList = Array.isArray(st) ? st : (st?.staff || st?.data || []);
      setStaff(staffList.filter((s) => s.actif !== false));
    } catch { /* silent */ }
  };

  const handleEdit = (matiere) => {
    setEditItem(matiere);
    setForm({
      nom: matiere.nom,
      code: matiere.code,
      coefficient: matiere.coefficient,
      description: matiere.description || '',
      enseignantId: '',
      classeId: '',
    });
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
        get('/api/classes?limit=200', { silent: true }),
        get('/api/staff/enseignants', { silent: true }),
        get(`/api/matieres/${matiere.id}/affectations`, { silent: true }),
      ]);
      setClasses(cl?.data || cl || []);
      const staffList = Array.isArray(st) ? st : (st?.staff || st?.data || []);
      setStaff(staffList);
      setAffectations(Array.isArray(aff) ? aff : (aff?.data || []));
    } catch { /* silent */ }
  };

  const handleAffect = async () => {
    try {
      await post(`/api/matieres/${selectedMatiere.id}/affectations`, affectForm);
      const aff = await get(`/api/matieres/${selectedMatiere.id}/affectations`, { silent: true });
      setAffectations(Array.isArray(aff) ? aff : (aff?.data || []));
      setAffectForm({ enseignantId: '', classeId: '' });
    } catch { /* silent */ }
  };

  const removeAffect = async (affId) => {
    try {
      await del(`/api/matieres/affectations/${affId}`);
      const aff = await get(`/api/matieres/${selectedMatiere.id}/affectations`, { silent: true });
      setAffectations(Array.isArray(aff) ? aff : (aff?.data || []));
    } catch { /* silent */ }
  };

  const addToProgramme = async () => {
    if (!progAnneeId || !progNiveauId || !progForm.matiereId) {
      toast.error('Sélectionnez année, niveau et matière');
      return;
    }
    try {
      await post('/api/matieres/programme/niveau', {
        anneeScolaireId: progAnneeId,
        niveauOfficielId: progNiveauId,
        matiereId: progForm.matiereId,
        coefficient: progForm.coefficient,
        actif: true,
      });
      setProgForm({ matiereId: '', coefficient: 1 });
      fetchProgramme();
      toast.success('Matière ajoutée au programme');
    } catch { /* silent */ }
  };

  const removeFromProgramme = async (id) => {
    try {
      await del(`/api/matieres/programme/niveau/${id}`);
      fetchProgramme();
    } catch { /* silent */ }
  };

  const saveProgCoef = async (row) => {
    try {
      await post('/api/matieres/programme/niveau', {
        anneeScolaireId: progAnneeId,
        niveauOfficielId: progNiveauId,
        matiereId: row.matiereId || row.matiere?.id,
        coefficient: editCoef,
        actif: row.actif !== false,
      });
      setEditingProgId(null);
      fetchProgramme();
      toast.success('Coefficient mis à jour');
    } catch { /* silent */ }
  };

  const addToClasseProgramme = async () => {
    if (!progClasseId || !classeForm.matiereId) {
      toast.error('Sélectionnez une classe et une matière');
      return;
    }
    try {
      await post('/api/matieres/programme/classe', {
        classeId: progClasseId,
        matiereId: classeForm.matiereId,
        coefficient: classeForm.coefficient,
        actif: true,
      });
      setClasseForm({ matiereId: '', coefficient: 1 });
      fetchClasseProgramme();
      toast.success('Matière personnalisée pour cette classe');
    } catch { /* silent */ }
  };

  const saveClasseCoef = async (row) => {
    try {
      await post('/api/matieres/programme/classe', {
        classeId: progClasseId,
        matiereId: row.matiereId || row.matiere?.id,
        coefficient: editCoef,
        actif: true,
      });
      setEditingProgId(null);
      fetchClasseProgramme();
      toast.success('Coefficient mis à jour');
    } catch { /* silent */ }
  };

  const removeFromClasse = async (row) => {
    try {
      await post('/api/matieres/programme/classe', {
        classeId: progClasseId,
        matiereId: row.matiereId || row.matiere?.id,
        coefficient: row.coefficient,
        actif: false,
      });
      fetchClasseProgramme();
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
        subtitle="Catalogue école + programme par niveau / année"
        actions={tab === 'catalogue' ? (
          <Button icon={Plus} onClick={openCreateMatiere}>Nouvelle matière</Button>
        ) : null}
      />

      <SegmentedControl
        value={tab}
        onChange={setTab}
        options={[
          { value: 'catalogue', label: 'Catalogue' },
          { value: 'programme', label: 'Programme par niveau' },
          { value: 'classe', label: 'Matière personnalisée' },
        ]}
      />

      {tab === 'catalogue' && (
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
              label: 'Coef. défaut',
              render: (v) => <Badge variant="info">Coef. {v}</Badge>,
            },
            {
              key: 'actif',
              label: 'Statut',
              render: (v) => (v ? <Badge variant="success" dot>Active</Badge> : <Badge variant="neutral">Inactive</Badge>),
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
      )}

      {tab === 'programme' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Année</label>
              <select style={{ ...inputStyle, width: 180 }} value={progAnneeId} onChange={(e) => setProgAnneeId(e.target.value)}>
                <option value="">Sélectionner</option>
                {annees.map((a) => <option key={a.id} value={a.id}>{a.libelle}{a.actif ? ' (active)' : ''}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Niveau</label>
              <select style={{ ...inputStyle, width: 220 }} value={progNiveauId} onChange={(e) => setProgNiveauId(e.target.value)}>
                <option value="">Sélectionner</option>
                {niveaux.map((n) => <option key={n.id} value={n.id}>{n.libelle} ({n.code})</option>)}
              </select>
            </div>
          </div>

          {progAnneeId && progNiveauId && (
            <div className="rounded-lg p-4 space-y-3" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
              <div className="flex flex-wrap gap-2 items-end">
                <div className="flex-1 min-w-[160px]">
                  <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Matière catalogue</label>
                  <select style={inputStyle} value={progForm.matiereId} onChange={(e) => setProgForm({ ...progForm, matiereId: e.target.value })}>
                    <option value="">Sélectionner</option>
                    {matieres.filter((m) => m.actif !== false).map((m) => (
                      <option key={m.id} value={m.id}>{m.nom} ({m.code})</option>
                    ))}
                  </select>
                </div>
                <div className="w-28">
                  <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Coef.</label>
                  <input
                    type="number"
                    min="1"
                    style={inputStyle}
                    value={progForm.coefficient}
                    onChange={(e) => setProgForm({ ...progForm, coefficient: parseInt(e.target.value, 10) || 1 })}
                  />
                </div>
                <Button icon={Plus} onClick={addToProgramme}>Ajouter</Button>
              </div>

              <div className="space-y-2">
                {programme.map((p) => (
                  <div key={p.id} className="flex items-center justify-between p-3 rounded-lg gap-3" style={{ background: 'var(--surface-overlay)' }}>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                        {p.matiere?.nom} <span className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>({p.matiere?.code})</span>
                      </p>
                      {editingProgId === p.id ? (
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Coef.</span>
                          <input
                            type="number"
                            min="1"
                            style={{ ...inputStyle, width: 72, height: 32 }}
                            value={editCoef}
                            onChange={(e) => setEditCoef(parseInt(e.target.value, 10) || 1)}
                          />
                          <Button onClick={() => saveProgCoef(p)}>OK</Button>
                          <Button variant="secondary" onClick={() => setEditingProgId(null)}>Annuler</Button>
                        </div>
                      ) : (
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          Coef. {p.coefficient}{!p.actif ? ' · inactif' : ''}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => { setEditingProgId(p.id); setEditCoef(p.coefficient || 1); }}
                        className="p-1.5 rounded-md hover:bg-[var(--surface-hover)]"
                        title="Modifier le coefficient"
                      >
                        <Pencil className="h-4 w-4" style={{ color: 'var(--text-secondary)' }} />
                      </button>
                      <button onClick={() => removeFromProgramme(p.id)} className="p-1.5 rounded-md hover:bg-[var(--surface-hover)]" title="Retirer du programme">
                        <Trash2 className="h-4 w-4" style={{ color: 'var(--color-danger)' }} />
                      </button>
                    </div>
                  </div>
                ))}
                {programme.length === 0 && (
                  <p className="text-sm text-center py-4" style={{ color: 'var(--text-muted)' }}>
                    Aucune matière pour ce niveau cette année — le catalogue reste disponible, mais sans programme les bulletins utilisent le coef. défaut.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'classe' && (
        <div className="space-y-4">
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Classe</label>
            <select
              style={{ ...inputStyle, width: 220 }}
              value={progClasseId}
              onChange={(e) => setProgClasseId(e.target.value)}
            >
              <option value="">Sélectionner</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>
            <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
              Surcharge le programme du niveau pour cette classe uniquement (coef. ou matière en plus).
            </p>
          </div>

          {progClasseId && (
            <div className="rounded-lg p-4 space-y-3" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
              <div className="flex flex-wrap gap-2 items-end">
                <div className="flex-1 min-w-[160px]">
                  <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Matière catalogue</label>
                  <select style={inputStyle} value={classeForm.matiereId} onChange={(e) => setClasseForm({ ...classeForm, matiereId: e.target.value })}>
                    <option value="">Sélectionner</option>
                    {matieres.filter((m) => m.actif !== false).map((m) => (
                      <option key={m.id} value={m.id}>{m.nom} ({m.code})</option>
                    ))}
                  </select>
                </div>
                <div className="w-28">
                  <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Coef.</label>
                  <input
                    type="number"
                    min="1"
                    style={inputStyle}
                    value={classeForm.coefficient}
                    onChange={(e) => setClasseForm({ ...classeForm, coefficient: parseInt(e.target.value, 10) || 1 })}
                  />
                </div>
                <Button icon={Plus} onClick={addToClasseProgramme}>Ajouter</Button>
              </div>

              <div className="space-y-2">
                {classeProgramme.map((p) => (
                  <div key={p.matiereId || p.id} className="flex items-center justify-between p-3 rounded-lg gap-3" style={{ background: 'var(--surface-overlay)' }}>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                        {p.matiere?.nom} <span className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>({p.matiere?.code})</span>
                      </p>
                      {editingProgId === (p.matiereId || p.id) ? (
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Coef.</span>
                          <input
                            type="number"
                            min="1"
                            style={{ ...inputStyle, width: 72, height: 32 }}
                            value={editCoef}
                            onChange={(e) => setEditCoef(parseInt(e.target.value, 10) || 1)}
                          />
                          <Button onClick={() => saveClasseCoef(p)}>OK</Button>
                          <Button variant="secondary" onClick={() => setEditingProgId(null)}>Annuler</Button>
                        </div>
                      ) : (
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          Coef. {p.coefficient} · {p.source === 'classe' ? 'personnalisé' : 'programme niveau'}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => { setEditingProgId(p.matiereId || p.id); setEditCoef(p.coefficient || 1); }}
                        className="p-1.5 rounded-md hover:bg-[var(--surface-hover)]"
                        title="Modifier le coefficient"
                      >
                        <Pencil className="h-4 w-4" style={{ color: 'var(--text-secondary)' }} />
                      </button>
                      {p.source === 'classe' && (
                        <button onClick={() => removeFromClasse(p)} className="p-1.5 rounded-md hover:bg-[var(--surface-hover)]" title="Retirer la surcharge">
                          <Trash2 className="h-4 w-4" style={{ color: 'var(--color-danger)' }} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {classeProgramme.length === 0 && (
                  <p className="text-sm text-center py-4" style={{ color: 'var(--text-muted)' }}>
                    Aucune matière pour cette classe — le programme du niveau s’applique, ou ajoutez une matière ici.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

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
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Coefficient défaut</label>
              <input type="number" min="1" style={inputStyle} value={form.coefficient} onChange={(e) => setForm({ ...form, coefficient: parseInt(e.target.value, 10) || 1 })} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Description (optionnel)</label>
            <textarea style={{ ...inputStyle, height: 80, paddingTop: 10 }} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          {!editItem && (
            <div className="grid grid-cols-2 gap-3 pt-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Enseignant (optionnel)</label>
                <select style={inputStyle} value={form.enseignantId} onChange={(e) => setForm({ ...form, enseignantId: e.target.value })}>
                  <option value="">— Aucun —</option>
                  {staff.map((s) => <option key={s.id} value={s.id}>{s.prenom} {s.nom}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Classe (si enseignant)</label>
                <select style={inputStyle} value={form.classeId} onChange={(e) => setForm({ ...form, classeId: e.target.value })}>
                  <option value="">— Aucune —</option>
                  {classes.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
                </select>
              </div>
            </div>
          )}
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
            <QuickSearchSelect
              items={staff}
              value={affectForm.enseignantId}
              onChange={(id) => setAffectForm({ ...affectForm, enseignantId: id })}
              getLabel={(s) => `${s.prenom} ${s.nom}`}
              placeholder="Rechercher un enseignant…"
            />
            <QuickSearchSelect
              items={classes}
              value={affectForm.classeId}
              onChange={(id) => setAffectForm({ ...affectForm, classeId: id })}
              getLabel={(c) => c.nom}
              placeholder="Rechercher une classe…"
            />
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
