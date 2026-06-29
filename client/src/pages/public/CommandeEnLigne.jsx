import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useTenant } from '../../contexts/TenantContext';
import { useDebounce } from '../../hooks/useDebounce';
import {
  Pill, Menu, X, Search, ShoppingCart, Plus, Minus, Trash2,
  Upload, FileText, Loader2, CheckCircle2, Package, ClipboardList,
} from 'lucide-react';
import { ThemeToggle } from '../../components/ui/ThemeToggle';
import FloatingPrescriptionButton from '../../components/public/FloatingPrescriptionButton.jsx';

const NAV_LINKS = [
  { label: 'Accueil', to: '/' },
  { label: 'Catalogue', to: '/catalogue' },
  { label: 'Commander', to: '/commander' },
];

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];

function PublicNavbar({ config, menuOuvert, setMenuOuvert, activePath = '/commander' }) {
  const nomApp = config?.nomApp || 'GestPharma';

  return (
    <>
      <header
        className="sticky top-0 z-40 border-b"
        style={{ background: 'color-mix(in srgb, var(--surface-raised) 85%, transparent)', backdropFilter: 'blur(12px)', borderColor: 'var(--border-subtle)' }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 md:h-[72px]">
            <Link to="/" className="flex items-center gap-2.5 shrink-0">
              {config?.logoUrl ? (
                <img src={config.logoUrl} alt={nomApp} className="h-9 w-auto" />
              ) : (
                <Pill className="h-7 w-7" style={{ color: 'var(--color-primary)' }} />
              )}
              <span className="text-xl font-semibold tracking-tight" style={{ color: 'var(--color-primary)' }}>
                {nomApp}
              </span>
            </Link>

            <nav className="hidden md:flex items-center gap-10 absolute left-1/2 -translate-x-1/2">
              {NAV_LINKS.map((lien) => (
                <Link
                  key={lien.label}
                  to={lien.to}
                  className="text-sm tracking-wide transition-colors"
                  style={{ color: lien.to === activePath ? 'var(--text-primary)' : 'var(--text-secondary)' }}
                >
                  {lien.label}
                </Link>
              ))}
            </nav>

            <div className="hidden md:flex items-center gap-2">
              <ThemeToggle />
              <Link
                to="/login"
                className="inline-flex items-center px-5 py-2 text-sm font-medium tracking-wide rounded-full border"
                style={{ borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }}
              >
                Connexion
              </Link>
            </div>

            <button
              type="button"
              className="md:hidden p-2 rounded-lg hover:bg-[#F0EFEA] dark:hover:bg-[#21262d]"
              onClick={() => setMenuOuvert(true)}
              aria-label="Menu"
            >
              <Menu className="h-6 w-6" style={{ color: 'var(--text-secondary)' }} />
            </button>
          </div>
        </div>
      </header>

      {menuOuvert && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMenuOuvert(false)} />
          <nav className="absolute right-0 top-0 h-full w-72 bg-white dark:bg-[#161b22] flex flex-col" style={{ animation: 'slideIn 250ms ease both' }}>
            <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
              <span className="text-lg font-semibold" style={{ color: 'var(--color-primary)' }}>{nomApp}</span>
              <button type="button" onClick={() => setMenuOuvert(false)} className="p-2 rounded-lg">
                <X className="h-5 w-5" style={{ color: 'var(--text-secondary)' }} />
              </button>
            </div>
            <div className="flex flex-col gap-1 p-4">
              {NAV_LINKS.map((lien) => (
                <Link
                  key={lien.label}
                  to={lien.to}
                  onClick={() => setMenuOuvert(false)}
                  className="px-4 py-3 text-sm rounded-lg"
                  style={{ color: 'var(--text-secondary)', background: lien.to === activePath ? 'var(--surface-overlay)' : 'transparent' }}
                >
                  {lien.label}
                </Link>
              ))}
            </div>
          </nav>
        </div>
      )}
    </>
  );
}

