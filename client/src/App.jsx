import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { TenantProvider } from './contexts/TenantContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { I18nProvider } from './contexts/I18nContext';

// Layouts (statiques — toujours nécessaires au premier rendu)
import PublicLayout from './components/layouts/PublicLayout';
import AdminLayout from './components/layouts/AdminLayout';
import StaffLayout from './components/layouts/StaffLayout';
import CaissierLayout from './components/layouts/CaissierLayout';

// Public pages (lazy)
const Home = lazy(() => import('./pages/public/Home'));
const Catalogue = lazy(() => import('./pages/public/Catalogue'));
const CommandeEnLigne = lazy(() => import('./pages/public/CommandeEnLigne'));
const SuiviCommande = lazy(() => import('./pages/public/SuiviCommande'));
const Login = lazy(() => import('./pages/public/Login'));
const Register = lazy(() => import('./pages/public/Register'));
const ChangePassword = lazy(() => import('./pages/public/ChangePassword'));
const ForgotPassword = lazy(() => import('./pages/public/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/public/ResetPassword'));
const VerifyEmail = lazy(() => import('./pages/public/VerifyEmail'));
const PrivacyPolicy = lazy(() => import('./pages/public/PrivacyPolicy'));
const TermsOfService = lazy(() => import('./pages/public/TermsOfService'));
const CookiePolicy = lazy(() => import('./pages/public/CookiePolicy'));
const NotFound = lazy(() => import('./pages/public/NotFound'));

// Admin pages (lazy)
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const CatalogueMgmt = lazy(() => import('./pages/admin/CatalogueMgmt'));
const StockMgmt = lazy(() => import('./pages/admin/StockMgmt'));
const LotsMgmt = lazy(() => import('./pages/admin/LotsMgmt'));
const FournisseursMgmt = lazy(() => import('./pages/admin/FournisseursMgmt'));
const CommandesF = lazy(() => import('./pages/admin/CommandesF'));
const FacturesMgmt = lazy(() => import('./pages/admin/FacturesMgmt'));
const OrdonnancesMgmt = lazy(() => import('./pages/admin/OrdonnancesMgmt'));
const VentesMgmt = lazy(() => import('./pages/admin/VentesMgmt'));
const LivraisonsMgmt = lazy(() => import('./pages/admin/LivraisonsMgmt'));
const PersonnelMgmt = lazy(() => import('./pages/admin/PersonnelMgmt'));
const Rapports = lazy(() => import('./pages/admin/Rapports'));
const Profil = lazy(() => import('./pages/admin/Profil'));
const Configuration = lazy(() => import('./pages/admin/Configuration'));

// Staff pages (lazy)
const VendeurDashboard = lazy(() => import('./pages/staff/VendeurDashboard'));
const NouvelleVente = lazy(() => import('./pages/staff/NouvelleVente'));
const MesVentes = lazy(() => import('./pages/staff/MesVentes'));
const ScanOrdonnance = lazy(() => import('./pages/staff/ScanOrdonnance'));

// Caissier pages (lazy)
const CaisseHome = lazy(() => import('./pages/staff/CaisseHome'));
const EncaisserVente = lazy(() => import('./pages/staff/EncaisserVente'));

// Livreur pages (lazy)
const MesLivraisons = lazy(() => import('./pages/staff/MesLivraisons'));

// Client pages (lazy)
const ClientDashboard = lazy(() => import('./pages/client/ClientDashboard'));
const ClientHistorique = lazy(() => import('./pages/client/ClientHistorique'));
const ClientOrdonnances = lazy(() => import('./pages/client/ClientOrdonnances'));

// Super Admin (lazy)
const SuperAdminPanel = lazy(() => import('./pages/superadmin/SuperAdminPanel'));

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--surface-base)' }}>
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
  </div>
);

