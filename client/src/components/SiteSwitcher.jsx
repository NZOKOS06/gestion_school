import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Building2 } from 'lucide-react';
import axiosInstance from '../utils/axios';

const ACCUEIL_PAR_ROLE = { comptable: '/caissier' };

/** Sélecteur de site d'un groupe scolaire : visible seulement si la personne a accès à plusieurs sites. */
const SiteSwitcher = () => {
  const [sites, setSites] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let annule = false;
    axiosInstance.get('/api/groupe/sites')
      .then((res) => { if (!annule) setSites(res.data?.data || []); })
      .catch(() => {});
    return () => { annule = true; };
  }, []);

  if (sites.length < 2) return null;
  const courant = sites.find((s) => s.courant);

  const changer = async (e) => {
    const tenantId = e.target.value;
    if (!tenantId || tenantId === courant?.id) return;
    setBusy(true);
    try {
      const res = await axiosInstance.post('/api/groupe/changer-site', { tenantId });
      const { slug, role } = res.data?.data || {};
      if (slug) localStorage.setItem('tenantSlug', slug);
      // Rechargement complet : thème, configuration et permissions de l'école d'arrivée
      window.location.assign(ACCUEIL_PAR_ROLE[role] || '/admin/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || err.response?.data?.error || 'Changement de site impossible');
      setBusy(false);
    }
  };

  return (
    <label className="flex items-center gap-1.5 text-sm" title="Changer de site">
      <Building2 className="h-4 w-4 shrink-0" style={{ color: 'var(--text-muted)' }} />
      <select
        value={courant?.id || ''}
        onChange={changer}
        disabled={busy}
        aria-label="Changer de site"
        className="max-w-[10rem] truncate rounded-md border bg-transparent px-2 py-1 text-sm"
        style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
      >
        {sites.map((s) => <option key={s.id} value={s.id}>{s.nom}</option>)}
      </select>
    </label>
  );
};

export default SiteSwitcher;
