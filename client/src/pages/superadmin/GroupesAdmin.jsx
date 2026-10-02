import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Building2, Plus, Users } from 'lucide-react';
import { useAxios } from '../../hooks/useAxios';

const fmt = (n) => `${Number(n || 0).toLocaleString('fr-FR')} FCFA`;

/** Super-admin : groupes scolaires (création, rattachement des écoles, directeur de groupe, consolidation). */
const GroupesAdmin = () => {
  const { get, post, put } = useAxios();
  const [groupes, setGroupes] = useState([]);
  const [ecoles, setEcoles] = useState([]);
  const [nom, setNom] = useState('');
  const [selection, setSelection] = useState({}); // groupeId -> Set d'ids d'écoles en cours d'édition
  const [stats, setStats] = useState({}); // groupeId -> stats

  const charger = useCallback(async () => {
    try {
      const res = await get('/api/superadmin/groupes', { silent: true });
      setGroupes(res?.data || []);
      setEcoles(res?.ecoles || []);
      setSelection({});
    } catch { toast.error('Chargement des groupes impossible'); }
  }, [get]);

  useEffect(() => { charger(); }, [charger]);

  const creer = async (e) => {
    e.preventDefault();
    if (!nom.trim()) return;
    try {
      await post('/api/superadmin/groupes', { nom: nom.trim() });
      setNom('');
      toast.success('Groupe créé');
      charger();
    } catch { /* message affiché par useAxios */ }
  };

  const idsActuels = (g) => selection[g.id] || new Set(g.sites.map((s) => s.id));
  const basculer = (g, id) => {
    const s = new Set(idsActuels(g));
    if (s.has(id)) s.delete(id); else s.add(id);
    setSelection((prev) => ({ ...prev, [g.id]: s }));
  };

  const enregistrerSites = async (g) => {
    try {
      await put(`/api/superadmin/groupes/${g.id}/sites`, { tenantIds: [...idsActuels(g)] });
      toast.success('Écoles du groupe mises à jour');
      charger();
    } catch { /* message affiché par useAxios */ }
  };

  const designerDirecteur = async (g, staffId) => {
    try {
      await put(`/api/superadmin/groupes/${g.id}/directeur`, { staffId: staffId || null });
      toast.success(staffId ? 'Directeur de groupe désigné' : 'Directeur de groupe retiré');
      charger();
    } catch { /* message affiché par useAxios */ }
  };

  const voirStats = async (g) => {
    try {
      const res = await get(`/api/superadmin/groupes/${g.id}/stats`, { silent: true });
      setStats((prev) => ({ ...prev, [g.id]: res }));
    } catch { toast.error('Statistiques indisponibles'); }
  };

  const directeurs = (g) => g.sites.flatMap((s) => (s.staff || []).map((d) => ({ ...d, site: s.nom })));

  return (
    <div className="space-y-6">
      <form onSubmit={creer} className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row" style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-raised)' }}>
        <input
          className="min-h-[44px] flex-1 rounded-lg border px-3 text-sm"
          style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-base)', color: 'var(--text-primary)' }}
          placeholder="Nom du nouveau groupe scolaire"
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          maxLength={120}
        />
        <button type="submit" className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium text-white" style={{ background: 'var(--color-primary)' }}>
          <Plus className="h-4 w-4" /> Créer le groupe
        </button>
      </form>

      {groupes.length === 0 && (
        <p className="py-10 text-center text-sm" style={{ color: 'var(--text-muted)' }}>Aucun groupe. Créez-en un puis rattachez ses écoles.</p>
      )}

      {groupes.map((g) => {
        const choisis = idsActuels(g);
        const modifie = choisis.size !== g.sites.length || g.sites.some((s) => !choisis.has(s.id));
        const st = stats[g.id];
        return (
          <section key={g.id} className="space-y-4 rounded-lg border p-4" style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-raised)' }}>
            <header className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                <Building2 className="h-4 w-4" /> {g.nom}
                <span className="text-xs font-normal" style={{ color: 'var(--text-muted)' }}>{g.sites.length} école(s)</span>
              </h3>
              <button onClick={() => voirStats(g)} className="text-sm underline" style={{ color: 'var(--color-primary)' }}>Voir la consolidation</button>
            </header>

            <div>
              <p className="mb-2 text-xs font-medium uppercase" style={{ color: 'var(--text-muted)' }}>Écoles du groupe</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {ecoles.map((e) => {
                  const ailleurs = e.groupeId && e.groupeId !== g.id;
                  return (
                    <label key={e.id} className={`flex items-center gap-2 text-sm ${ailleurs ? 'opacity-50' : ''}`} style={{ color: 'var(--text-primary)' }}>
                      <input type="checkbox" checked={choisis.has(e.id)} disabled={ailleurs} onChange={() => basculer(g, e.id)} />
                      {e.nom}{ailleurs ? ' (autre groupe)' : ''}
                    </label>
                  );
                })}
              </div>
              {modifie && (
                <button onClick={() => enregistrerSites(g)} className="mt-3 min-h-[40px] rounded-lg px-4 text-sm font-medium text-white" style={{ background: 'var(--color-primary)' }}>
                  Enregistrer les écoles
                </button>
              )}
            </div>

            <div>
              <p className="mb-2 flex items-center gap-1 text-xs font-medium uppercase" style={{ color: 'var(--text-muted)' }}>
                <Users className="h-3 w-3" /> Directeur de groupe
              </p>
              <select
                className="min-h-[44px] w-full rounded-lg border px-3 text-sm sm:w-auto"
                style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-base)', color: 'var(--text-primary)' }}
                value={g.directeurStaffId || ''}
                onChange={(e) => designerDirecteur(g, e.target.value)}
                disabled={modifie}
              >
                <option value="">— Aucun —</option>
                {directeurs(g).map((d) => (
                  <option key={d.id} value={d.id}>{d.prenom} {d.nom} ({d.site})</option>
                ))}
              </select>
              <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                Choisi parmi les directeurs des écoles du groupe ; il accède à la page « Groupe scolaire » de son espace.
              </p>
            </div>

            {st && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm" style={{ color: 'var(--text-primary)' }}>
                  <thead className="text-left text-xs uppercase" style={{ color: 'var(--text-muted)' }}>
                    <tr><th className="py-2 pr-3">École</th><th className="pr-3">Effectif</th><th className="pr-3">Attendu</th><th className="pr-3">Encaissé</th><th>Reste dû</th></tr>
                  </thead>
                  <tbody>
                    {st.sites.map((s) => (
                      <tr key={s.id} className="border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                        <td className="py-2 pr-3">{s.nom}</td><td className="pr-3">{s.effectif}</td>
                        <td className="pr-3">{fmt(s.attendu)}</td><td className="pr-3">{fmt(s.encaisse)}</td><td>{fmt(s.reste)}</td>
                      </tr>
                    ))}
                    <tr className="border-t-2 font-semibold" style={{ borderColor: 'var(--border-subtle)' }}>
                      <td className="py-2 pr-3">Total</td><td className="pr-3">{st.total.effectif}</td>
                      <td className="pr-3">{fmt(st.total.attendu)}</td><td className="pr-3">{fmt(st.total.encaisse)}</td><td>{fmt(st.total.reste)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
};

export default GroupesAdmin;
