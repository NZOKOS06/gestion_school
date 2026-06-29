import { useState, useEffect, useCallback } from 'react';
import { useAxios } from '../../hooks/useAxios';
import { useSocket } from '../../hooks/useSocket';
import { useTenant } from '../../contexts/TenantContext';
import { Modal } from '../../components/ui';
import {
  Truck, Package, Clock, CheckCircle, XCircle, MapPin,
  Phone, User, ChevronRight, Filter, RotateCcw, Send
} from 'lucide-react';
import { format, isToday } from 'date-fns';
import { fr } from 'date-fns/locale';

const STATUTS = [
  { key: 'toutes', label: 'Toutes', color: 'gray' },
  { key: 'assignee', label: 'En attente', color: 'yellow' },
  { key: 'en_route', label: 'En route', color: 'blue' },
  { key: 'livree', label: 'Livrées', color: 'green' },
  { key: 'echec', label: 'Echecs', color: 'red' },
];

const STATUT_META = {
  assignee:   { label: 'En attente', badge: 'bg-[color-mix(in_srgb,#F59E0B_12%,transparent)] text-[#F59E0B]', border: 'border-l-yellow-400' },
  en_route:   { label: 'En route',   badge: 'bg-[color-mix(in_srgb,#3B82F6_12%,transparent)] text-[#3B82F6]',    border: 'border-l-blue-400' },
  livree:     { label: 'Livrée',     badge: 'bg-[color-mix(in_srgb,#10B981_12%,transparent)] text-[#10B981]',  border: 'border-l-green-500' },
  echec:      { label: 'Echec',      badge: 'bg-[color-mix(in_srgb,#EF4444_12%,transparent)] text-[#EF4444]',      border: 'border-l-red-500' },
};

