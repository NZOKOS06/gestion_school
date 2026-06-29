import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import { useTenant } from '../../contexts/TenantContext';
import { Modal } from '../../components/ui';
import {
  ArrowLeft, Calendar, ShoppingBag, Eye, ChevronLeft, ChevronRight,
  Package, Pill
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════
// UTILITAIRES
// ═══════════════════════════════════════════════════════════
const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
};

const getStatutBadge = (statut) => {
  const styles = {
    payee: { bg: '#DCFCE7', text: '#166534', label: 'Payée' },
    en_cours: { bg: '#FEF3C7', text: '#92400E', label: 'En cours' },
    annulee: { bg: '#FEE2E2', text: '#991B1B', label: 'Annulée' },
    livree: { bg: '#DBEAFE', text: '#1E40AF', label: 'Livrée' },
    default: { bg: '#F3F4F6', text: '#374151', label: statut || 'Inconnu' }
  };
  const style = styles[statut] || styles.default;
  return (
    <span
      className="px-2 py-1 rounded-full text-xs font-medium"
      style={{ background: style.bg, color: style.text }}
    >
      {style.label}
    </span>
  );
};

// ═══════════════════════════════════════════════════════════
// MODAL DÉTAIL
// ═══════════════════════════════════════════════════════════
const DetailModal = ({ vente, onClose, formatPrice }) => {
  if (!vente) return null;

  return (
    <Modal
      open={!!vente}
      onClose={onClose}
      title="Détail de la commande"
      size="md"
    >
      <div className="space-y-4">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-12 w-12 rounded-full bg-[var(--surface-overlay)] flex items-center justify-center">
              <ShoppingBag className="h-6 w-6" style={{ color: 'var(--color-primary)' }} />
            </div>
            <div>
              <p className="font-bold" style={{ color: 'var(--text-primary)' }}>
                Commande #{vente.numeroVente}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{formatDate(vente.createdAt)}</p>
            </div>
            <div className="ml-auto">
              {getStatutBadge(vente.statut)}
            </div>
          </div>

          <div className="space-y-3 mb-6">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Articles</h4>
            {vente.items?.map((item, idx) => (
              <div
                key={idx}
                className="flex items-center gap-3 p-3 bg-[var(--surface-base)] dark:bg-[#161b22] rounded-xl"
              >
                <div className="h-8 w-8 rounded-lg bg-white dark:bg-[#21262d] flex items-center justify-center shrink-0">
                  <Pill className="h-4 w-4" style={{ color: 'var(--color-primary)' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                    {item.dci || item.medicament?.dci || 'Médicament'}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Qté: {item.quantite}
                  </p>
                </div>
                <span className="text-sm font-medium shrink-0" style={{ fontFamily: 'var(--font-mono)' }}>
                  {formatPrice(Number(item.prixUnitaire) * item.quantite)}
                </span>
              </div>
            ))}
            {!vente.items?.length && (
              <p className="text-sm text-gray-500 dark:text-gray-400 italic">Aucun détail disponible</p>
            )}
          </div>

          <div className="border-t border-[var(--border-subtle)] pt-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400">Total</span>
              <span
                className="text-xl font-bold"
                style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-primary)' }}
              >
                {formatPrice(Number(vente.totalTTC) || 0)}
              </span>
            </div>
        </div>
      </div>
    </Modal>
  );
};

// ═══════════════════════════════════════════════════════════
// COMPOSANT PRINCIPAL
// ═══════════════════════════════════════════════════════════
const ClientHistorique = () => {
  const { user } = useAuth();
  const { formatPrice } = useTenant();
  const headers = useMemo(() => ({ 'X-Tenant-Slug': user?.tenantSlug || 'default' }), [user?.tenantSlug]);

  const [loading, setLoading] = useState(true);
  const [ventes, setVentes] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [selectedVente, setSelectedVente] = useState(null);

  // Filtres
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');

  const limit = 10;

  const fetchHistorique = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const params = {
        client: 'moi',
        page,
        limit,
        ...(dateDebut && { dateDebut }),
        ...(dateFin && { dateFin })
      };

      const res = await axios.get('/api/ventes', { headers, params });
      setVentes(res.data.ventes || []);
      setTotal(res.data.total || 0);
    } catch (err) {
      console.error('Erreur historique:', err);
      toast.error('Erreur de chargement de l\'historique');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistorique();
  }, [user, headers, page, dateDebut, dateFin]);

  const totalPages = Math.ceil(total / limit);
  const totalPeriode = ventes.reduce((sum, v) => sum + (Number(v.totalTTC) || 0), 0);

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link
          to="/profil"
          className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour au profil
        </Link>
      </div>

      <h1 className="text-2xl font-bold mb-6" style={{ color: 'var(--text-primary)' }}>
        Historique d'achats
      </h1>

      {/* Filtres */}
      <div className="bg-white dark:bg-[#161b22] rounded-2xl p-4 border border-[var(--border-subtle)] shadow-sm mb-6">
        <div className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="flex-1 w-full">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Date début
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="date"
                value={dateDebut}
                onChange={(e) => setDateDebut(e.target.value)}
                className="w-full h-10 pl-10 pr-4 text-sm rounded-xl border border-[var(--border-subtle)] outline-none focus:ring-2 focus:ring-[color-mix(in_srgb,var(--color-primary)_25%,transparent)]"
              />
            </div>
          </div>
          <div className="flex-1 w-full">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Date fin
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="date"
                value={dateFin}
                onChange={(e) => setDateFin(e.target.value)}
                className="w-full h-10 pl-10 pr-4 text-sm rounded-xl border border-[var(--border-subtle)] outline-none focus:ring-2 focus:ring-[color-mix(in_srgb,var(--color-primary)_25%,transparent)]"
              />
            </div>
          </div>
          <button
            onClick={() => { setDateDebut(''); setDateFin(''); setPage(1); }}
            className="h-10 px-4 text-sm font-medium rounded-xl border border-[var(--border-subtle)] hover:bg-gray-50 dark:hover:bg-[#21262d] transition-colors"
          >
            Réinitialiser
          </button>
        </div>
      </div>

      {/* DataTable */}
      <div className="bg-white dark:bg-[#161b22] rounded-2xl border border-[var(--border-subtle)] shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: 'var(--color-primary)' }} />
          </div>
        ) : ventes.length === 0 ? (
          <div className="text-center py-12">
            <ShoppingBag className="h-12 w-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
            <p className="text-gray-500 dark:text-gray-400">Aucun achat trouvé pour cette période</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[var(--surface-overlay)]">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400">N° vente</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400">Articles</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400">Montant</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400">Statut</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 dark:text-gray-400">Détail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {ventes.map((vente) => (
                    <tr key={vente.id} className="hover:bg-[var(--surface-base)] dark:hover:bg-[#21262d]">
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                        {formatDate(vente.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                        #{vente.numeroVente}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {vente.items?.length || 0} article(s)
                      </td>
                      <td className="px-4 py-3 text-sm font-medium" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-primary)' }}>
                        {formatPrice(Number(vente.totalTTC) || 0)}
                      </td>
                      <td className="px-4 py-3">
                        {getStatutBadge(vente.statut)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => setSelectedVente(vente)}
                          className="p-2 hover:bg-gray-100 dark:hover:bg-[#21262d] rounded-lg transition-colors"
                        >
                          <Eye className="h-4 w-4" style={{ color: 'var(--color-primary)' }} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--border-subtle)]">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg hover:bg-gray-100 dark:hover:bg-[#21262d] disabled:opacity-50"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Précédent
                </button>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Page {page} sur {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg hover:bg-gray-100 dark:hover:bg-[#21262d] disabled:opacity-50"
                >
                  Suivant
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Total période */}
            <div className="px-4 py-3 bg-[var(--surface-overlay)] border-t border-[var(--border-subtle)]">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400">Total période</span>
                <span
                  className="text-lg font-bold"
                  style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-primary)' }}
                >
                  {formatPrice(totalPeriode)}
                </span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Modal */}
      {selectedVente && (
        <DetailModal
          vente={selectedVente}
          onClose={() => setSelectedVente(null)}
          formatPrice={formatPrice}
        />
      )}
    </div>
  );
};

export default ClientHistorique;
