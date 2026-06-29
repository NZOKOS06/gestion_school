import { useTenant } from '../../contexts/TenantContext';
import { useI18n } from '../../contexts/I18nContext';
import PublicLayout from '../../components/layouts/PublicLayout';

const PrivacyPolicy = () => {
  const { config } = useTenant();
  const { t } = useI18n();
  const nomApp = config?.nomApp || 'GestPharma';

  return (
    <PublicLayout>
      <div className="max-w-3xl mx-auto px-4 py-16" style={{ color: 'var(--text-primary)' }}>
        <h1 className="text-3xl font-bold mb-8" style={{ color: 'var(--color-primary)' }}>
          {t('privacy_title') || 'Politique de confidentialité'}
        </h1>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">{t('privacy_intro_title') || 'Introduction'}</h2>
          <p className="leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {t('privacy_intro_text')?.replace('{app}', nomApp) ||
              `La présente politique de confidentialité décrit comment ${nomApp} collecte, utilise et protège vos données personnelles.`}
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">{t('privacy_data_title') || 'Données collectées'}</h2>
          <ul className="list-disc pl-6 space-y-2" style={{ color: 'var(--text-secondary)' }}>
            <li>{t('privacy_data_identity') || 'Identité (nom, prénom, email, téléphone)'}</li>
            <li>{t('privacy_data_health') || 'Données de santé strictement nécessaires à la gestion des ordonnances'}</li>
            <li>{t('privacy_data_usage') || 'Données de navigation et d\'utilisation du service'}</li>
            <li>{t('privacy_data_payment') || 'Données de paiement traitées par nos prestataires certifiés'}</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">{t('privacy_use_title') || 'Utilisation des données'}</h2>
          <p className="leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {t('privacy_use_text') ||
              'Vos données sont utilisées uniquement pour fournir, améliorer et sécuriser nos services. Elles ne sont jamais revendues à des tiers.'}
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">{t('privacy_rights_title') || 'Vos droits'}</h2>
          <p className="leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {t('privacy_rights_text') ||
              'Conformément au RGPD, vous disposez d\'un droit d\'accès, de rectification, d\'effacement, de limitation et de portabilité de vos données. Contactez votre pharmacie pour exercer ces droits.'}
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">{t('privacy_contact_title') || 'Contact'}</h2>
          <p className="leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {t('privacy_contact_text')?.replace('{app}', nomApp) ||
              `Pour toute question relative à vos données, contactez ${nomApp} via les coordonnées disponibles sur le site.`}
          </p>
        </section>

        <p className="text-sm mt-12 pt-8 border-t" style={{ color: 'var(--text-muted)', borderColor: 'var(--border-subtle)' }}>
          {t('privacy_last_update') || 'Dernière mise à jour :'} {new Date().toLocaleDateString()}
        </p>
      </div>
    </PublicLayout>
  );
};

export default PrivacyPolicy;
