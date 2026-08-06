import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { TenantProvider } from './contexts/TenantContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { I18nProvider } from './contexts/I18nContext';
import { DensityProvider } from './contexts/DensityContext';

// Layouts
import PublicLayout from './components/layouts/PublicLayout';
import AdminLayout from './components/layouts/AdminLayout';
import EnseignantLayout from './components/layouts/EnseignantLayout';
import ParentLayout from './components/layouts/ParentLayout';
import CaissierLayout from './components/layouts/CaissierLayout';

// Public pages (lazy)
const Home = lazy(() => import('./pages/public/Home'));
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
const Actualites = lazy(() => import('./pages/public/Actualites'));
const Maintenance = lazy(() => import('./pages/public/Maintenance'));

// Admin pages (lazy)
const Dashboard = lazy(() => import('./pages/admin/Dashboard'));
const Eleves = lazy(() => import('./pages/admin/Eleves'));
const Classes = lazy(() => import('./pages/admin/Classes'));
const Inscriptions = lazy(() => import('./pages/admin/Inscriptions'));
const Matieres = lazy(() => import('./pages/admin/Matieres'));
const EmploiDuTemps = lazy(() => import('./pages/admin/EmploiDuTemps'));
const Absences = lazy(() => import('./pages/admin/Absences'));
const Sanctions = lazy(() => import('./pages/admin/Sanctions'));
const Paiements = lazy(() => import('./pages/admin/Paiements'));
const Bulletins = lazy(() => import('./pages/admin/Bulletins'));
const Certificats = lazy(() => import('./pages/admin/Certificats'));
const PersonnelMgmt = lazy(() => import('./pages/admin/PersonnelMgmt'));
const Rapports = lazy(() => import('./pages/admin/Rapports'));
const Profil = lazy(() => import('./pages/admin/Profil'));
const Configuration = lazy(() => import('./pages/admin/Configuration'));
const CahierDeTextes = lazy(() => import('./pages/admin/CahierDeTextes'));
const ConseilDeClasse = lazy(() => import('./pages/admin/ConseilDeClasse'));
const Salles = lazy(() => import('./pages/admin/Salles'));
const CalendrierScolaire = lazy(() => import('./pages/admin/CalendrierScolaire'));
const Messagerie = lazy(() => import('./pages/admin/Messagerie'));
const AnneesScolaires = lazy(() => import('./pages/admin/AnneesScolaires'));
const Examens = lazy(() => import('./pages/admin/Examens'));

// Enseignant pages (lazy)
const EnseignantDashboard = lazy(() => import('./pages/enseignant/EnseignantDashboard'));
const MesClasses = lazy(() => import('./pages/enseignant/MesClasses'));
const SaisieNotes = lazy(() => import('./pages/enseignant/SaisieNotes'));
const Appel = lazy(() => import('./pages/enseignant/Appel'));
const MonEmploi = lazy(() => import('./pages/enseignant/MonEmploi'));

// Parent pages (lazy)
const ParentDashboard = lazy(() => import('./pages/parent/ParentDashboard'));
const MesEnfants = lazy(() => import('./pages/parent/MesEnfants'));
const BulletinsParent = lazy(() => import('./pages/parent/BulletinsParent'));
const AbsencesParent = lazy(() => import('./pages/parent/AbsencesParent'));
const SanctionsParent = lazy(() => import('./pages/parent/SanctionsParent'));
const FacturationParent = lazy(() => import('./pages/parent/FacturationParent'));

// Super Admin (lazy)
const SuperAdminPanel = lazy(() => import('./pages/superadmin/SuperAdminShell'));

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--surface-base)' }}>
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
  </div>
);

// Redirections post-login par rôle
const ROLE_REDIRECTIONS = {
  super_admin: '/super-admin/dashboard',
  directeur: '/admin/dashboard',
  directeur_etudes: '/admin/dashboard',
  secretaire: '/admin/dashboard',
  comptable: '/caissier',
  surveillant: '/admin/dashboard',
  enseignant: '/enseignant/dashboard',
  parent: '/parent/dashboard',
};

// Protected Route component
const ProtectedRoute = ({ allowedRoles }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div
        data-theme="admin"
        className="min-h-screen flex items-center justify-center"
        style={{ background: 'var(--surface-base)' }}
      >
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) {
    const slug = localStorage.getItem('tenantSlug') || 'demo';
    return <Navigate to={`/e/${slug}/login`} replace />;
  }

  if (user.mustChangePassword) {
    return <Navigate to="/changer-mot-de-passe" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    const redirect = ROLE_REDIRECTIONS[user.role] || '/';
    return <Navigate to={redirect} replace />;
  }

  return <Outlet />;
};

