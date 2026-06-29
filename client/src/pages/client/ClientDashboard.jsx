import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import { useTenant } from '../../contexts/TenantContext';
import {
  User, ShoppingBag, FileText, Calendar, ChevronRight,
  Package, Clock, LogOut, TrendingUp
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════
// UTILITAIRES D'HUMANISATION
// ═══════════════════════════════════════════════════════════
function getInitials(nom, prenom) {
  return `${prenom?.[0] ?? ''}${nom?.[0] ?? ''}`.toUpperCase();
}

function memberSince(date) {
  const months = Math.floor((Date.now() - new Date(date)) / 2592000000);
  if (months < 1) return 'ce mois';
  if (months < 12) return `${months} mois`;
  return `${Math.floor(months / 12)} an${Math.floor(months / 12) > 1 ? 's' : ''}`;
}

// ═══════════════════════════════════════════════════════════
// COMPOSANTS
// ═══════════════════════════════════════════════════════════
const KpiCard = ({ icon: Icon, label, value, color }) => (
  <div className="bg-white dark:bg-[#161b22] rounded-2xl p-5 border border-[var(--border-subtle)] shadow-sm">
    <div className="flex items-center gap-4">
      <div
        className="h-12 w-12 rounded-xl flex items-center justify-center"
        style={{ background: `color-mix(in srgb, ${color} 15%, white)` }}
      >
        <Icon className="h-6 w-6" style={{ color }} />
      </div>
      <div>
        <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{value}</p>
        <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
      </div>
    </div>
  </div>
);

const QuickLink = ({ to, icon: Icon, label, description }) => (
  <Link
    to={to}
    className="flex items-center gap-4 p-4 bg-white dark:bg-[#161b22] rounded-xl border border-[var(--border-subtle)] hover:shadow-md transition-shadow group"
  >
    <div className="h-10 w-10 rounded-lg bg-[var(--surface-overlay)] flex items-center justify-center group-hover:bg-[var(--border-subtle)] transition-colors">
      <Icon className="h-5 w-5" style={{ color: 'var(--color-primary)' }} />
    </div>
    <div className="flex-1">
      <p className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{label}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400">{description}</p>
    </div>
    <ChevronRight className="h-4 w-4 text-gray-400 dark:text-gray-500" />
  </Link>
);

const ActivityItem = ({ vente, formatPrice }) => (
  <div className="flex items-center gap-4 py-3 border-b border-[var(--border-subtle)] last:border-0">
    <div className="h-10 w-10 rounded-full bg-[var(--surface-overlay)] flex items-center justify-center shrink-0">
      <ShoppingBag className="h-5 w-5" style={{ color: 'var(--color-primary)' }} />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
        Commande #{vente.numeroVente}
      </p>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        {vente.items?.length || 0} article(s) · {new Date(vente.createdAt).toLocaleDateString('fr-FR')}
      </p>
    </div>
    <span className="text-sm font-semibold shrink-0" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-primary)' }}>
      {formatPrice(Number(vente.totalTTC) || 0)}
    </span>
  </div>
);

// ═══════════════════════════════════════════════════════════
// COMPOSANT PRINCIPAL
// ═══════════════════════════════════════════════════════════
const ClientDashboard = () => {
  const { user, logout } = useAuth();
  const { formatPrice } = useTenant();
  const navigate = useNavigate();
  const headers = useMemo(() => ({ 'X-Tenant-Slug': user?.tenantSlug || 'default' }), [user?.tenantSlug]);

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalAchats: 0,
    nombreCommandes: 0,
    nombreOrdonnances: 0
  });
  const [recentVentes, setRecentVentes] = useState([]);

  useEffect(() => {
    if (!user) return;

    const fetchDashboardData = async () => {
      try {
        setLoading(true);

        // Récupérer les ventes récentes
        const ventesRes = await axios.get('/api/ventes', {
          headers,
          params: { client: 'moi', limit: 5 }
        });
        const ventes = ventesRes.data.ventes || [];
        setRecentVentes(ventes);

        // Calculer les stats
        const totalAchats = ventes.reduce((sum, v) => sum + (Number(v.totalTTC) || 0), 0);

        // Récupérer le nombre d'ordonnances
        const ordRes = await axios.get('/api/ordonnances', {
          headers,
          params: { client: 'moi', limit: 1 }
        });
        const totalOrdonnances = ordRes.data.total || ordRes.data.ordonnances?.length || 0;

        setStats({
          totalAchats,
          nombreCommandes: ventes.length,
          nombreOrdonnances: totalOrdonnances
        });
      } catch (err) {
        console.error('Erreur dashboard:', err);
        toast.error('Erreur de chargement des données');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [user, headers]);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  if (!user) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500 dark:text-gray-400">Veuillez vous connecter</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header Profil */}
      <div className="bg-white dark:bg-[#161b22] rounded-2xl p-6 md:p-8 border border-[var(--border-subtle)] shadow-sm mb-6">
        <div className="flex flex-col md:flex-row md:items-center gap-6">
          {/* Avatar */}
          <div
            className="h-20 w-20 rounded-full flex items-center justify-center text-2xl font-bold text-white shrink-0"
            style={{ background: 'var(--color-primary)' }}
          >
            {getInitials(user.nom, user.prenom)}
          </div>

          <div className="flex-1">
            <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
              {user.prenom} {user.nom}
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mb-2">{user.email}</p>
            <div className="flex items-center gap-2 text-sm text-gray-400 dark:text-gray-500">
              <Calendar className="h-4 w-4" />
              <span>Membre depuis {memberSince(user.createdAt)}</span>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Déconnexion
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <KpiCard
          icon={TrendingUp}
          label="Achats totaux"
          value={formatPrice(stats.totalAchats)}
          color="#16A34A"
        />
        <KpiCard
          icon={Package}
          label="Commandes"
          value={stats.nombreCommandes}
          color="#3B82F6"
        />
        <KpiCard
          icon={FileText}
          label="Ordonnances soumises"
          value={stats.nombreOrdonnances}
          color="#F59E0B"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Activité récente */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-[#161b22] rounded-2xl p-6 border border-[var(--border-subtle)] shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                Activité récente
              </h2>
              <Link
                to="/profil/historique"
                className="text-sm font-medium hover:underline"
                style={{ color: 'var(--color-primary)' }}
              >
                Voir tout
              </Link>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: 'var(--color-primary)' }} />
              </div>
            ) : recentVentes.length === 0 ? (
              <div className="text-center py-8">
                <ShoppingBag className="h-12 w-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
                <p className="text-sm text-gray-500 dark:text-gray-400">Aucun achat récent</p>
              </div>
            ) : (
              <div>
                {recentVentes.map((vente) => (
                  <ActivityItem key={vente.id} vente={vente} formatPrice={formatPrice} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Liens rapides */}
        <div>
          <div className="bg-white dark:bg-[#161b22] rounded-2xl p-6 border border-[var(--border-subtle)] shadow-sm">
            <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
              Accès rapide
            </h2>
            <div className="space-y-3">
              <QuickLink
                to="/profil/historique"
                icon={ShoppingBag}
                label="Historique d'achats"
                description="Consultez toutes vos commandes"
              />
              <QuickLink
                to="/profil/ordonnances"
                icon={FileText}
                label="Mes ordonnances"
                description="Suivi de vos ordonnances"
              />
              <QuickLink
                to="/catalogue"
                icon={Package}
                label="Catalogue"
                description="Parcourir les médicaments"
              />
              <QuickLink
                to="/commander"
                icon={Clock}
                label="Commander"
                description="Nouvelle commande"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClientDashboard;
