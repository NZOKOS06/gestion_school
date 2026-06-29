import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useAxios } from '../../hooks/useAxios';
import { useTenant } from '../../contexts/TenantContext';
import {
  Package,
  AlertTriangle,
  Clock,
  Search,
  SlidersHorizontal,
  RotateCcw,
  TrendingUp,
  TrendingDown,
  Minus,
  X,
  ChevronLeft,
  ChevronRight,
  Activity
} from 'lucide-react';
import toast from 'react-hot-toast';

const StockMgmt = () => {
  const { formatPrice } = useTenant();
  const { get, post, loading } = useAxios();
  const navigate = useNavigate();
  const tableRef = useRef(null);

  const [medicaments, setMedicaments] = useState([]);
  const [search, setSearch] = useState('');
  const [categorieId, setCategorieId] = useState('');
  const [categories, setCategories] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const [totalRefs, setTotalRefs] = useState(0);
  const [kpiRuptures, setKpiRuptures] = useState(0);
  const [kpiPeremptions, setKpiPeremptions] = useState(0);

  const [showModal, setShowModal] = useState(false);
  const [selectedMed, setSelectedMed] = useState(null);
  const [selectedMedLots, setSelectedMedLots] = useState([]);
  const [ajustementType, setAjustementType] = useState('entree');
  const [quantite, setQuantite] = useState('');
  const [note, setNote] = useState('');
  const [selectedLotId, setSelectedLotId] = useState('');
  const [modalLoading, setModalLoading] = useState(false);

  const [mouvements, setMouvements] = useState([]);
  const [filterRupture, setFilterRupture] = useState(false);
  const [ruptureMeds, setRuptureMeds] = useState([]);

  useEffect(() => {
    fetchCategories();
    fetchAlertes();
    fetchMouvements();
  }, []);

  useEffect(() => {
    if (filterRupture) {
      fetchRuptures();
    } else {
      fetchMedicaments();
    }
  }, [page, search, categorieId, filterRupture]);

  const fetchMedicaments = async () => {
    try {
      const response = await get(
        `/api/medicaments?page=${page}&limit=30&search=${encodeURIComponent(search)}&categorieId=${categorieId}`
      );
      setMedicaments(response.data || []);
      setTotalPages(response.pagination?.totalPages || 1);
      setTotalItems(response.pagination?.total || 0);
      setTotalRefs(response.pagination?.total || 0);
    } catch (error) {
      console.error('Error fetching medicaments:', error);
    }
  };

  const fetchAlertes = async () => {
    try {
      const response = await get('/api/medicaments/stock-alerts');
      setKpiRuptures(response.ruptures?.length || 0);
      setKpiPeremptions(response.peremptions?.length || 0);
      setRuptureMeds(response.ruptures || []);
    } catch (error) {
      console.error('Error fetching alertes:', error);
    }
  };

  const fetchRuptures = async () => {
    setMedicaments(ruptureMeds);
    setTotalPages(1);
    setTotalItems(ruptureMeds.length);
  };

  const fetchMouvements = async () => {
    try {
      const response = await get('/api/stock/mouvements?limit=20');
      setMouvements(response.data || []);
    } catch (error) {
      console.error('Error fetching mouvements:', error);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await get('/api/categories');
      setCategories(response || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const handleRuptureClick = () => {
    setFilterRupture(true);
    setPage(1);
    setSearch('');
    setCategorieId('');
    setTimeout(() => {
      tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const clearFilters = () => {
    setFilterRupture(false);
    setSearch('');
    setCategorieId('');
    setPage(1);
  };

  const openAjustementModal = async (med) => {
    setSelectedMed(med);
    setAjustementType('entree');
    setQuantite('');
    setNote('');
    setModalLoading(true);
    setShowModal(true);

    try {
      const fullMed = await get(`/api/medicaments/${med.id}`);
      setSelectedMedLots(fullMed.lots || []);
      if (fullMed.lots?.length > 0) {
        setSelectedLotId(fullMed.lots[0].id);
      } else {
        setSelectedLotId('');
      }
    } catch (error) {
      toast.error('Erreur lors du chargement des lots');
      setSelectedMedLots([]);
      setSelectedLotId('');
    } finally {
      setModalLoading(false);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedMed(null);
    setSelectedMedLots([]);
    setSelectedLotId('');
  };

  const handleAjustementSubmit = async (e) => {
    e.preventDefault();
    if (!quantite || parseInt(quantite) < 0) {
      toast.error('Veuillez entrer une quantité valide');
      return;
    }
    if (!note.trim()) {
      toast.error('La note est obligatoire');
      return;
    }

    const lot = selectedMedLots.find((l) => l.id === selectedLotId);
    const currentQty = lot ? lot.quantiteRestante : 0;
    let quantiteAjustee;

    if (ajustementType === 'entree') {
      quantiteAjustee = currentQty + parseInt(quantite);
    } else if (ajustementType === 'sortie') {
      if (!lot) {
        toast.error('Sélectionnez un lot pour effectuer une sortie');
        return;
      }
      quantiteAjustee = currentQty - parseInt(quantite);
      if (quantiteAjustee < 0) {
        toast.error('Quantité de sortie supérieure au stock disponible');
        return;
      }
    } else {
      quantiteAjustee = parseInt(quantite);
      if (quantiteAjustee < 0) {
        toast.error('La quantité ne peut pas être négative');
        return;
      }
    }

    try {
      await post('/api/stock/ajustement', {
        medicamentId: selectedMed.id,
        ...(selectedLotId && { lotStockId: selectedLotId }),
        quantiteAjustee,
        note: note.trim()
      }, { silent: true });
      toast.success('Ajustement enregistré avec succès');
      closeModal();
      fetchMedicaments();
      fetchAlertes();
      fetchMouvements();
    } catch (error) {
      console.error('Ajustement error:', error);
    }
  };

  const getStockStatus = (stockTotal, seuilAlerte) => {
    if (stockTotal <= 0) {
      return { label: 'Rupture', className: 'bg-[color-mix(in_srgb,#EF4444_12%,transparent)] text-red-800' };
    }
    if (stockTotal <= seuilAlerte) {
      return { label: 'Critique', className: 'bg-[color-mix(in_srgb,#F59E0B_12%,transparent)] text-orange-800' };
    }
    return { label: 'OK', className: 'bg-[color-mix(in_srgb,#10B981_12%,transparent)] text-green-800' };
  };

  const getMouvementTypeStyle = (type) => {
    switch (type) {
      case 'entree':
        return 'text-[#10B981] bg-[color-mix(in_srgb,#10B981_12%,transparent)]';
      case 'sortie':
        return 'text-[#EF4444] bg-[color-mix(in_srgb,#EF4444_12%,transparent)]';
      case 'ajustement':
        return 'text-[#3B82F6] bg-[color-mix(in_srgb,#3B82F6_12%,transparent)]';
      case 'peremption':
        return 'text-gray-600 bg-gray-50';
      case 'retour':
        return 'text-purple-600 bg-purple-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const getMouvementTypeLabel = (type) => {
    const labels = {
      entree: 'Entrée',
      sortie: 'Sortie',
      ajustement: 'Ajustement',
      peremption: 'Péremption',
      retour: 'Retour'
    };
    return labels[type] || type;
  };

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

  const kpiCards = [
    {
      title: 'Total références',
      value: totalRefs,
      icon: Package,
      color: 'blue',
      clickable: false
    },
    {
      title: 'Ruptures / Critiques',
      value: kpiRuptures,
      icon: AlertTriangle,
      color: 'red',
      clickable: true,
      onClick: handleRuptureClick
    },
    {
      title: 'Péremptions proches',
      value: kpiPeremptions,
      icon: Clock,
      color: 'orange',
      clickable: true,
      onClick: () => navigate('/admin/lots')
    }
  ];

  const displayData = filterRupture ? ruptureMeds : medicaments;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Gestion du stock</h1>
        {filterRupture && (
          <button
            onClick={clearFilters}
            className="flex items-center px-4 py-2 rounded-lg text-sm font-medium bg-gray-50 text-gray-600 hover:bg-gray-100"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Réinitialiser le filtre
          </button>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {kpiCards.map((kpi, idx) => {
          const Icon = kpi.icon;
          const colorMap = {
            blue: 'bg-[color-mix(in_srgb,#3B82F6_12%,transparent)] text-[#3B82F6]',
            red: 'bg-[color-mix(in_srgb,#EF4444_12%,transparent)] text-[#EF4444]',
            orange: 'bg-[color-mix(in_srgb,#F59E0B_12%,transparent)] text-[#F59E0B]'
          };
          const borderMap = {
            blue: 'border-[color-mix(in_srgb,#3B82F6_30%,transparent)]',
            red: 'border-[color-mix(in_srgb,#EF4444_30%,transparent)]',
            orange: 'border-[color-mix(in_srgb,#F59E0B_30%,transparent)]'
          };

          return (
            <button
              key={idx}
              onClick={kpi.clickable ? kpi.onClick : undefined}
              disabled={!kpi.clickable}
              className={`bg-white rounded-xl shadow-sm p-6 border ${borderMap[kpi.color]} flex items-center justify-between transition-all ${
                kpi.clickable ? 'hover:shadow-md cursor-pointer' : 'cursor-default'
              }`}
            >
              <div>
                <p className="text-sm text-gray-500 mb-1">{kpi.title}</p>
                <p className="text-3xl font-bold text-gray-900">{kpi.value}</p>
              </div>
              <div className={`h-12 w-12 rounded-full flex items-center justify-center ${colorMap[kpi.color]}`}>
                <Icon className="h-6 w-6" />
              </div>
            </button>
          );
        })}
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); setFilterRupture(false); }}
            placeholder="Rechercher par DCI ou nom commercial..."
            className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 bg-white"
          />
        </div>
        <div className="relative sm:w-64">
          <SlidersHorizontal className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <select
            value={categorieId}
            onChange={(e) => { setCategorieId(e.target.value); setPage(1); setFilterRupture(false); }}
            className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 bg-white appearance-none"
          >
            <option value="">Toutes les catégories</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.nom}
              </option>
            ))}
          </select>
        </div>
      </div>

      {filterRupture && (
        <div className="bg-[color-mix(in_srgb,#EF4444_12%,transparent)] border border-[color-mix(in_srgb,#EF4444_30%,transparent)] rounded-lg p-3 flex items-center text-[#EF4444] text-sm">
          <AlertTriangle className="h-4 w-4 mr-2" />
          Affichage des médicaments en rupture ou stock critique
        </div>
      )}

      {/* Medicaments Table */}
      <div ref={tableRef} className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[var(--surface-hover)]">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">DCI</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nom commercial</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Forme</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Stock total</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Seuil alerte</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Prix vente</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Statut</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {displayData.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                    Aucun médicament trouvé
                  </td>
                </tr>
              ) : (
                displayData.map((med) => {
                  const status = getStockStatus(med.stockTotal, med.seuilAlerte);
                  return (
                    <tr key={med.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{med.dci}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{med.nomCommercial}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {med.formeGalenique || '-'}
                        {med.dosage ? ` - ${med.dosage}` : ''}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">{med.stockTotal}</td>
                      <td className="px-4 py-3 text-right text-sm text-gray-500">{med.seuilAlerte}</td>
                      <td className="px-4 py-3 text-right text-sm text-gray-900">
                        {med.prixVente ? formatPrice(med.prixVente) : '-'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${status.className}`}
                        >
                          {status.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => openAjustementModal(med)}
                          className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:opacity-90"
                        >
                          Ajuster
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!filterRupture && totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
            <p className="text-sm text-gray-400">
              {totalItems} résultat{totalItems > 1 ? 's' : ''}
            </p>
            <div className="flex items-center space-x-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 rounded-lg hover:bg-[var(--surface-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`px-3 py-1 rounded-lg text-sm font-medium ${
                    page === p
                      ? 'text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                  style={page === p ? { backgroundColor: '#16A34A' } : {}}
                >
                  {p}
                </button>
              ))}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-2 rounded-lg hover:bg-[var(--surface-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Derniers mouvements */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center">
            <Activity className="h-5 w-5 mr-2 text-emerald-600" />
            Derniers mouvements
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Médicament</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Quantité</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Par</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {mouvements.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                    Aucun mouvement récent
                  </td>
                </tr>
              ) : (
                mouvements.map((m) => (
                  <tr key={m.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                      {formatDate(m.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getMouvementTypeStyle(
                          m.type
                        )}`}
                      >
                        {getMouvementTypeLabel(m.type)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {m.medicament?.dci || '-'}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">
                      {m.quantite > 0 && (m.type === 'entree' || m.type === 'retour') ? (
                        <span className="text-[#10B981] flex items-center justify-end">
                          <TrendingUp className="h-3 w-3 mr-1" />+{m.quantite}
                        </span>
                      ) : m.quantite > 0 && (m.type === 'sortie' || m.type === 'peremption') ? (
                        <span className="text-[#EF4444] flex items-center justify-end">
                          <TrendingDown className="h-3 w-3 mr-1" />-{m.quantite}
                        </span>
                      ) : (
                        <span className="flex items-center justify-end">
                          <Minus className="h-3 w-3 mr-1" />
                          {m.quantite}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {m.staff ? `${m.staff.prenom} ${m.staff.nom}` : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400 max-w-xs truncate">
                      {m.note || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Ajustement */}
      {showModal && selectedMed && createPortal(
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4" onClick={closeModal}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto mt-10 mb-4" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">
                  Ajustement stock
                </h2>
                <button
                  onClick={closeModal}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <p className="text-sm text-gray-400">Médicament</p>
                <p className="font-semibold text-gray-900">{selectedMed.dci}</p>
                <p className="text-sm text-gray-600">{selectedMed.nomCommercial}</p>
                <div className="mt-2 flex items-center gap-4 text-sm">
                  <span className="text-gray-600">
                    Stock actuel: <span className="font-semibold text-gray-900">{selectedMed.stockTotal}</span>
                  </span>
                </div>
              </div>

              {modalLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div
                    className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 border-t-transparent"
                  />
                </div>
              ) : (
                <form onSubmit={handleAjustementSubmit} className="space-y-4">
                  {selectedMedLots.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                        Lot concerné *
                      </label>
                      <select
                        value={selectedLotId}
                        onChange={(e) => setSelectedLotId(e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--color-primary)] bg-[var(--surface-raised)]"
                        required
                      >
                        {selectedMedLots.map((lot) => (
                          <option key={lot.id} value={lot.id}>
                            {lot.numeroLot} — {lot.quantiteRestante} unités — Péremption: {new Date(lot.datePeremption).toLocaleDateString('fr-FR')}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {selectedMedLots.length === 0 && (
                    <div className="bg-[color-mix(in_srgb,#F59E0B_12%,transparent)] border border-[color-mix(in_srgb,#F59E0B_30%,transparent)] rounded-lg p-3 text-sm text-[#F59E0B]">
                      Aucun lot actif. Une entrée créera automatiquement un lot générique.
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                      Type d'opération *
                    </label>
                    <select
                      value={ajustementType}
                      onChange={(e) => setAjustementType(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--color-primary)] bg-[var(--surface-raised)]"
                      required
                    >
                      <option value="entree">Entrée de stock</option>
                      <option value="sortie">Sortie de stock</option>
                      <option value="ajustement">Ajustement inventaire (absolu)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                      Quantité *
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={quantite}
                      onChange={(e) => setQuantite(e.target.value)}
                      placeholder={
                        ajustementType === 'ajustement'
                          ? 'Nouvelle quantité totale...'
                          : 'Quantité...'
                      }
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--color-primary)]"
                      required
                    />
                    <p className="text-xs text-[var(--text-muted)] mt-1">
                      {ajustementType === 'entree'
                        ? 'Ajoutée au stock actuel'
                        : ajustementType === 'sortie'
                        ? 'Retirée du stock actuel'
                        : 'Remplace la quantité actuelle'}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                      Note / Motif *
                    </label>
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Ex: Inventaire mensuel, produits endommagés..."
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--color-primary)] resize-none"
                      rows={3}
                      required
                    />
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={closeModal}
                      className="flex-1 px-4 py-2 border rounded-lg text-[var(--text-secondary)] font-medium hover:bg-[var(--surface-hover)]"
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 px-4 py-2 rounded-lg text-white font-medium disabled:opacity-50"
                      style={{ backgroundColor: 'var(--color-primary)' }}
                    >
                      {loading ? 'Enregistrement...' : 'Confirmer'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default StockMgmt;
