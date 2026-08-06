import { useEffect, useState, useCallback } from 'react';
import { useAxios } from '../../hooks/useAxios';
import { useTenant } from '../../contexts/TenantContext';
import { Calendar, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const Actualites = () => {
  const { get } = useAxios();
  const { config } = useTenant();
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  const fetchArticles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await get('/api/actualites');
      setArticles(res?.data || res || []);
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchArticles(); }, [fetchArticles]);

  const nomApp = config?.nomApp || 'GestSchool';

  if (selected) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <button
          onClick={() => setSelected(null)}
          className="text-sm mb-6 hover:underline"
          style={{ color: 'var(--text-secondary)' }}
        >
          ← Retour aux actualités
        </button>
        {selected.imageUrl && (
          <img src={selected.imageUrl} alt={selected.titre} className="w-full rounded-xl mb-6" style={{ maxHeight: 400, objectFit: 'cover' }} />
        )}
        <h1 className="text-2xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>{selected.titre}</h1>
        <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
          {new Date(selected.datePublication).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
        <div className="prose max-w-none text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          {selected.contenu}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Actualités de {nomApp}</h1>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Restez informé des derniers événements de l'établissement</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl p-5" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
              <div className="skeleton h-40 w-full rounded-lg mb-4" />
              <div className="skeleton h-5 w-32 rounded mb-2" />
              <div className="skeleton h-4 w-full rounded" />
            </div>
          ))}
        </div>
      ) : articles.length === 0 ? (
        <div className="text-center py-16">
          <Calendar className="h-12 w-12 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} strokeWidth={1.25} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Aucune actualité pour le moment</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {articles.map((article) => (
            <article
              key={article.id}
              onClick={() => setSelected(article)}
              className="rounded-xl overflow-hidden cursor-pointer transition-all"
              style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.08)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'var(--shadow-card)'; }}
            >
              {article.imageUrl && (
                <img src={article.imageUrl} alt={article.titre} className="w-full" style={{ height: 200, objectFit: 'cover' }} />
              )}
              <div className="p-5">
                <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
                  {new Date(article.datePublication).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
                <h2 className="text-base font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>{article.titre}</h2>
                <p className="text-sm line-clamp-2" style={{ color: 'var(--text-secondary)' }}>
                  {article.excerpt || article.contenu?.substring(0, 120)}
                </p>
                <span className="inline-flex items-center gap-1 mt-3 text-xs font-medium" style={{ color: 'var(--color-primary)' }}>
                  Lire la suite <ArrowRight className="h-3 w-3" />
                </span>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
};

export default Actualites;
