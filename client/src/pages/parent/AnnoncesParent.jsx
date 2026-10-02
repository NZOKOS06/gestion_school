import { useCallback, useEffect, useState } from 'react';
import { Megaphone } from 'lucide-react';
import { useAxios } from '../../hooks/useAxios';
import { PageHeader, Badge, EmptyState } from '../../components/ui';

/** Annonces reçues de l'école (marquées lues à l'ouverture). */
const AnnoncesParent = () => {
  const { get, put } = useAxios();
  const [annonces, setAnnonces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ouverte, setOuverte] = useState(null);

  const fetchAnnonces = useCallback(async () => {
    setLoading(true);
    try {
      const res = await get('/api/parent/annonces', { silent: true });
      setAnnonces(res?.data || []);
    } catch { /* silent */ }
    setLoading(false);
  }, [get]);

  useEffect(() => { fetchAnnonces(); }, [fetchAnnonces]);

  const ouvrir = async (a) => {
    setOuverte(ouverte === a.id ? null : a.id);
    if (!a.lu) {
      setAnnonces((prev) => prev.map((x) => (x.id === a.id ? { ...x, lu: true } : x)));
      try { await put(`/api/parent/annonces/${a.id}/lu`, {}, { silent: true }); } catch { /* silent */ }
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Annonces" subtitle="Informations de l'école" />
      {!loading && annonces.length === 0 ? (
        <EmptyState icon={Megaphone} title="Aucune annonce" description="Les annonces de l'école apparaîtront ici." />
      ) : (
        <div className="space-y-3">
          {annonces.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => ouvrir(a)}
              className="w-full text-left rounded-xl p-4"
              style={{ background: 'var(--surface-raised)', border: `1px solid ${a.lu ? 'var(--border-subtle)' : 'var(--color-primary)'}` }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{a.titre}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {new Date(a.date).toLocaleDateString('fr-FR')}{a.auteur ? ` · ${a.auteur}` : ''}
                  </p>
                </div>
                {!a.lu && <Badge variant="info">Nouveau</Badge>}
              </div>
              <p
                className={`text-sm mt-2 whitespace-pre-line ${ouverte === a.id ? '' : 'line-clamp-2'}`}
                style={{ color: 'var(--text-secondary)' }}
              >
                {a.contenu}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default AnnoncesParent;
