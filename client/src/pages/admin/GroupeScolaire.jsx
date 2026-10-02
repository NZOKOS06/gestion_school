import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Building2, Share2, ArrowRightLeft } from 'lucide-react';
import { useAxios } from '../../hooks/useAxios';
import { PageHeader, Button, Card, EmptyState } from '../../components/ui';

const fmt = (n) => `${Number(n || 0).toLocaleString('fr-FR')} FCFA`;

/** Vue du directeur de groupe : consolidation, partage de tarifs, transfert d'élève entre sites. */
const GroupeScolaire = () => {
  const { get, post } = useAxios();
  const [groupe, setGroupe] = useState(undefined);
  const [stats, setStats] = useState(null);
  const [cibles, setCibles] = useState([]);
  const [transfert, setTransfert] = useState({ eleveId: '', cibleTenantId: '' });
  const [eleves, setEleves] = useState([]);
  const [recherche, setRecherche] = useState('');

  const charger = useCallback(async () => {
    try {
      const res = await get('/api/groupe', { silent: true });
      setGroupe(res?.data || null);
      if (res?.data?.estDirecteurGroupe) {
        const s = await get('/api/groupe/stats', { silent: true });
        setStats(s);
      }
    } catch { setGroupe(null); }
  }, [get]);

  useEffect(() => { charger(); }, [charger]);

  useEffect(() => {
    if (recherche.trim().length < 2) { setEleves([]); return undefined; }
    const t = setTimeout(async () => {
      try {
        const res = await get(`/api/eleves?search=${encodeURIComponent(recherche)}&limit=8`, { silent: true });
        setEleves(res?.data || []);
      } catch { /* silent */ }
    }, 300);
    return () => clearTimeout(t);
  }, [recherche, get]);

  if (groupe === undefined) return null;
  if (!groupe?.estDirecteurGroupe) {
    return (
      <div className="space-y-6">
        <PageHeader title="Groupe scolaire" />
        <EmptyState icon={Building2} title="Espace réservé au directeur de groupe"
          description="Le super-administrateur désigne le directeur de groupe parmi les directeurs des sites." />
      </div>
    );
  }

  const autres = groupe.sites.filter((s) => s.id !== groupe.tenantId);
  const toggle = (id) => setCibles((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));

  const partager = async () => {
    if (!cibles.length) return toast.error('Choisissez au moins un site');
    if (!window.confirm('Copier les tarifs de cette école vers les classes de même nom des sites choisis ?')) return;
    try {
      const res = await post('/api/groupe/partager-tarifs', { cibleTenantIds: cibles });
      const n = (res?.data || []).reduce((t, r) => t + r.classesMisesAJour, 0);
      toast.success(`${n} classe(s) mise(s) à jour`);
    } catch { /* toast par useAxios */ }
  };

  const transferer = async () => {
    if (!transfert.eleveId || !transfert.cibleTenantId) return toast.error('Choisissez un élève et un site');
    if (!window.confirm("Transférer cet élève ? Son inscription en cours ici sera annulée.")) return;
    try {
      const res = await post('/api/groupe/transferts', transfert);
      toast.success(res?.message || 'Élève transféré');
      setTransfert({ eleveId: '', cibleTenantId: '' }); setRecherche(''); setEleves([]);
    } catch { /* toast par useAxios */ }
  };

  return (
    <div className="space-y-6">
      <PageHeader title={`Groupe ${groupe.nom}`} subtitle="Consolidation des sites (année active de chaque école)" />

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-gray-500">
            <tr><th className="p-3">Site</th><th className="p-3">Effectif</th><th className="p-3">Attendu</th><th className="p-3">Encaissé</th><th className="p-3">Reste dû</th></tr>
          </thead>
          <tbody>
            {(stats?.sites || []).map((s) => (
              <tr key={s.id} className="border-t border-gray-100 dark:border-gray-800">
                <td className="p-3 font-medium">{s.nom}</td><td className="p-3">{s.effectif}</td>
                <td className="p-3">{fmt(s.attendu)}</td><td className="p-3">{fmt(s.encaisse)}</td><td className="p-3">{fmt(s.reste)}</td>
              </tr>
            ))}
            {stats && (
              <tr className="border-t-2 border-gray-200 font-semibold dark:border-gray-700">
                <td className="p-3">Total</td><td className="p-3">{stats.total.effectif}</td>
                <td className="p-3">{fmt(stats.total.attendu)}</td><td className="p-3">{fmt(stats.total.encaisse)}</td><td className="p-3">{fmt(stats.total.reste)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      <Card className="space-y-3 p-4">
        <h3 className="flex items-center gap-2 font-semibold"><Share2 className="h-4 w-4" /> Partager les tarifs de cette école</h3>
        <p className="text-sm text-gray-500">Les frais des classes de cette école sont copiés vers les classes de même nom des sites cochés. Les inscriptions existantes ne changent pas.</p>
        <div className="flex flex-wrap gap-3">
          {autres.map((s) => (
            <label key={s.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={cibles.includes(s.id)} onChange={() => toggle(s.id)} /> {s.nom}
            </label>
          ))}
        </div>
        <Button onClick={partager}>Partager les tarifs</Button>
      </Card>

      <Card className="space-y-3 p-4">
        <h3 className="flex items-center gap-2 font-semibold"><ArrowRightLeft className="h-4 w-4" /> Transférer un élève vers un autre site</h3>
        <input className="w-full rounded border p-2 text-sm dark:bg-gray-900" placeholder="Rechercher un élève (nom, matricule)…"
          value={recherche} onChange={(e) => setRecherche(e.target.value)} />
        {eleves.length > 0 && (
          <select className="w-full rounded border p-2 text-sm dark:bg-gray-900" value={transfert.eleveId}
            onChange={(e) => setTransfert((t) => ({ ...t, eleveId: e.target.value }))}>
            <option value="">— Choisir l'élève —</option>
            {eleves.map((e) => <option key={e.id} value={e.id}>{e.nom} {e.prenom} ({e.matricule})</option>)}
          </select>
        )}
        <select className="w-full rounded border p-2 text-sm dark:bg-gray-900" value={transfert.cibleTenantId}
          onChange={(e) => setTransfert((t) => ({ ...t, cibleTenantId: e.target.value }))}>
          <option value="">— Site d'accueil —</option>
          {autres.map((s) => <option key={s.id} value={s.id}>{s.nom}</option>)}
        </select>
        <Button onClick={transferer}>Transférer</Button>
      </Card>
    </div>
  );
};

export default GroupeScolaire;
