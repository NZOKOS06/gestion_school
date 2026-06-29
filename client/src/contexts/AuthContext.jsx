import { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../utils/axios';
import toast from 'react-hot-toast';
import { useTenant } from './TenantContext';

const AuthContext = createContext(null);
const SESSION_KEY = 'gestpharma_has_session';

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

  // Priorité au tenant de l'utilisateur connecté (utile quand le login est cross-tenant)
  const activeSlug = user?.tenant?.slug || user?.tenantSlug || slug || localStorage.getItem('tenantSlug') || null;

  // axiosInstance est configuré dans src/utils/axios.js

  useEffect(() => {
    // Intercepteur pour ajouter le tenant (skip for superadmin routes and auth endpoints)
    const requestInterceptor = axiosInstance.interceptors.request.use((config) => {
      const isSuperAdminRoute = window.location.pathname.startsWith('/super-admin');
      if (!config.headers['X-Tenant-Slug'] && activeSlug && activeSlug !== 'default' && !isSuperAdminRoute) {
        config.headers['X-Tenant-Slug'] = activeSlug;
      }
      return config;
    });

    // Intercepteur pour gérer les erreurs 401
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
            toast.error('Session expirée, veuillez vous reconnecter');
            return Promise.reject(refreshError);
          }
        }

        return Promise.reject(error);
      }
    );

    // Vérifier la session existante
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
      const response = await axiosInstance.get('/api/staff/profile/me');
      const userData = response.data;
      if (userData?.tenant?.slug) {
        localStorage.setItem('tenantSlug', userData.tenant.slug);
      }
      setUser(userData);
    } catch (err) {
      localStorage.removeItem(SESSION_KEY);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password, role = 'staff', tenantSlug = null) => {
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
      setUser(null);
      localStorage.removeItem(SESSION_KEY);
      toast.success('Déconnexion réussie');
    } catch (error) {
      localStorage.removeItem(SESSION_KEY);
      console.error('Logout error:', error);
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

  const hasRole = (...roles) => {
    return user && roles.includes(user.role);
  };

  const isSuperAdmin = () => user?.role === 'super_admin';
  const isPharmacien = () => user?.role === 'pharmacien' || user?.role === 'admin';
  const isStaff = () => ['pharmacien', 'admin', 'vendeur', 'preparateur', 'caissier', 'livreur'].includes(user?.role);
  const isClient = () => user?.role === 'client';

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
    isPharmacien,
    isStaff,
    isClient,
    checkAuth
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
