import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTenant } from '../../contexts/TenantContext';
import { useI18n } from '../../contexts/I18nContext';
import axiosInstance from '../../utils/axios';
import { Mail, ArrowLeft, Loader2, CheckCircle } from 'lucide-react';
import { ThemeToggle } from '../../components/ui/ThemeToggle';

const ForgotPassword = () => {
  const { config, slug } = useTenant();
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const nomApp = config?.nomApp || 'GestPharma';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      await axiosInstance.post('/api/auth/forgot-password', { email });
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.message || t('forgot_error') || 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  const inputBase = 'w-full rounded-lg text-sm transition-all';
  const inputIcon = 'absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none';

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
            <h1
              className="text-2xl font-semibold tracking-tight"
              style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-sans)' }}
            >
              {t('forgot_title') || 'Mot de passe oublié'}
            </h1>
            <p className="mt-2 text-base" style={{ color: 'var(--text-secondary)' }}>
              {t('forgot_subtitle') || `Entrez votre email pour recevoir un lien de réinitialisation ${nomApp}`}
            </p>
          </div>

          {error && (
            <div
              className="mb-6 rounded-lg border p-4 text-sm"
              style={{
                background: 'color-mix(in srgb, var(--color-danger) 10%, transparent)',
                borderColor: 'color-mix(in srgb, var(--color-danger) 20%, transparent)',
                color: 'var(--color-danger)',
              }}
            >
              {error}
            </div>
          )}

          {success && (
            <div
              className="mb-6 rounded-lg border p-4 text-sm flex items-start gap-3"
              style={{
                background: 'color-mix(in srgb, var(--color-success) 10%, transparent)',
                borderColor: 'color-mix(in srgb, var(--color-success) 20%, transparent)',
                color: 'var(--color-success)',
              }}
            >
              <CheckCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">{t('forgot_success_title') || 'Email envoyé'}</p>
                <p className="mt-1 opacity-90">
                  {t('forgot_success_message') || 'Si un compte existe avec cet email, vous recevrez un lien de réinitialisation.'}
                </p>
              </div>
            </div>
          )}

          {!success && (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                  {t('login_email') || 'Email'}
                </label>
                <div className="relative">
                  <Mail className={inputIcon} style={{ color: 'var(--text-muted)' }} />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={`${inputBase} pl-10 pr-3 h-11`}
                    style={{
                      background: 'var(--surface-overlay)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-primary)',
                    }}
                    placeholder="votre@email.com"
                    required
                    onFocus={(e) => {
                      e.target.style.borderColor = 'var(--color-primary)';
                      e.target.style.boxShadow = '0 0 0 3px color-mix(in srgb, var(--color-primary) 20%, transparent)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = 'var(--border-subtle)';
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-11 rounded-lg text-sm font-medium text-white transition-all flex items-center justify-center gap-2 hover:shadow-md active:scale-[0.98]"
                style={{ background: 'var(--color-primary)' }}
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                <span className={loading ? 'opacity-60' : ''}>{t('forgot_btn') || 'Envoyer le lien'}</span>
              </button>
            </form>
          )}

          <div className="mt-8 text-center">
            <Link
              to={slug ? `/login?tenant=${encodeURIComponent(slug)}` : '/login'}
              className="inline-flex items-center gap-2 font-medium transition-colors hover:text-[var(--color-primary)]"
              style={{ color: 'var(--color-primary)' }}
            >
              <ArrowLeft className="h-4 w-4" />
              {t('forgot_back_login') || 'Retour à la connexion'}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
