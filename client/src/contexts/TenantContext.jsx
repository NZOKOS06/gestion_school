import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axiosInstance from '../utils/axios';
import toast from 'react-hot-toast';
import Maintenance from '../pages/public/Maintenance';
import { applyThemeVars, derivePalette } from '../utils/themeEngine';

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

  const resolveSlug = () => {
    if (window.location.pathname.startsWith('/super-admin')) {
      return null;
    }

    if (import.meta.env.VITE_SUBDOMAIN_MODE === 'true') {
      const host = window.location.hostname;
      const parts = host.split('.');
      if (parts.length >= 3) return parts[0];
    }
    // Routes publiques : /e/:slug/... (actuel) et /p/:slug/... (legacy)
    const pathMatch = window.location.pathname.match(/^\/(?:e|p)\/([^/]+)/);
    if (pathMatch) {
      localStorage.setItem('tenantSlug', pathMatch[1]);
      return pathMatch[1];
    }
    const params = new URLSearchParams(window.location.search);
    if (params.get('tenant')) {
      localStorage.setItem('tenantSlug', params.get('tenant'));
      return params.get('tenant');
    }
    if (localStorage.getItem('tenantSlug')) {
      return localStorage.getItem('tenantSlug');
    }
    return import.meta.env.VITE_DEFAULT_TENANT ?? 'demo';
  };

  const slug = resolveSlug();

  const applyTenantTheme = useCallback((cfg) => {
    if (!cfg) return;
    const isDark = document.documentElement.classList.contains('dark');
    const vars = derivePalette({
      couleurPrimaire: cfg.couleurPrimaire,
      couleurSecondaire: cfg.couleurSecondaire,
      couleurTexte: cfg.couleurTexte,
      couleurAlerte: cfg.couleurAlerte,
      couleurErreur: cfg.couleurErreur,
      couleurSucces: cfg.couleurSucces,
      police: cfg.police,
      isDark,
    });
    // Prefer server-enriched cssVariables, then overlay derived (dark-aware) values
    if (cfg.cssVariables) {
      applyThemeVars(cfg.cssVariables);
    }
    applyThemeVars(vars);
  }, []);

  /** Live preview from Configuration color pickers without saving */
  const previewTheme = useCallback((partial) => {
    const merged = { ...(config || {}), ...partial };
    applyTenantTheme(merged);
  }, [config, applyTenantTheme]);

  const refreshConfig = useCallback(async () => {
    if (!slug) return null;
    const response = await axiosInstance.get(`/api/config/${slug}`);
    setTenant(response.data);
    setConfig(response.data);
    setModules(response.data.modules || {});
    applyTenantTheme(response.data);
    return response.data;
  }, [slug, applyTenantTheme]);

  useEffect(() => {
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
        applyTenantTheme(response.data);

        document.title = response.data.metaTitle || response.data.nomApp || 'GestSchool';

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
        if (!window.location.pathname.startsWith('/super-admin')) {
          toast.error(err.response?.data?.message || 'Établissement introuvable');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchConfig();
  }, [slug, applyTenantTheme]);

  // Re-derive brand soft surfaces when dark mode toggles
  useEffect(() => {
    const onThemeChange = () => {
      if (config) applyTenantTheme(config);
    };
    window.addEventListener('gestschool-theme-change', onThemeChange);
    return () => window.removeEventListener('gestschool-theme-change', onThemeChange);
  }, [config, applyTenantTheme]);

  const isModuleActive = (moduleName) => {
    const key = `module${moduleName.charAt(0).toUpperCase() + moduleName.slice(1)}`;
    return modules[moduleName] ?? modules[key] ?? false;
  };

  const getCurrency = () => config?.devise || 'FCFA';

  const formatPrice = (amount) => {
    const currency = getCurrency();
    const rounded = Math.round(Number(amount) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return `${rounded} ${currency}`;
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
    formatPrice,
    previewTheme,
    applyTenantTheme,
    refreshConfig,
    setConfig,
  };

  return (
    <TenantContext.Provider value={value}>
      {tenant?.modeMaintenance && !window.location.pathname.startsWith('/login') ? <Maintenance /> : children}
    </TenantContext.Provider>
  );
};

export default TenantContext;
