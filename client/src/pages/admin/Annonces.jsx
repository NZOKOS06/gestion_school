import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Megaphone, Plus, Trash2 } from 'lucide-react';
import { useAxios } from '../../hooks/useAxios';
import { useAuth } from '../../contexts/AuthContext';
import { PageHeader, Button, Modal, Badge, EmptyState } from '../../components/ui';

const CIBLES = [
  { value: 'tous', label: 'Tous les parents' },
  { value: 'cycle', label: 'Un cycle' },
  { value: 'classe', label: 'Une classe' },
  { value: 'impayes', label: 'Parents avec une scolarité impayée' },
];

const CYCLES = [
  { value: 'prescolaire', label: 'Préscolaire' },
  { value: 'primaire', label: 'Primaire' },
  { value: 'college', label: 'Collège' },
  { value: 'lycee', label: 'Lycée' },
];

const EMPTY = { titre: '', contenu: '', cible: 'tous', cibleValeur: '' };

/** Annonces de l'école vers les espaces parents (module Parents). */
const Annonces = () => {
  const { get, post, delete: del } = useAxios();
  const { user } = useAuth();
  const [annonces, setAnnonces] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null);
  const [nbDestinataires, setNbDestinataires] = useState(null);
  const [saving, setSaving] = useState(false);

  const fetchAnnonces = useCallback(async () => {
    setLoading(true);
    try {
      const res = await get('/api/annonces', { silent: true });
      setAnnonces(res?.data || []);
    } catch { /* silent */ }
    setLoading(false);
  }, [get]);

  useEffect(() => { fetchAnnonces(); }, [fetchAnnonces]);

  const openForm = async () => {
    setForm(EMPTY);
    if (!classes.length) {
      try {
        const res = await get('/api/classes?limit=200', { silent: true });
        setClasses(res?.data || res || []);
      } catch { /* silent */ }
    }
  };

  // Nombre de parents qui recevront l'annonce
  useEffect(() => {
    if (!form) return undefined;
    if ((form.cible === 'cycle' || form.cible === 'classe') && !form.cibleValeur) {
      setNbDestinataires(null);
      return undefined;
    }
    let cancelled = false;
    const params = new URLSearchParams({ cible: form.cible });
    if (form.cibleValeur) params.set('cibleValeur', form.cibleValeur);
    get(`/api/annonces/apercu?${params.toString()}`, { silent: true })
      .then((res) => { if (!cancelled) setNbDestinataires(res?.nbDestinataires ?? null); })
      .catch(() => { if (!cancelled) setNbDestinataires(null); });
    return () => { cancelled = true; };
  }, [form?.cible, form?.cibleValeur, get]); // eslint-disable-line react-hooks/exhaustive-deps

  const publier = async () => {
    if (!form.titre.trim() || !form.contenu.trim()) {
      toast.error('Titre et message obligatoires');
      return;
    }
    setSaving(true);
    try {
      const res = await post('/api/annonces', {
        titre: form.titre.trim(),
        contenu: form.contenu.trim(),
        cible: form.cible,
        cibleValeur: form.cibleValeur || null,
      });
      toast.success(`Annonce envoyée à ${res?.nbDestinataires ?? ''} parent(s)`);
      setForm(null);
      fetchAnnonces();
    } catch { /* toast via useAxios */ }
    setSaving(false);
  };

  const retirer = async (a) => {
    if (!window.confirm(`Retirer l'annonce « ${a.titre} » des espaces parents ?`)) return;
    try {
      await del(`/api/annonces/${a.id}`);
      toast.success('Annonce retirée');
      fetchAnnonces();
    } catch { /* toast via useAxios */ }
  };

  const libelleCible = (a) => {
    if (a.cible === 'cycle') return CYCLES.find((c) => c.value === a.cibleValeur)?.label || a.cibleValeur;
    if (a.cible === 'classe') return classes.find((c) => c.id === a.cibleValeur)?.nom || 'Une classe';
    return CIBLES.find((c) => c.value === a.cible)?.label || a.cible;
  };

  const input = 'w-full px-3 py-2 border rounded-lg bg-[var(--surface-overlay)]';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Annonces aux parents"
        subtitle="Messages diffusés dans les espaces parents, avec notification"
        actions={<Button icon={Plus} onClick={openForm}>Nouvelle annonce</Button>}
      />

      {!loading && annonces.length === 0 ? (
        <EmptyState icon={Megaphone} title="Aucune annonce" description="Informez les familles : réunion, sortie, fermeture, rappel de paiement…" />
      ) : (
        <div className="space-y-3">
          {annonces.map((a) => (
            <div key={a.id} className="rounded-xl p-4" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{a.titre}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {new Date(a.createdAt).toLocaleString('fr-FR')} · {a.auteur || '—'}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="info">{libelleCible(a)}</Badge>
                  <Badge variant="neutral">{a.nbLus}/{a.nbDestinataires} lus</Badge>
                  {(a.auteurId === user?.id || user?.role === 'directeur') && (
                    <button type="button" className="p-1.5 rounded-md hover:bg-[var(--surface-hover)]" onClick={() => retirer(a)} title="Retirer">
                      <Trash2 className="h-4 w-4" style={{ color: 'var(--color-danger)' }} />
                    </button>
                  )}
                </div>
              </div>
              <p className="text-sm mt-2 whitespace-pre-line" style={{ color: 'var(--text-secondary)' }}>{a.contenu}</p>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={!!form}
        onClose={() => setForm(null)}
        title="Nouvelle annonce"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setForm(null)}>Annuler</Button>
            <Button icon={Megaphone} onClick={publier} loading={saving} disabled={nbDestinataires === 0}>Publier</Button>
          </>
        }
      >
        {form && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block text-sm">
                <span className="block mb-1 text-[var(--text-secondary)]">Destinataires</span>
                <select className={input} value={form.cible} onChange={(e) => setForm({ ...form, cible: e.target.value, cibleValeur: '' })}>
                  {CIBLES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </label>
              {form.cible === 'cycle' && (
                <label className="block text-sm">
                  <span className="block mb-1 text-[var(--text-secondary)]">Cycle</span>
                  <select className={input} value={form.cibleValeur} onChange={(e) => setForm({ ...form, cibleValeur: e.target.value })}>
                    <option value="">Choisir…</option>
                    {CYCLES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </label>
              )}
              {form.cible === 'classe' && (
                <label className="block text-sm">
                  <span className="block mb-1 text-[var(--text-secondary)]">Classe</span>
                  <select className={input} value={form.cibleValeur} onChange={(e) => setForm({ ...form, cibleValeur: e.target.value })}>
                    <option value="">Choisir…</option>
                    {classes.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
                  </select>
                </label>
              )}
            </div>
            {nbDestinataires !== null && (
              <p className="text-xs" style={{ color: nbDestinataires ? 'var(--text-muted)' : 'var(--color-warning)' }}>
                {nbDestinataires
                  ? `${nbDestinataires} parent(s) avec un espace actif recevront cette annonce.`
                  : 'Aucun parent avec un espace actif ne correspond à cette cible.'}
              </p>
            )}
            <label className="block text-sm">
              <span className="block mb-1 text-[var(--text-secondary)]">Titre</span>
              <input className={input} maxLength={150} value={form.titre} onChange={(e) => setForm({ ...form, titre: e.target.value })} placeholder="Ex. Réunion parents-professeurs" />
            </label>
            <label className="block text-sm">
              <span className="block mb-1 text-[var(--text-secondary)]">Message</span>
              <textarea className={input} rows={6} maxLength={5000} value={form.contenu} onChange={(e) => setForm({ ...form, contenu: e.target.value })} />
            </label>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Annonces;
