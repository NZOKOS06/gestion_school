import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAxios } from '../../hooks/useAxios';
import { Modal } from '../../components/ui';
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  Phone,
  Mail,
  MapPin,
  User,
  Package,
  Calendar,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  AlertTriangle
} from 'lucide-react';
import toast from 'react-hot-toast';

const FournisseursMgmt = () => {
  const { get, post, put, delete: del, loading } = useAxios();
  const navigate = useNavigate();

  const [fournisseurs, setFournisseurs] = useState([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const [showFormModal, setShowFormModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editingFournisseur, setEditingFournisseur] = useState(null);
  const [deletingFournisseur, setDeletingFournisseur] = useState(null);
  const [formErrors, setFormErrors] = useState({});

  const [formData, setFormData] = useState({
    nom: '',
    telephone: '',
    email: '',
    adresse: '',
    contactPrincipal: '',
    note: ''
  });

  const limit = 20;

  useEffect(() => {
    fetchFournisseurs();
  }, [page, search]);

  const fetchFournisseurs = async () => {
    try {
      const response = await get(
        `/api/fournisseurs?search=${encodeURIComponent(search)}&page=${page}&limit=${limit}`
      );
      setFournisseurs(response.data || response.fournisseurs || []);
      setTotalPages(response.pagination?.totalPages || 1);
      setTotalItems(response.pagination?.total || response.data?.length || 0);
    } catch (error) {
      console.error('Error fetching fournisseurs:', error);
    }
  };

  const validateForm = () => {
    const errors = {};
    if (!formData.nom.trim()) {
      errors.nom = 'Le nom est requis';
    }
    if (formData.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email.trim())) {
        errors.email = 'Adresse email invalide';
      }
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      const payload = {
        nom: formData.nom.trim(),
        telephone: formData.telephone.trim(),
        email: formData.email.trim(),
        adresse: formData.adresse.trim(),
        contactPrincipal: formData.contactPrincipal.trim(),
        note: formData.note.trim()
      };

      if (editingFournisseur) {
        await put(`/api/fournisseurs/${editingFournisseur.id}`, payload);
        toast.success('Fournisseur mis à jour');
      } else {
        await post('/api/fournisseurs', payload);
        toast.success('Fournisseur créé');
      }

      closeFormModal();
      fetchFournisseurs();
    } catch (error) {
      console.error('Error saving fournisseur:', error);
    }
  };

  const openDeleteModal = (fournisseur) => {
    setDeletingFournisseur(fournisseur);
    setShowDeleteModal(true);
  };

  const closeDeleteModal = () => {
    setShowDeleteModal(false);
    setDeletingFournisseur(null);
  };

  const handleDelete = async () => {
    if (!deletingFournisseur) return;

    try {
      await del(`/api/fournisseurs/${deletingFournisseur.id}`, { silent: true });
      toast.success('Fournisseur supprimé');
      closeDeleteModal();
      fetchFournisseurs();
    } catch (error) {
      if (error.response?.status === 409) {
        toast.error('Impossible : des commandes sont liées à ce fournisseur');
      } else {
        toast.error('Erreur lors de la suppression');
      }
      closeDeleteModal();
    }
  };

  const openCreateModal = () => {
    setEditingFournisseur(null);
    setFormData({
      nom: '',
      telephone: '',
      email: '',
      adresse: '',
      contactPrincipal: '',
      note: ''
    });
    setFormErrors({});
    setShowFormModal(true);
  };

  const openEditModal = (fournisseur) => {
    setEditingFournisseur(fournisseur);
    setFormData({
      nom: fournisseur.nom || '',
      telephone: fournisseur.telephone || '',
      email: fournisseur.email || '',
      adresse: fournisseur.adresse || '',
      contactPrincipal: fournisseur.contact || fournisseur.contactPrincipal || '',
      note: fournisseur.note || ''
    });
    setFormErrors({});
    setShowFormModal(true);
  };

  const closeFormModal = () => {
    setShowFormModal(false);
    setEditingFournisseur(null);
    setFormErrors({});
  };

  const formatDate = (dateString) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('fr-FR');
  };

  const handleSearchChange = (e) => {
    setSearch(e.target.value);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Gestion des fournisseurs</h1>
        <button
          onClick={openCreateModal}
          className="flex items-center justify-center px-4 py-2 rounded-lg text-white font-medium"
          style={{ backgroundColor: 'var(--color-primary)' }}
        >
          <Plus className="h-5 w-5 mr-2" />
          Ajouter un fournisseur
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-[var(--text-muted)]" />
        <input
          type="text"
          value={search}
          onChange={handleSearchChange}
          placeholder="Rechercher un fournisseur..."
          className="w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-[var(--color-primary)] bg-[var(--surface-raised)]"
        />
      </div>

      {/* Cards Grid */}
      {fournisseurs.length === 0 ? (
        <div className="bg-[var(--surface-raised)] rounded-xl shadow-sm p-12 text-center text-[var(--text-muted)]">
          Aucun fournisseur trouvé
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {fournisseurs.map((f) => (
            <div
              key={f.id}
              className="bg-[var(--surface-raised)] rounded-xl shadow-sm p-5 flex flex-col hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-lg font-bold text-[var(--text-primary)] leading-tight">{f.nom}</h3>
                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => openEditModal(f)}
                    className="p-2 text-[#3B82F6] hover:bg-[color-mix(in_srgb,#3B82F6_12%,transparent)] rounded-lg"
                    title="Modifier"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => openDeleteModal(f)}
                    className="p-2 text-[#EF4444] hover:bg-[color-mix(in_srgb,#EF4444_12%,transparent)] rounded-lg"
                    title="Supprimer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-2 text-sm text-[var(--text-secondary)] flex-1">
                {f.telephone && (
                  <div className="flex items-center">
                    <Phone className="h-4 w-4 mr-2 text-[var(--text-muted)] flex-shrink-0" />
                    <span>{f.telephone}</span>
                  </div>
                )}
                {f.email && (
                  <div className="flex items-center">
                    <Mail className="h-4 w-4 mr-2 text-[var(--text-muted)] flex-shrink-0" />
                    <span className="truncate">{f.email}</span>
                  </div>
                )}
                {f.adresse && (
                  <div className="flex items-start">
                    <MapPin className="h-4 w-4 mr-2 text-[var(--text-muted)] flex-shrink-0 mt-0.5" />
                    <span>{f.adresse}</span>
                  </div>
                )}
                {f.contactPrincipal && (
                  <div className="flex items-center">
                    <User className="h-4 w-4 mr-2 text-[var(--text-muted)] flex-shrink-0" />
                    <span>{f.contactPrincipal}</span>
                  </div>
                )}
                <div className="flex items-center">
                  <Package className="h-4 w-4 mr-2 text-[var(--text-muted)] flex-shrink-0" />
                  <span>{f.nombreCommandes || 0} commande{(f.nombreCommandes || 0) > 1 ? 's' : ''}</span>
                </div>
                <div className="flex items-center">
                  <Calendar className="h-4 w-4 mr-2 text-[var(--text-muted)] flex-shrink-0" />
                  <span>Dernière : {formatDate(f.derniereCommande)}</span>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t">
                <button
                  onClick={() => navigate(`/admin/commandes-fournisseurs?fournisseurId=${f.id}`)}
                  className="flex items-center text-sm font-medium hover:underline"
                  style={{ color: 'var(--color-primary)' }}
                >
                  <ExternalLink className="h-4 w-4 mr-1.5" />
                  Voir les commandes
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between bg-[var(--surface-raised)] rounded-xl shadow-sm px-4 py-3">
          <p className="text-sm text-[var(--text-muted)]">
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
                  page === p ? 'text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'
                }`}
                style={page === p ? { backgroundColor: 'var(--color-primary)' } : {}}
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

      {/* Form Modal */}
      <Modal
        open={showFormModal}
        onClose={closeFormModal}
        title={editingFournisseur ? 'Modifier le fournisseur' : 'Ajouter un fournisseur'}
        size="md"
        footer={
          <>
            <button
              type="button"
              onClick={closeFormModal}
              className="px-4 py-2 text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] rounded-lg font-medium"
            >
              Annuler
            </button>
            <button
              type="submit"
              form="fournisseur-form"
              disabled={loading}
              className="px-4 py-2 text-white rounded-lg font-medium disabled:opacity-50"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              {loading ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </>
        }
      >
        <form id="fournisseur-form" onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                    Nom <span className="text-[#EF4444]">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.nom}
                    onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--color-primary)] ${
                      formErrors.nom ? 'border-red-300' : ''
                    }`}
                  />
                  {formErrors.nom && (
                    <p className="mt-1 text-sm text-[#EF4444]">{formErrors.nom}</p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Téléphone</label>
                    <input
                      type="text"
                      value={formData.telephone}
                      onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--color-primary)]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Email</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--color-primary)] ${
                        formErrors.email ? 'border-red-300' : ''
                      }`}
                    />
                    {formErrors.email && (
                      <p className="mt-1 text-sm text-[#EF4444]">{formErrors.email}</p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Adresse</label>
                  <input
                    type="text"
                    value={formData.adresse}
                    onChange={(e) => setFormData({ ...formData, adresse: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--color-primary)]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Contact principal</label>
                  <input
                    type="text"
                    value={formData.contactPrincipal}
                    onChange={(e) => setFormData({ ...formData, contactPrincipal: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--color-primary)]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Note</label>
                  <textarea
                    value={formData.note}
                    onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--color-primary)]"
                  />
                </div>

              </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        open={showDeleteModal && !!deletingFournisseur}
        onClose={closeDeleteModal}
        title={
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-[color-mix(in_srgb,#EF4444_12%,transparent)] flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-[#EF4444]" />
            </div>
            <span>Confirmer la suppression</span>
          </div>
        }
        size="md"
        footer={
          <>
            <button
              onClick={closeDeleteModal}
              className="px-4 py-2 text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] rounded-lg font-medium"
            >
              Annuler
            </button>
            <button
              onClick={handleDelete}
              disabled={loading}
              className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50"
            >
              {loading ? 'Suppression...' : 'Supprimer'}
            </button>
          </>
        }
      >
        <p className="text-[var(--text-secondary)]">
          Voulez-vous supprimer <span className="font-semibold text-[var(--text-primary)]">{deletingFournisseur?.nom}</span> ?
          <br />
          Cette action est irréversible.
        </p>
      </Modal>
    </div>
  );
};

export default FournisseursMgmt;