// App Routes
const AppRoutes = () => {
  const { user } = useAuth();

  const getDefaultRoute = () => {
    if (!user) return '/';
    return ROLE_REDIRECTIONS[user.role] || '/';
  };

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Routes publiques — accès via /e/:slug */}
        <Route element={<PublicLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/e/:slug" element={<Home />} />
          <Route path="/e/:slug/actualites" element={<Actualites />} />
          <Route path="/e/:slug/login" element={<Login />} />
          <Route path="/e/:slug/register" element={<Register />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/actualites" element={<Actualites />} />
          <Route path="/changer-mot-de-passe" element={<ChangePassword />} />
          <Route path="/mot-de-passe-oublie" element={<ForgotPassword />} />
          <Route path="/reinitialiser-mot-de-passe" element={<ResetPassword />} />
          <Route path="/verifier-email" element={<VerifyEmail />} />
          <Route path="/politique-confidentialite" element={<PrivacyPolicy />} />
          <Route path="/conditions-utilisation" element={<TermsOfService />} />
          <Route path="/politique-cookies" element={<CookiePolicy />} />
          <Route path="/maintenance" element={<Maintenance />} />
        </Route>

        {/* Routes communes admin — directeur, DE, secretaire, surveillant */}
        <Route element={<ProtectedRoute allowedRoles={['directeur', 'directeur_etudes', 'secretaire', 'surveillant']} />}>
          <Route element={<AdminLayout />}>
            <Route path="/admin/dashboard" element={<Dashboard />} />
            <Route path="/admin/eleves" element={<Eleves />} />
            <Route path="/admin/emploi-du-temps" element={<EmploiDuTemps />} />
            <Route path="/admin/absences" element={<Absences />} />
            <Route path="/admin/sanctions" element={<Sanctions />} />
            <Route path="/admin/profil" element={<Profil />} />
          </Route>
        </Route>

        {/* Secretaire + directeur + DE — vie scolaire élargie */}
        <Route element={<ProtectedRoute allowedRoles={['directeur', 'directeur_etudes', 'secretaire']} />}>
          <Route element={<AdminLayout />}>
            <Route path="/admin/classes" element={<Classes />} />
            <Route path="/admin/inscriptions" element={<Inscriptions />} />
            <Route path="/admin/matieres" element={<Matieres />} />
            <Route path="/admin/salles" element={<Salles />} />
            <Route path="/admin/calendrier" element={<CalendrierScolaire />} />
            <Route path="/admin/annees-scolaires" element={<AnneesScolaires />} />
            <Route path="/admin/examens" element={<Examens />} />
            <Route path="/admin/cahier-de-textes" element={<CahierDeTextes />} />
            <Route path="/admin/conseil-de-classe" element={<ConseilDeClasse />} />
            <Route path="/admin/certificats" element={<Certificats />} />
            <Route path="/admin/messagerie" element={<Messagerie />} />
          </Route>
        </Route>

        {/* Directeur + DE — pédagogie (bulletins) ; finances = directeur seul */}
        <Route element={<ProtectedRoute allowedRoles={['directeur', 'directeur_etudes']} />}>
          <Route element={<AdminLayout />}>
            <Route path="/admin/bulletins" element={<Bulletins />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute allowedRoles={['directeur']} />}>
          <Route element={<AdminLayout />}>
            <Route path="/admin/paiements" element={<Paiements />} />
            <Route path="/admin/rapports" element={<Rapports />} />
            <Route path="/admin/personnel" element={<PersonnelMgmt />} />
          </Route>
        </Route>

        {/* Routes comptable/caissier */}
        <Route element={<ProtectedRoute allowedRoles={['comptable', 'directeur']} />}>
          <Route element={<CaissierLayout />}>
            <Route path="/caissier" element={<Paiements />} />
            <Route path="/caissier/encaisser" element={<Paiements />} />
            <Route path="/caissier/retards" element={<Paiements />} />
            <Route path="/caissier/historique" element={<Paiements />} />
          </Route>
        </Route>

        {/* Routes enseignant */}
        <Route element={<ProtectedRoute allowedRoles={['enseignant']} />}>
          <Route element={<EnseignantLayout />}>
            <Route path="/enseignant/dashboard" element={<EnseignantDashboard />} />
            <Route path="/enseignant/mes-classes" element={<MesClasses />} />
            <Route path="/enseignant/saisie-notes" element={<SaisieNotes />} />
            <Route path="/enseignant/appel" element={<Appel />} />
            <Route path="/enseignant/mon-emploi" element={<MonEmploi />} />
            <Route path="/enseignant/cahier-de-textes" element={<CahierDeTextes />} />
            <Route path="/enseignant/messagerie" element={<Messagerie />} />
          </Route>
        </Route>

        {/* Routes parent */}
        <Route element={<ProtectedRoute allowedRoles={['parent']} />}>
          <Route element={<ParentLayout />}>
            <Route path="/parent/dashboard" element={<ParentDashboard />} />
            <Route path="/parent/mes-enfants" element={<MesEnfants />} />
            <Route path="/parent/bulletins" element={<BulletinsParent />} />
            <Route path="/parent/absences" element={<AbsencesParent />} />
            <Route path="/parent/sanctions" element={<SanctionsParent />} />
            <Route path="/parent/facturation" element={<FacturationParent />} />
            <Route path="/parent/messagerie" element={<Messagerie />} />
          </Route>
        </Route>

        {/* Configuration — directeur + super_admin */}
        <Route element={<ProtectedRoute allowedRoles={['directeur', 'super_admin']} />}>
          <Route element={<AdminLayout />}>
            <Route path="/admin/configuration" element={<Configuration />} />
          </Route>
        </Route>

        {/* Super Admin */}
        <Route element={<ProtectedRoute allowedRoles={['super_admin']} />}>
          <Route path="/super-admin/*" element={<SuperAdminPanel />} />
        </Route>

        {/* Redirection par défaut */}
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
        <DensityProvider>
          <TenantProvider>
            <AuthProvider>
              <AppRoutes />
            </AuthProvider>
          </TenantProvider>
        </DensityProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}

export default App;