const LivraisonsMgmt = () => {
  const { formatPrice } = useTenant();
  const { get, put, loading } = useAxios();
  const { on, off } = useSocket();

  const [livraisons, setLivraisons] = useState([]);
  const [livreurs, setLivreurs] = useState([]);
  const [activeTab, setActiveTab] = useState('toutes');
  const [kpis, setKpis] = useState({ enAttente: 0, enRoute: 0, livreesJour: 0, echecs: 0 });

  const [modalOpen, setModalOpen] = useState(false);
  const [modalLivraison, setModalLivraison] = useState(null);
  const [selectedLivreurId, setSelectedLivreurId] = useState('');

  // --- Fetch initial ---
  const fetchLivraisons = useCallback(async () => {
    try {
      const res = await get('/api/livraisons?page=1');
      const data = res.livraisons || [];
      setLivraisons(data);
      computeKpis(data);
    } catch (e) {
      /* toast géré par useAxios */
    }
  }, [get]);

  const fetchLivreurs = useCallback(async () => {
    try {
      const res = await get('/api/personnel?role=livreur');
      setLivreurs(res.data || []);
    } catch (e) {
      /* */
    }
  }, [get]);

  const computeKpis = (data) => {
    setKpis({
      enAttente: data.filter(l => l.statut === 'assignee').length,
      enRoute: data.filter(l => l.statut === 'en_route').length,
      livreesJour: data.filter(l => l.statut === 'livree' && l.dateLivraison && isToday(new Date(l.dateLivraison))).length,
      echecs: data.filter(l => l.statut === 'echec').length,
    });
  };

  useEffect(() => {
    fetchLivraisons();
    fetchLivreurs();
  }, [fetchLivraisons, fetchLivreurs]);

  // --- Socket.IO temps réel ---
  useEffect(() => {
    const handler = (payload) => {
      setLivraisons(prev =>
        prev.map(l => (l.id === payload.livraisonId ? { ...l, statut: payload.statut } : l))
      );
    };
    on('livraisonMAJ', handler);
    return () => off('livraisonMAJ', handler);
  }, [on, off]);

  // --- Actions ---
  const openAssignModal = (livraison) => {
    setModalLivraison(livraison);
    setSelectedLivreurId(livraison.livreur?.id || '');
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setModalLivraison(null);
    setSelectedLivreurId('');
  };

  const assignerLivreur = async () => {
    if (!modalLivraison || !selectedLivreurId) return;
    try {
      await put(`/api/livraisons/${modalLivraison.id}/statut`, {
        statut: 'assignee',
        livreurId: selectedLivreurId,
      });
      await fetchLivraisons();
      closeModal();
    } catch (e) {
      /* */
    }
  };

  const changerStatut = async (id, statut) => {
    try {
      await put(`/api/livraisons/${id}/statut`, { statut });
      await fetchLivraisons();
    } catch (e) {
      /* */
    }
  };

  const googleMapsLink = (adresse) => {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(adresse)}`;
  };

  // --- Filtrage ---
  const filtered = activeTab === 'toutes'
    ? livraisons
    : livraisons.filter(l => l.statut === activeTab);

  // --- Rendu ---
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Gestion des livraisons</h1>
        <button
          onClick={fetchLivraisons}
          className="flex items-center px-3 py-2 bg-[var(--surface-raised)] border rounded-lg text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
        >
          <RotateCcw className="h-4 w-4 mr-2" />
          Actualiser
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={Package}
          label="En attente"
          value={kpis.enAttente}
          color="bg-[color-mix(in_srgb,#F59E0B_12%,transparent)] text-[#F59E0B]"
        />
        <KpiCard
          icon={Truck}
          label="En route"
          value={kpis.enRoute}
          color="bg-[color-mix(in_srgb,#3B82F6_12%,transparent)] text-[#3B82F6]"
        />
        <KpiCard
          icon={CheckCircle}
          label="Livrées auj."
          value={kpis.livreesJour}
          color="bg-[color-mix(in_srgb,#10B981_12%,transparent)] text-[#10B981]"
        />
        <KpiCard
          icon={XCircle}
          label="Échecs"
          value={kpis.echecs}
          color="bg-[color-mix(in_srgb,#EF4444_12%,transparent)] text-[#EF4444]"
        />
      </div>

      {/* Onglets */}
      <div className="bg-[var(--surface-raised)] rounded-xl shadow-sm p-2">
        <div className="flex space-x-1 overflow-x-auto">
          {STATUTS.map(s => (
            <button
              key={s.key}
              onClick={() => setActiveTab(s.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === s.key
                  ? 'bg-gray-900 text-white'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'
              }`}
            >
              {s.label}
              {s.key !== 'toutes' && (
                <span className="ml-2 text-xs opacity-70">
                  ({livraisons.filter(l => l.statut === s.key).length})
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Liste cards */}
      {filtered.length === 0 ? (
        <div className="bg-[var(--surface-raised)] rounded-xl shadow-sm p-12 text-center">
          <Package className="h-12 w-12 mx-auto text-gray-300 mb-4" />
          <p className="text-[var(--text-muted)]">Aucune livraison dans cette catégorie.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map(l => {
            const meta = STATUT_META[l.statut] || STATUT_META.assignee;
            return (
              <div
                key={l.id}
                className={`bg-[var(--surface-raised)] rounded-xl shadow-sm p-5 border-l-4 ${meta.border} card-hover`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-sm text-[var(--text-muted)]">Commande n°</p>
                    <p className="text-lg font-bold text-[var(--text-primary)]">
                      #{l.vente?.numeroVente || '-'}
                    </p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${meta.badge}`}>
                    {meta.label}
                  </span>
                </div>

                <div className="mb-3">
                  <p className="text-xl font-semibold" style={{ color: 'var(--color-primary)' }}>
                    {formatPrice(l.vente?.montantTotal || 0)}
                  </p>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center text-[var(--text-secondary)]">
                    <User className="h-4 w-4 mr-2 text-[var(--text-muted)]" />
                    <span className="font-medium">{l.vente?.nomClient || 'Client comptoir'}</span>
                  </div>
                  {l.vente?.telephoneClient && (
                    <div className="flex items-center">
                      <Phone className="h-4 w-4 mr-2 text-[var(--text-muted)]" />
                      <a href={`tel:${l.vente.telephoneClient}`} className="font-medium hover:underline" style={{ color: 'var(--color-primary)' }}>
                        {l.vente.telephoneClient}
                      </a>
                    </div>
                  )}
                  <div className="flex items-start text-[var(--text-secondary)]">
                    <MapPin className="h-4 w-4 mr-2 text-[var(--text-muted)] mt-0.5" />
                    <span>{l.adresse}</span>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t flex items-center justify-between">
                  <div className="text-sm">
                    {l.livreur ? (
                      <span className="text-[var(--text-secondary)]">
                        <span className="font-medium">{l.livreur.prenom} {l.livreur.nom}</span>
                        <span className="text-[var(--text-muted)] ml-1">(livreur)</span>
                      </span>
                    ) : (
                      <span className="text-[#EF4444] font-medium flex items-center">
                        <Clock className="h-4 w-4 mr-1" />
                        Non assigné
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-[var(--text-muted)]">
                    {l.dateLivraison
                      ? format(new Date(l.dateLivraison), 'HH:mm', { locale: fr })
                      : format(new Date(l.createdAt), 'dd/MM HH:mm', { locale: fr })}
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-3 flex gap-2">
                  {!l.livreur && (
                    <button
                      onClick={() => openAssignModal(l)}
                      className="flex-1 flex items-center justify-center px-3 py-2 rounded-lg text-sm font-medium text-white"
                      style={{ backgroundColor: 'var(--color-primary)' }}
                    >
                      <Send className="h-4 w-4 mr-2" />
                      Assigner
                    </button>
                  )}
                  {l.statut === 'assignee' && l.livreur && (
                    <button
                      onClick={() => changerStatut(l.id, 'en_route')}
                      className="flex-1 flex items-center justify-center px-3 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700"
                    >
                      <Truck className="h-4 w-4 mr-2" />
                      Marquer en route
                    </button>
                  )}
                  {l.statut === 'en_route' && (
                    <>
                      <button
                        onClick={() => changerStatut(l.id, 'livree')}
                        className="flex-1 flex items-center justify-center px-3 py-2 rounded-lg text-sm font-medium bg-green-600 text-white hover:bg-green-700"
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Livrée
                      </button>
                      <button
                        onClick={() => changerStatut(l.id, 'echec')}
                        className="flex-1 flex items-center justify-center px-3 py-2 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-700"
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Echec
                      </button>
                    </>
                  )}
                  <a
                    href={googleMapsLink(l.adresse)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center px-3 py-2 rounded-lg text-sm font-medium border hover:bg-[var(--surface-hover)]"
                  >
                    <MapPin className="h-4 w-4 mr-2" />
                    Carte
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal assigner livreur */}
      <Modal
        open={modalOpen && !!modalLivraison}
        onClose={closeModal}
        title="Assigner un livreur"
        subtitle={`Commande #${modalLivraison?.vente?.numeroVente}`}
        size="md"
        footer={
          <>
            <button
              onClick={closeModal}
              className="px-4 py-2 text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] rounded-lg text-sm"
            >
              Annuler
            </button>
            <button
              onClick={assignerLivreur}
              disabled={!selectedLivreurId || loading}
              className="px-4 py-2 text-white rounded-lg text-sm font-medium disabled:opacity-50"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              Confirmer
            </button>
          </>
        }
      >
        <div className="space-y-2 max-h-64 overflow-y-auto">
              {livreurs.length === 0 ? (
                <p className="text-sm text-[var(--text-muted)] text-center py-4">
                  Aucun livreur disponible.
                </p>
              ) : (
                livreurs.map(liv => (
                  <label
                    key={liv.id}
                    className={`flex items-center p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedLivreurId === liv.id
                        ? 'border-green-500 bg-[color-mix(in_srgb,#10B981_12%,transparent)]'
                        : 'border-[var(--border-subtle)] hover:bg-[var(--surface-hover)]'
                    }`}
                  >
                    <input
                      type="radio"
                      name="livreur"
                      value={liv.id}
                      checked={selectedLivreurId === liv.id}
                      onChange={() => setSelectedLivreurId(liv.id)}
                      className="h-4 w-4 text-[#10B981] focus:ring-[var(--color-primary)]"
                    />
                    <div className="ml-3">
                      <p className="font-medium text-[var(--text-primary)]">
                        {liv.prenom} {liv.nom}
                      </p>
                      <p className="text-xs text-[var(--text-muted)]">{liv.telephone}</p>
                    </div>
                  </label>
                ))
              )}
            </div>
      </Modal>
    </div>
  );
};

/* ---- Sous-composants ---- */

const KpiCard = ({ icon: Icon, label, value, color }) => (
  <div className="bg-[var(--surface-raised)] rounded-xl shadow-sm p-5 flex items-center">
    <div className={`h-12 w-12 rounded-lg flex items-center justify-center mr-4 ${color}`}>
      <Icon className="h-6 w-6" />
    </div>
    <div>
      <p className="text-2xl font-bold text-[var(--text-primary)]">{value}</p>
      <p className="text-sm text-[var(--text-muted)]">{label}</p>
    </div>
  </div>
);

export default LivraisonsMgmt;

