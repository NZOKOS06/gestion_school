import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, Sparkles } from 'lucide-react';
import { useAxios } from '../../hooks/useAxios';
import { useTenant } from '../../contexts/TenantContext';
import { Button, Modal, Badge } from '../../components/ui';

const PERIODICITES = [
  { value: 'mensuelle', label: 'Mensuelle', unite: 'mois' },
  { value: 'trimestrielle', label: 'Trimestrielle', unite: 'trimestre' },
  { value: 'annuelle', label: 'Annuelle', unite: 'an' },
  { value: 'unique', label: 'Paiement unique', unite: 'paiement' },
];

const CYCLES = [
  { value: 'prescolaire', label: 'Préscolaire' },
  { value: 'primaire', label: 'Primaire' },
  { value: 'college', label: 'Collège' },
  { value: 'lycee', label: 'Lycée' },
];

const EMPTY = { id: null, nom: '', description: '', tarif: '', periodicite: 'mensuelle', cycles: [], actif: true };

/**
 * Catalogue des services optionnels payants de l'école (cantine, garderie, crèche, TD…).
 * Un élève peut cumuler plusieurs services en plus de sa scolarité.
 */
export default function ServicesOptionnels() {
  const { get, post, put, delete: del } = useAxios();
  const { formatPrice } = useTenant();
  const [services, setServices] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  const fetchServices = useCallback(async () => {
    try {
      const res = await get('/api/services-optionnels', { silent: true });
      setServices(res?.data || []);
      setSuggestions(res?.suggestions || []);
    } catch { /* silent */ }
  }, [get]);

  useEffect(() => { fetchServices(); }, [fetchServices]);

  const nomsExistants = new Set(services.map((s) => s.nom.toLowerCase()));
  const suggestionsLibres = suggestions.filter((s) => !nomsExistants.has(s.nom.toLowerCase()));

  const openForm = (service = null, preset = {}) => {
    setForm(service
      ? {
        id: service.id,
        nom: service.nom,
        description: service.description || '',
        tarif: String(Number(service.tarif)),
        periodicite: service.periodicite,
        cycles: Array.isArray(service.cycles) ? service.cycles : [],
        actif: service.actif,
      }
      : { ...EMPTY, ...preset });
  };

  const save = async () => {
    if (!form.nom.trim() || form.tarif === '' || Number(form.tarif) < 0) {
      toast.error('Nom et tarif obligatoires');
      return;
    }
    setSaving(true);
    const payload = {
      nom: form.nom.trim(),
      description: form.description,
      tarif: Number(form.tarif),
      periodicite: form.periodicite,
      cycles: form.cycles.length ? form.cycles : null,
      actif: form.actif,
    };
    try {
      if (form.id) await put(`/api/services-optionnels/${form.id}`, payload);
      else await post('/api/services-optionnels', payload);
      toast.success(form.id ? 'Service mis à jour' : 'Service ajouté');
      setForm(null);
      fetchServices();
    } catch { /* toast via useAxios */ }
    setSaving(false);
  };

  const remove = async (service) => {
    if (!window.confirm(`Supprimer le service « ${service.nom} » ?`)) return;
    try {
      const res = await del(`/api/services-optionnels/${service.id}`);
      toast.success(res?.message || 'Service supprimé');
      fetchServices();
    } catch { /* toast via useAxios */ }
  };

  const toggleCycle = (cycle) => setForm((f) => ({
    ...f,
    cycles: f.cycles.includes(cycle) ? f.cycles.filter((c) => c !== cycle) : [...f.cycles, cycle],
  }));

  const unite = (p) => PERIODICITES.find((x) => x.value === p)?.unite || 'mois';
  const input = 'w-full px-3 py-2 border rounded-lg bg-[var(--surface-overlay)]';

  return (
    <div className="space-y-3">
      <p className="text-xs text-[var(--text-secondary)]">
        Services payants facultatifs, cumulables avec la scolarité (cantine, garderie, crèche, TD…). Chaque élève y souscrit
        à l'inscription ou en cours d'année ; ils ont leurs propres échéances et n'entrent pas dans le blocage des notes.
      </p>

      {services.length > 0 && (
        <div className="divide-y divide-[var(--border-subtle)] rounded-lg border border-[var(--border-subtle)]">
          {services.map((s) => (
            <div key={s.id} className="flex items-center gap-3 px-3 py-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-[var(--text-primary)]">{s.nom}</span>
                  {!s.actif && <Badge variant="neutral">Désactivé</Badge>}
                  {Array.isArray(s.cycles) && s.cycles.length > 0 && (
                    <span className="text-xs text-[var(--text-muted)]">
                      {s.cycles.map((c) => CYCLES.find((x) => x.value === c)?.label || c).join(', ')}
                    </span>
                  )}
                </div>
                <span className="text-xs text-[var(--text-secondary)]">
                  {formatPrice(Number(s.tarif))} / {unite(s.periodicite)} · {s.nbSouscriptions} élève{s.nbSouscriptions > 1 ? 's' : ''}
                </span>
              </div>
              <button type="button" className="p-1.5 rounded-md hover:bg-[var(--surface-hover)]" onClick={() => openForm(s)} title="Modifier">
                <Pencil className="h-4 w-4" />
              </button>
              <button type="button" className="p-1.5 rounded-md hover:bg-[var(--surface-hover)]" onClick={() => remove(s)} title="Supprimer">
                <Trash2 className="h-4 w-4" style={{ color: 'var(--color-danger)' }} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" icon={Plus} onClick={() => openForm()}>Ajouter un service</Button>
        {suggestionsLibres.map((s) => (
          <Button key={s.nom} size="sm" variant="secondary" icon={Sparkles} onClick={() => openForm(null, { nom: s.nom, periodicite: s.periodicite })}>
            {s.nom}
          </Button>
        ))}
      </div>

      <Modal
        open={!!form}
        onClose={() => setForm(null)}
        title={form?.id ? 'Modifier le service' : 'Nouveau service optionnel'}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setForm(null)}>Annuler</Button>
            <Button onClick={save} loading={saving}>Enregistrer</Button>
          </>
        }
      >
        {form && (
          <div className="space-y-4">
            <label className="block text-sm">
              <span className="block mb-1 text-[var(--text-secondary)]">Nom</span>
              <input className={input} value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} placeholder="Ex. Cantine, Garderie, TD Mathématiques" />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm">
                <span className="block mb-1 text-[var(--text-secondary)]">Tarif par {unite(form.periodicite)}</span>
                <input type="number" min="0" step="500" className={input} value={form.tarif} onChange={(e) => setForm({ ...form, tarif: e.target.value })} />
              </label>
              <label className="block text-sm">
                <span className="block mb-1 text-[var(--text-secondary)]">Facturation</span>
                <select className={input} value={form.periodicite} onChange={(e) => setForm({ ...form, periodicite: e.target.value })}>
                  {PERIODICITES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </label>
            </div>
            <div className="text-sm">
              <span className="block mb-1 text-[var(--text-secondary)]">Proposé aux cycles (aucun coché = tous)</span>
              <div className="flex flex-wrap gap-3">
                {CYCLES.map((c) => (
                  <label key={c.value} className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={form.cycles.includes(c.value)} onChange={() => toggleCycle(c.value)} />
                    {c.label}
                  </label>
                ))}
              </div>
            </div>
            <label className="block text-sm">
              <span className="block mb-1 text-[var(--text-secondary)]">Description (facultatif)</span>
              <input className={input} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.actif} onChange={(e) => setForm({ ...form, actif: e.target.checked })} />
              Service proposé (décocher pour ne plus le proposer, les souscriptions en cours continuent)
            </label>
            {form.id && (
              <p className="text-xs text-[var(--text-muted)]">
                Un changement de tarif ne s'applique qu'aux nouvelles souscriptions ; les élèves déjà inscrits gardent leur tarif.
              </p>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
