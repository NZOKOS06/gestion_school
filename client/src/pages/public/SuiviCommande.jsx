import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';
import { io } from 'socket.io-client';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useTenant } from '../../contexts/TenantContext';
import {
  Pill, Menu, X, Loader2, CheckCircle2, Package, Truck,
  Home, Clock, Phone, User, Hash, Wifi, WifiOff,
} from 'lucide-react';
import { ThemeToggle } from '../../components/ui/ThemeToggle';
import FloatingPrescriptionButton from '../../components/public/FloatingPrescriptionButton.jsx';

const NAV_LINKS = [
  { label: 'Accueil', to: '/' },
  { label: 'Catalogue', to: '/catalogue' },
  { label: 'Commander', to: '/commander' },
];

const ETAPES = [
  { key: 'recue', label: 'Commande reçue', icon: CheckCircle2 },
  { key: 'preparation', label: 'En préparation', icon: Package },
  { key: 'livraison', label: 'En livraison', icon: Truck },
  { key: 'livree', label: 'Livrée', icon: Home },
];

function PublicNavbar({ config, menuOuvert, setMenuOuvert }) {
  const nomApp = config?.nomApp || 'GestPharma';
  return (
    <>
      <header
        className="sticky top-0 z-40 border-b"
        style={{ background: 'color-mix(in srgb, var(--surface-raised) 85%, transparent)', backdropFilter: 'blur(12px)', borderColor: 'var(--border-subtle)' }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2.5">
              {config?.logoUrl ? (
                <img src={config.logoUrl} alt={nomApp} className="h-8 w-auto" />
              ) : (
                <Pill className="h-6 w-6" style={{ color: 'var(--color-primary)' }} />
              )}
              <span className="text-lg font-semibold" style={{ color: 'var(--color-primary)' }}>{nomApp}</span>
            </Link>
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
            <button type="button" className="md:hidden p-2" onClick={() => setMenuOuvert(true)}>
              <Menu className="h-6 w-6" style={{ color: 'var(--text-secondary)' }} />
            </button>
          </div>
        </div>
      </header>
      {menuOuvert && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMenuOuvert(false)} />
          <nav className="absolute right-0 top-0 h-full w-72 bg-white dark:bg-[#161b22] p-5">
            <button type="button" onClick={() => setMenuOuvert(false)} className="mb-4">
              <X className="h-5 w-5" />
            </button>
            {NAV_LINKS.map((l) => (
              <Link key={l.to} to={l.to} onClick={() => setMenuOuvert(false)} className="block py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </>
  );
}

function calculerEtapes(commande) {
  if (!commande) return ETAPES.map((e) => ({ ...e, etat: 'pending', heure: null }));

  const { statut, livraison, createdAt } = commande;
  const livStatut = livraison?.statut;

  const result = ETAPES.map((e) => ({ ...e, etat: 'pending', heure: null }));

  result[0].etat = 'done';
  result[0].heure = createdAt;

  if (statut === 'annulee') {
    result[1].etat = 'error';
    return result;
  }

  if (statut === 'finalisee' && !livraison) {
    result[1].etat = 'done';
    result[3].etat = 'done';
    result[3].heure = commande.updatedAt;
    return result;
  }

  if (livStatut === 'livree') {
    result[1].etat = 'done';
    result[2].etat = 'done';
    result[2].heure = livraison.dateEnRoute;
    result[3].etat = 'done';
    result[3].heure = livraison.dateLivraison;
    return result;
  }

  if (livStatut === 'en_route') {
    result[1].etat = 'done';
    result[2].etat = 'active';
    result[2].heure = livraison.dateEnRoute;
    return result;
  }

  if (livStatut === 'assignee') {
    result[1].etat = 'active';
    result[1].heure = livraison.dateAssignation;
    return result;
  }

  if (statut === 'en_cours' || statut === 'finalisee') {
    result[1].etat = 'active';
    return result;
  }

  return result;
}

function EtapeIcone({ etape, etat }) {
  const Icon = etape.icon;
  const base = 'h-10 w-10 rounded-full flex items-center justify-center shrink-0 transition-all';

  if (etat === 'done') {
    return (
      <div className={base} style={{ background: 'var(--color-primary)', color: '#fff' }}>
        <CheckCircle2 className="h-5 w-5" />
      </div>
    );
  }
  if (etat === 'active') {
    return (
      <div className={`${base} relative`} style={{ background: 'color-mix(in srgb, var(--color-primary) 15%, white)' }}>
        <span className="absolute inset-0 rounded-full animate-ping opacity-30" style={{ background: 'var(--color-primary)' }} />
        <Icon className="h-5 w-5 relative" style={{ color: 'var(--color-primary)' }} />
      </div>
    );
  }
  if (etat === 'error') {
    return (
      <div className={base} style={{ background: 'color-mix(in srgb, var(--color-danger) 12%, transparent)', color: 'var(--color-danger)' }}>
        <Icon className="h-5 w-5" />
      </div>
    );
  }
  return (
    <div className={base} style={{ background: 'var(--surface-hover)', color: 'var(--text-muted)' }}>
      <Icon className="h-5 w-5" />
    </div>
  );
}

function Stepper({ etapes }) {
  return (
    <>
      {/* Desktop horizontal */}
      <div className="hidden md:block">
        <div className="flex items-start justify-between relative">
          <div
            className="absolute top-5 left-[12%] right-[12%] h-0.5"
            style={{ background: 'var(--border-subtle)' }}
          />
          {etapes.map((etape, i) => (
            <div key={etape.key} className="flex flex-col items-center relative z-10" style={{ width: '22%' }}>
              <EtapeIcone etape={etape} etat={etape.etat} />
              <p
                className="mt-3 text-sm font-semibold text-center"
                style={{ color: etape.etat === 'pending' ? 'var(--text-muted)' : 'var(--text-primary)' }}
              >
                {etape.label}
              </p>
              {etape.heure && (
                <p className="text-xs mt-1 flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                  <Clock className="h-3 w-3" />
                  {format(new Date(etape.heure), 'dd MMM HH:mm', { locale: fr })}
                </p>
              )}
              {i < etapes.length - 1 && etape.etat === 'done' && (
                <div
                  className="absolute top-5 left-[calc(50%+20px)] w-[calc(100%-40px)] h-0.5 -z-10"
                  style={{ background: 'var(--color-primary)' }}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Mobile vertical */}
      <div className="md:hidden space-y-0">
        {etapes.map((etape, i) => (
          <div key={etape.key} className="flex gap-4">
            <div className="flex flex-col items-center">
              <EtapeIcone etape={etape} etat={etape.etat} />
              {i < etapes.length - 1 && (
                <div
                  className="w-0.5 flex-1 my-1 min-h-[32px]"
                  style={{ background: etape.etat === 'done' ? 'var(--color-primary)' : 'var(--border-subtle)' }}
                />
              )}
            </div>
            <div className="pb-8 pt-1.5">
              <p
                className="text-sm font-semibold"
                style={{ color: etape.etat === 'pending' ? 'var(--text-muted)' : 'var(--text-primary)' }}
              >
                {etape.label}
              </p>
              {etape.heure && (
                <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                  <Clock className="h-3 w-3" />
                  {format(new Date(etape.heure), 'dd MMM yyyy à HH:mm', { locale: fr })}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

const SuiviCommande = () => {
  const { id } = useParams();
  const { config, slug, formatPrice, loading: tenantLoading } = useTenant();

  const [menuOuvert, setMenuOuvert] = useState(false);
  const [commande, setCommande] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const socketRef = useRef(null);

  const headers = useMemo(() => ({ 'X-Tenant-Slug': slug }), [slug]);

  const fetchStatut = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res = await axios.get(`/api/public/commandes/${id}/statut`, { headers });
      setCommande(res.data.commande || res.data);
      setErreur(null);
    } catch (err) {
      setErreur(err.response?.data?.error || 'Commande introuvable');
    } finally {
      setLoading(false);
    }
  }, [id, headers]);

  useEffect(() => {
    if (!tenantLoading && id) fetchStatut();
  }, [fetchStatut, tenantLoading, id]);

  useEffect(() => {
    if (!id || tenantLoading) return;

    const socket = io(window.location.origin, {
      auth: { tenantSlug: slug },
      withCredentials: true,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setSocketConnected(true);
      socket.emit('join-order-room', id);
    });
    socket.on('disconnect', () => setSocketConnected(false));

    socket.on('orderUpdated', (payload) => {
      if (payload.orderId === id) {
        setCommande((prev) => ({
          ...prev,
          statut: payload.statut ?? prev?.statut,
          livraison: payload.livraison
            ? { ...prev?.livraison, ...payload.livraison }
            : prev?.livraison,
        }));
        fetchStatut(true);
      }
    });

    return () => {
      socket.emit('leave-order-room', id);
      socket.disconnect();
    };
  }, [id, slug, tenantLoading, fetchStatut]);

  useEffect(() => {
    if (socketConnected) return undefined;
    const interval = setInterval(() => fetchStatut(true), 60000);
    return () => clearInterval(interval);
  }, [socketConnected, fetchStatut]);

  const etapes = calculerEtapes(commande);

  if (tenantLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--surface-base)' }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: 'var(--color-primary)' }} />
      </div>
    );
  }

  if (erreur) {
    return (
      <div className="min-h-screen" style={{ background: 'var(--surface-base)' }}>
        <PublicNavbar config={config} menuOuvert={menuOuvert} setMenuOuvert={setMenuOuvert} />
        <div className="max-w-md mx-auto px-4 py-20 text-center">
          <p className="text-lg font-semibold mb-4" style={{ color: 'var(--color-danger)' }}>{erreur}</p>
          <Link to="/commander" className="text-sm font-medium" style={{ color: 'var(--color-primary)' }}>
            Retour à la commande
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--surface-base)' }}>
      <PublicNavbar config={config} menuOuvert={menuOuvert} setMenuOuvert={setMenuOuvert} />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 md:py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Suivi de commande</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
              Commande n°{' '}
              <span className="font-bold" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-primary)' }}>
                {commande.numeroVente}
              </span>
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
            {socketConnected ? (
              <>
                <Wifi className="h-3.5 w-3.5 text-green-500" />
                <span className="text-green-600">Temps réel</span>
              </>
            ) : (
              <>
                <WifiOff className="h-3.5 w-3.5" />
                <span>Actualisation auto</span>
              </>
            )}
          </div>
        </div>

        <div
          className="bg-white dark:bg-[#161b22] rounded-2xl p-6 md:p-8 mb-6 shadow-sm"
          style={{ border: '1px solid var(--border-subtle)' }}
        >
          <Stepper etapes={etapes} />
        </div>

        <div
          className="bg-white dark:bg-[#161b22] rounded-2xl p-6 shadow-sm space-y-4"
          style={{ border: '1px solid var(--border-subtle)' }}
        >
          <h2 className="text-sm font-bold uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>
            Détails de la commande
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <Hash className="h-4 w-4 shrink-0" style={{ color: 'var(--text-muted)' }} />
              <div>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Numéro</p>
                <p className="font-bold" style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                  #{commande.numeroVente}
                </p>
              </div>
            </div>

            {commande.montantTotal > 0 && (
              <div className="flex items-center gap-3">
                <Package className="h-4 w-4 shrink-0" style={{ color: 'var(--text-muted)' }} />
                <div>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Montant</p>
                  <p className="font-bold" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-primary)' }}>
                    {formatPrice(Number(commande.montantTotal))}
                  </p>
                </div>
              </div>
            )}

            {commande.nomClient && (
              <div className="flex items-center gap-3">
                <User className="h-4 w-4 shrink-0" style={{ color: 'var(--text-muted)' }} />
                <div>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Client</p>
                  <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{commande.nomClient}</p>
                </div>
              </div>
            )}

            {commande.telephoneClient && (
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 shrink-0" style={{ color: 'var(--text-muted)' }} />
                <div>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Téléphone</p>
                  <a href={`tel:${commande.telephoneClient}`} className="font-medium" style={{ color: 'var(--color-primary)' }}>
                    {commande.telephoneClient}
                  </a>
                </div>
              </div>
            )}

            {commande.livraison?.telephoneLivreur && (
              <div className="flex items-center gap-3 sm:col-span-2">
                <Truck className="h-4 w-4 shrink-0" style={{ color: 'var(--text-muted)' }} />
                <div>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Livreur</p>
                  <p className="font-medium" style={{ color: 'var(--text-primary)' }}>
                    {commande.livraison.livreurNom || 'Assigné'}
                    {' — '}
                    <a href={`tel:${commande.livraison.telephoneLivreur}`} style={{ color: 'var(--color-primary)' }}>
                      {commande.livraison.telephoneLivreur}
                    </a>
                  </p>
                </div>
              </div>
            )}
          </div>

          {commande.createdAt && (
            <p className="text-xs pt-2 border-t" style={{ color: 'var(--text-muted)', borderColor: 'var(--border-subtle)' }}>
              Commande passée le {format(new Date(commande.createdAt), "dd MMMM yyyy 'à' HH:mm", { locale: fr })}
            </p>
          )}
        </div>

        <div className="mt-6 text-center">
          <Link to="/commander" className="text-sm font-medium" style={{ color: 'var(--color-primary)' }}>
            Passer une nouvelle commande
          </Link>
        </div>
      </div>

      <FloatingPrescriptionButton />
    </div>
  );
};

export default SuiviCommande;
