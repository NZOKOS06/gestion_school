import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Lock, Eye, EyeOff, Loader2 } from 'lucide-react';
import { ThemeToggle } from '../../components/ui/ThemeToggle';
import toast from 'react-hot-toast';
import axios from 'axios';

function getPasswordStrength(pwd) {
  let score = 0;
  if (pwd.length >= 8) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  return score;
}

const STRENGTH_LABELS = ['', 'Faible', 'Moyen', 'Fort', 'Très fort'];
const STRENGTH_COLORS = ['', 'bg-red-500', 'bg-orange-400', 'bg-yellow-400', 'bg-green-500'];

const getDashboardRoute = (role) => {
  switch (role) {
    case 'super_admin': return '/super-admin/dashboard';
    case 'directeur':
    case 'directeur_etudes':
    case 'secretaire':
    case 'surveillant': return '/admin/dashboard';
    case 'enseignant': return '/enseignant/dashboard';
    case 'comptable': return '/caissier';
    case 'parent': return '/parent/dashboard';
    default: return '/';
  }
};

const ChangePassword = () => {
  const navigate = useNavigate();
  const { user, checkAuth } = useAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const strength = getPasswordStrength(newPassword);
  const passwordsMatch = confirmPassword.length > 0 && newPassword === confirmPassword;
  const passwordsMismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;

  const inputBase = 'w-full rounded-md text-sm transition-all';
  const inputIcon = 'absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none';

  const focusStyle = (e) => {
    e.target.style.borderColor = 'var(--color-primary)';
    e.target.style.boxShadow = '0 0 0 3px color-mix(in srgb, var(--color-primary) 20%, transparent)';
  };
  const blurStyle = (e) => {
    e.target.style.borderColor = 'var(--border-subtle)';
    e.target.style.boxShadow = 'none';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }

    if (strength < 4) {
      setError('Le mot de passe doit contenir au moins 8 caractères, une majuscule, un chiffre et un caractère spécial.');
      return;
    }

    setLoading(true);
    try {
      await axios.post('/api/auth/change-password', { currentPassword, newPassword });
      await checkAuth();
      toast.success('Mot de passe défini avec succès');
      navigate(getDashboardRoute(user?.role), { replace: true });
    } catch (err) {
      const message = err.response?.data?.message || err.response?.data?.error || 'Erreur lors du changement de mot de passe';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 relative"
      style={{ background: 'var(--surface-base)' }}
    >
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm">
        <div
          className="rounded-xl p-8"
          style={{
            background: 'var(--surface-raised)',
            border: '1px solid var(--border-default)',
            boxShadow: 'var(--shadow-modal)',
          }}
        >
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <div
                className="flex items-center justify-center w-14 h-14 rounded-full"
                style={{ background: 'color-mix(in srgb, var(--color-primary) 15%, transparent)' }}
              >
                <Lock className="h-7 w-7" style={{ color: 'var(--color-primary)' }} />
              </div>
            </div>
            <h1
              className="text-xl font-semibold tracking-tight"
              style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-sans)' }}
            >
              Définir votre mot de passe
            </h1>
            <p className="mt-1.5 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              Votre compte nécessite un nouveau mot de passe
              <br />pour des raisons de sécurité.
            </p>
          </div>

          {error && (
            <div
              className="mb-5 rounded-md border p-3 text-sm"
              style={{
                background: 'color-mix(in srgb, var(--color-danger) 12%, transparent)',
                borderColor: 'color-mix(in srgb, var(--color-danger) 25%, transparent)',
                color: 'var(--color-danger)',
              }}
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Mot de passe actuel */}
            <div>
              <label className="block text-xs font-medium uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                Mot de passe actuel (provisoire)
              </label>
              <div className="relative">
                <Lock className={inputIcon} style={{ color: 'var(--text-muted)' }} />
                <input
                  type={showCurrent ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className={`${inputBase} pl-9 pr-10 h-10`}
                  style={{
                    background: 'var(--surface-overlay)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-primary)',
                  }}
                  placeholder="••••••••"
                  required
                  onFocus={focusStyle}
                  onBlur={blurStyle}
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                  style={{ color: 'var(--text-muted)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
                >
                  {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Nouveau mot de passe */}
            <div>
              <label className="block text-xs font-medium uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                Nouveau mot de passe
              </label>
              <div className="relative">
                <Lock className={inputIcon} style={{ color: 'var(--text-muted)' }} />
                <input
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className={`${inputBase} pl-9 pr-10 h-10`}
                  style={{
                    background: 'var(--surface-overlay)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-primary)',
                  }}
                  placeholder="••••••••"
                  required
                  onFocus={focusStyle}
                  onBlur={blurStyle}
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                  style={{ color: 'var(--text-muted)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
                >
                  {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              {/* Indicateur de force */}
              {newPassword.length > 0 && (
                <div className="mt-2">
                  <div className="flex gap-1 mb-1">
                    {[1, 2, 3, 4].map((bar) => (
                      <div
                        key={bar}
                        className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                          bar <= strength ? STRENGTH_COLORS[strength] : 'bg-gray-600'
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    Force :{' '}
                    <span
                      className={`font-medium ${
                        strength === 1 ? 'text-red-400' :
                        strength === 2 ? 'text-orange-400' :
                        strength === 3 ? 'text-yellow-400' :
                        strength === 4 ? 'text-green-400' : ''
                      }`}
                    >
                      {STRENGTH_LABELS[strength]}
                    </span>
                  </p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                    8+ caractères · 1 majuscule · 1 chiffre · 1 caractère spécial
                  </p>
                </div>
              )}
            </div>

            {/* Confirmer mot de passe */}
            <div>
              <label className="block text-xs font-medium uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                Confirmer nouveau mot de passe
              </label>
              <div className="relative">
                <Lock className={inputIcon} style={{ color: 'var(--text-muted)' }} />
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={`${inputBase} pl-9 pr-10 h-10`}
                  style={{
                    background: 'var(--surface-overlay)',
                    border: `1px solid ${
                      passwordsMismatch ? 'var(--color-danger)' :
                      passwordsMatch ? 'var(--color-success)' :
                      'var(--border-subtle)'
                    }`,
                    color: 'var(--text-primary)',
                  }}
                  placeholder="••••••••"
                  required
                  onFocus={focusStyle}
                  onBlur={blurStyle}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                  style={{ color: 'var(--text-muted)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {passwordsMismatch && (
                <p className="mt-1 text-xs" style={{ color: 'var(--color-danger)' }}>
                  Les mots de passe ne correspondent pas.
                </p>
              )}
              {passwordsMatch && (
                <p className="mt-1 text-xs" style={{ color: 'var(--color-success, #22c55e)' }}>
                  Les mots de passe correspondent.
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || passwordsMismatch}
              className="w-full h-10 rounded-md text-sm font-medium text-white transition-all flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: 'var(--color-primary)' }}
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              <span className={loading ? 'opacity-60' : ''}>Changer le mot de passe</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ChangePassword;
