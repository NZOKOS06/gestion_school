import { useEffect, useState, useMemo, useCallback } from 'react';
import { useAxios } from '../../hooks/useAxios';
import { useTenant } from '../../contexts/TenantContext';
import {
  PageHeader,
  KpiCard,
  SearchInput,
  DataTable,
  Badge,
  Button,
  Modal
} from '../../components/ui';
import {
  DollarSign,
  ShoppingCart,
  Loader2,
  Download,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Eye,
  Ban,
  Calendar
} from 'lucide-react';
import toast from 'react-hot-toast';

const VentesMgmt = () => {
  const { get, put, loading } = useAxios();
  const { formatPrice } = useTenant();

  const [ventes, setVentes] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const [search, setSearch] = useState('');
  const [statutFilter, setStatutFilter] = useState('');
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const [detailVente, setDetailVente] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const [annulVente, setAnnulVente] = useState(null);
  const [annulMotif, setAnnulMotif] = useState('');
  const [showAnnulModal, setShowAnnulModal] = useState(false);

  const fetchVentes = useCallback(async () => {
    const params = new URLSearchParams({ page: page.toString(), limit: '20' });
    if (search) params.set('search', search);
    if (statutFilter) params.set('statut', statutFilter);
    if (dateDebut) params.set('dateDebut', dateDebut);
    if (dateFin) params.set('dateFin', dateFin);

    try {
      const response = await get(`/api/ventes?${params.toString()}`);
      setVentes(response.data || []);
      setTotalPages(response.pagination?.totalPages || 1);
      setTotalItems(response.pagination?.total || 0);
    } catch (error) {
      console.error('Error fetching ventes:', error);
    }
  }, [page, search, statutFilter, dateDebut, dateFin, get]);

  useEffect(() => {
    fetchVentes();
  }, [fetchVentes]);

  const caTotal = useMemo(() => {
    return ventes
      .filter(v => v.statut !== 'annulee')
      .reduce((sum, v) => sum + parseFloat(v.montantTotal || 0), 0);
  }, [ventes]);

  const kpiData = useMemo(() => {
    const total = totalItems;
    const finalisees = ventes.filter(v => v.statut === 'finalisee').length;
    const enCours = ventes.filter(v => v.statut === 'en_cours').length;
    const annulees = ventes.filter(v => v.statut === 'annulee').length;
    return { total, caTotal, finalisees, enCours, annulees };
  }, [totalItems, ventes, caTotal]);

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatutBadge = (statut) => {
    switch (statut) {
      case 'en_cours':
        return { variant: 'warning', label: 'En cours' };
      case 'finalisee':
        return { variant: 'success', label: 'Finalisée' };
      case 'annulee':
        return { variant: 'danger', label: 'Annulée' };
      default:
        return { variant: 'neutral', label: statut };
    }
  };

  const handleRowClick = async (row) => {
    try {
      const vente = await get(`/api/ventes/${row.id}`);
      setDetailVente(vente);
      setShowDetailModal(true);
    } catch (error) {
      console.error('Error fetching vente detail:', error);
    }
  };

  const openAnnulModal = (vente) => {
    setAnnulVente(vente);
    setAnnulMotif('');
    setShowAnnulModal(true);
  };

  const handleAnnuler = async () => {
    if (!annulVente || !annulMotif.trim()) {
      toast.error('Veuillez saisir un motif d annulation');
      return;
    }
    try {
      await put(`/api/ventes/${annulVente.id}/annuler`, { motif: annulMotif.trim() });
      toast.success('Vente annulée avec succès');
      setShowAnnulModal(false);
      fetchVentes();
    } catch (error) {
      console.error('Annulation error:', error);
    }
  };

  const canAnnuler = (statut) => statut === 'en_cours' || statut === 'finalisee';

  const exportCSV = () => {
    const headers = ['N vente', 'Date', 'Client', 'Vendeur', 'Articles', 'Montant', 'Mode paiement', 'Statut'];
    const rows = ventes.map(v => [
      v.numeroVente,
      new Date(v.createdAt).toLocaleDateString('fr-FR'),
      v.nomClient || 'Client comptoir',
      v.staff ? `${v.staff.prenom} ${v.staff.nom}` : '-',
      (v.lignes || []).map(l => `${l.medicament?.dci} x${l.quantite}`).join('; '),
      parseFloat(v.montantTotal).toFixed(2),
      v.modePaiement || '-',
      v.statut
    ]);

    const csvContent = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `ventes_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Export CSV téléchargé');
  };

  const columns = [
    { key: 'numeroVente', label: 'N° vente' },
    {
      key: 'createdAt',
      label: 'Date',
      render: (_, row) => formatDate(row.createdAt)
    },
    {
      key: 'nomClient',
      label: 'Client',
      render: (val) => val || 'Client comptoir'
    },
    {
      key: 'vendeur',
      label: 'Vendeur',
      render: (_, row) => row.staff ? `${row.staff.prenom} ${row.staff.nom}` : '-'
    },
    {
      key: 'articles',
      label: 'Articles',
      render: (_, row) => (row.lignes || []).map(l => `${l.medicament?.dci} x${l.quantite}`).join(', ')
    },
    {
      key: 'montantTotal',
      label: 'Montant',
      render: (val) => formatPrice(parseFloat(val || 0))
    },
    {
      key: 'modePaiement',
      label: 'Mode paiement',
      render: (val) => val || '-'
    },
    {
      key: 'statut',
      label: 'Statut',
      render: (val) => {
        const badge = getStatutBadge(val);
        return <Badge variant={badge.variant} dot={val === 'en_cours'}>{badge.label}</Badge>;
      }
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, row) => (
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); handleRowClick(row); }}
            className="p-1.5 text-[#3B82F6] hover:bg-[color-mix(in_srgb,#3B82F6_12%,transparent)] rounded-lg"
            title="Détail"
          >
            <Eye className="h-4 w-4" />
          </button>
          {canAnnuler(row.statut) && (
            <button
              onClick={(e) => { e.stopPropagation(); openAnnulModal(row); }}
              className="p-1.5 text-[#EF4444] hover:bg-[color-mix(in_srgb,#EF4444_12%,transparent)] rounded-lg"
              title="Annuler"
            >
              <Ban className="h-4 w-4" />
            </button>
          )}
        </div>
      )
    }
  ];

  const resetFilters = () => {
    setSearch('');
    setStatutFilter('');
    setDateDebut('');
    setDateFin('');
    setPage(1);
  };

  const hasActiveFilters = search || statutFilter || dateDebut || dateFin;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gestion des ventes"
        subtitle="Historique complet, recherche avancée et annulations"
        icon={ShoppingCart}
        actions={
          <Button variant="secondary" icon={Download} onClick={exportCSV}>
            Exporter CSV
          </Button>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="CA période"
          value={formatPrice(kpiData.caTotal)}
          icon={DollarSign}
          color="green"
        />
        <KpiCard
          label="Ventes finalisées"
          value={kpiData.finalisees}
          icon={ShoppingCart}
          color="primary"
        />
        <KpiCard
          label="Ventes en cours"
          value={kpiData.enCours}
          icon={Loader2}
          color="orange"
        />
        <KpiCard
          label="Ventes annulées"
          value={kpiData.annulees}
          icon={Ban}
          color="red"
        />
      </div>

      {/* Filters */}
      <div className="bg-[var(--surface-raised)] rounded-xl shadow-sm p-4">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <SearchInput
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Rechercher par n° vente ou client..."
                loading={loading}
              />
            </div>
            <Button
              variant="ghost"
              icon={Calendar}
              onClick={() => setShowFilters(!showFilters)}
            >
              {showFilters ? 'Masquer filtres' : 'Filtres avancés'}
            </Button>
            {hasActiveFilters && (
              <Button variant="ghost" icon={RotateCcw} onClick={resetFilters}>
                Réinitialiser
              </Button>
            )}
          </div>

          {showFilters && (
            <div className="flex flex-col sm:flex-row gap-3 pt-3 border-t border-[var(--border-subtle)]">
              <div className="sm:w-48">
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Statut</label>
                <select
                  value={statutFilter}
                  onChange={(e) => { setStatutFilter(e.target.value); setPage(1); }}
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-[var(--surface-raised)] focus:ring-2 focus:ring-[var(--color-primary)]"
                >
                  <option value="">Tous</option>
                  <option value="en_cours">En cours</option>
                  <option value="finalisee">Finalisée</option>
                  <option value="annulee">Annulée</option>
                </select>
              </div>
              <div className="sm:w-48">
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Date début</label>
                <input
                  type="date"
                  value={dateDebut}
                  onChange={(e) => { setDateDebut(e.target.value); setPage(1); }}
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-[var(--surface-raised)] focus:ring-2 focus:ring-[var(--color-primary)]"
                />
              </div>
              <div className="sm:w-48">
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Date fin</label>
                <input
                  type="date"
                  value={dateFin}
                  onChange={(e) => { setDateFin(e.target.value); setPage(1); }}
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-[var(--surface-raised)] focus:ring-2 focus:ring-[var(--color-primary)]"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* DataTable */}
      <div className="bg-[var(--surface-raised)] rounded-xl shadow-sm overflow-hidden">
        <DataTable
          columns={columns}
          data={ventes}
          loading={loading}
          emptyMessage="Aucune vente trouvée"
          onRowClick={handleRowClick}
        />

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--border-subtle)]">
            <p className="text-sm text-[var(--text-muted)]">
              {totalItems} vente{totalItems > 1 ? 's' : ''}  Page {page} / {totalPages}
            </p>
            <div className="flex items-center space-x-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 rounded-lg hover:bg-[var(--surface-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`px-3 py-1 rounded-lg text-sm font-medium ${
                    page === p ? 'text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'
                  }`}
                  style={page === p ? { backgroundColor: 'var(--color-primary)' } : {}}
                >
                  {p}
                </button>
              ))}
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-2 rounded-lg hover:bg-[var(--surface-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Résumé bas de page */}
      <div className="bg-[var(--surface-hover)] rounded-lg p-4 flex items-center justify-between text-sm text-[var(--text-secondary)]">
        <span>{totalItems} vente{totalItems > 1 ? 's' : ''}</span>
        <span className="font-medium">CA total : {formatPrice(caTotal)}</span>
      </div>

      {/* Modal Détail */}
      <Modal
        open={showDetailModal}
        onClose={() => { setShowDetailModal(false); setDetailVente(null); }}
        title={`Détail vente n°${detailVente?.numeroVente || ''}`}
        size="lg"
        footer={
          <Button variant="ghost" onClick={() => setShowDetailModal(false)}>
            Fermer
          </Button>
        }
      >
        {detailVente && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-[var(--text-muted)]">Date</p>
                <p className="text-sm font-medium">{formatDate(detailVente.createdAt)}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--text-muted)]">Statut</p>
                <p className="text-sm font-medium">
                  <Badge variant={getStatutBadge(detailVente.statut).variant}>
                    {getStatutBadge(detailVente.statut).label}
                  </Badge>
                </p>
              </div>
              <div>
                <p className="text-xs text-[var(--text-muted)]">Client</p>
                <p className="text-sm font-medium">{detailVente.nomClient || 'Client comptoir'}</p>
                {detailVente.telephoneClient && (
                  <p className="text-xs text-[var(--text-muted)]">{detailVente.telephoneClient}</p>
                )}
              </div>
              <div>
                <p className="text-xs text-[var(--text-muted)]">Vendeur</p>
                <p className="text-sm font-medium">
                  {detailVente.staff ? `${detailVente.staff.prenom} ${detailVente.staff.nom}` : '-'}
                </p>
              </div>
              <div>
                <p className="text-xs text-[var(--text-muted)]">Mode paiement</p>
                <p className="text-sm font-medium">{detailVente.modePaiement || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--text-muted)]">Montant total</p>
                <p className="text-sm font-bold text-[var(--text-primary)]">{formatPrice(parseFloat(detailVente.montantTotal))}</p>
              </div>
            </div>

            {detailVente.ordonnance && (
              <div className="bg-[color-mix(in_srgb,#3B82F6_12%,transparent)] rounded-lg p-3">
                <p className="text-xs font-medium text-[#3B82F6] mb-1">Ordonnance</p>
                <p className="text-sm text-blue-900">Dr. {detailVente.ordonnance.nomMedecin || 'Non renseigné'}</p>
                <p className="text-xs text-[#3B82F6]">Statut : {detailVente.ordonnance.statut}</p>
              </div>
            )}

            <div>
              <p className="text-xs font-medium text-[var(--text-muted)] mb-2">Lignes de vente</p>
              <table className="w-full text-sm">
                <thead className="bg-[var(--surface-hover)]">
                  <tr>
                    <th className="text-left px-3 py-2 text-xs text-[var(--text-muted)]">Médicament</th>
                    <th className="text-right px-3 py-2 text-xs text-[var(--text-muted)]">Qté</th>
                    <th className="text-right px-3 py-2 text-xs text-[var(--text-muted)]">Prix unit.</th>
                    <th className="text-right px-3 py-2 text-xs text-[var(--text-muted)]">Sous-total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(detailVente.lignes || []).map((ligne) => (
                    <tr key={ligne.id}>
                      <td className="px-3 py-2">
                        <p className="font-medium">{ligne.medicament?.dci}</p>
                        <p className="text-xs text-[var(--text-muted)]">{ligne.medicament?.nomCommercial}</p>
                      </td>
                      <td className="px-3 py-2 text-right">{ligne.quantite}</td>
                      <td className="px-3 py-2 text-right">{formatPrice(parseFloat(ligne.prixUnitaire))}</td>
                      <td className="px-3 py-2 text-right font-medium">{formatPrice(parseFloat(ligne.sousTotal))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {detailVente.livraison && (
              <div className="bg-[color-mix(in_srgb,#F59E0B_12%,transparent)] rounded-lg p-3">
                <p className="text-xs font-medium text-[#F59E0B] mb-1">Livraison</p>
                <p className="text-sm text-orange-900">{detailVente.livraison.adresse}</p>
                <p className="text-xs text-[#F59E0B]">Statut : {detailVente.livraison.statut}</p>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Modal Annulation */}
      <Modal
        open={showAnnulModal}
        onClose={() => { setShowAnnulModal(false); setAnnulVente(null); setAnnulMotif(''); }}
        title="Confirmer l'annulation"
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowAnnulModal(false)}>
              Annuler
            </Button>
            <Button
              variant="danger"
              loading={loading}
              onClick={handleAnnuler}
            >
              Confirmer l'annulation
            </Button>
          </>
        }
      >
        {annulVente && (
          <div className="space-y-4">
            <p className="text-sm text-[var(--text-secondary)]">
              Vous êtes sur le point d'annuler la vente n°<strong>{annulVente.numeroVente}</strong>.
            </p>
            <p className="text-sm text-[#EF4444]">
              Cette action est irréversible et remettra les articles en stock.
            </p>
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                Motif d'annulation <span className="text-[#EF4444]">*</span>
              </label>
              <textarea
                value={annulMotif}
                onChange={(e) => setAnnulMotif(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent"
                placeholder="Saisissez le motif obligatoire..."
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default VentesMgmt;
