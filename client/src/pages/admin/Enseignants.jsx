import { useEffect, useState, useCallback, useMemo } from 'react';
import toast from 'react-hot-toast';
import { useAxios } from '../../hooks/useAxios';
import {
  PageHeader,
  SearchInput,
  Button,
  DataTable,
  Modal,
  Badge,
  KpiCard,
  KpiGrid,
} from '../../components/ui';
import { GraduationCap, Plus, Pencil, Link2, Trash2, Users } from 'lucide-react';

const CYCLES_TITULAIRE = ['prescolaire', 'primaire'];

const Enseignants = () => {
  const { get, post, put, delete: del } = useAxios();
  const [enseignants, setEnseignants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    nom: '', prenom: '', email: '', telephone: '', typeContrat: 'titulaire',
  });
  const [resultModal, setResultModal] = useState({ open: false, password: '', email: '' });

  const [assignOpen, setAssignOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [classes, setClasses] = useState([]);
  const [matieres, setMatieres] = useState([]);
  const [assignForm, setAssignForm] = useState({ classeId: '', matiereId: '' });

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

  const fetchEnseignants = useCallback(async () => {
    setLoading(true);
    try {
      const res = await get('/api/staff/enseignants', { silent: true });
      setEnseignants(Array.isArray(res) ? res : (res?.data || []));
    } catch {
      setEnseignants([]);
    } finally {
      setLoading(false);
    }
  }, [get]);

  useEffect(() => { fetchEnseignants(); }, [fetchEnseignants]);

  const filtered = useMemo(() => {
    if (!search) return enseignants;
    const q = search.toLowerCase();
    return enseignants.filter(
      (e) =>
        e.nom?.toLowerCase().includes(q) ||
        e.prenom?.toLowerCase().includes(q) ||
        e.email?.toLowerCase().includes(q)
    );
  }, [enseignants, search]);

  const stats = useMemo(() => {
    const actifs = enseignants.filter((e) => e.actif !== false).length;
    const affectations = enseignants.reduce((n, e) => n + (e.enseignantClasses?.length || 0), 0);
    return { total: enseignants.length, actifs, affectations };
  }, [enseignants]);

  const selectedClasse = classes.find((c) => c.id === assignForm.classeId);
  const isTitulaireMode = CYCLES_TITULAIRE.includes(selectedClasse?.cycle);

  const openCreate = () => {
    setEditing(null);
    setForm({ nom: '', prenom: '', email: '', telephone: '', typeContrat: 'titulaire' });
    setModalOpen(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    setForm({
      nom: row.nom || '',
      prenom: row.prenom || '',
      email: row.email || '',
      telephone: row.telephone || '',
      typeContrat: row.typeContrat || 'titulaire',
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        await put(`/api/staff/${editing.id}`, { ...form, role: 'enseignant', actif: editing.actif !== false });
        toast.success('Enseignant mis à jour');
      } else {
        const res = await post('/api/staff', { ...form, role: 'enseignant' });
        setResultModal({
          open: true,
          password: res?.motDePasseProvisoire || res?.tempPassword || '',
          email: form.email || res?.email || '',
        });
        toast.success('Enseignant créé');
      }
      setModalOpen(false);
      fetchEnseignants();
    } catch { /* toast via axios */ }
  };

  const openAssign = async (row) => {
    setSelected(row);
    setAssignForm({ classeId: '', matiereId: '' });
    setAssignOpen(true);
    try {
      const [cl, mat] = await Promise.all([
        get('/api/classes?limit=200', { silent: true }),
        get('/api/matieres', { silent: true }),
      ]);
      setClasses(cl?.data || cl || []);
      setMatieres(mat?.data || mat || []);
    } catch { /* silent */ }
  };

  const handleAssign = async () => {
    if (!selected || !assignForm.classeId) {
      toast.error('Sélectionnez une classe');
      return;
    }
    try {
      if (isTitulaireMode) {
        // Préscolaire / primaire : titulaire sur toutes les matières actives (ou la sélectionnée)
        const matiereIds = assignForm.matiereId
          ? [assignForm.matiereId]
          : matieres.filter((m) => m.actif !== false).map((m) => m.id);
        if (!matiereIds.length) {
          toast.error('Aucune matière catalogue — créez-en une d’abord');
          return;
        }
        let ok = 0;
        let refus = null;
        let classesLiberees = [];
        for (const matiereId of matiereIds) {
          try {
            const res = await post(
              `/api/matieres/${matiereId}/affectations`,
              { enseignantId: selected.id, classeId: assignForm.classeId },
              { silent: true }
            );
            ok += 1;
            if (res?.classesLiberees?.length) classesLiberees = res.classesLiberees;
          } catch (err) {
            const message = err.response?.data?.error;
            if (message && message !== 'Affectation déjà existante' && !refus) refus = message;
          }
        }
        if (refus) {
          toast.error(refus);
          return;
        }
        if (classesLiberees.length) {
          toast(`Retiré de ${classesLiberees.join(', ')} — retour désormais impossible`, { icon: '⚠️' });
        }
        toast.success(ok ? `Titulaire assigné (${ok} matière${ok > 1 ? 's' : ''})` : 'Affectations déjà présentes');
      } else {
        if (!assignForm.matiereId) {
          toast.error('Sélectionnez une matière (collège / lycée)');
          return;
        }
        const res = await post(`/api/matieres/${assignForm.matiereId}/affectations`, {
          enseignantId: selected.id,
          classeId: assignForm.classeId,
        });
        if (res?.classesLiberees?.length) {
          toast(`Retiré de ${res.classesLiberees.join(', ')} — retour désormais impossible`, { icon: '⚠️' });
        }
        toast.success('Affectation enregistrée');
      }
      setAssignForm({ classeId: '', matiereId: '' });
      fetchEnseignants();
      const refreshed = await get('/api/staff/enseignants', { silent: true });
      const list = Array.isArray(refreshed) ? refreshed : (refreshed?.data || []);
      const updated = list.find((e) => e.id === selected.id);
      if (updated) setSelected(updated);
    } catch { /* silent */ }
  };

  const removeAssign = async (aff) => {
    try {
      await del(`/api/matieres/affectations/${aff.id}`);
      toast.success('Affectation retirée');
      fetchEnseignants();
      if (selected) {
        setSelected((s) => ({
          ...s,
          enseignantClasses: (s.enseignantClasses || []).filter((a) => a.id !== aff.id),
        }));
      }
    } catch { /* silent */ }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Enseignants"
        subtitle="Identité, matières enseignées et affectations aux classes"
        actions={<Button icon={Plus} onClick={openCreate}>Nouvel enseignant</Button>}
      />

      <KpiGrid cols={3}>
        <KpiCard label="Enseignants" value={stats.total} icon={GraduationCap} color="primary" />
        <KpiCard label="Actifs" value={stats.actifs} icon={Users} color="green" />
        <KpiCard label="Affectations" value={stats.affectations} icon={Link2} color="blue" />
      </KpiGrid>

      <div className="flex flex-wrap gap-3 items-center max-w-sm">
        <SearchInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nom, prénom, email…" />
      </div>

      <DataTable
        loading={loading}
        data={filtered}
        emptyMessage="Aucun enseignant"
        columns={[
          {
            key: 'nom',
            label: 'Enseignant',
            primary: true,
            render: (_, row) => (
              <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                {row.prenom} {row.nom}
              </span>
            ),
          },
          {
            key: 'email',
            label: 'Contact',
            secondary: true,
            render: (_, row) => (
              <div className="text-sm">
                <div style={{ color: 'var(--text-secondary)' }}>{row.email || '—'}</div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{row.telephone || ''}</div>
              </div>
            ),
            mobileRender: (_, row) => [row.email, row.telephone].filter(Boolean).join(' · ') || '—',
          },
          {
            key: 'typeContrat',
            label: 'Contrat',
            badge: true,
            render: (v) => <Badge variant="neutral">{v || 'titulaire'}</Badge>,
          },
          {
            key: 'enseignantClasses',
            label: 'Classes / matières',
            hideOnMobile: true,
            render: (affs) => {
              if (!affs?.length) return <span style={{ color: 'var(--text-muted)' }}>—</span>;
              const uniqueClasses = [...new Map(affs.map((a) => [a.classeId, a.classe?.nom])).entries()];
              return (
                <div className="flex flex-wrap gap-1">
                  {uniqueClasses.slice(0, 4).map(([id, nom]) => (
                    <Badge key={id} variant="info">{nom || '?'}</Badge>
                  ))}
                  {uniqueClasses.length > 4 && <Badge variant="neutral">+{uniqueClasses.length - 4}</Badge>}
                </div>
              );
            },
          },
          {
            key: 'actif',
            label: 'Statut',
            hideOnMobile: true,
            render: (v) => (v !== false ? <Badge variant="success" dot>Actif</Badge> : <Badge variant="neutral">Inactif</Badge>),
          },
          {
            key: 'actions',
            label: 'Actions',
            actions: true,
            render: (_, row) => (
              <div className="flex items-center gap-1">
                <button onClick={() => openAssign(row)} className="p-1.5 rounded-md hover:bg-[var(--surface-hover)]" title="Affecter">
                  <Link2 className="h-4 w-4" style={{ color: 'var(--text-secondary)' }} />
                </button>
                <button onClick={() => openEdit(row)} className="p-1.5 rounded-md hover:bg-[var(--surface-hover)]" title="Modifier">
                  <Pencil className="h-4 w-4" style={{ color: 'var(--text-secondary)' }} />
                </button>
              </div>
            ),
          },
        ]}
      />

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Modifier l’enseignant' : 'Nouvel enseignant'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Annuler</Button>
            <Button onClick={handleSubmit}>{editing ? 'Enregistrer' : 'Créer'}</Button>
          </>
        }
      >
        <form className="space-y-3" onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Prénom</label>
              <input style={inputStyle} required value={form.prenom} onChange={(e) => setForm({ ...form, prenom: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Nom</label>
              <input style={inputStyle} required value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Email</label>
            <input type="email" style={inputStyle} required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} disabled={!!editing} />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Téléphone</label>
            <input style={inputStyle} value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Type de contrat</label>
            <select style={inputStyle} value={form.typeContrat} onChange={(e) => setForm({ ...form, typeContrat: e.target.value })}>
              <option value="titulaire">Titulaire</option>
              <option value="contractuel">Contractuel</option>
              <option value="vacataire">Vacataire</option>
              <option value="stagiaire">Stagiaire</option>
            </select>
          </div>
        </form>
      </Modal>

      <Modal
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        title={selected ? `Affectations — ${selected.prenom} ${selected.nom}` : 'Affectations'}
        size="lg"
        footer={<Button variant="secondary" onClick={() => setAssignOpen(false)}>Fermer</Button>}
      >
        {selected && (
          <div className="space-y-4">
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Préscolaire / primaire : titulaire d’une seule classe (matière optionnelle = toutes les matières).
              Toute réaffectation retire la classe précédente et en ferme définitivement le retour.
              Collège / lycée : une seule matière par enseignant, sur autant de classes que nécessaire.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-end">
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Classe</label>
                <select style={inputStyle} value={assignForm.classeId} onChange={(e) => setAssignForm({ ...assignForm, classeId: e.target.value, matiereId: '' })}>
                  <option value="">Sélectionner</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>{c.nom} ({c.cycle})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>
                  Matière{isTitulaireMode ? ' (optionnel)' : ''}
                </label>
                <select style={inputStyle} value={assignForm.matiereId} onChange={(e) => setAssignForm({ ...assignForm, matiereId: e.target.value })}>
                  <option value="">{isTitulaireMode ? '— Toutes (titulaire) —' : 'Sélectionner'}</option>
                  {matieres.filter((m) => m.actif !== false).map((m) => (
                    <option key={m.id} value={m.id}>{m.nom}</option>
                  ))}
                </select>
              </div>
              <Button icon={Plus} onClick={handleAssign}>Assigner</Button>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {(selected.enseignantClasses || []).map((a) => (
                <div key={a.id} className="flex items-center justify-between p-2 rounded-lg" style={{ background: 'var(--surface-overlay)' }}>
                  <div className="text-sm">
                    <span style={{ color: 'var(--text-primary)' }}>{a.classe?.nom}</span>
                    <span style={{ color: 'var(--text-muted)' }}> · {a.matiere?.nom}</span>
                    {CYCLES_TITULAIRE.includes(a.classe?.cycle) && (
                      <span className="ml-2"><Badge variant="success">Titulaire</Badge></span>
                    )}
                  </div>
                  <button onClick={() => removeAssign(a)} className="p-1.5 rounded-md hover:bg-[var(--surface-hover)]" title="Retirer">
                    <Trash2 className="h-4 w-4" style={{ color: 'var(--color-danger)' }} />
                  </button>
                </div>
              ))}
              {!(selected.enseignantClasses || []).length && (
                <p className="text-sm text-center py-4" style={{ color: 'var(--text-muted)' }}>Aucune affectation</p>
              )}
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={resultModal.open}
        onClose={() => setResultModal({ open: false, password: '', email: '' })}
        title="Compte créé"
        footer={<Button onClick={() => setResultModal({ open: false, password: '', email: '' })}>OK</Button>}
      >
        <div className="space-y-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <p>
            Email :{' '}
            <strong style={{ color: 'var(--text-primary)' }}>{resultModal.email || '—'}</strong>
          </p>
          <p>
            Mot de passe temporaire :{' '}
            <strong style={{ color: 'var(--color-primary)' }}>
              {resultModal.password || '(voir email / logs)'}
            </strong>
          </p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Communiquez ces identifiants à l’enseignant — le mot de passe devra être changé à la première connexion.
          </p>
        </div>
      </Modal>
    </div>
  );
};

export default Enseignants;
