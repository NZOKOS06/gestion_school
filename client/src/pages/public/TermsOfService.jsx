import { useTenant } from '../../contexts/TenantContext';
import { useI18n } from '../../contexts/I18nContext';
import PublicLayout from '../../components/layouts/PublicLayout';

const TermsOfService = () => {
  const { config } = useTenant();
  const { t } = useI18n();
  const nomApp = config?.nomApp || 'GestPharma';

  return (
    <PublicLayout>
      <div className="max-w-3xl mx-auto px-4 py-16" style={{ color: 'var(--text-primary)' }}>
        <h1 className="text-3xl font-bold mb-8" style={{ color: 'var(--color-primary)' }}>
          {t('terms_title') || 'Conditions d\'utilisation'}
        </h1>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">{t('terms_accept_title') || 'Acceptation'}</h2>
          <p className="leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {t('terms_accept_text')?.replace('{app}', nomApp) ||
              `En accédant et en utilisant ${nomApp}, vous acceptez les présentes conditions d\'utilisation. Si vous ne les acceptez pas, veuillez ne pas utiliser le service.`}
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">{t('terms_service_title') || 'Description du service'}</h2>
          <p className="leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {t('terms_service_text') ||
              `${nomApp} est une plateforme SaaS dédiée à la gestion de pharmacie et à la vente en ligne de produits de santé.`}
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">{t('terms_account_title') || 'Compte utilisateur'}</h2>
          <p className="leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {t('terms_account_text') ||
              'Vous êtes responsable de la confidentialité de vos identifiants. Toute activité effectuée depuis votre compte est réputée effectuée par vous.'}
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">{t('terms_responsibility_title') || 'Responsabilités'}</h2>
          <p className="leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {t('terms_responsibility_text') ||
              'Les informations fournies sur la plateforme ne remplacent pas l\'avis d\'un professionnel de santé. En cas de doute, consultez votre pharmacien ou médecin.'}
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">{t('terms_modification_title') || 'Modifications'}</h2>
          <p className="leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {t('terms_modification_text') ||
              'Nous nous réservons le droit de modifier ces conditions à tout moment. Les modifications prennent effet dès leur publication.'}
          </p>
        </section>

        <p className="text-sm mt-12 pt-8 border-t" style={{ color: 'var(--text-muted)', borderColor: 'var(--border-subtle)' }}>
          {t('terms_last_update') || 'Dernière mise à jour :'} {new Date().toLocaleDateString()}
        </p>
      </div>
    </PublicLayout>
  );
};

export default TermsOfService;
