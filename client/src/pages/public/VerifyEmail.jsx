import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useTenant } from '../../contexts/TenantContext';
import { useI18n } from '../../contexts/I18nContext';
import axiosInstance from '../../utils/axios';
import { Mail, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { ThemeToggle } from '../../components/ui/ThemeToggle';

const VerifyEmail = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { config, slug } = useTenant();
  const { t } = useI18n();

  const token = searchParams.get('token');
  const nomApp = config?.nomApp || 'GestPharma';

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('pending'); // pending | success | error
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage(t('verify_invalid_token') || 'Lien de vérification invalide ou expiré.');
      setLoading(false);
      return;
    }

    const verify = async () => {
      try {
        await axiosInstance.post('/api/auth/verify-email', { token });
        setStatus('success');
        setTimeout(() => {
          navigate(slug ? `/login?tenant=${encodeURIComponent(slug)}` : '/login');
        }, 3000);
      } catch (err) {
        setStatus('error');
        setMessage(err.response?.data?.error || err.response?.data?.message || t('verify_error') || 'Une erreur est survenue');
      } finally {
        setLoading(false);
      }
    };

    verify();
  }, [token, navigate, t]);

  return (
    <div
      className="min-h-screen flex items-center justify-center relative"
      style={{
        background: config?.backgroundImageUrl
          ? `url(${config.backgroundImageUrl}) center/cover no-repeat fixed`
          : 'var(--surface-base)'
      }}
    >
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm px-4">
        <div
          className="rounded-2xl p-10"
          style={{
            background: 'var(--surface-raised)',
            border: '1px solid var(--border-subtle)',
            boxShadow: 'var(--shadow-modal)',
          }}
        >
          <div className="text-center mb-8">
            <div
              className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full"
              style={{
                background: status === 'success'
                  ? 'color-mix(in srgb, var(--color-success) 15%, transparent)'
                  : status === 'error'
                    ? 'color-mix(in srgb, var(--color-danger) 15%, transparent)'
                    : 'color-mix(in srgb, var(--color-primary) 15%, transparent)'
              }}
            >
              {status === 'success' ? (
                <CheckCircle className="h-7 w-7" style={{ color: 'var(--color-success)' }} />
              ) : status === 'error' ? (
                <XCircle className="h-7 w-7" style={{ color: 'var(--color-danger)' }} />
              ) : (
                <Mail className="h-7 w-7" style={{ color: 'var(--color-primary)' }} />
              )}
            </div>
            <h1
              className="text-2xl font-semibold tracking-tight"
              style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-sans)' }}
            >
              {t('verify_title') || 'Vérification d\'email'}
            </h1>
            <p className="mt-2 text-base" style={{ color: 'var(--text-secondary)' }}>
              {t('verify_subtitle')?.replace('{app}', nomApp) || `Vérification de votre adresse email pour ${nomApp}`}
            </p>
          </div>

          {loading && (
            <div className="flex items-center justify-center gap-3 py-6">
              <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--color-primary)' }} />
              <span style={{ color: 'var(--text-secondary)' }}>{t('verify_loading') || 'Vérification en cours...'}</span>
            </div>
          )}

          {!loading && (
            <div
              className="rounded-lg border p-4 text-sm"
              style={{
                background: status === 'success'
                  ? 'color-mix(in srgb, var(--color-success) 10%, transparent)'
                  : 'color-mix(in srgb, var(--color-danger) 10%, transparent)',
                borderColor: status === 'success'
                  ? 'color-mix(in srgb, var(--color-success) 20%, transparent)'
                  : 'color-mix(in srgb, var(--color-danger) 20%, transparent)',
                color: status === 'success' ? 'var(--color-success)' : 'var(--color-danger)',
              }}
            >
              <p className="font-medium">
                {status === 'success'
                  ? t('verify_success_title') || 'Email vérifié'
                  : t('verify_error_title') || 'Erreur de vérification'}
              </p>
              <p className="mt-1 opacity-90">
                {status === 'success'
                  ? t('verify_success_message') || 'Votre email a été confirmé avec succès. Redirection...'
                  : message}
              </p>
            </div>
          )}

          <div className="mt-8 text-center">
            <Link
              to={slug ? `/login?tenant=${encodeURIComponent(slug)}` : '/login'}
              className="inline-flex items-center gap-2 font-medium transition-colors hover:text-[var(--color-primary)]"
              style={{ color: 'var(--color-primary)' }}
            >
              {t('verify_back_login') || 'Retour à la connexion'}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VerifyEmail;
