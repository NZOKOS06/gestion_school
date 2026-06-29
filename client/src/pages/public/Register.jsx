import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTenant } from '../../contexts/TenantContext';
import { User, Mail, Lock, Phone, Calendar, Eye, EyeOff, Loader2 } from 'lucide-react';
import { ThemeToggle } from '../../components/ui/ThemeToggle';

const INPUT_STYLE = {
  background: 'var(--surface-overlay)',
  border: '1px solid var(--border-subtle)',
  color: 'var(--text-primary)',
};

const INPUT_FOCUS = (e) => {
  e.target.style.borderColor = 'var(--color-primary)';
  e.target.style.boxShadow = '0 0 0 3px color-mix(in srgb, var(--color-primary) 20%, transparent)';
};

const INPUT_BLUR = (e) => {
  e.target.style.borderColor = 'var(--border-subtle)';
  e.target.style.boxShadow = 'none';
};

const Register = () => {
  const navigate = useNavigate();
  const { register } = useAuth();
  const { config } = useTenant();

  const [formData, setFormData] = useState({
    nom: '',
    prenom: '',
    email: '',
    password: '',
    telephone: '',
    dateNaissance: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await register(formData);
      navigate('/profil');
    } catch (err) {
      setError(err.response?.data?.error || "Erreur d'inscription");
    } finally {
      setLoading(false);
    }
  };

  const nomApp = config?.nomApp || 'GestPharma';
  const labelClass = 'block text-sm font-medium mb-2';
  const iconClass = 'absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none';
  const inputClass = 'w-full rounded-lg text-sm transition-all pl-10 pr-3 h-11';

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
            <h1 className="text-2xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-sans)' }}>
              Créer un compte
            </h1>
            <p className="mt-2 text-base" style={{ color: 'var(--text-secondary)' }}>
              Rejoignez {nomApp}
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

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass} style={{ color: 'var(--text-secondary)' }}>Nom</label>
                <div className="relative">
                  <User className={iconClass} style={{ color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    value={formData.nom}
                    onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                    className={inputClass}
                    style={INPUT_STYLE}
                    required
                    onFocus={INPUT_FOCUS}
                    onBlur={INPUT_BLUR}
                  />
                </div>
              </div>
              <div>
                <label className={labelClass} style={{ color: 'var(--text-secondary)' }}>Prénom</label>
                <div className="relative">
                  <User className={iconClass} style={{ color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    value={formData.prenom}
                    onChange={(e) => setFormData({ ...formData, prenom: e.target.value })}
                    className={inputClass}
                    style={INPUT_STYLE}
                    required
                    onFocus={INPUT_FOCUS}
                    onBlur={INPUT_BLUR}
                  />
                </div>
              </div>
            </div>

            <div>
              <label className={labelClass} style={{ color: 'var(--text-secondary)' }}>Email</label>
              <div className="relative">
                <Mail className={iconClass} style={{ color: 'var(--text-muted)' }} />
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className={inputClass}
                  style={INPUT_STYLE}
                  required
                  onFocus={INPUT_FOCUS}
                  onBlur={INPUT_BLUR}
                />
              </div>
            </div>

            <div>
              <label className={labelClass} style={{ color: 'var(--text-secondary)' }}>Mot de passe</label>
              <div className="relative">
                <Lock className={iconClass} style={{ color: 'var(--text-muted)' }} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className={`${inputClass} pr-10`}
                  style={INPUT_STYLE}
                  minLength={6}
                  required
                  onFocus={INPUT_FOCUS}
                  onBlur={INPUT_BLUR}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                  style={{ color: 'var(--text-muted)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className={labelClass} style={{ color: 'var(--text-secondary)' }}>Téléphone</label>
              <div className="relative">
                <Phone className={iconClass} style={{ color: 'var(--text-muted)' }} />
                <input
                  type="tel"
                  value={formData.telephone}
                  onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
                  className={inputClass}
                  style={INPUT_STYLE}
                  onFocus={INPUT_FOCUS}
                  onBlur={INPUT_BLUR}
                />
              </div>
            </div>

            <div>
              <label className={labelClass} style={{ color: 'var(--text-secondary)' }}>Date de naissance</label>
              <div className="relative">
                <Calendar className={iconClass} style={{ color: 'var(--text-muted)' }} />
                <input
                  type="date"
                  value={formData.dateNaissance}
                  onChange={(e) => setFormData({ ...formData, dateNaissance: e.target.value })}
                  className={inputClass}
                  style={INPUT_STYLE}
                  onFocus={INPUT_FOCUS}
                  onBlur={INPUT_BLUR}
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
              <span className={loading ? 'opacity-60' : ''}>Créer mon compte</span>
            </button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-base" style={{ color: 'var(--text-secondary)' }}>
              Déjà un compte ?{' '}
              <Link to="/login" className="font-medium transition-colors hover:text-[var(--color-primary)]" style={{ color: 'var(--color-primary)' }}>
                Connectez-vous
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