function ChampFormulaire({ label, required, children }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls =
  'w-full h-11 px-4 text-sm rounded-xl outline-none transition-shadow focus:ring-2 focus:ring-[color-mix(in_srgb,var(--color-primary)_25%,transparent)]';
const inputStyle = { background: 'var(--surface-base)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' };

const CommandeEnLigne = () => {
  const { config, slug, formatPrice, loading: tenantLoading } = useTenant();
  const [searchParams] = useSearchParams();

  const [menuOuvert, setMenuOuvert] = useState(false);
  const [onglet, setOnglet] = useState('medicaments');
  const [succes, setSucces] = useState(null);

  // Onglet médicaments
  const [search, setSearch] = useState('');
  const [medicaments, setMedicaments] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [panier, setPanier] = useState([]);
  const [formMed, setFormMed] = useState({ nomClient: '', telephoneClient: '', adresseLivraison: '' });
  const [submittingMed, setSubmittingMed] = useState(false);

  // Onglet ordonnance
  const [fichier, setFichier] = useState(null);
  const [apercu, setApercu] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [formOrd, setFormOrd] = useState({ nomClient: '', telephoneClient: '', adresseLivraison: '', note: '' });
  const [submittingOrd, setSubmittingOrd] = useState(false);
  const fileInputRef = useRef(null);

  const searchDebounced = useDebounce(search, 350);
  const headers = useMemo(() => ({ 'X-Tenant-Slug': slug }), [slug]);

  const totalPanier = panier.reduce(
    (sum, item) => sum + (Number(item.prixVente) || 0) * item.quantite,
    0
  );

  const fetchMedicaments = useCallback(async (q) => {
    try {
      setSearchLoading(true);
      const res = await axios.get('/api/public/catalogue', {
        headers,
        params: { search: q, disponible: 'true', limit: 20 },
      });
      setMedicaments(res.data.medicaments || res.data.data || []);
    } catch {
      setMedicaments([]);
    } finally {
      setSearchLoading(false);
    }
  }, [headers]);

  useEffect(() => {
    fetchMedicaments(searchDebounced);
  }, [searchDebounced, fetchMedicaments]);

  useEffect(() => {
    const medId = searchParams.get('med');
    if (!medId) return;
    axios.get('/api/public/catalogue', { headers, params: { limit: 100 } })
      .then((res) => {
        const all = res.data.medicaments || res.data.data || [];
        const med = all.find((m) => m.id === medId);
        if (med?.disponible !== false) ajouterAuPanier(med);
      })
      .catch(() => {});
  }, [searchParams, headers]);

  useEffect(() => {
    document.body.style.overflow = menuOuvert ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOuvert]);

  const ajouterAuPanier = (med) => {
    setPanier((prev) => {
      const existant = prev.find((p) => p.medicamentId === med.id);
      if (existant) {
        return prev.map((p) =>
          p.medicamentId === med.id ? { ...p, quantite: p.quantite + 1 } : p
        );
      }
      return [...prev, {
        medicamentId: med.id,
        dci: med.dci,
        nomCommercial: med.nomCommercial,
        prixVente: med.prixVente,
        quantite: 1,
      }];
    });
    toast.success(`${med.dci} ajouté au panier`);
  };

  const modifierQuantite = (medicamentId, delta) => {
    setPanier((prev) =>
      prev
        .map((p) =>
          p.medicamentId === medicamentId ? { ...p, quantite: p.quantite + delta } : p
        )
        .filter((p) => p.quantite > 0)
    );
  };

  const traiterFichier = (file) => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error('Format non accepté. Utilisez JPG, PNG ou PDF.');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error('Fichier trop volumineux (max 5 Mo).');
      return;
    }
    setFichier(file);
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => setApercu(e.target.result);
      reader.readAsDataURL(file);
    } else {
      setApercu(null);
    }
  };

  const passerCommande = async () => {
    const { nomClient, telephoneClient, adresseLivraison } = formMed;
    if (!nomClient || !telephoneClient || !adresseLivraison) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }
    if (panier.length === 0) {
      toast.error('Votre panier est vide');
      return;
    }

    setSubmittingMed(true);
    try {
      const res = await axios.post('/api/public/commandes', {
        items: panier.map((p) => ({ medicamentId: p.medicamentId, quantite: p.quantite })),
        nomClient,
        telephoneClient,
        adresseLivraison,
      }, { headers });

      const cmd = res.data.commande || res.data;
      setSucces({ id: cmd.id, numeroVente: cmd.numeroVente });
      setPanier([]);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erreur lors de la commande');
    } finally {
      setSubmittingMed(false);
    }
  };

  const envoyerOrdonnance = async () => {
    const { nomClient, telephoneClient, adresseLivraison, note } = formOrd;
    if (!nomClient || !telephoneClient || !adresseLivraison) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }
    if (!fichier) {
      toast.error('Veuillez joindre votre ordonnance');
      return;
    }

    setSubmittingOrd(true);
    try {
      const fd = new FormData();
      fd.append('ordonnanceFile', fichier);
      fd.append('nomClient', nomClient);
      fd.append('telephoneClient', telephoneClient);
      fd.append('adresseLivraison', adresseLivraison);
      if (note) fd.append('note', note);
      fd.append('items', JSON.stringify([]));

      const res = await axios.post('/api/public/commandes', fd, {
        headers: { 'Content-Type': undefined },
      });

      const cmd = res.data.commande || res.data;
      setSucces({ id: cmd.id, numeroVente: cmd.numeroVente });
      setFichier(null);
      setApercu(null);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erreur lors de l\'envoi');
    } finally {
      setSubmittingOrd(false);
    }
  };

  if (tenantLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--surface-base)' }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: 'var(--color-primary)' }} />
      </div>
    );
  }

  if (succes) {
    return (
      <div className="min-h-screen" style={{ background: 'var(--surface-base)' }}>
        <PublicNavbar config={config} menuOuvert={menuOuvert} setMenuOuvert={setMenuOuvert} />
        <div className="max-w-lg mx-auto px-4 py-20 text-center">
          <div
            className="h-20 w-20 rounded-full flex items-center justify-center mx-auto mb-6"
            style={{ background: 'color-mix(in srgb, var(--color-primary) 12%, white)' }}
          >
            <CheckCircle2 className="h-10 w-10" style={{ color: 'var(--color-primary)' }} />
          </div>
          <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Commande enregistrée !</h1>
          <p className="text-4xl font-bold my-4" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-primary)' }}>
            #{succes.numeroVente}
          </p>
          <p className="text-base mb-8" style={{ color: 'var(--text-secondary)' }}>
            Vous serez contacté sous 30 minutes pour confirmer votre commande.
          </p>
          <Link
            to={`/suivi/${succes.id}`}
            className="inline-flex items-center justify-center w-full h-12 rounded-xl text-sm font-semibold text-white mb-3"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            Suivre ma commande
          </Link>
          <button
            type="button"
            onClick={() => { setSucces(null); setOnglet('medicaments'); }}
            className="text-sm font-medium"
            style={{ color: 'var(--text-secondary)' }}
          >
            Passer une autre commande
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--surface-base)' }}>
      <PublicNavbar config={config} menuOuvert={menuOuvert} setMenuOuvert={setMenuOuvert} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight mb-2" style={{ color: 'var(--text-primary)' }}>
            Commander en ligne
          </h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            Sélectionnez vos médicaments ou envoyez votre ordonnance pour une livraison à domicile.
          </p>
        </div>

        {/* Onglets */}
        <div
          className="flex gap-1 p-1 rounded-2xl max-w-xl mx-auto mb-8"
          style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}
        >
          {[
            { key: 'medicaments', label: 'Commander des médicaments', icon: Package },
            { key: 'ordonnance', label: 'Envoyer une ordonnance', icon: ClipboardList },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setOnglet(tab.key)}
              className={`flex-1 flex items-center justify-center gap-2 h-12 rounded-xl text-sm font-semibold transition-all ${
                onglet === tab.key ? 'text-white shadow-sm' : 'text-[var(--text-secondary)] hover:bg-[var(--surface-overlay)] dark:hover:bg-[#21262d]'
              }`}
              style={onglet === tab.key ? { backgroundColor: 'var(--color-primary)' } : undefined}
            >
              <tab.icon className="h-4 w-4 hidden sm:block" />
              <span className="truncate">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* ── Onglet médicaments ── */}
        {onglet === 'medicaments' && (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
            <div>
              <div className="relative mb-5">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--text-muted)' }} />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher un médicament…"
                  className="w-full h-11 pl-11 pr-4 text-sm rounded-xl outline-none"
                  style={inputStyle}
                />
                {searchLoading && (
                  <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin" style={{ color: 'var(--text-muted)' }} />
                )}
              </div>

              <div className="space-y-2">
                {medicaments.length === 0 && !searchLoading ? (
                  <p className="text-center py-12 text-sm" style={{ color: 'var(--text-muted)' }}>
                    Aucun médicament trouvé
                  </p>
                ) : (
                  medicaments.map((med) => (
                    <button
                      key={med.id}
                      type="button"
                      onClick={() => ajouterAuPanier(med)}
                      disabled={!med.disponible}
                      className="w-full flex items-center gap-4 p-4 rounded-2xl text-left transition-all hover:shadow-md disabled:opacity-50 bg-white dark:bg-[#161b22]"
                      style={{ border: '1px solid var(--border-subtle)' }}
                    >
                      <div
                        className="h-10 w-10 rounded-full shrink-0 flex items-center justify-center"
                        style={{ background: 'color-mix(in srgb, var(--color-primary) 10%, transparent)' }}
                      >
                        <Pill className="h-5 w-5" style={{ color: 'var(--color-primary)' }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>{med.dci}</p>
                        <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>{med.nomCommercial}</p>
                      </div>
                      {med.prixVente != null && (
                        <span className="text-sm font-bold shrink-0" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-primary)' }}>
                          {formatPrice(Number(med.prixVente))}
                        </span>
                      )}
                      <Plus className="h-5 w-5 shrink-0" style={{ color: 'var(--color-primary)' }} />
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Panier sidebar */}
            <aside
              className="lg:sticky lg:top-24 bg-white dark:bg-[#161b22] rounded-2xl p-5 shadow-sm h-fit"
              style={{ border: '1px solid var(--border-subtle)' }}
            >
              <div className="flex items-center gap-2 mb-4">
                <ShoppingCart className="h-5 w-5" style={{ color: 'var(--color-primary)' }} />
                <h2 className="font-bold" style={{ color: 'var(--text-primary)' }}>
                  Panier ({panier.reduce((s, p) => s + p.quantite, 0)})
                </h2>
              </div>

              {panier.length === 0 ? (
                <p className="text-sm py-6 text-center" style={{ color: 'var(--text-muted)' }}>
                  Votre panier est vide
                </p>
              ) : (
                <div className="space-y-3 mb-4 max-h-48 overflow-y-auto">
                  {panier.map((item) => (
                    <div key={item.medicamentId} className="flex items-center gap-2 text-sm">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate" style={{ color: 'var(--text-primary)' }}>{item.dci}</p>
                        {item.prixVente != null && (
                          <p className="text-xs" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                            {formatPrice(Number(item.prixVente))}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button type="button" onClick={() => modifierQuantite(item.medicamentId, -1)} className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-[#F0EFEA] dark:hover:bg-[#21262d]">
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="w-6 text-center font-semibold">{item.quantite}</span>
                        <button type="button" onClick={() => modifierQuantite(item.medicamentId, 1)} className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-[#F0EFEA] dark:hover:bg-[#21262d]">
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setPanier((prev) => prev.filter((p) => p.medicamentId !== item.medicamentId))}
                          className="h-7 w-7 rounded-lg flex items-center justify-center ml-1"
                          style={{ color: 'var(--color-danger)' }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = 'color-mix(in srgb, var(--color-danger) 10%, transparent)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = ''; }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {totalPanier > 0 && (
                <div className="flex justify-between py-3 mb-4 border-t border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                  <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>Total</span>
                  <span className="font-bold" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-primary)' }}>
                    {formatPrice(totalPanier)}
                  </span>
                </div>
              )}

              <div className="space-y-3">
                <ChampFormulaire label="Nom" required>
                  <input
                    className={inputCls}
                    style={inputStyle}
                    value={formMed.nomClient}
                    onChange={(e) => setFormMed({ ...formMed, nomClient: e.target.value })}
                    placeholder="Votre nom complet"
                  />
                </ChampFormulaire>
                <ChampFormulaire label="Téléphone" required>
                  <input
                    className={inputCls}
                    style={inputStyle}
                    type="tel"
                    value={formMed.telephoneClient}
                    onChange={(e) => setFormMed({ ...formMed, telephoneClient: e.target.value })}
                    placeholder="+242 06 000 0000"
                  />
                </ChampFormulaire>
                <ChampFormulaire label="Adresse de livraison" required>
                  <textarea
                    className={`${inputCls} h-20 py-3 resize-none`}
                    style={inputStyle}
                    value={formMed.adresseLivraison}
                    onChange={(e) => setFormMed({ ...formMed, adresseLivraison: e.target.value })}
                    placeholder="Quartier, rue, point de repère…"
                  />
                </ChampFormulaire>
              </div>

              <button
                type="button"
                onClick={passerCommande}
                disabled={submittingMed || panier.length === 0}
                className="w-full h-12 mt-5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-50"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                {submittingMed ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingCart className="h-4 w-4" />}
                Passer la commande
              </button>
            </aside>
          </div>
        )}

        {/* ── Onglet ordonnance ── */}
        {onglet === 'ordonnance' && (
          <div className="max-w-xl mx-auto">
            <div
              className={`relative rounded-2xl p-8 text-center transition-colors cursor-pointer mb-6 ${
                dragOver ? 'border-2 border-dashed' : 'border-2 border-dashed'
              }`}
              style={{
                borderColor: dragOver ? 'var(--color-primary)' : 'var(--border-subtle)',
                background: dragOver ? 'color-mix(in srgb, var(--color-primary) 5%, white)' : 'var(--surface-raised)',
              }}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const file = e.dataTransfer.files[0];
                if (file) traiterFichier(file);
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".jpg,.jpeg,.png,.pdf"
                className="hidden"
                onChange={(e) => e.target.files[0] && traiterFichier(e.target.files[0])}
              />
              {fichier ? (
                <div>
                  {apercu ? (
                    <img src={apercu} alt="Aperçu ordonnance" className="max-h-48 mx-auto rounded-xl mb-3 object-contain" />
                  ) : (
                    <FileText className="h-16 w-16 mx-auto mb-3" style={{ color: 'var(--color-primary)' }} />
                  )}
                  <p className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{fichier.name}</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                    {(fichier.size / 1024).toFixed(0)} Ko — Cliquez pour changer
                  </p>
                </div>
              ) : (
                <div>
                  <Upload className="h-12 w-12 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
                  <p className="font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
                    Glissez votre ordonnance ici
                  </p>
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    JPG, PNG ou PDF — 5 Mo max
                  </p>
                </div>
              )}
            </div>

            <div className="bg-white dark:bg-[#161b22] rounded-2xl p-6 space-y-4" style={{ border: '1px solid var(--border-subtle)' }}>
              <ChampFormulaire label="Nom" required>
                <input
                  className={inputCls}
                  style={inputStyle}
                  value={formOrd.nomClient}
                  onChange={(e) => setFormOrd({ ...formOrd, nomClient: e.target.value })}
                />
              </ChampFormulaire>
              <ChampFormulaire label="Téléphone" required>
                <input
                  className={inputCls}
                  style={inputStyle}
                  type="tel"
                  value={formOrd.telephoneClient}
                  onChange={(e) => setFormOrd({ ...formOrd, telephoneClient: e.target.value })}
                />
              </ChampFormulaire>
              <ChampFormulaire label="Adresse de livraison" required>
                <textarea
                  className={`${inputCls} h-20 py-3 resize-none`}
                  style={inputStyle}
                  value={formOrd.adresseLivraison}
                  onChange={(e) => setFormOrd({ ...formOrd, adresseLivraison: e.target.value })}
                />
              </ChampFormulaire>
              <ChampFormulaire label="Note pour le pharmacien">
                <textarea
                  className={`${inputCls} h-20 py-3 resize-none`}
                  style={inputStyle}
                  value={formOrd.note}
                  onChange={(e) => setFormOrd({ ...formOrd, note: e.target.value })}
                  placeholder="Instructions, allergies, préférences…"
                />
              </ChampFormulaire>

              <button
                type="button"
                onClick={envoyerOrdonnance}
                disabled={submittingOrd || !fichier}
                className="w-full h-12 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-50"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                {submittingOrd ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Envoyer l&apos;ordonnance
              </button>
            </div>
          </div>
        )}
      </div>

      <FloatingPrescriptionButton />
    </div>
  );
};

export default CommandeEnLigne;
