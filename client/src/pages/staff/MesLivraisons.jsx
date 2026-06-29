import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAxios } from '../../hooks/useAxios';
import { useSocket } from '../../hooks/useSocket';
import { useTenant } from '../../contexts/TenantContext';
import Modal from '../../components/ui/Modal';
import {
  Truck, Package, MapPin, Phone, User, Clock,
  CheckCircle, XCircle, Loader2, Wifi
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import toast from 'react-hot-toast';

const TABS = [
  { key: 'assignee', label: 'Assignées', color: '#F59E0B' },
  { key: 'en_route', label: 'En route', color: '#3B82F6' },
  { key: 'livree', label: 'Livrées', color: '#10B981' },
  { key: 'echec', label: 'Échecs', color: '#EF4444' },
];

const STATUT_META = {
  assignee: {
    label: 'Assignée',
    border: 'border-l-amber-400',
    badge: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    dot: 'bg-amber-400',
  },
  en_route: {
    label: 'En route',
    border: 'border-l-blue-500',
    badge: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    dot: 'bg-blue-400',
  },
  livree: {
    label: 'Livrée',
    border: 'border-l-green-500',
    badge: 'bg-green-500/15 text-green-400 border-green-500/30',
    dot: 'bg-green-400',
  },
  echec: {
    label: 'Échec',
    border: 'border-l-red-500',
    badge: 'bg-red-500/15 text-red-400 border-red-500/30',
    dot: 'bg-red-400',
  },
};

const googleMapsLink = (adresse) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(adresse || '')}`;

const normalizeLivraison = (l) => ({
  ...l,
  adresse: l.adresse || l.vente?.adresseLivraison || '',
  telephone: l.telephone || l.vente?.telephoneClient || '',
  note: l.note || l.motifEchec || null,
});

const MesLivraisons = () => {
  const { formatPrice } = useTenant();
  const { get, put, loading } = useAxios();
  const { on, off, joinLivraison, leaveLivraison } = useSocket();

  const [livraisons, setLivraisons] = useState([]);
  const [activeTab, setActiveTab] = useState('assignee');
  const [fetching, setFetching] = useState(true);
  const [socketConnected, setSocketConnected] = useState(false);
  const [actionId, setActionId] = useState(null);

  const [confirmLivreeId, setConfirmLivreeId] = useState(null);
  const [echecModal, setEchecModal] = useState(null);
  const [echecNote, setEchecNote] = useState('');

  const counts = useMemo(() => ({
    assignee: livraisons.filter((l) => l.statut === 'assignee').length,
    en_route: livraisons.filter((l) => l.statut === 'en_route').length,
    livree: livraisons.filter((l) => l.statut === 'livree').length,
    echec: livraisons.filter((l) => l.statut === 'echec').length,
  }), [livraisons]);

  const filtered = useMemo(
    () => livraisons.filter((l) => l.statut === activeTab),
    [livraisons, activeTab]
  );

  const fetchLivraisons = useCallback(async () => {
    try {
      setFetching(true);
      const res = await get('/api/livraisons?livreur=moi', { silent: true });
      const data = (res.livraisons || res.data || []).map(normalizeLivraison);
      setLivraisons(data);
    } catch {
      /* toast géré par useAxios */
    } finally {
      setFetching(false);
    }
  }, [get]);

  useEffect(() => {
    fetchLivraisons();
  }, [fetchLivraisons]);

  useEffect(() => {
    const handleConnect = () => setSocketConnected(true);
    const handleDisconnect = () => setSocketConnected(false);

    on('connect', handleConnect);
    on('disconnect', handleDisconnect);

    const timer = setTimeout(() => {
      on('connect', handleConnect);
    }, 150);

    return () => {
      clearTimeout(timer);
      off('connect', handleConnect);
      off('disconnect', handleDisconnect);
    };
  }, [on, off]);

  useEffect(() => {
    const handler = (payload) => {
      setLivraisons((prev) =>
        prev.map((l) =>
          l.id === payload.livraisonId
            ? normalizeLivraison({
                ...l,
                statut: payload.statut ?? l.statut,
                motifEchec: payload.motifEchec ?? l.motifEchec,
                dateEnRoute: payload.dateEnRoute ?? l.dateEnRoute,
                dateLivraison: payload.dateLivraison ?? l.dateLivraison,
              })
            : l
        )
      );
    };
    on('livraisonMAJ', handler);
    return () => off('livraisonMAJ', handler);
  }, [on, off]);

  useEffect(() => {
    livraisons.forEach((l) => joinLivraison(l.id));
    return () => livraisons.forEach((l) => leaveLivraison(l.id));
  }, [livraisons, joinLivraison, leaveLivraison]);

  const updateStatut = async (id, statut, note) => {
    setActionId(id);
    try {
      const body = { statut };
      if (statut === 'echec' && note) body.motifEchec = note;

      const updated = await put(`/api/livraisons/${id}/statut`, body);
      setLivraisons((prev) =>
        prev.map((l) => (l.id === id ? normalizeLivraison({ ...l, ...updated }) : l))
      );

      const labels = {
        en_route: 'Livraison démarrée',
        livree: 'Livraison marquée comme livrée',
        echec: 'Échec signalé',
      };
      if (labels[statut]) toast.success(labels[statut]);
    } catch {
      /* */
    } finally {
      setActionId(null);
      setConfirmLivreeId(null);
      setEchecModal(null);
      setEchecNote('');
    }
  };

  const openEchecModal = (livraison) => {
    setConfirmLivreeId(null);
    setEchecModal(livraison);
    setEchecNote('');
  };

  const confirmEchec = () => {
    if (!echecModal || !echecNote.trim()) {
      toast.error('Veuillez indiquer le motif de l\'échec');
      return;
    }
    updateStatut(echecModal.id, 'echec', echecNote.trim());
  };

  return (
    <div className="min-h-screen bg-[var(--surface-base)] pb-8">
      {/* Header */}
      <header
        className="sticky top-0 z-30 px-4 pt-5 pb-4"
        style={{
          background: 'color-mix(in srgb, var(--surface-base) 85%, transparent)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className="h-10 w-10 rounded-xl flex items-center justify-center"
              style={{ background: 'color-mix(in srgb, var(--color-primary) 15%, transparent)' }}
            >
              <Truck className="h-5 w-5" style={{ color: 'var(--color-primary)' }} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[var(--text-primary)]">Mes livraisons</h1>
              <p className="text-xs text-[var(--text-muted)]">{livraisons.length} au total</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
            <span className="relative flex h-2.5 w-2.5">
              {socketConnected && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              )}
              <span
                className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                  socketConnected ? 'bg-green-400 animate-pulse-dot' : 'bg-gray-500'
                }`}
              />
            </span>
            <Wifi className={`h-3.5 w-3.5 ${socketConnected ? 'text-green-400' : 'text-[var(--text-muted)]'}`} />
          </div>
        </div>

        {/* Badges compteurs */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
          {TABS.map((tab) => (
            <span
              key={tab.key}
              className="inline-flex items-center gap-1.5 shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border"
              style={{
                background: `color-mix(in srgb, ${tab.color} 12%, transparent)`,
                color: tab.color,
                borderColor: `color-mix(in srgb, ${tab.color} 25%, transparent)`,
              }}
            >
              {tab.label}
              <span
                className="min-w-[20px] h-5 px-1.5 rounded-full flex items-center justify-center text-[11px] font-bold"
                style={{
                  background: `color-mix(in srgb, ${tab.color} 20%, transparent)`,
                }}
              >
                {counts[tab.key]}
              </span>
            </span>
          ))}
        </div>
      </header>

      {/* Onglets */}
      <div className="px-4 mt-4">
        <div
          className="flex gap-1 p-1 rounded-2xl overflow-x-auto"
          style={{ background: 'var(--surface-raised)' }}
        >
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key);
                setConfirmLivreeId(null);
              }}
              className={`flex-1 min-w-[80px] h-11 rounded-xl text-sm font-semibold whitespace-nowrap transition-all ${
                activeTab === tab.key
                  ? 'text-white shadow-md'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'
              }`}
              style={
                activeTab === tab.key
                  ? { backgroundColor: tab.color }
                  : undefined
              }
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Liste */}
      <div className="px-4 mt-5">
        {fetching ? (
          <div className="flex flex-col items-center justify-center py-20 text-[var(--text-muted)]">
            <Loader2 className="h-8 w-8 animate-spin mb-3" />
            <p className="text-sm">Chargement des livraisons…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl shadow-md p-10 text-center bg-[var(--surface-raised)]">
            <Package className="h-12 w-12 mx-auto text-[var(--text-muted)] mb-4 opacity-40" />
            <p className="text-[var(--text-secondary)] font-medium">Aucune livraison</p>
            <p className="text-sm text-[var(--text-muted)] mt-1">
              {TABS.find((t) => t.key === activeTab)?.label} — rien pour le moment
            </p>
          </div>
        ) : (
          filtered.map((l) => {
            const meta = STATUT_META[l.statut] || STATUT_META.assignee;
            const isActing = actionId === l.id && loading;

            return (
              <article
                key={l.id}
                className={`rounded-2xl shadow-md p-5 mb-4 border-l-4 bg-[var(--surface-raised)] ${meta.border}`}
              >
                {/* N° commande + montant */}
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide mb-0.5">
                      Commande
                    </p>
                    <p
                      className="text-xl font-bold text-[var(--text-primary)]"
                      style={{ fontFamily: 'var(--font-mono)' }}
                    >
                      #{l.vente?.numeroVente ?? '—'}
                    </p>
                    <p
                      className="text-lg font-bold mt-1"
                      style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-primary)' }}
                    >
                      {formatPrice(Number(l.vente?.montantTotal) || 0)}
                    </p>
                  </div>

                  <span
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border ${meta.badge}`}
                  >
                    <span className={`h-2.5 w-2.5 rounded-full ${meta.dot}`} />
                    {meta.label}
                  </span>
                </div>

                {/* Client */}
                <div className="space-y-2.5 mb-4">
                  <div className="flex items-center gap-3 text-base">
                    <User className="h-5 w-5 shrink-0 text-[var(--text-muted)]" />
                    <span className="font-semibold text-[var(--text-primary)]">
                      {l.vente?.nomClient || 'Client comptoir'}
                    </span>
                  </div>

                  {l.telephone && (
                    <a
                      href={`tel:${l.telephone}`}
                      className="flex items-center gap-3 text-base font-medium active:opacity-70"
                      style={{ color: 'var(--color-primary)' }}
                    >
                      <Phone className="h-5 w-5 shrink-0" />
                      {l.telephone}
                    </a>
                  )}

                  {l.adresse && (
                    <a
                      href={googleMapsLink(l.adresse)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-start gap-3 text-base text-[var(--text-secondary)] active:opacity-70"
                    >
                      <MapPin className="h-5 w-5 shrink-0 mt-0.5 text-[var(--text-muted)]" />
                      <span className="underline decoration-dotted underline-offset-2">
                        {l.adresse}
                      </span>
                    </a>
                  )}
                </div>

                {/* Heure assignation */}
                <div className="flex items-center gap-2 text-sm text-[var(--text-muted)] mb-4 pb-4 border-b border-[var(--border-subtle)]">
                  <Clock className="h-4 w-4" />
                  <span>
                    Assignée le{' '}
                    {format(
                      new Date(l.dateAssignation || l.createdAt),
                      "dd MMM yyyy 'à' HH:mm",
                      { locale: fr }
                    )}
                  </span>
                </div>

                {/* Note échec */}
                {l.statut === 'echec' && l.note && (
                  <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-300">
                    <span className="font-semibold">Motif : </span>
                    {l.note}
                  </div>
                )}

                {/* Confirmation livrée (dialog léger) */}
                {confirmLivreeId === l.id && (
                  <div className="mb-3 p-4 rounded-xl border border-green-500/30 bg-green-500/10">
                    <p className="text-sm font-semibold text-[var(--text-primary)] mb-3">
                      Confirmer que la commande #{l.vente?.numeroVente} a bien été livrée ?
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setConfirmLivreeId(null)}
                        disabled={isActing}
                        className="flex-1 h-10 rounded-xl text-sm font-medium text-[var(--text-secondary)] bg-[var(--surface-hover)]"
                      >
                        Annuler
                      </button>
                      <button
                        onClick={() => updateStatut(l.id, 'livree')}
                        disabled={isActing}
                        className="flex-1 h-10 rounded-xl text-sm font-semibold text-white bg-green-600 flex items-center justify-center gap-2"
                      >
                        {isActing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                        Confirmer
                      </button>
                    </div>
                  </div>
                )}

                {/* Actions */}
                {l.statut === 'assignee' && (
                  <button
                    onClick={() => updateStatut(l.id, 'en_route')}
                    disabled={isActing}
                    className="w-full h-12 rounded-xl text-base font-semibold text-white bg-green-600 active:bg-green-700 flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {isActing ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Truck className="h-5 w-5" />
                    )}
                    Démarrer la livraison
                  </button>
                )}

                {l.statut === 'en_route' && confirmLivreeId !== l.id && (
                  <div className="space-y-3">
                    <button
                      onClick={() => {
                        setEchecModal(null);
                        setConfirmLivreeId(l.id);
                      }}
                      disabled={isActing}
                      className="w-full h-12 rounded-xl text-base font-semibold text-white bg-green-600 active:bg-green-700 flex items-center justify-center gap-2 disabled:opacity-60"
                    >
                      <CheckCircle className="h-5 w-5" />
                      Marquer comme livrée
                    </button>
                    <button
                      onClick={() => openEchecModal(l)}
                      disabled={isActing}
                      className="w-full h-12 rounded-xl text-base font-semibold text-white bg-red-600 active:bg-red-700 flex items-center justify-center gap-2 disabled:opacity-60"
                    >
                      <XCircle className="h-5 w-5" />
                      Signaler un échec
                    </button>
                  </div>
                )}
              </article>
            );
          })
        )}
      </div>

      {/* Modal échec */}
      <Modal
        open={!!echecModal}
        onClose={() => {
          if (!loading) {
            setEchecModal(null);
            setEchecNote('');
          }
        }}
        title="Motif de l'échec"
        subtitle={
          echecModal
            ? `Commande #${echecModal.vente?.numeroVente}`
            : undefined
        }
        footer={
          <>
            <button
              onClick={() => {
                setEchecModal(null);
                setEchecNote('');
              }}
              disabled={loading}
              className="px-4 py-2.5 rounded-xl text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
            >
              Annuler
            </button>
            <button
              onClick={confirmEchec}
              disabled={loading || !echecNote.trim()}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-600 disabled:opacity-50 flex items-center gap-2"
            >
              {loading && actionId === echecModal?.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              Confirmer
            </button>
          </>
        }
      >
        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
          Décrivez la raison de l'échec <span className="text-red-400">*</span>
        </label>
        <textarea
          value={echecNote}
          onChange={(e) => setEchecNote(e.target.value)}
          placeholder="Ex : client absent, adresse incorrecte, refus de livraison…"
          rows={4}
          className="w-full rounded-xl p-4 text-base resize-none outline-none transition-colors"
          style={{
            background: 'var(--surface-hover)',
            border: '1px solid var(--border-default)',
            color: 'var(--text-primary)',
          }}
          autoFocus
        />
      </Modal>
    </div>
  );
};

export default MesLivraisons;
