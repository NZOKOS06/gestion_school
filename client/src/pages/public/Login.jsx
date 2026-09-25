import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTenant } from '../../contexts/TenantContext';
import { useI18n } from '../../contexts/I18nContext';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  Building2,
  LogIn,
  ShieldCheck,
  GraduationCap,
  Sparkles,
  BookOpen,
  CreditCard,
  Users
} from 'lucide-react';
import { ThemeToggle } from '../../components/ui/ThemeToggle';

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { config, slug, tenant } = useTenant();
  const { t } = useI18n();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    rememberMe: true,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tenants, setTenants] = useState([]);
  const [selectedTenantSlug, setSelectedTenantSlug] = useState('');

  // Identité personnalisable récupérée depuis le Tenant / SuperAdmin
  const nomEtablissement = config?.nomEcole || config?.nomApp || tenant?.nom || 'GestSchool';
  const logoEtablissement = config?.logoUrl || null;
  const sloganEtablissement =
    config?.slogan || 'Plateforme intégrée d’excellence académique & de gestion scolaire';
  const primaryColor = config?.couleurPrimaire || '#1e40af';
  const secondaryColor = config?.couleurSecondaire || '#0d9488';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(formData.email, formData.password, selectedTenantSlug || slug);
      // La redirection post-login est automatiquement orchestrée par AuthContext selon le rôle
    } catch (err) {
      const message =
        err.response?.data?.error ||
        err.response?.data?.message ||
        'Identifiants incorrects ou compte inactif';
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

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 sm:p-6 lg:p-8 relative overflow-hidden"
      style={{
        background: config?.backgroundImageUrl
          ? `linear-gradient(rgba(15, 23, 42, 0.65), rgba(15, 23, 42, 0.75)), url(${config.backgroundImageUrl}) center/cover no-repeat fixed`
          : 'radial-gradient(ellipse at top right, rgba(30, 64, 175, 0.08), transparent 50%), radial-gradient(ellipse at bottom left, rgba(13, 148, 136, 0.08), transparent 50%), var(--surface-base, #f8fafc)',
      }}
    >
      {/* Bouton de bascule de thème discret en haut à droite */}
      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle />
      </div>

      {/* Cadre principal moderne - Style Split-Screen / Card Pro */}
      <div
        className="w-full max-w-5xl rounded-3xl overflow-hidden shadow-2xl border flex flex-col lg:flex-row transition-all duration-300"
        style={{
          background: 'var(--surface-raised, #ffffff)',
          borderColor: 'var(--border-subtle, rgba(226, 232, 240, 0.8))',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
        }}
      >
        {/* ══════════════════════════════════════════════════════════
            COLONNE GAUCHE (Formulaire de Connexion)
           ══════════════════════════════════════════════════════════ */}
        <div className="w-full lg:w-7/12 p-8 sm:p-12 lg:p-14 flex flex-col justify-between">
          <div>
            {/* Header branding établissement */}
            <div className="flex items-center gap-3 mb-8">
              {logoEtablissement ? (
                <img
                  src={logoEtablissement}
                  alt={nomEtablissement}
                  className="h-12 w-12 object-contain rounded-xl p-1 border shadow-sm"
                  style={{
                    backgroundColor: 'var(--surface-overlay, #ffffff)',
                    borderColor: 'var(--border-subtle, #e2e8f0)',
                  }}
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
              ) : (
                <div
                  className="h-12 w-12 rounded-xl flex items-center justify-center text-white shadow-md font-bold text-lg"
                  style={{
                    background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`,
                  }}
                >
                  <GraduationCap className="h-6 w-6" />
                </div>
              )}
              <div>
                <h2 className="text-base font-bold leading-tight" style={{ color: 'var(--text-primary, #0f172a)' }}>
                  {nomEtablissement}
                </h2>
                <span className="text-xs font-medium tracking-wide uppercase px-2 py-0.5 rounded-full inline-block mt-0.5"
                  style={{
                    backgroundColor: 'rgba(30, 64, 175, 0.08)',
                    color: primaryColor,
                  }}
                >
                  Portail Scolaire Sécurisé
                </span>
              </div>
            </div>

            {/* Titre & Accroche */}
            <div className="mb-8">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight" style={{ color: 'var(--text-primary, #0f172a)' }}>
                Bienvenue ! 👋
              </h1>
              <p className="mt-2 text-sm sm:text-base leading-relaxed" style={{ color: 'var(--text-secondary, #64748b)' }}>
                Connectez-vous pour accéder à votre espace de gestion, notes, bulletins et suivi scolaire.
              </p>
            </div>

            {/* Message d'erreur */}
            {error && (
              <div
                data-testid="login-error"
                className="mb-6 rounded-xl border p-4 text-sm flex items-start gap-3 animate-shake"
                style={{
                  background: 'rgba(239, 68, 68, 0.08)',
                  borderColor: 'rgba(239, 68, 68, 0.25)',
                  color: '#dc2626',
                }}
              >
                <div className="mt-0.5 flex-shrink-0 font-bold">⚠️</div>
                <div className="flex-1 font-medium">{error}</div>
              </div>
            )}

            {/* Formulaire */}
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Champ Email / Identifiant */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-primary, #334155)' }}>
                  Adresse Email ou Identifiant
                </label>
                <div className="relative group">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none transition-colors group-focus-within:text-blue-600" style={{ color: 'var(--text-muted, #94a3b8)' }}>
                    <Mail className="h-5 w-5" />
                  </div>
                  <input
                    data-testid="email-input"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full rounded-xl pl-11 pr-4 h-12 text-sm transition-all outline-none border focus:ring-2"
                    style={{
                      background: 'var(--surface-overlay, #f8fafc)',
                      borderColor: 'var(--border-subtle, #cbd5e1)',
                      color: 'var(--text-primary, #0f172a)',
                    }}
                    placeholder="directeur@ecole.cg ou prenom.nom@domaine.com"
                    required
                  />
                </div>
              </div>

              {/* Champ Mot de passe */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-primary, #334155)' }}>
                  Mot de passe
                </label>
                <div className="relative group">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none transition-colors group-focus-within:text-blue-600" style={{ color: 'var(--text-muted, #94a3b8)' }}>
                    <Lock className="h-5 w-5" />
                  </div>
                  <input
                    data-testid="password-input"
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full rounded-xl pl-11 pr-12 h-12 text-sm transition-all outline-none border focus:ring-2"
                    style={{
                      background: 'var(--surface-overlay, #f8fafc)',
                      borderColor: 'var(--border-subtle, #cbd5e1)',
                      color: 'var(--text-primary, #0f172a)',
                    }}
                    placeholder="••••••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 rounded-lg transition-colors hover:bg-slate-200/50"
                    style={{ color: 'var(--text-muted, #94a3b8)' }}
                    title={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Sélecteur multi-établissements (si compte multi-tenants) */}
              {tenants.length > 0 && (
                <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/50">
                  <label className="block text-xs font-semibold text-blue-900 mb-1.5 flex items-center gap-1.5">
                    <Building2 className="h-4 w-4 text-blue-600" />
                    Sélectionnez votre établissement
                  </label>
                  <select
                    value={selectedTenantSlug}
                    onChange={(e) => setSelectedTenantSlug(e.target.value)}
                    className="w-full rounded-lg px-3 h-10 text-sm font-medium border border-blue-200 bg-white text-slate-900 outline-none"
                    required={tenants.length > 0}
                  >
                    {tenants.map((t) => (
                      <option key={t.id} value={t.slug}>
                        {t.nom || t.slug}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-[11px] text-blue-700">
                    Plusieurs établissements sont associés à cet email.
                  </p>
                </div>
              )}

              {/* Options Remember Me & Mot de passe oublié */}
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={formData.rememberMe}
                    onChange={(e) => setFormData({ ...formData, rememberMe: e.target.checked })}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <span className="text-xs font-medium" style={{ color: 'var(--text-secondary, #64748b)' }}>
                    Se souvenir de moi
                  </span>
                </label>

                <Link
                  to="/mot-de-passe-oublie"
                  className="text-xs font-semibold transition-colors hover:underline"
                  style={{ color: primaryColor }}
                >
                  {t('login_forgot') || 'Mot de passe oublié ?'}
                </Link>
              </div>

              {/* Bouton de Soumission Principal */}
              <button
                data-testid="login-button"
                type="submit"
                disabled={loading}
                className="w-full h-12 rounded-xl text-sm font-bold text-white transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] flex items-center justify-center gap-2"
                style={{
                  background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`,
                  boxShadow: `0 10px 25px -5px ${primaryColor}66`,
                }}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Connexion en cours...</span>
                  </>
                ) : (
                  <>
                    <span>Accéder à mon espace</span>
                    <LogIn className="h-4 w-4 ml-1" />
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Pied de formulaire */}
          <div className="mt-8 pt-6 border-t flex flex-col sm:flex-row items-center justify-between gap-3 text-xs" style={{ borderColor: 'var(--border-subtle, #f1f5f9)' }}>
            <p style={{ color: 'var(--text-muted, #94a3b8)' }}>
              Pas encore de compte ?{' '}
              <Link
                to="/register"
                className="font-bold hover:underline"
                style={{ color: primaryColor }}
              >
                Inscrivez votre enfant
              </Link>
            </p>

            <Link
              to="/super-admin/login"
              className="text-[11px] font-medium transition-colors hover:underline text-slate-400 hover:text-slate-600"
            >
              SuperAdmin Platform
            </Link>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════
            COLONNE DROITE (Vitrine Établissement & Esthétique Hero)
           ══════════════════════════════════════════════════════════ */}
        <div
          className="w-full lg:w-5/12 p-8 sm:p-12 text-white flex flex-col justify-between relative overflow-hidden"
          style={{
            background: `linear-gradient(145deg, ${primaryColor} 0%, #0f172a 100%)`,
          }}
        >
          {/* Motifs fluides en arrière-plan (SVG Waves & Soft Glow) */}
          <div className="absolute inset-0 pointer-events-none opacity-20">
            <svg className="w-full h-full object-cover" viewBox="0 0 400 600" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="350" cy="150" r="180" fill="white" filter="blur(60px)" />
              <circle cx="50" cy="450" r="140" fill={secondaryColor} filter="blur(60px)" />
              <path
                d="M-50,300 C80,220 180,380 320,290 C420,220 480,350 550,280 L550,650 L-50,650 Z"
                fill="white"
                fillOpacity="0.06"
              />
              <path
                d="M-50,380 C120,310 220,440 360,360 C460,300 500,410 600,340 L600,650 L-50,650 Z"
                fill="white"
                fillOpacity="0.04"
              />
            </svg>
          </div>

          {/* En-tête Hero */}
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-xs font-semibold tracking-wide mb-6">
              <Sparkles className="h-3.5 w-3.5 text-amber-300" />
              <span>Système Intégré GestSchool</span>
            </div>

            <div className="flex items-center gap-4 mb-4">
              {logoEtablissement ? (
                <div className="h-16 w-16 rounded-2xl p-2 bg-white/10 backdrop-blur-md border border-white/20 shadow-xl flex items-center justify-center">
                  <img
                    src={logoEtablissement}
                    alt={nomEtablissement}
                    className="max-h-full max-w-full object-contain filter drop-shadow"
                  />
                </div>
              ) : (
                <div
                  className="h-16 w-16 rounded-2xl p-2 bg-white/20 backdrop-blur-md border border-white/30 shadow-xl flex items-center justify-center font-bold text-2xl text-white"
                >
                  <GraduationCap className="h-8 w-8" />
                </div>
              )}
              <div>
                <h3 className="text-xl sm:text-2xl font-black tracking-tight leading-tight">
                  {nomEtablissement}
                </h3>
                <p className="text-xs text-blue-200 font-medium mt-0.5">
                  Année Académique Active
                </p>
              </div>
            </div>

            <p className="text-sm text-slate-200/90 leading-relaxed font-normal mt-4">
              {sloganEtablissement}
            </p>
          </div>

          {/* 3 Cartes Avantages Métier Flottantes (Glassmorphism) */}
          <div className="my-8 space-y-3 relative z-10">
            <div className="p-3.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 flex items-center gap-3.5 hover:bg-white/15 transition-all">
              <div className="h-9 w-9 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0 text-white">
                <BookOpen className="h-4 w-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold">Bulletins & Notes en temps réel</h4>
                <p className="text-[11px] text-blue-100">Calculs automatiques, rangs et impressions officielles</p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 flex items-center gap-3.5 hover:bg-white/15 transition-all">
              <div className="h-9 w-9 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0 text-emerald-300">
                <CreditCard className="h-4 w-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold">Comptabilité & Reçus de Scolarité</h4>
                <p className="text-[11px] text-blue-100">Encaissements avec QR Code de traçabilité bancaire</p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 flex items-center gap-3.5 hover:bg-white/15 transition-all">
              <div className="h-9 w-9 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0 text-indigo-300">
                <Users className="h-4 w-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold">Portail Multi-Rôles Sécurisé</h4>
                <p className="text-[11px] text-blue-100">Direction, Enseignants, Parents & Élèves connectés</p>
              </div>
            </div>
          </div>

          {/* Badge de réassurance bas de page */}
          <div className="relative z-10 pt-4 border-t border-white/10 flex items-center justify-between text-xs text-blue-200/80">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              <span>Chiffrement certifié & PWA Hors-ligne</span>
            </div>
            <span className="font-mono text-[11px] opacity-75">v2.0</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
