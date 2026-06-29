import { useTenant } from '../../contexts/TenantContext';
import { useI18n } from '../../contexts/I18nContext';
import PublicLayout from '../../components/layouts/PublicLayout';

const CookiePolicy = () => {
  const { config } = useTenant();
  const { t } = useI18n();
  const nomApp = config?.nomApp || 'GestPharma';

  return (
    <PublicLayout>
      <div className="max-w-3xl mx-auto px-4 py-16" style={{ color: 'var(--text-primary)' }}>
        <h1 className="text-3xl font-bold mb-8" style={{ color: 'var(--color-primary)' }}>
          {t('cookies_title') || 'Politique de cookies'}
        </h1>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">{t('cookies_what_title') || 'Que sont les cookies ?'}</h2>
          <p className="leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {t('cookies_what_text') ||
              'Les cookies sont de petits fichiers texte stockés sur votre appareil lors de votre visite d\'un site web. Ils permettent d\'améliorer votre expérience et d\'assurer le bon fonctionnement des services.'}
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">{t('cookies_types_title') || 'Types de cookies utilisés'}</h2>
          <ul className="list-disc pl-6 space-y-2" style={{ color: 'var(--text-secondary)' }}>
            <li>
              <strong>{t('cookies_necessary') || 'Cookies nécessaires'}</strong> : {t('cookies_necessary_text') || 'indispensables au fonctionnement du site (authentification, sécurité, panier).'}
            </li>
            <li>
              <strong>{t('cookies_analytics') || 'Cookies analytiques'}</strong> : {t('cookies_analytics_text') || 'nous aident à comprendre comment le site est utilisé, avec votre consentement.'}
            </li>
            <li>
              <strong>{t('cookies_marketing') || 'Cookies marketing'}</strong> : {t('cookies_marketing_text') || 'utilisés pour personnaliser les communications, uniquement avec votre consentement.'}
            </li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">{t('cookies_manage_title') || 'Gestion des cookies'}</h2>
          <p className="leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {t('cookies_manage_text') ||
              'Vous pouvez modifier vos préférences à tout moment via la bannière de cookies ou les paramètres de votre navigateur.'}
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">{t('cookies_contact_title') || 'Contact'}</h2>
          <p className="leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {t('cookies_contact_text')?.replace('{app}', nomApp) ||
              `Pour toute question sur notre politique de cookies, contactez ${nomApp}.`}
          </p>
        </section>

        <p className="text-sm mt-12 pt-8 border-t" style={{ color: 'var(--text-muted)', borderColor: 'var(--border-subtle)' }}>
          {t('cookies_last_update') || 'Dernière mise à jour :'} {new Date().toLocaleDateString()}
        </p>
      </div>
    </PublicLayout>
  );
};

export default CookiePolicy;
