import { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../utils/axios';
import toast from 'react-hot-toast';
import { useTenant } from './TenantContext';

const AuthContext = createContext(null);
const SESSION_KEY = 'gestschool_has_session';

// Redirections post-login par rôle
const ROLE_REDIRECTIONS = {
  super_admin: '/super-admin/dashboard',
  directeur: '/admin/dashboard',
  secretaire: '/admin/dashboard',
  comptable: '/caissier',
  surveillant: '/admin/dashboard',
  enseignant: '/enseignant/dashboard',
  parent: '/parent/dashboard',
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const { slug, tenant } = useTenant();
  const navigate = useNavigate();

  // Priorité au tenant de l'utilisateur connecté
  const activeSlug = user?.tenant?.slug || user?.tenantSlug || slug || localStorage.getItem('tenantSlug') || null;

  useEffect(() => {
    // Intercepteur pour ajouter le tenant slug sur toutes les requêtes
    const requestInterceptor = axiosInstance.interceptors.request.use((config) => {
      const isSuperAdminRoute = window.location.pathname.startsWith('/super-admin');
      if (!config.headers['X-Tenant-Slug'] && activeSlug && activeSlug !== 'default' && !isSuperAdminRoute) {
        config.headers['X-Tenant-Slug'] = activeSlug;
      }
      return config;
    });

    // Intercepteur pour gérer le refresh token sur erreur 401
    const responseInterceptor = axiosInstance.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 &&
            error.response?.data?.code === 'TOKEN_EXPIRED' &&
            !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            await axiosInstance.post('/api/auth/refresh');
            return axiosInstance(originalRequest);
          } catch (refreshError) {
            setUser(null);
            localStorage.removeItem(SESSION_KEY);
            toast.error('Session expirée, veuillez vous reconnecter');
            return Promise.reject(refreshError);
          }
        }

        return Promise.reject(error);
      }
    );

    // Vérifier la session existante au montage
    checkAuth();

    return () => {
      axiosInstance.interceptors.request.eject(requestInterceptor);
      axiosInstance.interceptors.response.eject(responseInterceptor);
    };
  }, [activeSlug]);

  const checkAuth = async () => {
    if (localStorage.getItem(SESSION_KEY) !== 'true') {
      setLoading(false);
      return;
    }

    try {
      // Super admin utilise un endpoint différent
      const isSuperAdmin = window.location.pathname.startsWith('/super-admin');
      const endpoint = isSuperAdmin ? '/api/auth/me' : '/api/staff/profile/me';
      const response = await axiosInstance.get(endpoint);
      const userData = response.data;
      if (userData?.tenant?.slug) {
        localStorage.setItem('tenantSlug', userData.tenant.slug);
      }
      setUser(userData);
    } catch (err) {
      // Fallback : essayer l'endpoint parent
      try {
        const response = await axiosInstance.get('/api/auth/me');
        const userData = response.data;
        if (userData?.tenant?.slug) {
          localStorage.setItem('tenantSlug', userData.tenant.slug);
        }
        setUser(userData);
      } catch (err2) {
        localStorage.removeItem(SESSION_KEY);
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password, tenantSlug = null) => {
    try {
      const response = await axiosInstance.post('/api/auth/login', {
        email: email.trim().toLowerCase(),
        password
      }, {
        headers: tenantSlug ? { 'X-Tenant-Slug': tenantSlug } : {}
      });

      const userData = response.data.user || response.data.staff;

      if (userData?.tenant?.slug) {
        localStorage.setItem('tenantSlug', userData.tenant.slug);
      }

      if (userData?.mustChangePassword) {
        setUser(userData);
        localStorage.setItem(SESSION_KEY, 'true');
        navigate('/changer-mot-de-passe');
        return userData;
      }

      setUser(userData);
      localStorage.setItem(SESSION_KEY, 'true');
      toast.success('Connexion réussie');

      // Redirection post-login selon le rôle
      const redirect = ROLE_REDIRECTIONS[userData.role] || '/';
      navigate(redirect);

      return userData;
    } catch (error) {
      const message = error.response?.data?.error || error.response?.data?.message || 'Erreur de connexion';
      toast.error(message);
      throw error;
    }
  };

  const register = async (userData) => {
    try {
      const response = await axiosInstance.post('/api/auth/register', userData);
      const registeredUser = response.data.user;
      if (registeredUser?.tenant?.slug) {
        localStorage.setItem('tenantSlug', registeredUser.tenant.slug);
      }
      setUser(registeredUser);
      localStorage.setItem(SESSION_KEY, 'true');
      toast.success('Inscription réussie');

      const redirect = ROLE_REDIRECTIONS[registeredUser.role] || '/';
      navigate(redirect);

      return registeredUser;
    } catch (error) {
      const message = error.response?.data?.error || error.response?.data?.message || 'Erreur d\'inscription';
      toast.error(message);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await axiosInstance.post('/api/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      localStorage.removeItem(SESSION_KEY);
      toast.success('Déconnexion réussie');
    }
  };

  const changePassword = async (currentPassword, newPassword) => {
    try {
      await axiosInstance.post('/api/auth/change-password', {
        currentPassword,
        newPassword
      });
      setUser((prev) => prev ? { ...prev, mustChangePassword: false } : prev);
      toast.success('Mot de passe modifié');
    } catch (error) {
      const message = error.response?.data?.error || error.response?.data?.message || 'Erreur';
      toast.error(message);
      throw error;
    }
  };

  // Helpers de rôles — uniquement rôles scolaires
  const hasRole = (...roles) => user && roles.includes(user.role);
  const isSuperAdmin = () => user?.role === 'super_admin';
  const isDirecteur = () => user?.role === 'directeur';
  const isEnseignant = () => user?.role === 'enseignant';
  const isComptable = () => user?.role === 'comptable';
  const isSurveillant = () => user?.role === 'surveillant';
  const isSecretaire = () => user?.role === 'secretaire';
  const isStaff = () => ['directeur', 'secretaire', 'enseignant', 'surveillant', 'comptable', 'super_admin'].includes(user?.role);
  const isParent = () => user?.role === 'parent';

  const value = {
    user,
    setUser,
    loading,
    login,
    register,
    logout,
    changePassword,
    hasRole,
    isSuperAdmin,
    isDirecteur,
    isEnseignant,
    isComptable,
    isSurveillant,
    isSecretaire,
    isStaff,
    isParent,
    checkAuth,
    roleRedirections: ROLE_REDIRECTIONS,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
