import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useTenant } from '../../contexts/TenantContext';
import { useDebounce } from '../../hooks/useDebounce';
import PublicNavbar from '../../components/layouts/PublicNavbar';
import {
  Pill,
  X,
  Search,
  SlidersHorizontal,
  Loader2,
  ShoppingBag,
  ChevronDown,
} from 'lucide-react';
import FloatingPrescriptionButton from '../../components/public/FloatingPrescriptionButton.jsx';

const LIMIT = 24;

const FORME_OPTIONS = [
  { value: 'comprime', label: 'Comprimé' },
  { value: 'sirop', label: 'Sirop' },
  { value: 'injectable', label: 'Injectable' },
  { value: 'pommade', label: 'Pommade' },
  { value: 'autre', label: 'Autre' },
];

const NAV_LINKS = [
  { label: 'Accueil', to: '/' },
  { label: 'Catalogue', to: '/catalogue' },
  { label: 'Contact', to: '/#contact' },
];


/* ─── Filtres ─── */

function FiltresContenu({
  categories,
  categorieActive,
  setCategorieActive,
  formesActives,
  toggleForme,
  disponiblesUniquement,
  setDisponiblesUniquement,
  onReinitialiser,
}) {
  return (
    <div className="space-y-7">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--text-secondary)' }}>
          Catégories
        </h3>
        <div className="space-y-1.5">
          <label
            className={`flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${
              !categorieActive ? 'bg-[color-mix(in_srgb,var(--color-primary)_8%,white)]' : 'hover:bg-[#F8F7F5] dark:hover:bg-[#21262d]'
            }`}
          >
            <span className="flex items-center gap-3">
              <input
                type="radio"
                name="categorie"
                checked={!categorieActive}
                onChange={() => setCategorieActive('')}
                className="h-4 w-4 accent-[var(--color-primary)]"
              />
              <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Toutes</span>
            </span>
          </label>
          {categories.map((cat) => (
            <label
              key={cat.id}
              className={`flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${
                categorieActive === cat.id ? 'bg-[color-mix(in_srgb,var(--color-primary)_8%,white)]' : 'hover:bg-[#F8F7F5] dark:hover:bg-[#21262d]'
              }`}
            >
              <span className="flex items-center gap-3">
                <input
                  type="radio"
                  name="categorie"
                  checked={categorieActive === cat.id}
                  onChange={() => setCategorieActive(cat.id)}
                  className="h-4 w-4 accent-[var(--color-primary)]"
                />
                <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{cat.nom}</span>
              </span>
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{ background: 'var(--surface-hover)', color: 'var(--text-secondary)' }}
              >
                {cat.count ?? 0}
              </span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--text-secondary)' }}>
          Forme galénique
        </h3>
        <div className="space-y-1.5">
          {FORME_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-[#F8F7F5] dark:hover:bg-[#21262d] transition-colors"
            >
              <input
                type="checkbox"
                checked={formesActives.includes(opt.value)}
                onChange={() => toggleForme(opt.value)}
                className="h-4 w-4 rounded accent-[var(--color-primary)]"
              />
              <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{opt.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--text-secondary)' }}>
          Disponibilité
        </h3>
        <label className="flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer hover:bg-[#F8F7F5] dark:hover:bg-[#21262d]">
          <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Disponibles uniquement</span>
          <button
            type="button"
            role="switch"
            aria-checked={disponiblesUniquement}
            onClick={() => setDisponiblesUniquement((v) => !v)}
            className={`relative w-11 h-6 rounded-full transition-colors ${
              disponiblesUniquement ? 'bg-[var(--color-primary)]' : 'bg-[var(--border-subtle)]'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                disponiblesUniquement ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </label>
      </div>

      <button
        type="button"
        onClick={onReinitialiser}
        className="w-full py-2.5 text-sm font-medium rounded-xl border transition-colors hover:bg-[#F8F7F5] dark:hover:bg-[#21262d]"
        style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}
      >
        Réinitialiser les filtres
      </button>
    </div>
  );
}

/* ─── Sous-composants UI ─── */

function SkeletonCard() {
  return (
    <div className="bg-white dark:bg-[#161b22] rounded-2xl p-5 shadow-sm" style={{ border: '1px solid var(--border-subtle)' }}>
      <div className="skeleton h-12 w-12 rounded-full mb-4" style={{ background: 'linear-gradient(90deg, #F0EFEA 25%, #FAFAF8 50%, #F0EFEA 75%)', backgroundSize: '200% 100%' }} />
      <div className="skeleton h-4 w-3/4 mb-2 rounded" style={{ background: 'linear-gradient(90deg, #F0EFEA 25%, #FAFAF8 50%, #F0EFEA 75%)', backgroundSize: '200% 100%' }} />
      <div className="skeleton h-3 w-1/2 mb-4 rounded" style={{ background: 'linear-gradient(90deg, #F0EFEA 25%, #FAFAF8 50%, #F0EFEA 75%)', backgroundSize: '200% 100%' }} />
      <div className="skeleton h-6 w-20 mb-3 rounded-full" style={{ background: 'linear-gradient(90deg, #F0EFEA 25%, #FAFAF8 50%, #F0EFEA 75%)', backgroundSize: '200% 100%' }} />
      <div className="skeleton h-5 w-24 rounded" style={{ background: 'linear-gradient(90deg, #F0EFEA 25%, #FAFAF8 50%, #F0EFEA 75%)', backgroundSize: '200% 100%' }} />
    </div>
  );
}

function EmptyState() {
  return (
    <div className="col-span-full flex flex-col items-center justify-center py-20 text-center">
      <svg width="120" height="120" viewBox="0 0 120 120" fill="none" className="mb-6 opacity-60">
        <circle cx="60" cy="60" r="50" fill="#F0EFEA" />
        <rect x="38" y="48" width="44" height="28" rx="14" fill="var(--color-primary)" opacity="0.2" />
        <rect x="48" y="38" width="24" height="44" rx="12" fill="var(--color-primary)" opacity="0.35" />
        <circle cx="60" cy="60" r="8" fill="var(--color-primary)" opacity="0.5" />
      </svg>
      <h3 className="text-lg font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Aucun médicament trouvé</h3>
      <p className="text-sm max-w-xs" style={{ color: 'var(--text-secondary)' }}>
        Essayez de modifier vos critères de recherche ou vos filtres.
      </p>
    </div>
  );
}

function MedicamentCard({ med, afficherPrix, formatPrice, commandeActive }) {
  const formeLabel = med.formeGalenique
    ? med.formeGalenique.charAt(0).toUpperCase() + med.formeGalenique.slice(1)
    : null;

  return (
    <article
      className="bg-white dark:bg-[#161b22] rounded-2xl p-5 shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
      style={{ border: '1px solid var(--border-subtle)' }}
    >
      <div
        className="h-12 w-12 rounded-full flex items-center justify-center mb-4"
        style={{ background: 'color-mix(in srgb, var(--color-primary) 10%, transparent)' }}
      >
        <Pill className="h-6 w-6" style={{ color: 'var(--color-primary)' }} />
      </div>

      <h3 className="font-bold leading-snug mb-0.5" style={{ fontSize: 15, color: 'var(--text-primary)' }}>
        {med.dci}
      </h3>
      {med.nomCommercial && (
        <p className="text-[13px] mb-3" style={{ color: 'var(--text-secondary)' }}>{med.nomCommercial}</p>
      )}

      {(formeLabel || med.dosage) && (
        <span
          className="inline-block text-xs font-medium px-2.5 py-1 rounded-full mb-3"
          style={{ background: 'var(--surface-hover)', color: 'var(--text-secondary)' }}
        >
          {[formeLabel, med.dosage].filter(Boolean).join(' · ')}
        </span>
      )}

      <div className="mb-3">
        {med.disponible ? (
          <span
            className="inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full"
            style={{ background: 'color-mix(in srgb, var(--color-success) 12%, transparent)', color: 'var(--color-success)' }}
          >
            Disponible
          </span>
        ) : (
          <span
            className="inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full"
            style={{ background: 'color-mix(in srgb, var(--color-danger) 12%, transparent)', color: 'var(--color-danger)' }}
          >
            Rupture
          </span>
        )}
      </div>

      {afficherPrix && med.prixVente != null && (
        <p
          className="font-bold text-base mb-4"
          style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-primary)' }}
        >
          {formatPrice(Number(med.prixVente))}
        </p>
      )}

      {commandeActive && med.disponible && (
        <Link
          to={`/commander?med=${med.id}`}
          className="flex items-center justify-center gap-2 w-full h-11 rounded-xl text-sm font-semibold text-white transition-colors hover:opacity-90"
          style={{ backgroundColor: 'var(--color-primary)' }}
        >
          <ShoppingBag className="h-4 w-4" />
          Commander
        </Link>
      )}
    </article>
  );
}

/* ─── Page principale ─── */

const Catalogue = () => {
  const { config, slug, formatPrice, isModuleActive, loading: tenantLoading } = useTenant();

  const [menuOuvert, setMenuOuvert] = useState(false);
  const [drawerOuvert, setDrawerOuvert] = useState(false);
  const [search, setSearch] = useState('');
  const [categorieActive, setCategorieActive] = useState('');
  const [formesActives, setFormesActives] = useState([]);
  const [disponiblesUniquement, setDisponiblesUniquement] = useState(false);

  const [medicaments, setMedicaments] = useState([]);
  const [categories, setCategories] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [afficherPrix, setAfficherPrix] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [erreur, setErreur] = useState(null);

  const searchDebounced = useDebounce(search, 400);
  const commandeActive = isModuleActive('commandeEnLigne');

  const headers = useMemo(() => ({ 'X-Tenant-Slug': slug }), [slug]);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await axios.get('/api/public/categories', { headers });
      setCategories(res.data.categories || []);
    } catch {
      try {
        const res = await axios.get('/api/categories', { headers });
        const raw = res.data.categories || res.data || [];
        setCategories(raw.map((c) => ({ id: c.id, nom: c.nom, count: c.count ?? c._count?.medicaments ?? 0 })));
      } catch {
        /* catégories optionnelles */
      }
    }
  }, [headers]);

  const buildParams = useCallback(
    (pageNum) => {
      const params = { page: pageNum, limit: LIMIT };
      if (searchDebounced) params.search = searchDebounced;
      if (categorieActive) params.categorie = categorieActive;
      if (formesActives.length) params.forme = formesActives.join(',');
      if (disponiblesUniquement) params.disponible = 'true';
      return params;
    },
    [searchDebounced, categorieActive, formesActives, disponiblesUniquement]
  );

  const fetchMedicaments = useCallback(
    async (pageNum, append = false) => {
      try {
        if (append) setLoadingMore(true);
        else setLoading(true);
        setErreur(null);

        const res = await axios.get('/api/public/catalogue', {
          headers,
          params: buildParams(pageNum),
        });

        const data = res.data.medicaments || res.data.data || [];
        const pages = res.data.pages ?? res.data.pagination?.totalPages ?? 1;
        const count = res.data.total ?? res.data.pagination?.total ?? data.length;

        if (res.data.afficherPrix != null) {
          setAfficherPrix(res.data.afficherPrix);
        } else {
          setAfficherPrix(config?.afficherPrix ?? !config?.moduleVitrineMasquerPrix);
        }

        setMedicaments((prev) => (append ? [...prev, ...data] : data));
        setTotalPages(pages);
        setTotal(count);
        setPage(pageNum);
      } catch (err) {
        setErreur(err.response?.data?.message || 'Impossible de charger le catalogue');
        if (!append) setMedicaments([]);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [headers, buildParams, config]
  );

  useEffect(() => {
    if (!tenantLoading) fetchCategories();
  }, [fetchCategories, tenantLoading]);

  useEffect(() => {
    if (!tenantLoading) fetchMedicaments(1, false);
  }, [fetchMedicaments, tenantLoading]);

  useEffect(() => {
    document.body.style.overflow = menuOuvert || drawerOuvert ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOuvert, drawerOuvert]);

  const toggleForme = (value) => {
    setFormesActives((prev) =>
      prev.includes(value) ? prev.filter((f) => f !== value) : [...prev, value]
    );
  };

  const reinitialiserFiltres = () => {
    setCategorieActive('');
    setFormesActives([]);
    setDisponiblesUniquement(false);
    setSearch('');
  };

  const filtresActifs =
    categorieActive || formesActives.length > 0 || disponiblesUniquement;

  const peutChargerPlus = page < totalPages;

  if (tenantLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--surface-base)' }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: 'var(--color-primary)' }} />
      </div>
    );
  }

  // Fonction utilitaire pour normaliser les URLs d'images
  const normalizeImageUrl = (url) => {
    if (!url) return null;
    return url; // Utiliser l'URL telle quelle (relative ou complète)
  };

  return (
    <div 
      className="min-h-screen"
      style={{ 
        background: config?.backgroundImageUrl 
          ? `url(${normalizeImageUrl(config.backgroundImageUrl)}) center/cover no-repeat fixed`
          : 'var(--surface-base)'
      }}
    >
      <PublicNavbar
        config={config}
        links={NAV_LINKS.map((l) => ({ label: l.label, to: l.to, active: l.to === '/catalogue' }))}
        loginLabel="Connexion"
        menuOuvert={menuOuvert}
        setMenuOuvert={setMenuOuvert}
      />

      {/* Hero mini */}
      <section className="border-b" style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-raised)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-14 text-center">
          <h1
            className="text-3xl md:text-4xl font-bold tracking-tight mb-4"
            style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-sans)', letterSpacing: '-0.02em' }}
          >
            Notre catalogue
          </h1>
          <p className="text-lg max-w-2xl mx-auto mb-10" style={{ color: 'var(--text-secondary)' }}>
            Parcourez notre gamme de médicaments et produits de parapharmacie disponibles en pharmacie.
          </p>

          <div className="relative max-w-2xl mx-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5" style={{ color: 'var(--text-muted)' }} />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher par DCI, nom commercial…"
              className="w-full h-14 pl-12 pr-4 text-base rounded-2xl outline-none transition-shadow focus:shadow-md"
              style={{
                background: 'var(--surface-raised)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
              }}
            />
          </div>

          {!loading && (
            <p className="mt-5 text-sm" style={{ color: 'var(--text-muted)' }}>
              {total} médicament{total !== 1 ? 's' : ''} trouvé{total !== 1 ? 's' : ''}
            </p>
          )}
        </div>
      </section>

      {/* Contenu */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Bouton filtres mobile */}
        <button
          type="button"
          onClick={() => setDrawerOuvert(true)}
          className="lg:hidden flex items-center gap-2 mb-6 px-4 py-2.5 rounded-xl text-sm font-medium border"
          style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-primary)', background: 'var(--surface-raised)' }}
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filtres
          {filtresActifs && (
            <span
              className="h-5 min-w-[20px] px-1.5 rounded-full text-xs font-bold text-white flex items-center justify-center"
              style={{ background: 'var(--color-primary)' }}
            >
              !
            </span>
          )}
        </button>

        <div className="flex gap-8">
          {/* Sidebar desktop */}
          <aside
            className="hidden lg:block w-64 shrink-0"
            style={{ position: 'sticky', top: 96, alignSelf: 'flex-start', maxHeight: 'calc(100vh - 120px)', overflowY: 'auto' }}
          >
            <div
              className="bg-white dark:bg-[#161b22] rounded-2xl p-6 shadow-sm"
              style={{ border: '1px solid var(--border-subtle)' }}
            >
              <h2 className="text-sm font-semibold mb-6" style={{ color: 'var(--text-primary)' }}>Filtres</h2>
              <FiltresContenu
                categories={categories}
                categorieActive={categorieActive}
                setCategorieActive={setCategorieActive}
                formesActives={formesActives}
                toggleForme={toggleForme}
                disponiblesUniquement={disponiblesUniquement}
                setDisponiblesUniquement={setDisponiblesUniquement}
                onReinitialiser={reinitialiserFiltres}
              />
            </div>
          </aside>

          {/* Grille */}
          <div className="flex-1 min-w-0">
            {erreur && (
              <div
                className="mb-6 p-4 rounded-xl text-sm text-center"
                style={{ background: 'color-mix(in srgb, var(--color-danger) 8%, transparent)', color: 'var(--color-danger)', border: '1px solid color-mix(in srgb, var(--color-danger) 20%, transparent)' }}
              >
                {erreur}
              </div>
            )}

            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                {Array.from({ length: 6 }).map((_, i) => (
                  <SkeletonCard key={i} />
                ))}
              </div>
            ) : medicaments.length === 0 ? (
              <div className="grid grid-cols-1">
                <EmptyState />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                  {medicaments.map((med) => (
                    <MedicamentCard
                      key={med.id}
                      med={med}
                      afficherPrix={afficherPrix}
                      formatPrice={formatPrice}
                      commandeActive={commandeActive}
                    />
                  ))}
                </div>

                {peutChargerPlus && (
                  <div className="mt-10 text-center">
                    <button
                      type="button"
                      onClick={() => fetchMedicaments(page + 1, true)}
                      disabled={loadingMore}
                      className="inline-flex items-center gap-2 px-8 h-12 rounded-xl text-sm font-semibold text-white transition-all hover:shadow-md disabled:opacity-60"
                      style={{ backgroundColor: 'var(--color-primary)' }}
                    >
                      {loadingMore ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                      Charger plus
                      <span className="opacity-70 font-normal">
                        ({medicaments.length} / {total})
                      </span>
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Drawer filtres mobile */}
      {drawerOuvert && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setDrawerOuvert(false)} />
          <div
            className="absolute left-0 top-0 h-full w-[min(320px,85vw)] bg-white dark:bg-[#161b22] flex flex-col"
            style={{ boxShadow: 'var(--shadow-modal)', animation: 'slideIn 250ms ease both' }}
          >
            <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
              <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Filtres</h2>
              <button type="button" onClick={() => setDrawerOuvert(false)} className="p-2 rounded-lg hover:bg-[#F0EFEA] dark:hover:bg-[#21262d]">
                <X className="h-5 w-5" style={{ color: 'var(--text-secondary)' }} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              <FiltresContenu
                categories={categories}
                categorieActive={categorieActive}
                setCategorieActive={setCategorieActive}
                formesActives={formesActives}
                toggleForme={toggleForme}
                disponiblesUniquement={disponiblesUniquement}
                setDisponiblesUniquement={setDisponiblesUniquement}
                onReinitialiser={reinitialiserFiltres}
              />
            </div>
            <div className="p-4 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
              <button
                type="button"
                onClick={() => setDrawerOuvert(false)}
                className="w-full h-12 rounded-xl text-sm font-semibold text-white"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                Voir {total} résultat{total !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer minimal */}
      <footer className="mt-16 border-t py-8 text-center text-sm" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}>
        © 2026 {config?.nomApp || 'GestPharma'}. Catalogue mis à jour en temps réel.
      </footer>

      <FloatingPrescriptionButton />
    </div>
  );
};

export default Catalogue;
