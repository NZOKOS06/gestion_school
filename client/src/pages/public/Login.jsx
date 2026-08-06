import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTenant } from '../../contexts/TenantContext';
import { useI18n } from '../../contexts/I18nContext';
import { Mail, Lock, Eye, EyeOff, Loader2, Building2 } from 'lucide-react';
import { ThemeToggle } from '../../components/ui/ThemeToggle';

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { config } = useTenant();
  const { t } = useI18n();

  const [formData, setFormData] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tenants, setTenants] = useState([]);
  const [selectedTenantSlug, setSelectedTenantSlug] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const user = await login(formData.email, formData.password, selectedTenantSlug || undefined);
      // La redirection post-login est gérée par AuthContext selon le rôle
    } catch (err) {
      const message = err.response?.data?.error || err.response?.data?.message || 'Erreur de connexion';
      setError(message);
      if (err.response?.data?.tenants?.length) {
        setTenants(err.response.data.tenants);
        if (!selectedTenantSlug) {
          setSelectedTenantSlug(err.response.data.tenants[0].slug);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const nomApp = config?.nomApp || 'GestSchool';

  const inputBase = 'w-full rounded-lg text-sm transition-all';
  const inputIcon = 'absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none';

  // Fonction utilitaire pour normaliser les URLs d'images
  const normalizeImageUrl = (url) => {
    if (!url) return null;
    return url; // Utiliser l'URL telle quelle (relative ou complète)
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center relative"
      style={{
        background: config?.backgroundImageUrl
          ? `url(${normalizeImageUrl(config.backgroundImageUrl)}) center/cover no-repeat fixed`
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
          <div className="text-center mb-10">
            <h1
              className="text-2xl font-semibold tracking-tight"
              style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-sans)' }}
            >
              Connexion
            </h1>
            <p className="mt-2 text-base" style={{ color: 'var(--text-secondary)' }}>
              Connectez-vous à {nomApp}
            </p>
          </div>

          {error && (
            <div
              data-testid="login-error"
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

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                Email
              </label>
              <div className="relative">
                <Mail className={inputIcon} style={{ color: 'var(--text-muted)' }} />
                <input
                  data-testid="email-input"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
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

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                Mot de passe
              </label>
              <div className="relative">
                <Lock className={inputIcon} style={{ color: 'var(--text-muted)' }} />
                <input
                  data-testid="password-input"
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
            </div>

            {tenants.length > 0 && (
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                  Établissement
                </label>
                <div className="relative">
                  <Building2 className={inputIcon} style={{ color: 'var(--text-muted)' }} />
                  <select
                    value={selectedTenantSlug}
                    onChange={(e) => setSelectedTenantSlug(e.target.value)}
                    className={`${inputBase} pl-10 pr-3 h-11 appearance-none`}
                    style={{
                      background: 'var(--surface-overlay)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-primary)',
                    }}
                    required={tenants.length > 0}
                  >
                    {tenants.map((t) => (
                      <option key={t.id} value={t.slug}>
                        {t.nom || t.slug}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="mt-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                  Plusieurs comptes utilisent cet email. Sélectionnez l'établissement.
                </p>
              </div>
            )}

            <div className="flex items-center justify-end -mt-2">
              <Link
                to="/mot-de-passe-oublie"
                className="text-sm transition-colors hover:text-[var(--color-primary)]"
                style={{ color: 'var(--text-muted)' }}
              >
                {t('login_forgot') || 'Mot de passe oublié ?'}
              </Link>
            </div>

            <button
              data-testid="login-button"
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-lg text-sm font-medium text-white transition-all flex items-center justify-center gap-2 hover:shadow-md active:scale-[0.98]"
              style={{ background: 'var(--color-primary)' }}
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              <span className={loading ? 'opacity-60' : ''}>Se connecter</span>
            </button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-base" style={{ color: 'var(--text-secondary)' }}>
              Pas de compte ?{' '}
              <Link
                to="/register"
                className="font-medium transition-colors hover:text-[var(--color-primary)]"
                style={{ color: 'var(--color-primary)' }}
              >
                Inscrivez-vous
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
