import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAxios } from '../../hooks/useAxios';
import {
  Package,
  AlertTriangle,
  Clock,
  Calendar,
  Search,
  SlidersHorizontal,
  RotateCcw,
  X,
  Archive,
  ChevronLeft,
  ChevronRight,
  Edit2,
  Trash2,
  Plus,
  Minus
} from 'lucide-react';
import toast from 'react-hot-toast';

const LotsMgmt = () => {
  const { get, del, put, post, loading } = useAxios();

  const [allLots, setAllLots] = useState([]);
  const [search, setSearch] = useState('');
  const [statutFilter, setStatutFilter] = useState('');
  const [page, setPage] = useState(1);
  const limit = 30;

  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState(''); // 'edit', 'delete', 'adjust'
  const [selectedLot, setSelectedLot] = useState(null);
  const [formData, setFormData] = useState({
    numeroLot: '',
    datePeremption: '',
    prixAchatLot: ''
  });
  const [adjustmentQty, setAdjustmentQty] = useState('');
  const [adjustmentNote, setAdjustmentNote] = useState('');
  const [voirArchives, setVoirArchives] = useState(false);

  useEffect(() => {
    fetchLots();
  }, [voirArchives]);

  const fetchLots = async () => {
    try {
      const url = voirArchives
        ? '/api/stock/lots?limit=1000&inclureArchives=true'
        : '/api/stock/lots?limit=1000';
      const response = await get(url);
      setAllLots(response.data || []);
    } catch (error) {
      console.error('Error fetching lots:', error);
    }
  };

  const getJoursRestants = (datePeremption) => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const peremption = new Date(datePeremption);
    peremption.setHours(0, 0, 0, 0);
    return Math.ceil((peremption - now) / (1000 * 60 * 60 * 24));
  };

  const computeStatut = (lot) => {
    if (lot.archive) return 'archive';
    if (lot.quantiteRestante <= 0) return 'epuise';
    const jours = getJoursRestants(lot.datePeremption);
    if (jours < 0) return 'perime';
    if (jours <= 30) return 'critique';
    if (jours <= 90) return 'alerte';
    return 'actif';
  };

  const getStatutBadge = (statut) => {
    switch (statut) {
      case 'archive':
        return { label: 'Archivé', className: 'bg-gray-100 text-gray-400' };
      case 'actif':
        return { label: 'Actif', className: 'bg-emerald-50 text-emerald-700' };
      case 'alerte':
        return { label: 'Alerte', className: 'bg-amber-50 text-amber-700' };
      case 'critique':
        return { label: 'Critique', className: 'bg-red-50 text-red-700' };
      case 'perime':
        return { label: 'Périmé', className: 'bg-gray-100 text-gray-600' };
      case 'epuise':
        return { label: 'Épuisé', className: 'bg-gray-100 text-gray-500' };
      default:
        return { label: statut, className: 'bg-gray-100 text-gray-500' };
    }
  };

  const getJoursBadge = (jours) => {
    if (jours < 0) return { text: 'Périmé', className: 'text-red-600 font-semibold' };
    if (jours <= 30) return { text: `${jours} jours`, className: 'text-red-600 font-semibold' };
    if (jours <= 90) return { text: `${jours} jours`, className: 'text-amber-600 font-medium' };
    return { text: `${jours} jours`, className: 'text-emerald-600' };
  };

  const filteredLots = allLots.filter((lot) => {
    const statut = computeStatut(lot);
    const medName = `${lot.medicament?.dci || ''} ${lot.medicament?.nomCommercial || ''}`.toLowerCase();
    const matchesSearch = !search || medName.includes(search.toLowerCase()) || lot.numeroLot.toLowerCase().includes(search.toLowerCase());
    const matchesStatut = !statutFilter || statut === statutFilter;
    return matchesSearch && matchesStatut;
  });

  const totalPages = Math.ceil(filteredLots.length / limit) || 1;
  const paginatedLots = filteredLots.slice((page - 1) * limit, page * limit);

  const kpiTotalActifs = allLots.filter((l) => computeStatut(l) === 'actif').length;
  const kpiPerimes = allLots.filter((l) => computeStatut(l) === 'perime').length;
  const kpiCritique30 = allLots.filter((l) => {
    const j = getJoursRestants(l.datePeremption);
    return j >= 0 && j <= 30 && l.quantiteRestante > 0;
  }).length;
  const kpiAlerte90 = allLots.filter((l) => {
    const j = getJoursRestants(l.datePeremption);
    return j > 30 && j <= 90 && l.quantiteRestante > 0;
  }).length;

  const kpiCards = [
    {
      title: 'Lots actifs',
      value: kpiTotalActifs,
      icon: Package,
      color: 'blue',
      border: 'border-[color-mix(in_srgb,#3B82F6_30%,transparent)]',
      bg: 'bg-[color-mix(in_srgb,#3B82F6_12%,transparent)]',
      text: 'text-[#3B82F6]'
    },
    {
      title: 'Périmés',
      value: kpiPerimes,
      icon: AlertTriangle,
      color: 'red',
      border: 'border-[color-mix(in_srgb,#EF4444_30%,transparent)]',
      bg: 'bg-[color-mix(in_srgb,#EF4444_12%,transparent)]',
      text: 'text-[#EF4444]',
      clickable: true,
      onClick: () => { setStatutFilter('perime'); setPage(1); }
    },
    {
      title: 'Expire < 30j',
      value: kpiCritique30,
      icon: Clock,
      color: 'red',
      border: 'border-red-300',
      bg: 'bg-[color-mix(in_srgb,#EF4444_12%,transparent)]',
      text: 'text-[#EF4444]',
      clickable: true,
      onClick: () => { setStatutFilter('critique'); setPage(1); }
    },
    {
      title: 'Expire < 90j',
      value: kpiAlerte90,
      icon: Calendar,
      color: 'orange',
      border: 'border-[color-mix(in_srgb,#F59E0B_30%,transparent)]',
      bg: 'bg-[color-mix(in_srgb,#F59E0B_12%,transparent)]',
      text: 'text-[#F59E0B]',
      clickable: true,
      onClick: () => { setStatutFilter('alerte'); setPage(1); }
    }
  ];

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('fr-FR');
  };

  const openArchiveModal = (lot) => {
    setSelectedLot(lot);
    setModalType('archive');
    setShowModal(true);
  };

  const openEditModal = (lot) => {
    setSelectedLot(lot);
    setModalType('edit');
    setFormData({
      numeroLot: lot.numeroLot,
      datePeremption: lot.datePeremption ? lot.datePeremption.split('T')[0] : '',
      prixAchatLot: lot.prixAchatLot || ''
    });
    setShowModal(true);
  };

  const openDeleteModal = (lot) => {
    setSelectedLot(lot);
    setModalType('delete');
    setShowModal(true);
  };

  const openAdjustModal = (lot) => {
    setSelectedLot(lot);
    setModalType('adjust');
    setAdjustmentQty('');
    setAdjustmentNote('');
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedLot(null);
    setModalType('');
    setFormData({ numeroLot: '', datePeremption: '', prixAchatLot: '' });
    setAdjustmentQty('');
    setAdjustmentNote('');
  };

  const handleArchive = async () => {
    if (!selectedLot) return;
    try {
      await put(`/api/stock/lots/${selectedLot.id}/archiver`);
      toast.success(`Lot ${selectedLot.numeroLot} archivé avec succès`);
      closeModal();
      fetchLots();
    } catch (error) {
      console.error('Archive error:', error);
      toast.error('Erreur lors de l\'archivage');
    }
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    if (!selectedLot) return;
    try {
      await put(`/api/stock/lots/${selectedLot.id}`, formData);
      toast.success('Lot mis à jour avec succès');
      closeModal();
      fetchLots();
    } catch (error) {
      console.error('Edit error:', error);
      toast.error('Erreur lors de la modification');
    }
  };

  const handleDelete = async () => {
    if (!selectedLot) return;
    try {
      await del(`/api/stock/lots/${selectedLot.id}`);
      toast.success('Lot supprimé avec succès');
      closeModal();
      fetchLots();
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Erreur lors de la suppression');
    }
  };

  const handleAdjust = async (e) => {
    e.preventDefault();
    if (!selectedLot || !adjustmentQty) {
      toast.error('Veuillez entrer une quantité');
      return;
    }
    try {
      const currentQty = selectedLot.quantiteRestante;
      const newQty = currentQty + parseInt(adjustmentQty);
      if (newQty < 0) {
        toast.error('La quantité ne peut pas être négative');
        return;
      }
      await post('/api/stock/ajustement', {
        medicamentId: selectedLot.medicamentId,
        lotStockId: selectedLot.id,
        quantiteAjustee: newQty,
        note: adjustmentNote
      });
      toast.success('Ajustement enregistré avec succès');
      closeModal();
      fetchLots();
    } catch (error) {
      console.error('Adjust error:', error);
      toast.error('Erreur lors de l\'ajustement');
    }
  };

  const canArchive = (lot) => {
    return !lot.archive && lot.quantiteRestante === 0;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Gestion des lots</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setVoirArchives(v => !v); setPage(1); }}
            className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              voirArchives
                ? 'bg-gray-700 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Archive className="h-4 w-4 mr-2" />
            {voirArchives ? 'Masquer les archivés' : 'Voir les archivés'}
          </button>
          {(search || statutFilter) && (
            <button
              onClick={() => { setSearch(''); setStatutFilter(''); setPage(1); }}
              className="flex items-center px-4 py-2 rounded-lg text-sm font-medium bg-gray-50 text-gray-600 hover:bg-gray-100"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Réinitialiser
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <button
              key={idx}
              onClick={kpi.clickable ? kpi.onClick : undefined}
              disabled={!kpi.clickable}
              className={`bg-white rounded-xl shadow-sm p-5 border ${kpi.border} flex items-center justify-between transition-all ${
                kpi.clickable ? 'hover:shadow-md cursor-pointer' : 'cursor-default'
              }`}
            >
              <div>
                <p className="text-sm text-gray-500 mb-1">{kpi.title}</p>
                <p className="text-2xl font-bold text-gray-900">{kpi.value}</p>
              </div>
              <div className={`h-10 w-10 rounded-full flex items-center justify-center ${kpi.bg} ${kpi.text}`}>
                <Icon className="h-5 w-5" />
              </div>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-[var(--text-muted)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Rechercher par DCI, nom commercial ou n° lot..."
            className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 bg-white"
          />
        </div>
        <div className="relative sm:w-56">
          <SlidersHorizontal className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-[var(--text-muted)]" />
          <select
            value={statutFilter}
            onChange={(e) => { setStatutFilter(e.target.value); setPage(1); }}
            className="w-full pl-10 pr-4 py-3 border uiin usiolor-pri[va[var(--c-lor-pri[vay(--co]orbprbmary)]var-[var((isurfacr-y)ssrv)]face(rassrd)]face-rassrd)]face-raised)] appearance-none"
          >
            <option value="">Tous les statuts</option>
            <option value="actif">Actif</option>
            <option value="alerte">Alerte (&lt; 90j)</option>
            <option value="critique">Critique (&lt; 30j)</option>
            <option value="perime">Périmé</option>
            <option value="epuise">Épuisé</option>
          </select>
        </div>
      </div>

      {statutFilter && (
        <div className="bg-[color-mix(in_srgb,#F59E0B_12%,transparent)] border border-[color-mix(in_srgb,#F59E0B_30%,transparent)] rounded-lg p-3 flex items-center text-[#F59E0B] text-sm">
          <AlertTriangle className="h-4 w-4 mr-2" />
          Filtre actif : {getStatutBadge(statutFilter).label}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase">N° lot</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase">Médicament</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase">Date réception</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase">Date péremption</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-[var(--text-muted)] uppercase">Jours restants</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-[var(--text-muted)] uppercase">Qté initiale</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-[var(--text-muted)] uppercase">Qté restante</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase">Fournisseur</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-[var(--text-muted)] uppercase">Statut</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-[var(--text-muted)] uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {paginatedLots.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-gray-400">
                    Aucun lot trouvé
                  </td>
                </tr>
              ) : (
                paginatedLots.map((lot) => {
                  const statut = computeStatut(lot);
                  const badge = getStatutBadge(statut);
                  const jours = getJoursRestants(lot.datePeremption);
                  const joursBadge = getJoursBadge(jours);
                  const archiveable = canArchive(lot);

                  return (
                    <tr key={lot.id} className={`hover:bg-gray-50 ${lot.archive ? 'opacity-50' : ''}`}>
                      <td className="px-4 py-3 text-sm font-mono text-gray-900">{lot.numeroLot}</td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-gray-900">{lot.medicament?.dci || '-'}</p>
                        <p className="text-xs text-gray-400">{lot.medicament?.nomCommercial || ''}</p>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{formatDate(lot.dateReception)}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{formatDate(lot.datePeremption)}</td>
                      <td className="px-4 py-3 text-right text-sm whitespace-nowrap">
                        <span className={joursBadge.className}>{joursBadge.text}</span>
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-gray-600">{lot.quantiteInitiale}</td>
                      <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">{lot.quantiteRestante}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{lot.fournisseur?.nom || '-'}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.className}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end space-x-1">
                          <button
                            onClick={() => openEditModal(lot)}
                            className="p-1.5 text-[#3B82F6] hover:bg-[color-mix(in_srgb,#3B82F6_12%,transparent)] rounded-lg"
                            title="Modifier le lot"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => openAdjustModal(lot)}
                            className="p-1.5 text-[#10B981] hover:bg-[color-mix(in_srgb,#10B981_12%,transparent)] rounded-lg"
                            title="Ajuster la quantité"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                          {lot.quantiteRestante === 0 && (
                            <>
                              <button
                                onClick={() => openDeleteModal(lot)}
                                className="p-1.5 text-[#EF4444] hover:bg-[color-mix(in_srgb,#EF4444_12%,transparent)] rounded-lg"
                                title="Supprimer le lot"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                              {archiveable && (
                                <button
                                  onClick={() => openArchiveModal(lot)}
                                  className="inline-flex items-center px-2 py-1 text-xs font-medium text-white rounded-lg hover:opacity-90 bg-gray-600"
                                  title="Archiver le lot périmé"
                                >
                                  <Archive className="h-3 w-3.5 mr-1" />
                                  Archiver
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
            <p className="text-sm text-gray-400">
              {filteredLots.length} résultat{filteredLots.length > 1 ? 's' : ''}  Page {page} / {totalPages}
            </p>
            <div className="flex items-center space-x-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`px-3 py-1 rounded-lg text-sm font-medium ${
                    page === p ? 'text-white' : 'text-gray-600 hover:bg-gray-100'
                  }`}
                  style={page === p ? { backgroundColor: '#16A34A' } : {}}
                >
                  {p}
                </button>
              ))}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && selectedLot && createPortal(
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4" onClick={closeModal}>
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative bg-[var(--surface-raised)] rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto mt-10 mb-4" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-[var(--text-primary)]">
                  {modalType === 'edit' && 'Modifier le lot'}
                  {modalType === 'delete' && 'Supprimer le lot'}
                  {modalType === 'adjust' && 'Ajuster la quantité'}
                  {modalType === 'archive' && 'Archiver le lot'}
                </h2>
                <button
                  onClick={closeModal}
                  className="p-2 text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] rounded-lg"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="bg-[var(--surface-hover)] rounded-lg p-4 mb-4 space-y-2">
                <p className="text-sm text-[var(--text-muted)]">Lot n°</p>
                <p className="font-semibold text-[var(--text-primary)]">{selectedLot.numeroLot}</p>
                <p className="text-sm text-[var(--text-muted)]">Médicament</p>
                <p className="font-medium text-[var(--text-primary)]">
                  {selectedLot.medicament?.dci}  {selectedLot.medicament?.nomCommercial}
                </p>
                <p className="text-sm text-[var(--text-muted)]">Date de péremption</p>
                <p className="font-medium text-[#EF4444]">{formatDate(selectedLot.datePeremption)}</p>
                <p className="text-sm text-[var(--text-muted)]">Quantité restante</p>
                <p className="font-medium text-[var(--text-primary)]">{selectedLot.quantiteRestante}</p>
              </div>

              {modalType === 'edit' && (
                <form onSubmit={handleEdit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">N° lot</label>
                    <input
                      type="text"
                      value={formData.numeroLot}
                      onChange={(e) => setFormData({ ...formData, numeroLot: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--color-primary)]"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Date de péremption</label>
                    <input
                      type="date"
                      value={formData.datePeremption}
                      onChange={(e) => setFormData({ ...formData, datePeremption: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--color-primary)]"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Prix d'achat</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.prixAchatLot}
                      onChange={(e) => setFormData({ ...formData, prixAchatLot: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--color-primary)]"
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
                      {loading ? 'Enregistrement...' : 'Enregistrer'}
                    </button>
                  </div>
                </form>
              )}

              {modalType === 'delete' && (
                <>
                  <p className="text-sm text-[var(--text-secondary)] mb-6">
                    Êtes-vous sûr de vouloir supprimer ce lot ? Cette action est irréversible.
                  </p>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={closeModal}
                      className="flex-1 px-4 py-2 border rounded-lg text-[var(--text-secondary)] font-medium hover:bg-[var(--surface-hover)]"
                    >
                      Annuler
                    </button>
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={loading}
                      className="flex-1 px-4 py-2 rounded-lg text-white font-medium bg-red-600 hover:bg-red-700 disabled:opacity-50"
                    >
                      {loading ? 'Suppression...' : 'Supprimer'}
                    </button>
                  </div>
                </>
              )}

              {modalType === 'adjust' && (
                <form onSubmit={handleAdjust} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Ajustement (+/-)</label>
                    <input
                      type="number"
                      value={adjustmentQty}
                      onChange={(e) => setAdjustmentQty(e.target.value)}
                      placeholder="Ex: 10 pour ajouter, -5 pour retirer"
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--color-primary)]"
                      required
                    />
                    <p className="text-xs text-[var(--text-muted)] mt-1">
                      Stock actuel: {selectedLot.quantiteRestante} | Nouveau stock: {selectedLot.quantiteRestante + (parseInt(adjustmentQty) || 0)}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Note / Motif</label>
                    <textarea
                      value={adjustmentNote}
                      onChange={(e) => setAdjustmentNote(e.target.value)}
                      placeholder="Ex: Inventaire, casse, erreur..."
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
                      {loading ? 'Ajustement...' : 'Ajuster'}
                    </button>
                  </div>
                </form>
              )}

              {modalType === 'archive' && (
                <>
                  <p className="text-sm text-[var(--text-secondary)] mb-6">
                    Ce lot est périmé et sa quantité restante est nulle. L'archivage le retirera définitivement de la liste des lots actifs.
                  </p>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={closeModal}
                      className="flex-1 px-4 py-2 border rounded-lg text-[var(--text-secondary)] font-medium hover:bg-[var(--surface-hover)]"
                    >
                      Annuler
                    </button>
                    <button
                      type="button"
                      onClick={handleArchive}
                      disabled={loading}
                      className="flex-1 px-4 py-2 rounded-lg text-white font-medium bg-gray-700 hover:bg-gray-800 disabled:opacity-50"
                    >
                      {loading ? 'Archivage...' : 'Archiver'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default LotsMgmt;