// Protected Route component
const ProtectedRoute = ({ allowedRoles }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  // Conserver le paramètre ?tenant=slug lors des redirections
  const tenantParam = new URLSearchParams(location.search).get('tenant');
  const tenantSuffix = tenantParam ? `?tenant=${tenantParam}` : '';

  const useAdminTheme = !user || user.role !== 'client';

  if (loading) {
    return (
      <div
        data-theme={useAdminTheme ? 'admin' : undefined}
        className="min-h-screen flex items-center justify-center"
        style={{ background: 'var(--surface-base)' }}
      >
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to={`/login${tenantSuffix}`} replace />;
  }

  if (user.mustChangePassword) {
    return <Navigate to={`/changer-mot-de-passe${tenantSuffix}`} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
};

// App Routes
const AppRoutes = () => {
  const { user } = useAuth();

  const getDefaultRoute = () => {
    if (!user) return '/';
    switch (user.role) {
      case 'super_admin': return '/super-admin';
      case 'pharmacien':
      case 'admin': return '/admin/dashboard';
      case 'vendeur':
      case 'preparateur': return '/staff/dashboard';
      case 'caissier': return '/caissier';
      case 'livreur': return '/staff/livraisons';
      case 'client': return '/profil';
      default: return '/';
    }
  };

  return (
    <Suspense fallback={<PageLoader />}>
    <Routes>
      {/* Public routes */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/catalogue" element={<Catalogue />} />
        <Route path="/commander" element={<CommandeEnLigne />} />
        <Route path="/suivi/:id" element={<SuiviCommande />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/changer-mot-de-passe" element={<ChangePassword />} />
        <Route path="/mot-de-passe-oublie" element={<ForgotPassword />} />
        <Route path="/reinitialiser-mot-de-passe" element={<ResetPassword />} />
        <Route path="/verifier-email" element={<VerifyEmail />} />
        <Route path="/politique-confidentialite" element={<PrivacyPolicy />} />
        <Route path="/conditions-utilisation" element={<TermsOfService />} />
        <Route path="/politique-cookies" element={<CookiePolicy />} />
      </Route>

      {/* Admin routes */}
      <Route element={<ProtectedRoute allowedRoles={['pharmacien', 'admin']} />}>
        <Route element={<AdminLayout />}>
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/admin/catalogue" element={<CatalogueMgmt />} />
          <Route path="/admin/stock" element={<StockMgmt />} />
          <Route path="/admin/lots" element={<LotsMgmt />} />
          <Route path="/admin/fournisseurs" element={<FournisseursMgmt />} />
          <Route path="/admin/commandes-fournisseurs" element={<CommandesF />} />
          <Route path="/admin/factures" element={<FacturesMgmt />} />
          <Route path="/admin/ordonnances" element={<OrdonnancesMgmt />} />
          <Route path="/admin/ventes" element={<VentesMgmt />} />
          <Route path="/admin/livraisons" element={<LivraisonsMgmt />} />
          <Route path="/admin/personnel" element={<PersonnelMgmt />} />
          <Route path="/admin/rapports" element={<Rapports />} />
          <Route path="/admin/profil" element={<Profil />} />
        </Route>
      </Route>

      {/* Configuration - Super Admin uniquement */}
      <Route element={<ProtectedRoute allowedRoles={['super_admin']} />}>
        <Route element={<AdminLayout />}>
          <Route path="/admin/configuration" element={<Configuration />} />
        </Route>
      </Route>

      {/* Staff routes */}
      <Route element={<ProtectedRoute allowedRoles={['vendeur', 'preparateur', 'pharmacien', 'admin']} />}>
        <Route element={<StaffLayout />}>
          <Route path="/staff/dashboard" element={<VendeurDashboard />} />
          <Route path="/staff/vente" element={<NouvelleVente />} />
          <Route path="/staff/mes-ventes" element={<MesVentes />} />
          <Route path="/staff/ordonnance" element={<ScanOrdonnance />} />
        </Route>
      </Route>

      {/* Caissier routes */}
      <Route element={<ProtectedRoute allowedRoles={['caissier', 'pharmacien', 'admin']} />}>
        <Route element={<CaissierLayout />}>
          <Route path="/caissier" element={<CaisseHome />} />
          <Route path="/caissier/encaisser/:id" element={<EncaisserVente />} />
          <Route path="/staff/caisse" element={<CaisseHome />} />
          <Route path="/staff/caisse/encaisser/:id" element={<EncaisserVente />} />
        </Route>
      </Route>

      {/* Livreur routes */}
      <Route element={<ProtectedRoute allowedRoles={['livreur']} />}>
        <Route path="/staff/livraisons" element={<MesLivraisons />} />
      </Route>

      {/* Client routes */}
      <Route element={<ProtectedRoute allowedRoles={['client']} />}>
        <Route element={<PublicLayout />}>
          <Route path="/profil" element={<ClientDashboard />} />
          <Route path="/profil/historique" element={<ClientHistorique />} />
          <Route path="/profil/ordonnances" element={<ClientOrdonnances />} />
        </Route>
      </Route>

      {/* Super Admin */}
      <Route element={<ProtectedRoute allowedRoles={['super_admin']} />}>
        <Route path="/super-admin" element={<SuperAdminPanel />} />
      </Route>

      {/* Default redirect */}
      <Route path="*" element={<NotFound />} />
    </Routes>
    </Suspense>
  );
};

// Main App
function App() {
  return (
    <ThemeProvider>
      <I18nProvider>
        <TenantProvider>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </TenantProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}

export default App;
