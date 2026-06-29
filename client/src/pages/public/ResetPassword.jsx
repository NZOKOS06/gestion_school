import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useTenant } from '../../contexts/TenantContext';
import { useI18n } from '../../contexts/I18nContext';
import axiosInstance from '../../utils/axios';
import { Lock, Eye, EyeOff, Loader2, CheckCircle, ArrowLeft } from 'lucide-react';
import { ThemeToggle } from '../../components/ui/ThemeToggle';

const ResetPassword = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { config, slug } = useTenant();
  const { t } = useI18n();

  const token = searchParams.get('token');

  const [formData, setFormData] = useState({ password: '', confirmPassword: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const nomApp = config?.nomApp || 'GestPharma';

  useEffect(() => {
    if (!token) {
      setError(t('reset_invalid_token') || 'Lien de réinitialisation invalide ou expiré.');
    }
  }, [token, t]);

  const validatePassword = (password) => {
    return /^(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{8,}$/.test(password);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (!token) {
      setError(t('reset_invalid_token') || 'Lien de réinitialisation invalide ou expiré.');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError(t('reset_password_mismatch') || 'Les mots de passe ne correspondent pas.');
      return;
    }

    if (!validatePassword(formData.password)) {
      setError(
        t('reset_password_weak') ||
          'Le mot de passe doit contenir au moins 8 caractères, une majuscule, un chiffre et un caractère spécial.'
      );
      return;
    }

    setLoading(true);
    try {
      await axiosInstance.post('/api/auth/reset-password', {
        token,
        newPassword: formData.password
      });
      setSuccess(true);
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.message || t('reset_error') || 'Une erreur est survenue');
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
              {t('reset_title') || 'Nouveau mot de passe'}
            </h1>
            <p className="mt-2 text-base" style={{ color: 'var(--text-secondary)' }}>
              {t('reset_subtitle') || `Choisissez un nouveau mot de passe pour ${nomApp}`}
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
                <p className="font-medium">{t('reset_success_title') || 'Mot de passe réinitialisé'}</p>
                <p className="mt-1 opacity-90">
                  {t('reset_success_message') || 'Vous allez être redirigé vers la page de connexion...'}
                </p>
              </div>
            </div>
          )}

          {!success && (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                  {t('reset_password') || 'Nouveau mot de passe'}
                </label>
                <div className="relative">
                  <Lock className={inputIcon} style={{ color: 'var(--text-muted)' }} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className={`${inputBase} pl-10 pr-11 h-11`}
                    style={{
                      background: 'var(--surface-overlay)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-primary)',
                    }}
                    placeholder="••••••••"
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
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 transition-colors hover:text-[var(--color-primary)]"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                  {t('reset_password_hint') || '8 caractères min., 1 majuscule, 1 chiffre, 1 symbole'}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                  {t('reset_confirm_password') || 'Confirmer le mot de passe'}
                </label>
                <div className="relative">
                  <Lock className={inputIcon} style={{ color: 'var(--text-muted)' }} />
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    className={`${inputBase} pl-10 pr-11 h-11`}
                    style={{
                      background: 'var(--surface-overlay)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-primary)',
                    }}
                    placeholder="••••••••"
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
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 transition-colors hover:text-[var(--color-primary)]"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !token}
                className="w-full h-11 rounded-lg text-sm font-medium text-white transition-all flex items-center justify-center gap-2 hover:shadow-md active:scale-[0.98]"
                style={{ background: 'var(--color-primary)' }}
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                <span className={loading ? 'opacity-60' : ''}>{t('reset_btn') || 'Réinitialiser'}</span>
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
              {t('reset_back_login') || 'Retour à la connexion'}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
