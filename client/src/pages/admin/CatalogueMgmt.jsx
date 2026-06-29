import { useEffect, useState } from 'react';
import { useAxios } from '../../hooks/useAxios';
import { useTenant } from '../../contexts/TenantContext';
import { Search, Plus, Edit2, Trash2, AlertCircle, Pill } from 'lucide-react';
import { Modal } from '../../components/ui';
import toast from 'react-hot-toast';

const CatalogueMgmt = () => {
  const { formatPrice } = useTenant();
  const { get, post, put, delete: del, loading } = useAxios();
  
  const [medicaments, setMedicaments] = useState([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editingMed, setEditingMed] = useState(null);
  const [formData, setFormData] = useState({
    dci: '',
    nomCommercial: '',
    formeGalenique: '',
    dosage: '',
    prixAchat: '',
    prixVente: '',
    stockTotal: 0,
    seuilAlerte: 10,
    ordonnanceRequise: false
  });

  useEffect(() => {
    fetchMedicaments();
  }, [page, search]);

  const fetchMedicaments = async () => {
    try {
      const response = await get(`/api/medicaments?page=${page}&search=${search}`);
      setMedicaments(response.data);
      setTotalPages(response.pagination.totalPages);
    } catch (error) {
      console.error('Error fetching medicaments:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingMed) {
        await put(`/api/medicaments/${editingMed.id}`, formData);
        toast.success('Médicament mis à jour');
      } else {
        await post('/api/medicaments', formData);
        toast.success('Médicament créé');
      }
      setShowModal(false);
      setEditingMed(null);
      fetchMedicaments();
    } catch (error) {
      console.error('Error saving medicament:', error);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Êtes-vous sûr de vouloir désactiver ce médicament ?')) return;
    
    try {
      await del(`/api/medicaments/${id}`);
      toast.success('Médicament désactivé');
      fetchMedicaments();
    } catch (error) {
      toast.error('Erreur lors de la suppression');
    }
  };

  const openEditModal = (med) => {
    // Validation de l'ID UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(med.id)) {
      toast.error('ID de médicament invalide. Veuillez contacter l\'administrateur.');
      console.error('Invalid medicament ID:', med.id);
      return;
    }

    setEditingMed(med);
    setFormData({
      dci: med.dci,
      nomCommercial: med.nomCommercial,
      formeGalenique: med.formeGalenique,
      dosage: med.dosage || '',
      prixAchat: med.prixAchat,
      prixVente: med.prixVente,
      stockTotal: med.stockTotal,
      seuilAlerte: med.seuilAlerte,
      ordonnanceRequise: med.ordonnanceRequise
    });
    setShowModal(true);
  };

  const openCreateModal = () => {
    setEditingMed(null);
    setFormData({
      dci: '',
      nomCommercial: '',
      formeGalenique: '',
      dosage: '',
      prixAchat: '',
      prixVente: '',
      stockTotal: 0,
      seuilAlerte: 10,
      ordonnanceRequise: false
    });
    setShowModal(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Catalogue médicaments</h1>
        <button
          onClick={openCreateModal}
          className="flex items-center px-4 py-2 rounded-lg text-white font-medium"
          style={{ backgroundColor: 'var(--color-primary)' }}
        >
          <Plus className="h-5 w-5 mr-2" />
          Ajouter
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-[var(--text-muted)]" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher par DCI, nom commercial ou code barres..."
          className="w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-[var(--color-primary)]"
        />
      </div>

      {/* Table */}
      <div className="bg-[var(--surface-raised)] rounded-xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-[var(--surface-hover)]">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase">Médicament</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase">Forme</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-[var(--text-muted)] uppercase">Prix</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-[var(--text-muted)] uppercase">Stock</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-[var(--text-muted)] uppercase">Ordonnance</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-[var(--text-muted)] uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {medicaments.map((med) => (
              <tr key={med.id} className="hover:bg-[var(--surface-hover)]">
                <td className="px-6 py-4">
                  <div className="flex items-center">
                    <Pill className="h-5 w-5 text-[var(--text-muted)] mr-3" />
                    <div>
                      <p className="font-medium text-[var(--text-primary)]">{med.dci}</p>
                      <p className="text-sm text-[var(--text-muted)]">{med.nomCommercial}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-[var(--text-secondary)]">
                  {med.formeGalenique} {med.dosage && `- ${med.dosage}`}
                </td>
                <td className="px-6 py-4 text-right">
                  <p className="font-medium text-[var(--text-primary)]">{formatPrice(med.prixVente)}</p>
                  <p className="text-xs text-[var(--text-muted)]">Achat: {formatPrice(med.prixAchat)}</p>
                </td>
                <td className="px-6 py-4 text-right">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                    ${med.stockTotal <= med.seuilAlerte ? 'bg-[color-mix(in_srgb,#EF4444_12%,transparent)] text-red-800' : 'bg-[color-mix(in_srgb,#10B981_12%,transparent)] text-green-800'}`}>
                    {med.stockTotal}
                  </span>
                </td>
                <td className="px-6 py-4 text-center">
                  {med.ordonnanceRequise ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[color-mix(in_srgb,#3B82F6_12%,transparent)] text-blue-800">
                      Oui
                    </span>
                  ) : (
                    <span className="text-[var(--text-muted)]">-</span>
                  )}
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end space-x-2">
                    <button
                      onClick={() => openEditModal(med)}
                      className="p-2 text-[#3B82F6] hover:bg-[color-mix(in_srgb,#3B82F6_12%,transparent)] rounded-lg"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(med.id)}
                      className="p-2 text-[#EF4444] hover:bg-[color-mix(in_srgb,#EF4444_12%,transparent)] rounded-lg"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center space-x-2">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => setPage(p)}
              className={`px-3 py-1 rounded ${page === p ? 'bg-green-600 text-white' : 'bg-gray-200 text-[var(--text-secondary)]'}`}
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Modal */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={`${editingMed ? 'Modifier' : 'Ajouter'} un médicament`}
        size="md"
        footer={
          <>
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="px-4 py-2 text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] rounded-lg"
            >
              Annuler
            </button>
            <button
              type="submit"
              form="catalogue-form"
              className="px-4 py-2 text-white rounded-lg"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              {editingMed ? 'Mettre à jour' : 'Créer'}
            </button>
          </>
        }
      >
        <form id="catalogue-form" onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">DCI *</label>
                  <input
                    type="text"
                    value={formData.dci}
                    onChange={(e) => setFormData({ ...formData, dci: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--color-primary)]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Nom commercial *</label>
                  <input
                    type="text"
                    value={formData.nomCommercial}
                    onChange={(e) => setFormData({ ...formData, nomCommercial: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--color-primary)]"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Forme galénique *</label>
                    <select
                      value={formData.formeGalenique}
                      onChange={(e) => setFormData({ ...formData, formeGalenique: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--color-primary)]"
                      required
                    >
                      <option value="">Sélectionner</option>
                      <option value="comprime">Comprimé</option>
                      <option value="sirop">Sirop</option>
                      <option value="injectable">Injectable</option>
                      <option value="pommade">Pommade</option>
                      <option value="gelule">Gélule</option>
                      <option value="solution">Solution</option>
                      <option value="suspension">Suspension</option>
                      <option value="suppositoire">Suppositoire</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Dosage</label>
                    <input
                      type="text"
                      value={formData.dosage}
                      onChange={(e) => setFormData({ ...formData, dosage: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--color-primary)]"
                      placeholder="ex: 500mg"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Prix d'achat *</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.prixAchat}
                      onChange={(e) => setFormData({ ...formData, prixAchat: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--color-primary)]"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Prix de vente *</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.prixVente}
                      onChange={(e) => setFormData({ ...formData, prixVente: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--color-primary)]"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={formData.ordonnanceRequise}
                      onChange={(e) => setFormData({ ...formData, ordonnanceRequise: e.target.checked })}
                      className="rounded text-[#10B981] focus:ring-[var(--color-primary)]"
                    />
                    <span className="text-sm text-[var(--text-secondary)]">Ordonnance requise</span>
                  </label>
                </div>

              </form>
      </Modal>
    </div>
  );
};

export default CatalogueMgmt;
