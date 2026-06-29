import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import {
  ArrowLeft, FileText, Plus, X, Image as ImageIcon, User,
  Calendar, AlertCircle, CheckCircle2, Clock
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════
// UTILITAIRES
// ═══════════════════════════════════════════════════════════
const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
};

const getStatutConfig = (statut) => {
  const configs = {
    soumise: {
      icon: Clock,
      bg: '#FEF3C7',
      text: '#92400E',
      label: 'En attente'
    },
    validee: {
      icon: CheckCircle2,
      bg: '#DCFCE7',
      text: '#166534',
      label: 'Validée'
    },
    refusee: {
      icon: AlertCircle,
      bg: '#FEE2E2',
      text: '#991B1B',
      label: 'Refusée'
    },
    traitee: {
      icon: CheckCircle2,
      bg: '#DBEAFE',
      text: '#1E40AF',
      label: 'Traitée'
    },
    default: {
      icon: Clock,
      bg: '#F3F4F6',
      text: '#374151',
      label: statut || 'Inconnu'
    }
  };
  return configs[statut] || configs.default;
};

// ═══════════════════════════════════════════════════════════
// LIGHTBOX
// ═══════════════════════════════════════════════════════════
const Lightbox = ({ imageUrl, onClose, medecin }) => {
  if (!imageUrl) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 text-white hover:bg-white/10 rounded-lg"
      >
        <X className="h-6 w-6" />
      </button>
      <div className="max-w-4xl max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        <img
          src={imageUrl}
          alt={`Ordonnance de ${medecin}`}
          className="max-w-full max-h-[85vh] rounded-lg shadow-xl"
        />
        <p className="text-center text-white mt-3 text-sm">
          Ordonnance de Dr. {medecin}
        </p>
      </div>
    </div>,
    document.body
  );
};

// ═══════════════════════════════════════════════════════════
// CARD ORDONNANCE
// ═══════════════════════════════════════════════════════════
const OrdonnanceCard = ({ ordonnance, onImageClick }) => {
  const statutConfig = getStatutConfig(ordonnance.statut);
  const StatutIcon = statutConfig.icon;

  return (
    <div className="bg-white dark:bg-[#161b22] rounded-2xl p-5 border border-[var(--border-subtle)] shadow-sm hover:shadow-md transition-shadow">
      <div className="flex gap-4">
        {/* Miniature photo */}
        {ordonnance.imageUrl ? (
          <button
            onClick={() => onImageClick(ordonnance)}
            className="shrink-0 h-20 w-20 rounded-xl overflow-hidden bg-[var(--surface-overlay)] hover:opacity-80 transition-opacity"
          >
            <img
              src={ordonnance.imageUrl}
              alt="Ordonnance"
              className="h-full w-full object-cover"
            />
          </button>
        ) : (
          <div className="shrink-0 h-20 w-20 rounded-xl bg-[var(--surface-overlay)] flex items-center justify-center">
            <ImageIcon className="h-8 w-8 text-gray-300 dark:text-gray-600" />
          </div>
        )}

        <div className="flex-1 min-w-0">
          {/* Médecin & Date */}
          <div className="flex items-center gap-2 mb-2">
            <User className="h-4 w-4 text-gray-400" />
            <span className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
              Dr. {ordonnance.medecin || 'Non spécifié'}
            </span>
          </div>

          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-3">
            <Calendar className="h-4 w-4" />
            <span>{formatDate(ordonnance.dateOrdonnance || ordonnance.createdAt)}</span>
          </div>

          {/* Badge statut */}
          <div
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
            style={{ background: statutConfig.bg, color: statutConfig.text }}
          >
            <StatutIcon className="h-3.5 w-3.5" />
            {statutConfig.label}
          </div>
        </div>
      </div>

      {/* Note du pharmacien si refusée */}
      {ordonnance.statut === 'refusee' && ordonnance.note && (
        <div className="mt-4 p-3 bg-red-50 rounded-xl border border-red-100">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-medium text-red-700 mb-1">Note du pharmacien</p>
              <p className="text-sm text-red-600">{ordonnance.note}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// ÉTAT VIDE
// ═══════════════════════════════════════════════════════════
const EmptyState = ({ onAction }) => (
  <div className="text-center py-16">
    <div className="h-20 w-20 rounded-full bg-[#F8F7F5] flex items-center justify-center mx-auto mb-4">
      <FileText className="h-10 w-10 text-gray-300 dark:text-gray-600" />
    </div>
    <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
      Aucune ordonnance soumise
    </h3>
    <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 max-w-xs mx-auto">
      Envoyez votre première ordonnance pour commander vos médicaments en ligne
    </p>
    <button
      onClick={onAction}
      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white"
      style={{ background: 'var(--color-primary)' }}
    >
      <Plus className="h-4 w-4" />
      Nouvelle ordonnance
    </button>
  </div>
);

// ═══════════════════════════════════════════════════════════
// COMPOSANT PRINCIPAL
// ═══════════════════════════════════════════════════════════
const ClientOrdonnances = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const headers = useMemo(() => ({ 'X-Tenant-Slug': user?.tenantSlug || 'default' }), [user?.tenantSlug]);

  const [loading, setLoading] = useState(true);
  const [ordonnances, setOrdonnances] = useState([]);
  const [selectedImage, setSelectedImage] = useState(null);

  useEffect(() => {
    if (!user) return;

    const fetchOrdonnances = async () => {
      try {
        setLoading(true);
        const res = await axios.get('/api/ordonnances', {
          headers,
          params: { client: 'moi' }
        });
        setOrdonnances(res.data.ordonnances || []);
      } catch (err) {
        console.error('Erreur ordonnances:', err);
        toast.error('Erreur de chargement des ordonnances');
      } finally {
        setLoading(false);
      }
    };

    fetchOrdonnances();
  }, [user, headers]);

  const handleNouvelleOrdonnance = () => {
    // Redirection vers la page de commande avec onglet ordonnance
    navigate('/commander');
  };

  const handleImageClick = (ordonnance) => {
    if (ordonnance.imageUrl) {
      setSelectedImage(ordonnance);
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <Link
            to="/profil"
            className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour
          </Link>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Mes ordonnances
          </h1>
        </div>

        <button
          onClick={handleNouvelleOrdonnance}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white"
          style={{ background: 'var(--color-primary)' }}
        >
          <Plus className="h-4 w-4" />
          Nouvelle ordonnance
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: 'var(--color-primary)' }} />
        </div>
      ) : ordonnances.length === 0 ? (
        <div className="bg-white dark:bg-[#161b22] rounded-2xl border border-[var(--border-subtle)] shadow-sm">
          <EmptyState onAction={handleNouvelleOrdonnance} />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {ordonnances.map((ordonnance) => (
            <OrdonnanceCard
              key={ordonnance.id}
              ordonnance={ordonnance}
              onImageClick={handleImageClick}
            />
          ))}
        </div>
      )}

      {/* Lightbox */}
      {selectedImage && (
        <Lightbox
          imageUrl={selectedImage.imageUrl}
          medecin={selectedImage.medecin || 'Non spécifié'}
          onClose={() => setSelectedImage(null)}
        />
      )}
    </div>
  );
};

export default ClientOrdonnances;
