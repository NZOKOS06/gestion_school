import { createContext, useContext, useState, useEffect } from 'react';
import axiosInstance from '../utils/axios';
import toast from 'react-hot-toast';
import Maintenance from '../pages/public/Maintenance';

const TenantContext = createContext(null);

export const useTenant = () => {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
};

export const TenantProvider = ({ children }) => {
  const [tenant, setTenant] = useState(null);
  const [config, setConfig] = useState(null);
  const [modules, setModules] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Résolution du slug
  const resolveSlug = () => {
    // Skip for superadmin routes - no tenant needed
    if (window.location.pathname.startsWith('/super-admin')) {
      return null;
    }
    
    // Sous-domaine en prod
    if (import.meta.env.VITE_SUBDOMAIN_MODE === 'true') {
      const host = window.location.hostname;
      const parts = host.split('.');
      if (parts.length >= 3) return parts[0];
    }
    // Paramètre URL /p/:slug
    const pathMatch = window.location.pathname.match(/^\/p\/([^/]+)/);
    if (pathMatch) {
      localStorage.setItem('tenantSlug', pathMatch[1]);
      return pathMatch[1];
    }
    // Query string ?tenant=xxx
    const params = new URLSearchParams(window.location.search);
    if (params.get('tenant')) {
      localStorage.setItem('tenantSlug', params.get('tenant'));
      return params.get('tenant');
    }
    // localStorage (persistance session dev)
    if (localStorage.getItem('tenantSlug')) {
      return localStorage.getItem('tenantSlug');
    }
    // Fallback dev : lire VITE_DEFAULT_TENANT ou "demo"
    return import.meta.env.VITE_DEFAULT_TENANT ?? 'demo';
  };

  const slug = resolveSlug();

  useEffect(() => {
    // Skip for superadmin routes (no slug)
    if (!slug) {
      setLoading(false);
      setTenant(null);
      setConfig(null);
      setModules({});
      return;
    }
    
    const fetchConfig = async () => {
      try {
        setLoading(true);
        const response = await axiosInstance.get(`/api/config/${slug}`);
        
        setTenant(response.data);
        setConfig(response.data);
        setModules(response.data.modules || {});
        
        // Appliquer les variables CSS
        if (response.data.cssVariables) {
          Object.entries(response.data.cssVariables).forEach(([key, value]) => {
            document.documentElement.style.setProperty(key, value);
          });
        }
        
        // Mettre à jour le titre
        document.title = response.data.metaTitle || response.data.nomApp || 'GestSchool';

        // Favicon dynamique
        const faviconUrl = response.data.faviconUrl || response.data.logoUrl;
        if (faviconUrl) {
          let favicon = document.querySelector('link[rel="icon"]');
          if (!favicon) {
            favicon = document.createElement('link');
            favicon.rel = 'icon';
            document.head.appendChild(favicon);
          }
          favicon.href = faviconUrl;
        }

        // Meta tags SEO
        const setMeta = (name, content) => {
          let meta = document.querySelector(`meta[name="${name}"]`);
          if (!meta) {
            meta = document.createElement('meta');
            meta.name = name;
            document.head.appendChild(meta);
          }
          meta.content = content || '';
        };
        setMeta('description', response.data.metaDescription);
        setMeta('keywords', response.data.metaKeywords);

        let ogImage = document.querySelector('meta[property="og:image"]');
        if (response.data.ogImageUrl) {
          if (!ogImage) {
            ogImage = document.createElement('meta');
            ogImage.setAttribute('property', 'og:image');
            document.head.appendChild(ogImage);
          }
          ogImage.content = response.data.ogImageUrl;
        }

      } catch (err) {
        console.error('Tenant config error:', err);
        setError(err.response?.data?.message || 'Erreur de chargement');
        // Only show error toast if not on superadmin route
        if (!window.location.pathname.startsWith('/super-admin')) {
          toast.error(err.response?.data?.message || 'Établissement introuvable');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchConfig();
  }, [slug]);

  const isModuleActive = (moduleName) => {
    const key = `module${moduleName.charAt(0).toUpperCase() + moduleName.slice(1)}`;
    return modules[moduleName] ?? modules[key] ?? false;
  };

  const getCurrency = () => {
    return config?.devise || 'FCFA';
  };

  const formatPrice = (amount) => {
    const currency = getCurrency();
    const formatted = new Intl.NumberFormat('fr-FR').format(amount);
    return `${formatted} ${currency}`;
  };

  const value = {
    tenant,
    config,
    modules,
    loading,
    error,
    slug,
    isModuleActive,
    getCurrency,
    formatPrice
  };

  return (
    <TenantContext.Provider value={value}>
      {tenant?.modeMaintenance && !window.location.pathname.startsWith('/login') ? <Maintenance /> : children}
    </TenantContext.Provider>
  );
};

export default TenantContext;
