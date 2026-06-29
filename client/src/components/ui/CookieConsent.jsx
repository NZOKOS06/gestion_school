import { useState, useEffect } from 'react';
import { useTenant } from '../../contexts/TenantContext';
import { useI18n } from '../../contexts/I18nContext';
import { Link } from 'react-router-dom';
import { X, Cookie } from 'lucide-react';

const STORAGE_KEY = 'gestpharma_cookie_consent';

export const CookieConsent = () => {
  const { config } = useTenant();
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [preferences, setPreferences] = useState({
    necessary: true,
    analytics: false,
    marketing: false,
  });

  useEffect(() => {
    if (config?.cookieBannerEnabled === false) {
      return;
    }
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) {
        setVisible(true);
      } else {
        setPreferences(JSON.parse(saved));
      }
    } catch {
      setVisible(true);
    }
  }, [config?.cookieBannerEnabled]);

  const saveConsent = (newPreferences) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newPreferences));
    } catch {
      // Ignore localStorage errors
    }
    setPreferences(newPreferences);
    setVisible(false);
  };

  const acceptAll = () => {
    saveConsent({
      necessary: true,
      analytics: config?.analyticsEnabled ?? false,
      marketing: false,
    });
  };

  const acceptNecessary = () => {
    saveConsent({
      necessary: true,
      analytics: false,
      marketing: false,
    });
  };

  const savePreferences = () => {
    saveConsent(preferences);
  };

  if (!visible) return null;

  const bannerText = config?.cookieBannerText ||
    t('cookie_banner_text') ||
    'Nous utilisons des cookies pour améliorer votre expérience. Certains sont nécessaires au fonctionnement du site.';

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 p-4 md:p-6"
      style={{
        background: 'var(--surface-raised)',
        borderTop: '1px solid var(--border-subtle)',
        boxShadow: 'var(--shadow-modal)',
      }}
    >
      <div className="max-w-6xl mx-auto">
        <div className="flex items-start gap-4">
          <div
            className="hidden sm:flex h-10 w-10 items-center justify-center rounded-full flex-shrink-0"
            style={{ background: 'color-mix(in srgb, var(--color-primary) 15%, transparent)' }}
          >
            <Cookie className="h-5 w-5" style={{ color: 'var(--color-primary)' }} />
          </div>
          <div className="flex-1">
            <p className="text-sm md:text-base mb-4" style={{ color: 'var(--text-secondary)' }}>
              {bannerText}{' '}
              <Link
                to="/politique-cookies"
                className="underline transition-colors hover:text-[var(--color-primary)]"
                style={{ color: 'var(--color-primary)' }}
              >
                {t('cookie_banner_more') || 'En savoir plus'}
              </Link>
            </p>

            {showDetails && (
              <div className="mb-4 p-4 rounded-lg" style={{ background: 'var(--surface-overlay)', border: '1px solid var(--border-subtle)' }}>
                <div className="space-y-3">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={true} disabled className="h-4 w-4 rounded" />
                    <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      {t('cookie_necessary') || 'Nécessaires'}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {t('cookie_necessary_desc') || 'Toujours actifs'}
                    </span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preferences.analytics}
                      onChange={(e) => setPreferences({ ...preferences, analytics: e.target.checked })}
                      className="h-4 w-4 rounded"
                      style={{ accentColor: 'var(--color-primary)' }}
                    />
                    <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      {t('cookie_analytics') || 'Analytiques'}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {t('cookie_analytics_desc') || 'Mesure d\'audience'}
                    </span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preferences.marketing}
                      onChange={(e) => setPreferences({ ...preferences, marketing: e.target.checked })}
                      className="h-4 w-4 rounded"
                      style={{ accentColor: 'var(--color-primary)' }}
                    />
                    <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      {t('cookie_marketing') || 'Marketing'}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {t('cookie_marketing_desc') || 'Personnalisation'}
                    </span>
                  </label>
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={acceptAll}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-all hover:shadow-md"
                style={{ background: 'var(--color-primary)' }}
              >
                {t('cookie_accept_all') || 'Tout accepter'}
              </button>
              <button
                onClick={acceptNecessary}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all hover:shadow-md"
                style={{ background: 'var(--surface-overlay)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
              >
                {t('cookie_accept_necessary') || 'Nécessaires uniquement'}
              </button>
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:text-[var(--color-primary)]"
                style={{ color: 'var(--color-primary)' }}
              >
                {showDetails ? (t('cookie_hide') || 'Masquer') : (t('cookie_customize') || 'Personnaliser')}
              </button>
              {showDetails && (
                <button
                  onClick={savePreferences}
                  className="px-4 py-2 rounded-lg text-sm font-medium transition-all hover:shadow-md"
                  style={{ background: 'var(--color-primary)', color: '#fff' }}
                >
                  {t('cookie_save') || 'Enregistrer'}
                </button>
              )}
            </div>
          </div>
          <button
            onClick={acceptNecessary}
            className="flex-shrink-0 p-1 rounded-full transition-colors hover:bg-[var(--surface-overlay)]"
            style={{ color: 'var(--text-muted)' }}
            aria-label={t('cookie_close') || 'Fermer'}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default CookieConsent;
