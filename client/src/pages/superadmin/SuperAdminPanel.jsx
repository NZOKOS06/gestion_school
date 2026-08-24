import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axiosInstance from '../../utils/axios';
import { useAxios } from '../../hooks/useAxios';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useI18n } from '../../contexts/I18nContext';
import {
  Building2, Users, ShoppingCart, TrendingUp, CheckCircle,
  Plus, Edit2, Trash2, LogOut, Settings, ExternalLink, X,
  GraduationCap, BookOpen, FileText, BarChart2, Award,
  AlertTriangle, Copy, ChevronLeft, ChevronRight,
  Upload, UserPlus, ArrowRight, Building,
  PauseCircle, PlayCircle, Shield, LayoutDashboard, Sparkles,
  Globe, Sun, Moon, ChevronDown, Smartphone, Link2, QrCode, History,
  Filter, Calendar, ArrowDown, ArrowUp, Cookie, ClipboardList
} from 'lucide-react';
import QRCode from 'qrcode';
import toast from 'react-hot-toast';
import Button from '../../components/ui/Button';
import KpiCard from '../../components/ui/KpiCard';
import KpiGrid from '../../components/ui/KpiGrid';
import Modal from '../../components/ui/Modal';
import SearchInput from '../../components/ui/SearchInput';
import Badge from '../../components/ui/Badge';
import {
  PLANS,
  PALETTES,
  MODULES_CONFIG,
  FONTS,
  DEVISES,
  DEFAULT_CONFIG,
  JOURS_SEMAINE_CONFIG,
  SUPERADMIN_TABS,
  generateSlug,
  countActiveModules,
  formatCurrency,
  tabFromPathname,
} from './constants';
import {
  Avatar,
  TabButton,
  StatusBadge,
  PlanBadge,
  ModuleToggle,
  ColorPicker,
  PaletteSelector,
  PreviewCard,
} from './SharedUI';

// ─────────────────────────────────────────────────────────────────────────────
// LANGUAGE PICKER — sélecteur de langue global
// ─────────────────────────────────────────────────────────────────────────────
const LanguagePicker = () => {
  const { lang, setLang, currentLang, LANGUAGES: langs } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
        style={{
          background: open ? 'var(--surface-brand-soft)' : 'var(--surface-hover)',
          color: 'var(--text-secondary)',
          border: '1px solid var(--border-subtle)',
        }}
        title="Choisir la langue"
      >
        <Globe className="h-3.5 w-3.5" style={{ color: 'var(--color-primary)' }} />
        <span>{currentLang.flag} {currentLang.code.toUpperCase()}</span>
        <ChevronDown className="h-3 w-3 opacity-50" />
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            minWidth: 160,
            background: 'var(--surface-raised)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 10,
            boxShadow: 'var(--shadow-dropdown)',
            zIndex: 200,
            overflow: 'hidden',
          }}
        >
          <div style={{ padding: '6px 10px 4px', borderBottom: '1px solid var(--border-subtle)' }}>
            <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
              Langue de l&apos;interface
            </p>
          </div>
          {langs.map((l) => (
            <button
              type="button"
              key={l.code}
              onClick={() => { setLang(l.code); setOpen(false); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors"
              style={{
                color: l.code === lang ? 'var(--color-primary)' : 'var(--text-secondary)',
                fontWeight: l.code === lang ? 600 : 400,
                background: l.code === lang ? 'var(--surface-brand-soft)' : 'transparent',
              }}
            >
              <span className="text-base">{l.flag}</span>
              <span className="flex-1 text-left">{l.label}</span>
              {l.code === lang && <CheckCircle className="h-3.5 w-3.5" style={{ color: 'var(--color-primary)' }} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const SuperAdminThemeToggle = () => {
  const { isDark, toggle } = useTheme();
  return (
    <button
      type="button"
      onClick={toggle}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
      style={{
        background: 'var(--surface-hover)',
        color: 'var(--text-secondary)',
        border: '1px solid var(--border-subtle)',
      }}
      title={isDark ? 'Mode clair' : 'Mode sombre'}
    >
      {isDark ? <Sun className="h-3.5 w-3.5" style={{ color: 'var(--color-warning)' }} /> : <Moon className="h-3.5 w-3.5" />}
      <span className="hidden sm:inline">{isDark ? 'Clair' : 'Sombre'}</span>
    </button>
  );
};

const TenantAccessSection = ({ tenant }) => {
  const [maintenance, setMaintenance] = useState(tenant?.modeMaintenance || false);
  const [domain, setDomain] = useState(tenant?.domainePersonnalise || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setMaintenance(tenant?.modeMaintenance || false);
    setDomain(tenant?.domainePersonnalise || '');
  }, [tenant]);

  const saveAccessSettings = async () => {
    if (!tenant) return;
    setSaving(true);
    try {
      await axiosInstance.put(`/api/superadmin/tenants/${tenant.id}`, {
        modeMaintenance: maintenance,
        domainePersonnalise: domain || null
      });
      toast.success('Paramètres d\'accès mis à jour');
    } catch {
      toast.error('Erreur lors de la mise à jour');
    } finally {
      setSaving(false);
    }
  };

  // ── URLs ───────────────────────────────────────────────────────────────────
  // URL de production : priorité absolue
  const prodUrl = useMemo(() => {
    if (!tenant) return '';
    const frontendBase = import.meta.env.VITE_FRONTEND_URL || '';
    const apiBase      = import.meta.env.VITE_API_URL || '';
    const isSubdomain  = import.meta.env.VITE_SUBDOMAIN_MODE === 'true';

    // Base de production : VITE_FRONTEND_URL en priorité, sinon on déduit depuis VITE_API_URL
    let base = frontendBase;
    if (!base && apiBase) {
      // ex: https://GestSchool-api.onrender.com → https://GestSchool-two.vercel.app
      try {
        const apiOrigin = new URL(apiBase).origin;
        // Remplace le pattern -api.onrender.com par -two.vercel.app si possible
        base = apiOrigin
          .replace(/-api\.onrender\.com$/, '-two.vercel.app')
          .replace(/\.onrender\.com$/, '.vercel.app');
        if (base === apiOrigin) base = ''; // Pas de remplacement trouvé
      } catch { base = ''; }
    }

    if (base) {
      const cleanBase = base.replace(/\/$/, '');
      if (isSubdomain) {
        try {
          const host = new URL(cleanBase).hostname;
          const parts = host.split('.');
          if (parts.length >= 2) {
            const domain = parts.slice(-2).join('.');
            return `https://${tenant.slug}.${domain}/login`;
          }
        } catch { /* ignore */ }
      }
      return `${cleanBase}/login?tenant=${tenant.slug}`;
    }
    // Fallback : origine courante (dev)
    return `${window.location.origin}/login?tenant=${tenant.slug}`;
  }, [tenant]);

  // URL réseau local (LAN)
  const [networkInfo, setNetworkInfo]   = useState(null);
  const [selectedIp, setSelectedIp]     = useState('');
  const [loadingNet, setLoadingNet]     = useState(true);
  const [showLan, setShowLan]           = useState(false);

  useEffect(() => {
    setLoadingNet(true);
    axiosInstance.get('/api/network/info')
      .then(res => {
        const addrs = res.data?.addresses || res.addresses || [];
        setNetworkInfo({ addresses: addrs });
        const firstIp = addrs[0]?.ip || window.location.hostname;
        setSelectedIp(firstIp);
      })
      .catch(() => setSelectedIp(window.location.hostname))
      .finally(() => setLoadingNet(false));
  }, []);

  const lanUrl = useMemo(() => {
    if (!tenant || !selectedIp) return '';
    const port     = window.location.port ? `:${window.location.port}` : '';
    const protocol = window.location.protocol;
    return `${protocol}//${selectedIp}${port}/login?tenant=${tenant.slug}`;
  }, [tenant, selectedIp]);

  // ── QR codes ──────────────────────────────────────────────────────────────
  const [prodQr, setProdQr] = useState('');
  const [lanQr,  setLanQr]  = useState('');

  const QR_OPTS_PROD = { width: 240, margin: 2, color: { dark: '#0F172A', light: '#FFFFFF' } };
  const QR_OPTS_LAN  = { width: 200, margin: 2, color: { dark: '#1E3A2F', light: '#FFFFFF' } };

  useEffect(() => {
    if (!prodUrl) return;
    QRCode.toDataURL(prodUrl, QR_OPTS_PROD)
      .then(u => setProdQr(u))
      .catch(err => console.error('QR prod failed:', err));
  }, [prodUrl]);

  useEffect(() => {
    if (!lanUrl || !showLan) return;
    QRCode.toDataURL(lanUrl, QR_OPTS_LAN)
      .then(u => setLanQr(u))
      .catch(err => console.error('QR LAN failed:', err));
  }, [lanUrl, showLan]);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const copy = (txt, label = 'Lien copié !') => {
    navigator.clipboard.writeText(txt);
    toast.success(label);
  };

  const addresses = networkInfo?.addresses || [];

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* ── SECTION 0 : Contrôles d'accès ── */}
      <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-4">
        <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-2"><Shield className="h-4 w-4" /> Sécurité d'accès public</h4>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-700">Mode maintenance</p>
            <p className="text-xs text-slate-500">Ferme l'accès public au site de l'établissement.</p>
          </div>
          <button
            onClick={() => setMaintenance(v => !v)}
            className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors"
            style={{ background: maintenance ? '#EF4444' : '#CBD5E1' }}
          >
            <span className="inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform" style={{ transform: maintenance ? 'translateX(18px)' : 'translateX(2px)' }} />
          </button>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1 text-slate-500">Domaine personnalisé</label>
          <input type="text" value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="école-client.com" className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-900" />
        </div>
        <div className="flex justify-end">
          <Button variant="primary" onClick={saveAccessSettings} loading={saving} size="sm">Enregistrer</Button>
        </div>
      </div>

      {/* ── SECTION 1 : URL de production (priorité) ── */}
      <div
        className="rounded-xl border-2 overflow-hidden"
        style={{ borderColor: '#16A34A', background: 'linear-gradient(135deg, #F0FDF4 0%, #DCFCE7 100%)' }}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3" style={{ background: '#16A34A' }}>
          <ExternalLink className="h-4 w-4 text-white" />
          <span className="text-sm font-semibold text-white">🌐 Lien d'accès en production (Internet)</span>
          <span
            className="ml-auto text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
            style={{ background: '#FFFFFF33', color: '#FFFFFF' }}
          >Recommandé</span>
        </div>

        <div className="p-4 space-y-4">
          {/* URL + copy */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={prodUrl}
              className="flex-1 px-3 py-2 text-sm rounded-lg font-mono"
              style={{
                background: '#FFFFFF',
                border: '1.5px solid #86EFAC',
                color: '#14532D',
                fontWeight: 600,
              }}
            />
            <button
              onClick={() => copy(prodUrl)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-lg text-white transition-all"
              style={{ background: '#16A34A' }}
              title="Copier le lien de production"
            >
              <Copy className="h-4 w-4" />
              Copier
            </button>
            <a
              href={prodUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 px-3 py-2 text-sm font-medium rounded-lg transition-all"
              style={{ background: '#FFFFFF', color: '#16A34A', border: '1.5px solid #86EFAC' }}
              title="Ouvrir dans un nouvel onglet"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>

          {/* QR Code + description */}
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="shrink-0">
              {prodQr ? (
                <div className="p-2 bg-white rounded-xl shadow-md border border-green-100">
                  <img src={prodQr} alt={`QR Code ${tenant?.nom}`} style={{ width: 180, height: 180 }} />
                </div>
              ) : (
                <div className="w-[180px] h-[180px] rounded-xl bg-green-100 animate-pulse" />
              )}
            </div>
            <div className="flex-1 space-y-2">
              <p className="text-sm font-semibold text-green-900">📱 QR Code d'accès direct</p>
              <p className="text-xs text-green-700">
                Scannez ce QR code depuis n'importe où dans le monde pour accéder directement
                à la page de connexion de l'établissement <strong>{tenant?.nom}</strong>.
              </p>
              <p className="text-xs text-green-600 font-mono break-all">{prodUrl}</p>
              {prodQr && (
                <a
                  href={prodQr}
                  download={`qr-${tenant?.slug}-production.png`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-white transition-all mt-1"
                  style={{ background: '#15803D' }}
                >
                  <QrCode className="h-3.5 w-3.5" />
                  Télécharger le QR code
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── SECTION 2 : URL LAN (secondaire, repliable) ── */}
      <div className="rounded-xl border border-slate-200 overflow-hidden bg-slate-50">
        <button
          onClick={() => setShowLan(v => !v)}
          className="w-full flex items-center gap-2 px-4 py-3 text-left transition-colors hover:bg-slate-100"
        >
          <Smartphone className="h-4 w-4 text-slate-500" />
          <span className="text-sm font-medium text-slate-700">📡 Accès réseau local (LAN)</span>
          <ChevronDown
            className="h-4 w-4 text-slate-400 ml-auto transition-transform"
            style={{ transform: showLan ? 'rotate(180deg)' : 'rotate(0deg)' }}
          />
        </button>

        {showLan && (
          <div className="px-4 pb-4 space-y-3 border-t border-slate-200">
            <p className="text-xs text-slate-500 pt-3">
              Utilisation uniquement sur le réseau local (WiFi, LAN). Ne fonctionne pas depuis Internet.
            </p>

            {loadingNet ? (
              <div className="h-8 bg-slate-200 rounded animate-pulse" />
            ) : (
              <>
                {addresses.length > 1 && (
                  <div>
                    <label className="block text-xs font-medium mb-1 text-slate-500">Interface réseau</label>
                    <select
                      value={selectedIp}
                      onChange={(e) => setSelectedIp(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white text-slate-900"
                    >
                      {addresses.map(a => (
                        <option key={a.ip} value={a.ip}>{a.interface} — {a.ip}</option>
                      ))}
                    </select>
                  </div>
                )}
                {addresses.length === 1 && (
                  <p className="text-xs text-slate-500">Interface : {addresses[0].interface} ({addresses[0].ip})</p>
                )}

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={lanUrl}
                    className="flex-1 px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white text-slate-900 font-mono"
                  />
                  <button
                    onClick={() => copy(lanUrl, 'Lien LAN copié !')}
                    className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-slate-600 text-white hover:bg-slate-700 transition-colors"
                    title="Copier le lien LAN"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                </div>

                {lanQr && (
                  <div className="flex flex-col items-center pt-2">
                    <div className="p-2 bg-white rounded-lg shadow-sm border border-slate-200">
                      <img src={lanQr} alt="QR Code LAN" style={{ width: 160, height: 160 }} />
                    </div>
                    <p className="text-xs text-slate-400 mt-2">QR LAN — même réseau uniquement</p>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// COMPOSANT PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════

const SuperAdminPanel = ({ activeTab: controlledTab, setActiveTab: controlledSetTab } = {}) => {
  const { get, post, put, delete: del, loading } = useAxios();
  const { logout, user } = useAuth();
  const { t } = useI18n();
  // Tokens de couleur — CSS variables only
  const C = {
    bg: 'var(--surface-base)',
    surface: 'var(--surface-raised)',
    overlay: 'var(--surface-overlay)',
    border: 'var(--border-subtle)',
    text: 'var(--text-primary)',
    muted: 'var(--text-muted)',
    secondary: 'var(--text-secondary)',
    primary: 'var(--color-primary)',
    danger: 'var(--color-danger)',
    success: 'var(--color-success)',
    warning: 'var(--color-warning)',
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // ÉTAT GLOBAL
  // ─────────────────────────────────────────────────────────────────────────────

  const location = useLocation();
  const navigate = useNavigate();
  const tabFromUrl = tabFromPathname(location.pathname);
  const isControlled = controlledTab !== undefined && controlledSetTab !== undefined;
  const activeTab = isControlled ? controlledTab : tabFromUrl;
  const setActiveTab = useCallback((tab) => {
    const next = SUPERADMIN_TABS.includes(tab) ? tab : 'dashboard';
    if (isControlled) {
      controlledSetTab(next);
      return;
    }
    navigate(`/super-admin/${next}`, { replace: false });
  }, [isControlled, controlledSetTab, navigate]);
  const [tenants, setTenants] = useState([]);
  const [stats, setStats] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [planFilter, setPlanFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalTenants, setTotalTenants] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // ─────────────────────────────────────────────────────────────────────────────
  // ÉTAT AUDIT
  // ─────────────────────────────────────────────────────────────────────────────

  const [auditLogs, setAuditLogs] = useState([]);
  const [auditStats, setAuditStats] = useState(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditPage, setAuditPage] = useState(1);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditTenantFilter, setAuditTenantFilter] = useState('');
  const [auditTypeFilter, setAuditTypeFilter] = useState('all');
  const [auditSearch, setAuditSearch] = useState('');
  const [auditStartDate, setAuditStartDate] = useState('');
  const [auditEndDate, setAuditEndDate] = useState('');
  const [showSessionsDetails, setShowSessionsDetails] = useState(false);

  // ─────────────────────────────────────────────────────────────────────────────
  // ÉTAT MODALES
  // ─────────────────────────────────────────────────────────────────────────────

  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [configModalTab, setConfigModalTab] = useState('identity');
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [tenantConfig, setTenantConfig] = useState(DEFAULT_CONFIG);
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);

  const [staffModalOpen, setStaffModalOpen] = useState(false);
  const [staffForm, setStaffForm] = useState({ nom: '', prenom: '', email: '', role: 'directeur' });
  const [createdStaff, setCreatedStaff] = useState(null);
  const [staffList, setStaffList] = useState([]);
  const [viewStaffModalOpen, setViewStaffModalOpen] = useState(false);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [tenantToDelete, setTenantToDelete] = useState(null);

  // ─────────────────────────────────────────────────────────────────────────────
  // ÉTAT WIZARD CRÉATION
  // ─────────────────────────────────────────────────────────────────────────────

  const [createStep, setCreateStep] = useState(1);
  const [createForm, setCreateForm] = useState({
    nom: '',
    slug: '',
    plan: 'basique',
    email: '',
    telephone: '',
    adresse: '',
    numeroAutorisation: '',
  });
  const [createConfig, setCreateConfig] = useState(DEFAULT_CONFIG);
  const [createStaff, setCreateStaff] = useState({ nom: '', prenom: '', email: '', role: 'directeur' });
  const [skipStaffCreation, setSkipStaffCreation] = useState(false);
  const [createdTenantResult, setCreatedTenantResult] = useState(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState(null);
  const [editForm, setEditForm] = useState({
    nom: '',
    slug: '',
    plan: 'basique',
    actif: true,
    contact: { email: '', telephone: '', adresse: '' },
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // DONNÉES
  // ─────────────────────────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [tenantsRes, statsRes] = await Promise.all([
        get(`/api/superadmin/tenants?search=${searchQuery}&page=${page}&limit=20`),
        get('/api/superadmin/stats')
      ]);
      // useAxios already returns response.data
      console.log('Tenants response:', tenantsRes);
      console.log('Stats response:', statsRes);
      
      // Handle {data: [...], pagination: {...}} structure
      const tenantsList = tenantsRes?.data || tenantsRes?.tenants || tenantsRes || [];
      setTenants(Array.isArray(tenantsList) ? tenantsList : []);
      setTotalTenants(tenantsRes?.total || tenantsRes?.pagination?.total || tenantsList.length || 0);
      setStats(statsRes ?? null);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Erreur de chargement des données');
    } finally {
      setIsLoading(false);
    }
  }, [get, searchQuery, page]);

  useEffect(() => {
    fetchData();
  }, []); // Load data on component mount

  // Reload when search or page changes
  useEffect(() => {
    fetchData();
  }, [searchQuery, page]);

  const fetchAudit = useCallback(async () => {
    setAuditLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', auditPage);
      params.set('limit', '50');
      if (auditTenantFilter) params.set('tenantId', auditTenantFilter);
      if (auditTypeFilter && auditTypeFilter !== 'all') params.set('type', auditTypeFilter);
      if (auditSearch) params.set('search', auditSearch);
      if (auditStartDate) params.set('startDate', auditStartDate);
      if (auditEndDate) params.set('endDate', auditEndDate);

      const [logsRes, statsRes] = await Promise.all([
        get(`/api/superadmin/audit?${params.toString()}`),
        get('/api/superadmin/audit/stats')
      ]);

      setAuditLogs(logsRes?.data || []);
      setAuditTotal(logsRes?.pagination?.total || 0);
      setAuditStats(statsRes ?? null);
    } catch (error) {
      console.error('Error fetching audit:', error);
      toast.error('Erreur de chargement des logs d\'audit');
    } finally {
      setAuditLoading(false);
    }
  }, [get, auditPage, auditTenantFilter, auditTypeFilter, auditSearch, auditStartDate, auditEndDate]);

  useEffect(() => {
    if (activeTab === 'audit') {
      fetchAudit();
    }
  }, [activeTab, auditPage, auditTenantFilter, auditTypeFilter, auditSearch, auditStartDate, auditEndDate]);

  // Auto-generate slug from name
  useEffect(() => {
    if (createForm.nom && !createForm.slug) {
      setCreateForm(prev => ({ ...prev, slug: generateSlug(prev.nom) }));
    }
  }, [createForm.nom]);

  // ─────────────────────────────────────────────────────────────────────────────
  // ACTIONS TENANTS
  // ─────────────────────────────────────────────────────────────────────────────

  const handleToggleStatus = async (tenant) => {
    try {
      await put(`/api/superadmin/tenants/${tenant.id}`, {
        ...tenant,
        actif: !tenant.actif
      });
      toast.success(tenant.actif ? 'Établissement désactivé' : 'Établissement activé');
      fetchData();
    } catch (error) {
      toast.error('Erreur lors du changement de statut');
    }
  };

  const handleDeleteTenant = async () => {
    if (!tenantToDelete) return;
    try {
      await del(`/api/superadmin/tenants/${tenantToDelete.id}`);
      toast.success('Établissement supprimé');
      setDeleteModalOpen(false);
      setTenantToDelete(null);
      fetchData();
    } catch (error) {
      toast.error('Erreur lors de la suppression');
    }
  };

  const openEditModal = (tenant) => {
    setEditingTenant(tenant);
    setEditForm({
      nom: tenant.nom,
      slug: tenant.slug,
      plan: tenant.plan,
      actif: tenant.actif,
      contact: tenant.contact || { email: '', telephone: '', adresse: '' },
    });
    setEditModalOpen(true);
  };

  const handleEditSubmit = async () => {
    try {
      await put(`/api/superadmin/tenants/${editingTenant.id}`, editForm);
      toast.success('Établissement mis à jour');
      setEditModalOpen(false);
      fetchData();
    } catch (error) {
      toast.error('Erreur lors de la mise à jour');
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // CONFIGURATION
  // ─────────────────────────────────────────────────────────────────────────────

  const openConfigModal = (tenant) => {
    setSelectedTenant(tenant);
    const config = tenant.config || {};
    setTenantConfig({
      ...DEFAULT_CONFIG,
      ...config,
      nomApp: config.nomApp || tenant.nom,
    });
    setLogoPreview(config.logoUrl || null);
    setLogoFile(null);
    setConfigModalTab('identity');
    setConfigModalOpen(true);
  };

  const handleSaveConfig = async () => {
    try {
      const configToSave = { ...tenantConfig };
      if (logoFile) {
        const form = new FormData();
        form.append('logo', logoFile);
        try {
          const res = await axiosInstance.put(
            `/api/superadmin/tenants/${selectedTenant.id}/config/logo`,
            form,
            { withCredentials: true }
          );
          if (res.data?.logoUrl) configToSave.logoUrl = res.data.logoUrl;
        } catch {
          toast.error('Erreur upload logo');
        }
      }
      await put(`/api/superadmin/tenants/${selectedTenant.id}/config`, configToSave);
      toast.success('Configuration sauvegardée');
      setConfigModalOpen(false);
      fetchData();
    } catch (error) {
      toast.error('Erreur lors de la sauvegarde');
    }
  };

  const handleLogoDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.size <= 2 * 1024 * 1024) {
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    } else {
      toast.error('Le fichier doit faire moins de 2Mo');
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // CRÉATION STAFF
  // ─────────────────────────────────────────────────────────────────────────────

  const openStaffModal = (tenant) => {
    setSelectedTenant(tenant);
    setStaffForm({ nom: '', prenom: '', email: '', role: 'directeur' });
    setCreatedStaff(null);
    setStaffModalOpen(true);
  };

  const openViewStaffModal = async (tenant) => {
    setSelectedTenant(tenant);
    try {
      const res = await get(`/api/superadmin/tenants/${tenant.id}/staff`);
      setStaffList(res || []);
      setViewStaffModalOpen(true);
    } catch (error) {
      toast.error('Erreur lors du chargement des gérants');
    }
  };

  const handleCreateStaff = async () => {
    const defaultPassword = 'Azerty123';
    try {
      const res = await post(`/api/superadmin/tenants/${selectedTenant.id}/staff`, {
        ...staffForm,
        motDePasse: defaultPassword
      });
      const staffData = res.data || res;
      // Ensure password is available for display
      if (!staffData.motDePasseProvisoire && !staffData.staff?.motDePasseProvisoire) {
        staffData.motDePasseProvisoire = defaultPassword;
      }
      setCreatedStaff(staffData);
      toast.success('Compte gérant créé');
    } catch (error) {
      toast.error('Erreur lors de la création');
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copié !');
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // WIZARD CRÉATION ÉTABLISSEMENT
  // ─────────────────────────────────────────────────────────────────────────────

  const handleCreateTenant = async () => {
    let newTenant = null;
    let newStaff = null;

    try {
      // Step 1: Create tenant
      const tenantRes = await post('/api/superadmin/tenants', {
        nom: createForm.nom,
        slug: createForm.slug,
        plan: createForm.plan,
        email: createForm.email,
        telephone: createForm.telephone,
        adresse: createForm.adresse,
        numeroAutorisation: createForm.numeroAutorisation,
      });

      newTenant = tenantRes.data || tenantRes;
    } catch (error) {
      // Error already toasted by useAxios
      return;
    }

    // Step 2: Configure appearance (non-blocking)
    try {
      await put(`/api/superadmin/tenants/${newTenant.id}/config`, createConfig, { silent: true });
    } catch (configError) {
      console.warn('Config update failed:', configError);
      toast.error('Configuration apparence échouée - modifiez manuellement plus tard', { duration: 4000 });
    }

    // Step 3: Create staff if not skipped
    const defaultPassword = 'Azerty123';
    if (!skipStaffCreation && createStaff.nom && createStaff.prenom && createStaff.email) {
      try {
        const staffRes = await post(`/api/superadmin/tenants/${newTenant.id}/staff`, {
          ...createStaff,
          motDePasse: defaultPassword
        }, { silent: true });
        newStaff = staffRes.data || staffRes;
        // Ensure password is available for display
        if (!newStaff.motDePasseProvisoire) {
          newStaff = { ...newStaff, motDePasseProvisoire: defaultPassword };
        }
        toast.success('Gérant créé avec succès !');
      } catch (staffError) {
        console.warn('Staff creation failed:', staffError);
        toast.error('Création gérant échouée - créez manuellement plus tard', { duration: 4000 });
      }
    }

    // Always show success if tenant was created
    setCreatedTenantResult({
      tenant: newTenant,
      staff: newStaff,
    });

    toast.success('Établissement créé avec succès !');
  };

  const resetCreateWizard = () => {
    setCreateStep(1);
    setCreateForm({
      nom: '',
      slug: '',
      plan: 'basique',
      email: '',
      telephone: '',
      adresse: '',
      numeroAutorisation: '',
    });
    setCreateConfig(DEFAULT_CONFIG);
    setCreateStaff({ nom: '', prenom: '', email: '', role: 'directeur' });
    setSkipStaffCreation(false);
    setCreatedTenantResult(null);
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // FILTRAGE
  // ─────────────────────────────────────────────────────────────────────────────

  const filteredTenants = tenants.filter(t => {
    if (planFilter !== 'all' && t.plan !== planFilter) return false;
    if (statusFilter === 'active' && !t.actif) return false;
    if (statusFilter === 'inactive' && t.actif) return false;
    return true;
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDU
  // ─────────────────────────────────────────────────────────────────────────────

  if (isLoading && tenants.length === 0) {
    return (
      <div
        className="min-h-screen flex items-center justify-center superadmin-panel"
        style={{ background: C.bg }}
      >
        <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: 'var(--color-primary, #16A34A)' }} />
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // RENDU JSX
  // ═══════════════════════════════════════════════════════════════════════════════

  return (
    <div className="min-h-screen superadmin-panel" style={{ background: C.bg, fontFamily: 'var(--font-sans, "Plus Jakarta Sans", sans-serif)' }}>
      {/* HEADER */}
      <header
        className="sticky top-0 z-40 superadmin-header"
        style={{
          background: C.surface,
          borderBottom: `1px solid ${C.border}`,
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          height: 64,
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-center justify-between">
          <div className="flex items-center gap-2 md:gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: 'linear-gradient(135deg, #16A34A, #15803D)' }}
            >
              <GraduationCap className="h-5 w-5 text-white" />
            </div>
            <span className="text-base md:text-lg font-bold" style={{ color: C.text, fontFamily: 'var(--font-sans, "Plus Jakarta Sans", sans-serif)' }}>
              GestSchool
            </span>
            <Badge variant="info"><span className="hidden sm:inline">Super Admin</span><span className="sm:hidden">SA</span></Badge>
          </div>
          <div className="flex items-center gap-2 md:gap-3">
            {/* Sélecteur de langue */}
            <div className="hidden sm:block"><LanguagePicker /></div>

            {/* Toggle thème */}
            <SuperAdminThemeToggle />

            <div className="flex items-center gap-2">
              <Avatar nom={user?.nom || 'SA'} size={32} />
              <span className="hidden md:inline text-sm font-medium" style={{ color: C.secondary }}>
                {user?.nom || 'Super Admin'}
              </span>
            </div>
            <Button variant="ghost" size="sm" icon={LogOut} onClick={logout}>
              <span className="hidden sm:inline">Déconnexion</span>
            </Button>
          </div>
        </div>
      </header>

      {/* NAVIGATION ONGLETS */}
      <nav
        className="sticky top-16 z-30 superadmin-nav"
        style={{ background: C.surface, borderBottom: `1px solid ${C.border}` }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Select mobile */}
          <select
            className="md:hidden w-full py-3 px-3 text-sm font-medium rounded-lg my-2 min-h-[44px]"
            value={activeTab}
            onChange={(e) => {
              if (e.target.value === 'creation') resetCreateWizard();
              setActiveTab(e.target.value);
            }}
            style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.text }}
          >
            <option value="dashboard">📊 Dashboard</option>
            <option value="etablissements">🏪 Établissements</option>
            <option value="creation">✨ Création</option>
            <option value="audit">📋 Audit</option>
          </select>
          {/* Onglets desktop scrollables */}
          <div className="hidden md:block overflow-x-auto">
            <div className="flex min-w-max">
              <TabButton
                active={activeTab === 'dashboard'}
                onClick={() => setActiveTab('dashboard')}
                icon={LayoutDashboard}
                data-testid="tab-dashboard"
              >
                {t('dashboard')}
              </TabButton>
              <TabButton
                active={activeTab === 'etablissements'}
                onClick={() => setActiveTab('etablissements')}
                icon={Building2}
                data-testid="tab-etablissements"
              >
                {t('établissements')}
              </TabButton>
              <TabButton
                active={activeTab === 'creation'}
                onClick={() => { setActiveTab('creation'); resetCreateWizard(); }}
                data-testid="tab-creation"
                icon={Sparkles}
              >
                {t('creation')}
              </TabButton>
              <TabButton
                active={activeTab === 'audit'}
                onClick={() => setActiveTab('audit')}
                icon={History}
                data-testid="tab-audit"
              >
                Audit
              </TabButton>
            </div>
          </div>
        </div>
      </nav>

      {/* CONTENU PRINCIPAL */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* ═══════════════════════════════════════════════════════════════════════
            ONGLET 1 — DASHBOARD
           ═══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'dashboard' && (
          <div className="space-y-8">
            {/* KPI Cards */}
            {stats && (
              <KpiGrid cols={6}>
                <KpiCard
                  label="Total établissements"
                  value={stats?.totalTenants ?? stats?.total_tenants ?? 0}
                  icon={Building2}
                  color="blue"
                  delay={0}
                />
                <KpiCard
                  label="Établissements actifs"
                  value={stats?.tenantsActifs ?? stats?.tenants_actifs ?? 0}
                  icon={CheckCircle}
                  color="green"
                  delay={100}
                />
                <KpiCard
                  label="Total staff"
                  value={stats?.totalStaff ?? stats?.total_staff ?? 0}
                  icon={Users}
                  color="purple"
                  delay={200}
                />
                <KpiCard
                  label="Total élèves"
                  value={stats?.totalEleves ?? stats?.total_eleves ?? 0}
                  icon={GraduationCap}
                  color="cyan"
                  delay={300}
                />
                <KpiCard
                  label="Total paiements"
                  value={stats?.totalPaiements ?? stats?.total_paiements ?? 0}
                  icon={ShoppingCart}
                  color="orange"
                  delay={400}
                />
                <KpiCard
                  label="Scolarités perçues"
                  value={formatCurrency(stats?.caGlobal ?? stats?.ca_global ?? 0)}
                  icon={TrendingUp}
                  color="primary"
                  delay={500}
                />
              </div>
            )}

            {/* Tableau des établissements — desktop */}
            <div
              className="rounded-xl overflow-hidden"
              style={{
                background: C.surface,
                border: `1px solid ${C.border}`,
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              }}
            >
              <div className="px-4 md:px-6 py-4 flex items-center justify-between" style={{ borderBottom: `1px solid ${C.border}` }}>
                <div>
                  <h2 className="text-base md:text-lg font-semibold" style={{ color: C.text }}>
                    Vue d'ensemble des établissements
                  </h2>
                  <p className="text-sm" style={{ color: C.muted }}>
                    {totalTenants} établissements enregistrés
                  </p>
                </div>
                <Button variant="primary" icon={Plus} onClick={() => { resetCreateWizard(); setActiveTab('creation'); }}>
                  <span className="hidden sm:inline">Nouvel établissement</span>
                  <span className="sm:hidden">Nouvel</span>
                </Button>
              </div>

              {/* Tableau desktop */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: C.overlay }}>
                      <th className="px-6 py-3 text-left font-medium text-xs" style={{ color: C.muted }}>ÉTABLISSEMENT</th>
                      <th className="px-6 py-3 text-left font-medium text-xs" style={{ color: C.muted }}>SLUG</th>
                      <th className="px-6 py-3 text-left font-medium text-xs" style={{ color: C.muted }}>PLAN</th>
                      <th className="px-6 py-3 text-left font-medium text-xs" style={{ color: C.muted }}>MODULES</th>
                      <th className="px-6 py-3 text-left font-medium text-xs" style={{ color: C.muted }}>STATUT</th>
                      <th className="px-6 py-3 text-right font-medium text-xs" style={{ color: C.muted }}>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tenants.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center" style={{ color: C.muted }}>
                          Aucune établissement enregistrée
                        </td>
                      </tr>
                    ) : (
                      tenants.slice(0, 10).map((tenant) => {
                        const activeCount = countActiveModules(tenant.config);
                        const totalCount = MODULES_CONFIG.length;
                        return (
                          <tr
                            key={tenant.id}
                            className="transition-colors"
                            style={{ borderTop: `1px solid ${C.border}` }}
                          >
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <Avatar nom={tenant.nom} size={36} />
                                <div>
                                  <p className="font-medium" style={{ color: C.text }}>{tenant.nom}</p>
                                  <p className="text-xs" style={{ color: C.muted }}>{tenant.numeroAutorisation || '—'}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 font-mono text-xs" style={{ color: C.muted }}>{tenant.slug}</td>
                            <td className="px-6 py-4">
                              <PlanBadge plan={tenant.plan} />
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium" style={{ color: '#16A34A' }}>
                                  {activeCount}/{totalCount}
                                </span>
                                <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: C.border }}>
                                  <div
                                    className="h-full rounded-full"
                                    style={{ width: `${(activeCount / totalCount) * 100}%`, background: '#16A34A' }}
                                  />
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <StatusBadge actif={tenant.actif} />
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  onClick={() => openConfigModal(tenant)}
                                  className="p-2 rounded-lg transition-colors hover:bg-slate-100"
                                  style={{ color: '#64748B' }}
                                  title="Configurer"
                                >
                                  <Settings className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => window.open(`/p/${tenant.slug}/login`, '_blank')}
                                  className="p-2 rounded-lg transition-colors hover:bg-slate-100"
                                  style={{ color: '#64748B' }}
                                  title="Accéder"
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => openStaffModal(tenant)}
                                  className="p-2 rounded-lg transition-colors hover:bg-slate-100"
                                  style={{ color: '#64748B' }}
                                  title="Créer gérant"
                                >
                                  <UserPlus className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Cards mobile */}
              <div className="md:hidden divide-y" style={{ borderColor: C.border }}>
                {tenants.length === 0 ? (
                  <p className="px-4 py-12 text-center" style={{ color: C.muted }}>Aucune établissement enregistrée</p>
                ) : (
                  tenants.slice(0, 10).map((tenant) => {
                    const activeCount = countActiveModules(tenant.config);
                    const totalCount = MODULES_CONFIG.length;
                    return (
                      <div key={tenant.id} className="p-4 space-y-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <Avatar nom={tenant.nom} size={36} />
                            <div>
                              <p className="font-medium" style={{ color: C.text }}>{tenant.nom}</p>
                              <p className="text-xs font-mono" style={{ color: C.muted }}>{tenant.slug}</p>
                            </div>
                          </div>
                          <StatusBadge actif={tenant.actif} />
                        </div>
                        <div className="flex items-center gap-2">
                          <PlanBadge plan={tenant.plan} />
                          <span className="text-xs" style={{ color: C.muted }}>{activeCount}/{totalCount} modules</span>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          <button onClick={() => openConfigModal(tenant)} className="p-2 rounded-lg" style={{ background: C.overlay, color: C.secondary }} title="Configurer"><Settings className="h-4 w-4" /></button>
                          <button onClick={() => window.open(`/p/${tenant.slug}/login`, '_blank')} className="p-2 rounded-lg" style={{ background: C.overlay, color: C.secondary }} title="Accéder"><ExternalLink className="h-4 w-4" /></button>
                          <button onClick={() => openStaffModal(tenant)} className="p-2 rounded-lg" style={{ background: C.overlay, color: C.secondary }} title="Créer gérant"><UserPlus className="h-4 w-4" /></button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {tenants.length > 10 && (
                <div className="px-4 md:px-6 py-3 flex justify-center" style={{ borderTop: `1px solid ${C.border}` }}>
                  <Button variant="ghost" onClick={() => setActiveTab('etablissements')}>
                    Voir tous les établissements →
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════════
            ONGLET 2 — GESTION ÉTABLISSEMENTS
           ═══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'etablissements' && (
          <div className="space-y-6">
            {/* Filtres */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <SearchInput
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher un établissement..."
                />
              </div>
              <select
                value={planFilter}
                onChange={(e) => setPlanFilter(e.target.value)}
                className="px-3 py-2 rounded-lg text-sm"
                style={{
                  background: C.surface,
                  border: `1px solid ${C.border}`,
                  color: C.secondary,
                  minWidth: 140,
                }}
              >
                <option value="all">Tous les plans</option>
                <option value="starter">Starter</option>
                <option value="basique">Basique</option>
                <option value="pro">Pro</option>
                <option value="enterprise">Enterprise</option>
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 rounded-lg text-sm"
                style={{
                  background: C.surface,
                  border: `1px solid ${C.border}`,
                  color: C.secondary,
                  minWidth: 140,
                }}
              >
                <option value="all">Tous les statuts</option>
                <option value="active">Actifs</option>
                <option value="inactive">Inactifs</option>
              </select>
              <Button variant="primary" icon={Plus} onClick={() => { resetCreateWizard(); setActiveTab('creation'); }}>
                Nouvel établissement
              </Button>
            </div>

            {/* Grille de cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredTenants.map((tenant) => {
                const activeModules = MODULES_CONFIG.filter(m => tenant.config?.[m.key]);
                const inactiveModules = MODULES_CONFIG.filter(m => !tenant.config?.[m.key]);
                return (
                  <div
                    key={tenant.id}
                    className="rounded-xl p-5 transition-all hover:shadow-md"
                    style={{
                      background: C.surface,
                      border: `1px solid ${C.border}`,
                      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                    }}
                  >
                    {/* Header card */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <Avatar nom={tenant.nom} size={48} />
                        <div>
                          <h3 className="font-semibold" style={{ color: C.text }}>{tenant.nom}</h3>
                          <p className="text-xs" style={{ color: C.muted }}>slug: {tenant.slug}</p>
                        </div>
                      </div>
                      <StatusBadge actif={tenant.actif} />
                    </div>

                    {/* Plan */}
                    <div className="flex items-center gap-2 mb-4">
                      <span className="text-sm" style={{ color: C.muted }}>Plan:</span>
                      <PlanBadge plan={tenant.plan} />
                    </div>

                    {/* Modules */}
                    <div className="mb-4">
                      <p className="text-xs font-medium uppercase tracking-wide mb-2" style={{ color: C.muted }}>
                        MODULES ACTIFS
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {activeModules.map(m => (
                          <span
                            key={m.key}
                            className="px-2 py-1 rounded text-xs font-medium border"
                            style={{
                              background: 'color-mix(in srgb, #16A34A 15%, transparent)',
                              color: '#16A34A',
                              borderColor: 'color-mix(in srgb, #16A34A 30%, transparent)',
                            }}
                          >
                            {m.label}
                          </span>
                        ))}
                        {inactiveModules.slice(0, Math.max(0, 5 - activeModules.length)).map(m => (
                          <span
                            key={m.key}
                            className="px-2 py-1 rounded text-xs font-medium border"
                            style={{
                              background: C.overlay,
                              color: C.muted,
                              borderColor: C.border,
                            }}
                          >
                            {m.label}
                          </span>
                        ))}
                        {inactiveModules.length > Math.max(0, 5 - activeModules.length) && (
                          <span className="px-2 py-1 rounded text-xs" style={{ color: C.muted }}>
                            +{inactiveModules.length - Math.max(0, 5 - activeModules.length)} autres
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Contact */}
                    {tenant.contact?.email && (
                      <div className="text-sm mb-4" style={{ color: C.muted }}>
                        {tenant.contact.email} {tenant.contact.telephone && `| ${tenant.contact.telephone}`}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex flex-wrap gap-2 pt-4" style={{ borderTop: `1px solid ${C.border}` }}>
                      <Button data-testid={`btn-configurer-${tenant.slug}`} variant="secondary" size="sm" icon={Settings} onClick={() => openConfigModal(tenant)}>
                        Configurer
                      </Button>
                      <Button variant="secondary" size="sm" icon={UserPlus} onClick={() => openStaffModal(tenant)}>
                        Créer gérant
                      </Button>
                      <Button variant="secondary" size="sm" icon={Users} onClick={() => openViewStaffModal(tenant)}>
                        Voir gérants
                      </Button>
                      <Button variant="secondary" size="sm" icon={ExternalLink} onClick={() => window.open(`/p/${tenant.slug}/login`, '_blank')}>
                        Accéder
                      </Button>
                      <div className="flex-1" />
                      <Button variant="ghost" size="sm" icon={Edit2} onClick={() => openEditModal(tenant)}>
                        Modifier
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={tenant.actif ? PauseCircle : PlayCircle}
                        onClick={() => handleToggleStatus(tenant)}
                      >
                        {tenant.actif ? 'Désactiver' : 'Activer'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={Trash2}
                        onClick={() => { setTenantToDelete(tenant); setDeleteModalOpen(true); }}
                        className="text-red-600 hover:text-red-700"
                      >
                        Supprimer
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            {filteredTenants.length === 0 && (
              <div className="text-center py-16">
                <Building2 className="h-12 w-12 mx-auto mb-4" style={{ color: '#94A3B8' }} />
                <p className="text-lg font-medium" style={{ color: '#64748B' }}>Aucun établissement trouvé</p>
                <p className="text-sm" style={{ color: '#94A3B8' }}>Modifiez vos filtres ou créez un nouvel établissement</p>
              </div>
            )}
          </div>
        )}

        {/* ONGLET 3 — CRÉATION */}
        {activeTab === 'creation' && (
          <div className="max-w-3xl mx-auto">
            {createdTenantResult ? (
              <div data-testid="succes-creation" className="rounded-xl p-8 text-center bg-white border border-slate-200 shadow-sm">
                <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center bg-green-100">
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
                <h2 className="text-xl font-bold mb-2 text-slate-900">Établissement créé avec succès !</h2>
                <p className="text-lg mb-1 text-slate-700">{createdTenantResult.tenant.nom}</p>
                <p className="text-sm mb-4 text-slate-500">Slug : {createdTenantResult.tenant.slug}</p>
                {createdTenantResult.staff && (
                  <div className="rounded-lg p-4 mb-6 text-left bg-slate-50 border border-slate-200">
                    <p className="font-medium mb-2 text-slate-900">Gérant créé :</p>
                    <p className="text-sm text-slate-700">Email : {createdTenantResult.staff.email || createdTenantResult.staff.staff?.email}</p>
                    {(createdTenantResult.staff.motDePasseProvisoire || createdTenantResult.staff.staff?.motDePasseProvisoire) && (
                      <div className="mt-3">
                        <p className="text-xs text-slate-500 mb-1">Mot de passe provisoire :</p>
                        <div className="flex items-center justify-between p-2 rounded bg-white border border-slate-200">
                          <span data-testid="mdp-provisoire" className="font-mono text-sm text-slate-900">
                            {createdTenantResult.staff.motDePasseProvisoire || createdTenantResult.staff.staff?.motDePasseProvisoire}
                          </span>
                          <button 
                            onClick={() => copyToClipboard(createdTenantResult.staff.motDePasseProvisoire || createdTenantResult.staff.staff?.motDePasseProvisoire)} 
                            className="p-1.5 hover:bg-slate-100 rounded transition-colors"
                            title="Copier"
                          >
                            <Copy className="h-4 w-4 text-slate-500" />
                          </button>
                        </div>
                        <p className="text-xs mt-2 text-amber-600">⚠️ Notez ce mot de passe maintenant. Il ne sera plus affiché.</p>
                      </div>
                    )}
                  </div>
                )}
                <div className="flex justify-center gap-3">
                  <Button data-testid="btn-ouvrir-etablissement" variant="primary" icon={ExternalLink} onClick={() => window.open(`/p/${createdTenantResult.tenant.slug}/login`, '_blank')}>Ouvrir</Button>
                  <Button variant="secondary" icon={Plus} onClick={resetCreateWizard}>Créer une autre</Button>
                </div>
              </div>
            ) : (
              <>
                {/* Stepper horizontal — desktop */}
                <div className="hidden sm:flex items-center justify-center mb-8">
                  {[1, 2, 3].map((step, idx) => (
                    <div key={step} className="flex items-center">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm ${createStep >= step ? 'bg-green-600 text-white' : 'bg-slate-200 text-slate-500'}`}>{step}</div>
                      {idx < 2 && <div className={`w-16 h-0.5 mx-2 ${createStep > step ? 'bg-green-600' : 'bg-slate-200'}`} />}
                    </div>
                  ))}
                </div>
                {/* Stepper vertical — mobile */}
                <div className="sm:hidden flex flex-col gap-2 mb-6">
                  {[
                    { n: 1, label: 'Informations de base' },
                    { n: 2, label: 'Apparence' },
                    { n: 3, label: 'Compte gérant' },
                  ].map((e) => (
                    <div key={e.n} className={`flex items-center gap-3 ${
                      e.n < createStep ? 'text-green-600' :
                      e.n === createStep ? 'text-green-600 font-medium' :
                      'text-slate-400'
                    }`}>
                      <span className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-bold ${
                        e.n < createStep ? 'border-green-600 bg-green-600 text-white' :
                        e.n === createStep ? 'border-green-600 text-green-600' :
                        'border-slate-300 text-slate-400'
                      }`}>
                        {e.n < createStep ? '✓' : e.n}
                      </span>
                      <span className="text-sm">{e.label}</span>
                    </div>
                  ))}
                </div>
                {createStep === 1 && (
                  <div className="rounded-xl p-6 bg-white border border-slate-200 shadow-sm">
                    <h2 className="text-lg font-semibold mb-4 text-slate-900">Informations de base</h2>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium mb-1 text-slate-700">Nom *</label>
                        <input data-testid="nom-etablissement" type="text" value={createForm.nom} onChange={(e) => setCreateForm({ ...createForm, nom: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-900" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1 text-slate-700">Slug *</label>
                        <input data-testid="slug-preview" type="text" value={createForm.slug} onChange={(e) => setCreateForm({ ...createForm, slug: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 font-mono text-slate-900" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1 text-slate-700">Plan *</label>
                        <select data-testid="select-plan" value={createForm.plan} onChange={(e) => setCreateForm({ ...createForm, plan: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-900">
                          <option value="starter">Starter</option><option value="basique">Basique</option><option value="pro">Pro</option><option value="enterprise">Enterprise</option>
                        </select>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium mb-1 text-slate-700">Email *</label>
                          <input data-testid="email-contact" type="email" value={createForm.email} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-900" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1 text-slate-700">Téléphone</label>
                          <input type="tel" value={createForm.telephone} onChange={(e) => setCreateForm({ ...createForm, telephone: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-900" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1 text-slate-700">Adresse</label>
                        <input type="text" value={createForm.adresse} onChange={(e) => setCreateForm({ ...createForm, adresse: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-900" />
                      </div>
                    </div>
                    <div className="flex justify-end mt-6">
                      <Button data-testid="btn-etape-suivante" variant="primary" icon={ArrowRight} onClick={() => setCreateStep(2)} disabled={!createForm.nom || !createForm.slug || !createForm.email}>Suivant</Button>
                    </div>
                  </div>
                )}
                {createStep === 2 && (
                  <div className="rounded-xl p-6 bg-white border border-slate-200 shadow-sm">
                    <h2 className="text-lg font-semibold mb-4 text-slate-900">Apparence</h2>
                    <PaletteSelector selected={PALETTES.find(p => p.primary === createConfig.couleurPrimaire)} onSelect={(p) => setCreateConfig({ ...createConfig, couleurPrimaire: p.primary, couleurSecondaire: p.second })} />
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-4">
                      <ColorPicker label="Primaire" value={createConfig.couleurPrimaire} onChange={(v) => setCreateConfig({ ...createConfig, couleurPrimaire: v })} />
                      <ColorPicker label="Secondaire" value={createConfig.couleurSecondaire} onChange={(v) => setCreateConfig({ ...createConfig, couleurSecondaire: v })} />
                      <ColorPicker label="Texte" value={createConfig.couleurTexte} onChange={(v) => setCreateConfig({ ...createConfig, couleurTexte: v })} />
                    </div>
                    <select value={createConfig.police} onChange={(e) => setCreateConfig({ ...createConfig, police: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-900">
                      {FONTS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                    </select>
                    <PreviewCard config={createConfig} nom={createForm.nom} />
                    <div className="flex justify-between mt-6">
                      <Button variant="ghost" icon={ChevronLeft} onClick={() => setCreateStep(1)}>Précédent</Button>
                      <Button data-testid="btn-etape-suivante" variant="primary" icon={ArrowRight} onClick={() => setCreateStep(3)}>Suivant</Button>
                    </div>
                  </div>
                )}
                {createStep === 3 && (
                  <div className="rounded-xl p-6 bg-white border border-slate-200 shadow-sm">
                    <h2 className="text-lg font-semibold mb-4 text-slate-900">Compte gérant</h2>
                    <div className="flex flex-col sm:flex-row gap-4 mb-6">
                      <button onClick={() => setSkipStaffCreation(false)} className={`flex-1 p-4 rounded-lg border-2 text-left ${!skipStaffCreation ? 'border-green-600 bg-green-50' : 'border-slate-200 bg-white'}`}>
                        <p className="font-medium text-slate-900">Créer maintenant</p>
                      </button>
                      <button onClick={() => setSkipStaffCreation(true)} className={`flex-1 p-4 rounded-lg border-2 text-left ${skipStaffCreation ? 'border-green-600 bg-green-50' : 'border-slate-200 bg-white'}`}>
                        <p className="font-medium text-slate-900">Passer</p>
                      </button>
                    </div>
                    {!skipStaffCreation && (
                      <div className="space-y-4 mb-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div><label className="block text-sm font-medium mb-1 text-slate-700">Nom *</label><input data-testid="nom-gerant" type="text" value={createStaff.nom} onChange={(e) => setCreateStaff({ ...createStaff, nom: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-900" /></div>
                          <div><label className="block text-sm font-medium mb-1 text-slate-700">Prénom *</label><input data-testid="prenom-gerant" type="text" value={createStaff.prenom} onChange={(e) => setCreateStaff({ ...createStaff, prenom: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-900" /></div>
                        </div>
                        <div><label className="block text-sm font-medium mb-1 text-slate-700">Email *</label><input data-testid="email-gerant" type="email" value={createStaff.email} onChange={(e) => setCreateStaff({ ...createStaff, email: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-900" /></div>
                        <div><label className="block text-sm font-medium mb-1 text-slate-700">Rôle</label><select value={createStaff.role} onChange={(e) => setCreateStaff({ ...createStaff, role: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-900"><option value="directeur">Directeur</option><option value="admin">Admin</option></select></div>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <Button variant="ghost" icon={ChevronLeft} onClick={() => setCreateStep(2)}>Précédent</Button>
                      <Button data-testid="btn-creer-etablissement" variant="primary" icon={CheckCircle} onClick={handleCreateTenant} loading={loading} disabled={!skipStaffCreation && (!createStaff.nom || !createStaff.prenom || !createStaff.email)}>Créer</Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════════
            ONGLET 4 — AUDIT & TRAÇABILITÉ
           ═══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'audit' && (
          <div className="space-y-6">
            {/* Stats rapides */}
            {auditStats && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3 md:gap-4">
                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                  <p className="text-xs text-slate-500">Mouvements</p>
                  <p className="text-xl font-bold text-slate-900">{auditStats.totalMouvements?.toLocaleString('fr-FR') || 0}</p>
                </div>
                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                  <p className="text-xs text-slate-500">Paiements</p>
                  <p className="text-xl font-bold text-slate-900">{auditStats.totalPaiements?.toLocaleString('fr-FR') || 0}</p>
                </div>
                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                  <p className="text-xs text-slate-500">Inscriptions</p>
                  <p className="text-xl font-bold text-slate-900">{auditStats.totalInscriptions?.toLocaleString('fr-FR') || 0}</p>
                </div>
                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                  <p className="text-xs text-slate-500">Communications</p>
                  <p className="text-xl font-bold text-slate-900">{auditStats.totalCommunications?.toLocaleString('fr-FR') || 0}</p>
                </div>
                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                  <p className="text-xs text-slate-500">Inscriptions</p>
                  <p className="text-xl font-bold text-slate-900">{auditStats.totalInscriptions?.toLocaleString('fr-FR') || 0}</p>
                </div>
                <div
                  className="p-4 rounded-lg bg-green-50 border border-green-200 cursor-pointer hover:bg-green-100 transition-colors shadow-sm"
                  onClick={() => setShowSessionsDetails(!showSessionsDetails)}
                  title="Cliquer pour afficher les détails des sessions actives"
                >
                  <p className="text-xs text-green-700 font-medium flex items-center gap-1">
                    🟢 Connectés (Live)
                  </p>
                  <p className="text-xl font-bold text-green-900">{auditStats.activeSessionsCount || 0}</p>
                </div>
                <div className="p-4 rounded-lg bg-purple-50 border border-purple-200">
                  <p className="text-xs text-purple-700 font-medium">Actions admin</p>
                  <p className="text-xl font-bold text-purple-900">{auditStats.totalAuditLogs || 0}</p>
                </div>
              </div>
            )}

            {/* Détails des sessions actives (collapsible) */}
            {showSessionsDetails && auditStats?.activeSessionsDetails && (
              <div className="p-4 rounded-lg bg-white border border-green-200 shadow-sm space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <h3 className="text-sm font-semibold text-slate-800">Utilisateurs actuellement connectés ({auditStats.activeSessionsCount})</h3>
                  <button
                    onClick={() => setShowSessionsDetails(false)}
                    className="text-xs text-slate-400 hover:text-slate-600 font-medium"
                  >
                    Masquer
                  </button>
                </div>
                {auditStats.activeSessionsDetails.length === 0 ? (
                  <p className="text-xs text-slate-500 py-2">Aucun utilisateur connecté pour le moment.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-slate-500 border-b border-slate-100">
                          <th className="px-2 py-1.5 text-left font-medium">Nom complet</th>
                          <th className="px-2 py-1.5 text-left font-medium">Email</th>
                          <th className="px-2 py-1.5 text-left font-medium">Rôle</th>
                          <th className="px-2 py-1.5 text-left font-medium">Établissement</th>
                          <th className="px-2 py-1.5 text-left font-medium">Type</th>
                        </tr>
                      </thead>
                      <tbody>
                        {auditStats.activeSessionsDetails.map((user, i) => (
                          <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
                            <td className="px-2 py-1.5 font-medium text-slate-900">{user.name}</td>
                            <td className="px-2 py-1.5 text-slate-600">{user.email}</td>
                            <td className="px-2 py-1.5">
                              <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[10px] uppercase">
                                {user.role}
                              </span>
                            </td>
                            <td className="px-2 py-1.5 font-medium text-slate-700">{user.etablissement}</td>
                            <td className="px-2 py-1.5">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] ${user.type === 'Staff' ? 'bg-blue-50 text-blue-700 border border-blue-100' : 'bg-green-50 text-green-700 border border-green-100'}`}>
                                {user.type}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Filtres */}
            <div className="flex flex-col sm:flex-row lg:flex-row gap-3 p-4 rounded-lg bg-slate-50 border border-slate-200">
              <div className="flex-1">
                <SearchInput
                  value={auditSearch}
                  onChange={setAuditSearch}
                  placeholder="Rechercher par établissement, référence, action..."
                />
              </div>
              <select
                value={auditTenantFilter}
                onChange={(e) => { setAuditTenantFilter(e.target.value); setAuditPage(1); }}
                className="px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white text-slate-900"
              >
                <option value="">Tous les établissements</option>
                {tenants.map(t => (
                  <option key={t.id} value={t.id}>{t.nom}</option>
                ))}
              </select>
              <select
                value={auditTypeFilter}
                onChange={(e) => { setAuditTypeFilter(e.target.value); setAuditPage(1); }}
                className="px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white text-slate-900"
              >
                <option value="all">Tous les types d'opération</option>
                <option value="action_admin">Actions admin</option>
                <option value="session">Sessions (Connexions)</option>
                <option value="paiement">Paiements</option>
                <option value="inscription">Inscriptions</option>
                <option value="communication">Communications</option>
                <option value="note">Notes & Bulletins</option>
              </select>
              <input
                type="date"
                value={auditStartDate}
                onChange={(e) => { setAuditStartDate(e.target.value); setAuditPage(1); }}
                className="px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white text-slate-900"
                placeholder="Date début"
              />
              <input
                type="date"
                value={auditEndDate}
                onChange={(e) => { setAuditEndDate(e.target.value); setAuditPage(1); }}
                className="px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white text-slate-900"
                placeholder="Date fin"
              />
            </div>

            {/* Tableau */}
            <div className="rounded-lg border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="px-4 py-3 text-left font-medium text-slate-600">Date</th>
                      <th className="px-4 py-3 text-left font-medium text-slate-600">Établissement</th>
                      <th className="px-4 py-3 text-left font-medium text-slate-600">Type</th>
                      <th className="px-4 py-3 text-left font-medium text-slate-600">Entité</th>
                      <th className="px-4 py-3 text-left font-medium text-slate-600">Référence</th>
                      <th className="px-4 py-3 text-left font-medium text-slate-600">Qté</th>
                      <th className="px-4 py-3 text-left font-medium text-slate-600">Acteur</th>
                      <th className="px-4 py-3 text-left font-medium text-slate-600">Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLoading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <tr key={i} className="border-b border-slate-100">
                          <td colSpan={8}><div className="px-4 py-3"><div className="h-4 bg-slate-200 rounded animate-pulse w-full" /></div></td>
                        </tr>
                      ))
                    ) : auditLogs.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                          Aucune opération trouvée avec les filtres actuels.
                        </td>
                      </tr>
                    ) : (
                      auditLogs.map((log) => (
                        <tr key={log.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3 whitespace-nowrap text-slate-700">
                            {new Date(log.createdAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="font-medium text-slate-900">{log.tenant?.nom || '—'}</span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <Badge variant={log.color || 'neutral'}>
                              {log.type === 'action_admin' ? 'Admin' :
                               log.type === 'paiement' ? 'Paiement' :
                               log.type === 'inscription' ? 'Inscription' :
                               log.type === 'communication' ? 'Communication' :
                               log.type === 'note' ? 'Note' : log.type}
                            </Badge>
                            {log.subType && log.subType !== log.type && (
                              <span className="ml-1 text-xs text-slate-500">({log.subType})</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-slate-700 max-w-xs truncate" title={log.entity}>{log.entity || '—'}</td>
                          <td className="px-4 py-3 text-slate-600 font-mono text-xs">{log.reference || '—'}</td>
                          <td className="px-4 py-3 text-slate-700">{log.quantite ?? '—'}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                            {log.actor ? `${log.actor.prenom || ''} ${log.actor.nom || ''}`.trim() : '—'}
                          </td>
                          <td className="px-4 py-3 text-slate-600 max-w-xs truncate" title={log.note}>{log.note || '—'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {auditTotal > 50 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50">
                  <p className="text-xs text-slate-500">
                    Page {auditPage} sur {Math.ceil(auditTotal / 50)} — {auditTotal} résultats
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setAuditPage(p => Math.max(1, p - 1))}
                      disabled={auditPage <= 1 || auditLoading}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setAuditPage(p => p + 1)}
                      disabled={auditPage >= Math.ceil(auditTotal / 50) || auditLoading}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* MODALES */}
      <Modal open={editModalOpen} onClose={() => setEditModalOpen(false)} title="Modifier la établissement" footer={<><Button variant="ghost" onClick={() => setEditModalOpen(false)}>Annuler</Button><Button variant="primary" onClick={handleEditSubmit} loading={loading}>Sauvegarder</Button></>}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-slate-700">Nom</label>
            <input type="text" value={editForm.nom} onChange={(e) => setEditForm({ ...editForm, nom: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-900" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-slate-700">Slug</label>
            <input type="text" value={editForm.slug} disabled className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-100 text-slate-500" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-slate-700">Plan</label>
            <select value={editForm.plan} onChange={(e) => setEditForm({ ...editForm, plan: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-900">
              <option value="starter">Starter</option><option value="basique">Basique</option><option value="pro">Pro</option><option value="enterprise">Enterprise</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="actif" checked={editForm.actif} onChange={(e) => setEditForm({ ...editForm, actif: e.target.checked })} />
            <label htmlFor="actif" className="text-sm text-slate-700">Établissement actif</label>
          </div>
        </div>
      </Modal>

      <Modal open={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} title="Confirmer la suppression" size="sm" footer={<><Button variant="ghost" onClick={() => setDeleteModalOpen(false)}>Annuler</Button><Button variant="primary" onClick={handleDeleteTenant} loading={loading} className="bg-red-600 hover:bg-red-700">Supprimer</Button></>}>
        <p className="text-sm text-slate-700">Êtes-vous sûr de vouloir supprimer <strong>{tenantToDelete?.nom}</strong> ?<br />Cette action est irréversible.</p>
      </Modal>

      <Modal open={configModalOpen} onClose={() => setConfigModalOpen(false)} title={`Configurer — ${selectedTenant?.nom}`} size="lg" footer={<><Button variant="ghost" onClick={() => setConfigModalOpen(false)}>Annuler</Button><Button variant="primary" onClick={handleSaveConfig} loading={loading}>Sauvegarder</Button></>}>
        <div className="overflow-x-auto mb-4 pb-2 border-b border-slate-200">
          <div className="flex min-w-max gap-1">
            {['identity', 'appearance', 'modules', 'settings', 'access'].map((tab) => (
              <button key={tab} data-testid={tab === 'modules' ? 'tab-modules' : undefined} onClick={() => setConfigModalTab(tab)} className="px-3 py-1.5 text-sm rounded-md capitalize whitespace-nowrap" style={{ background: configModalTab === tab ? '#F1F5F9' : 'transparent', color: configModalTab === tab ? '#0F172A' : '#64748B' }}>
                {tab === 'identity' ? 'Identité' : tab === 'appearance' ? 'Apparence' : tab === 'modules' ? 'Modules' : tab === 'settings' ? 'Paramètres' : 'Accès'}
              </button>
            ))}
          </div>
        </div>
        {configModalTab === 'identity' && (
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            <div>
              <label className="block text-sm font-medium mb-1 text-slate-700">Nom de l&apos;application</label>
              <input type="text" value={tenantConfig.nomApp} onChange={(e) => setTenantConfig({ ...tenantConfig, nomApp: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-900" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-slate-700">Nom de l'établissement</label>
              <input type="text" value={tenantConfig.nom || ''} onChange={(e) => setTenantConfig({ ...tenantConfig, nom: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-900" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-slate-700">Slogan / Message d&apos;accueil</label>
              <input type="text" value={tenantConfig.messageAccueil || ''} onChange={(e) => setTenantConfig({ ...tenantConfig, messageAccueil: e.target.value })} placeholder="L'excellence éducative au service de votre avenir..." className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-900" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-slate-700">Description longue (À propos)</label>
              <textarea value={tenantConfig.descriptionAbout || ''} onChange={(e) => setTenantConfig({ ...tenantConfig, descriptionAbout: e.target.value })} rows={3} placeholder="Présentation officielle de l'établissement..." className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-900" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-slate-700">Nom du directeur</label>
              <input type="text" value={tenantConfig.nomDirecteur || ''} onChange={(e) => setTenantConfig({ ...tenantConfig, nomDirecteur: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-900" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-slate-700">Adresse</label>
              <textarea value={tenantConfig.adresse || ''} onChange={(e) => setTenantConfig({ ...tenantConfig, adresse: e.target.value })} rows={2} className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-900" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1 text-slate-700">Téléphone</label>
                <input type="text" value={tenantConfig.telephone || ''} onChange={(e) => setTenantConfig({ ...tenantConfig, telephone: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-900" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-slate-700">Email</label>
                <input type="email" value={tenantConfig.email || ''} onChange={(e) => setTenantConfig({ ...tenantConfig, email: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-900" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-slate-700">N° d&apos;agrément</label>
              <input type="text" value={tenantConfig.numeroAutorisation || ''} onChange={(e) => setTenantConfig({ ...tenantConfig, numeroAutorisation: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-900" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-slate-700">N° TVA</label>
              <input type="text" value={tenantConfig.numeroTVA || ''} onChange={(e) => setTenantConfig({ ...tenantConfig, numeroTVA: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-900" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1 text-slate-700">Année de création</label>
                <input type="number" value={tenantConfig.anneeCreation || ''} onChange={(e) => setTenantConfig({ ...tenantConfig, anneeCreation: e.target.value ? parseInt(e.target.value) : '' })} className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-900" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-slate-700">RCCM</label>
                <input type="text" value={tenantConfig.rccm || ''} onChange={(e) => setTenantConfig({ ...tenantConfig, rccm: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-900" />
              </div>
            </div>

            {/* Horaires d'ouverture */}
            <div className="pt-2">
              <label className="block text-sm font-semibold mb-3 text-slate-700">Horaires d&apos;ouverture</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {JOURS_SEMAINE_CONFIG.map((jour) => (
                  <div key={jour} className="flex items-center gap-2">
                    <span className="text-sm text-slate-600 capitalize w-20 shrink-0">{jour}</span>
                    <input
                      type="text"
                      value={tenantConfig.horaireOuverture?.[jour] || ''}
                      onChange={(e) => setTenantConfig({
                        ...tenantConfig,
                        horaireOuverture: { ...tenantConfig.horaireOuverture, [jour]: e.target.value },
                      })}
                      placeholder="8h-18h ou Fermé"
                      className="flex-1 px-2 py-1.5 text-sm rounded border border-slate-200 bg-slate-50 text-slate-900"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Réseaux sociaux & localisation */}
            <div className="pt-2">
              <label className="block text-sm font-semibold mb-3 text-slate-700">Réseaux sociaux & localisation</label>
              <div className="space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1 text-slate-500">URL Facebook</label>
                    <input type="text" value={tenantConfig.facebookUrl || ''} onChange={(e) => setTenantConfig({ ...tenantConfig, facebookUrl: e.target.value })} placeholder="https://facebook.com/..." className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-slate-50 text-slate-900" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1 text-slate-500">URL Instagram</label>
                    <input type="text" value={tenantConfig.instagramUrl || ''} onChange={(e) => setTenantConfig({ ...tenantConfig, instagramUrl: e.target.value })} placeholder="https://instagram.com/..." className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-slate-50 text-slate-900" />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1 text-slate-500">WhatsApp (URL ou numéro)</label>
                    <input type="text" value={tenantConfig.whatsappUrl || ''} onChange={(e) => setTenantConfig({ ...tenantConfig, whatsappUrl: e.target.value })} placeholder="https://wa.me/..." className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-slate-50 text-slate-900" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1 text-slate-500">Telegram</label>
                    <input type="text" value={tenantConfig.telegramUrl || ''} onChange={(e) => setTenantConfig({ ...tenantConfig, telegramUrl: e.target.value })} placeholder="https://t.me/..." className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-slate-50 text-slate-900" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1 text-slate-500">URL Google Maps</label>
                  <input type="text" value={tenantConfig.googleMapsUrl || ''} onChange={(e) => setTenantConfig({ ...tenantConfig, googleMapsUrl: e.target.value })} placeholder="https://maps.google.com/..." className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-slate-50 text-slate-900" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1 text-slate-500">Latitude</label>
                    <input type="number" step="any" value={tenantConfig.latitude || ''} onChange={(e) => setTenantConfig({ ...tenantConfig, latitude: e.target.value })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-slate-50 text-slate-900" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1 text-slate-500">Longitude</label>
                    <input type="number" step="any" value={tenantConfig.longitude || ''} onChange={(e) => setTenantConfig({ ...tenantConfig, longitude: e.target.value })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-slate-50 text-slate-900" />
                  </div>
                </div>
              </div>
            </div>

            {/* Logo upload */}
            <div className="pt-2">
              <label className="block text-sm font-semibold mb-2 text-slate-700">Logo</label>
              <div className="border-2 border-dashed rounded-lg p-6 text-center border-slate-300" onDragOver={(e) => e.preventDefault()} onDrop={handleLogoDrop}>
                {logoPreview ? (
                  <div className="relative inline-block">
                    <img src={logoPreview} alt="Logo" className="h-20" />
                    <button onClick={() => { setLogoFile(null); setLogoPreview(null); }} className="absolute -top-2 -right-2 p-1 rounded-full bg-red-100 text-red-600"><X className="h-3 w-3" /></button>
                  </div>
                ) : (
                  <><Upload className="h-8 w-8 mx-auto mb-2 text-slate-400" /><p className="text-sm text-slate-600">Glissez-déposez votre logo ici</p><p className="text-xs text-slate-400">JPG, PNG, WebP, SVG (max 2Mo)</p></>
                )}
              </div>
            </div>
          </div>
        )}
        {configModalTab === 'appearance' && (
          <div className="space-y-6">
            <PaletteSelector selected={PALETTES.find(p => p.primary === tenantConfig.couleurPrimaire)} onSelect={(p) => setTenantConfig({ ...tenantConfig, couleurPrimaire: p.primary, couleurSecondaire: p.second, couleurTexte: p.texte })} />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <ColorPicker label="Primaire" value={tenantConfig.couleurPrimaire} onChange={(v) => setTenantConfig({ ...tenantConfig, couleurPrimaire: v })} />
              <ColorPicker label="Secondaire" value={tenantConfig.couleurSecondaire} onChange={(v) => setTenantConfig({ ...tenantConfig, couleurSecondaire: v })} />
              <ColorPicker label="Texte" value={tenantConfig.couleurTexte} onChange={(v) => setTenantConfig({ ...tenantConfig, couleurTexte: v })} />
            </div>
            <select value={tenantConfig.police} onChange={(e) => setTenantConfig({ ...tenantConfig, police: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-900">
              {FONTS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>

            {/* Couleurs fonctionnelles */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <ColorPicker label="Alerte" value={tenantConfig.couleurAlerte} onChange={(v) => setTenantConfig({ ...tenantConfig, couleurAlerte: v })} />
              <ColorPicker label="Erreur" value={tenantConfig.couleurErreur} onChange={(v) => setTenantConfig({ ...tenantConfig, couleurErreur: v })} />
              <ColorPicker label="Succès" value={tenantConfig.couleurSucces} onChange={(v) => setTenantConfig({ ...tenantConfig, couleurSucces: v })} />
            </div>

            {/* Apparence avancée */}
            <div className="p-4 rounded-lg border border-slate-200 bg-slate-50 space-y-3">
              <h4 className="text-sm font-semibold text-slate-900">Options avancées</h4>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-700">Mode sombre par défaut</p>
                  <p className="text-xs text-slate-500">Le site public s'ouvre en mode sombre.</p>
                </div>
                <button
                  onClick={() => setTenantConfig({ ...tenantConfig, darkModeDefault: !tenantConfig.darkModeDefault })}
                  className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors"
                  style={{ background: tenantConfig.darkModeDefault ? '#16A34A' : '#CBD5E1' }}
                >
                  <span className="inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform" style={{ transform: tenantConfig.darkModeDefault ? 'translateX(18px)' : 'translateX(2px)' }} />
                </button>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1 text-slate-500">URL Favicon</label>
                <input type="text" value={tenantConfig.faviconUrl || ''} onChange={(e) => setTenantConfig({ ...tenantConfig, faviconUrl: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-900" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1 text-slate-500">URL Logo footer</label>
                <input type="text" value={tenantConfig.footerLogoUrl || ''} onChange={(e) => setTenantConfig({ ...tenantConfig, footerLogoUrl: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-900" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1 text-slate-500">URL Loader personnalisé (GIF/SVG)</label>
                <input type="text" value={tenantConfig.loaderUrl || ''} onChange={(e) => setTenantConfig({ ...tenantConfig, loaderUrl: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-900" />
              </div>
            </div>

            {/* Background Image Upload */}
            <div>
              <label className="block text-sm font-medium mb-2 text-slate-700">Image d'arrière-plan (pages publiques)</label>
              <div
                className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors hover:border-green-400"
                style={{ borderColor: tenantConfig.backgroundImageUrl ? '#16A34A' : '#E2E8F0' }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files[0];
                  if (file && file.size <= 5 * 1024 * 1024) {
                    const form = new FormData();
                    form.append('background', file);
                    axiosInstance.put(`/api/superadmin/tenants/${selectedTenant.id}/config/background`, form, { withCredentials: true })
                      .then(res => {
                        setTenantConfig({ ...tenantConfig, backgroundImageUrl: res.data.backgroundImageUrl });
                        toast.success('Image d\'arrière-plan mise à jour');
                      })
                      .catch(() => toast.error('Erreur upload image'));
                  } else {
                    toast.error('Le fichier doit faire moins de 5Mo');
                  }
                }}
                onClick={() => document.getElementById('background-input').click()}
              >
                <input
                  id="background-input"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file && file.size <= 5 * 1024 * 1024) {
                      const form = new FormData();
                      form.append('background', file);
                      axiosInstance.put(`/api/superadmin/tenants/${selectedTenant.id}/config/background`, form, { withCredentials: true })
                        .then(res => {
                          setTenantConfig({ ...tenantConfig, backgroundImageUrl: res.data.backgroundImageUrl });
                          toast.success('Image d\'arrière-plan mise à jour');
                        })
                        .catch(() => toast.error('Erreur upload image'));
                    } else {
                      toast.error('Le fichier doit faire moins de 5Mo');
                    }
                  }}
                />
                {tenantConfig.backgroundImageUrl ? (
                  <div className="space-y-3">
                    <img src={tenantConfig.backgroundImageUrl} alt="Background" className="w-full h-32 object-cover rounded-md" />
                    <p className="text-sm text-slate-600">Cliquez pour changer l'image</p>
                  </div>
                ) : (
                  <><Upload className="h-8 w-8 mx-auto mb-2 text-slate-400" /><p className="text-sm text-slate-600">Glissez-déposez votre image ici</p><p className="text-xs text-slate-400">JPG, PNG, WebP (max 5Mo)</p></>
                )}
              </div>
              {tenantConfig.backgroundImageUrl && (
                <button
                  onClick={() => {
                    setTenantConfig({ ...tenantConfig, backgroundImageUrl: null });
                    toast.success('Image d\'arrière-plan supprimée');
                  }}
                  className="mt-2 text-sm text-red-600 hover:text-red-700"
                >
                  Supprimer l'image
                </button>
              )}
            </div>

            {/* Hero Image Upload */}
            <div>
              <label className="block text-sm font-medium mb-2 text-slate-700">Image Hero (section principale)</label>
              <div
                className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors hover:border-green-400"
                style={{ borderColor: tenantConfig.heroImageUrl ? '#16A34A' : '#E2E8F0' }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files[0];
                  if (file && file.size <= 5 * 1024 * 1024) {
                    const form = new FormData();
                    form.append('hero', file);
                    axiosInstance.put(`/api/superadmin/tenants/${selectedTenant.id}/config/hero`, form, { withCredentials: true })
                      .then(res => {
                        setTenantConfig({ ...tenantConfig, heroImageUrl: res.data.heroImageUrl });
                        toast.success('Image Hero mise à jour');
                      })
                      .catch(() => toast.error('Erreur upload image'));
                  } else {
                    toast.error('Le fichier doit faire moins de 5Mo');
                  }
                }}
                onClick={() => document.getElementById('hero-input').click()}
              >
                <input
                  id="hero-input"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file && file.size <= 5 * 1024 * 1024) {
                      const form = new FormData();
                      form.append('hero', file);
                      axiosInstance.put(`/api/superadmin/tenants/${selectedTenant.id}/config/hero`, form, { withCredentials: true })
                        .then(res => {
                          setTenantConfig({ ...tenantConfig, heroImageUrl: res.data.heroImageUrl });
                          toast.success('Image Hero mise à jour');
                        })
                        .catch(() => toast.error('Erreur upload image'));
                    } else {
                      toast.error('Le fichier doit faire moins de 5Mo');
                    }
                  }}
                />
                {tenantConfig.heroImageUrl ? (
                  <div className="space-y-3">
                    <img src={tenantConfig.heroImageUrl} alt="Hero" className="w-full h-32 object-cover rounded-md" />
                    <p className="text-sm text-slate-600">Cliquez pour changer l'image</p>
                  </div>
                ) : (
                  <><Upload className="h-8 w-8 mx-auto mb-2 text-slate-400" /><p className="text-sm text-slate-600">Glissez-déposez votre image ici</p><p className="text-xs text-slate-400">JPG, PNG, WebP (max 5Mo)</p></>
                )}
              </div>
              {tenantConfig.heroImageUrl && (
                <button
                  onClick={() => {
                    setTenantConfig({ ...tenantConfig, heroImageUrl: null });
                    toast.success('Image Hero supprimée');
                  }}
                  className="mt-2 text-sm text-red-600 hover:text-red-700"
                >
                  Supprimer l'image
                </button>
              )}
            </div>

            {/* Features Image Upload */}
            <div>
              <label className="block text-sm font-medium mb-2 text-slate-700">Image Features (section fonctionnalités)</label>
              <div
                className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors hover:border-green-400"
                style={{ borderColor: tenantConfig.featuresImageUrl ? '#16A34A' : '#E2E8F0' }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files[0];
                  if (file && file.size <= 5 * 1024 * 1024) {
                    const form = new FormData();
                    form.append('features', file);
                    axiosInstance.put(`/api/superadmin/tenants/${selectedTenant.id}/config/features`, form, { withCredentials: true })
                      .then(res => {
                        setTenantConfig({ ...tenantConfig, featuresImageUrl: res.data.featuresImageUrl });
                        toast.success('Image Features mise à jour');
                      })
                      .catch(() => toast.error('Erreur upload image'));
                  } else {
                    toast.error('Le fichier doit faire moins de 5Mo');
                  }
                }}
                onClick={() => document.getElementById('features-input').click()}
              >
                <input
                  id="features-input"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file && file.size <= 5 * 1024 * 1024) {
                      const form = new FormData();
                      form.append('features', file);
                      axiosInstance.put(`/api/superadmin/tenants/${selectedTenant.id}/config/features`, form, { withCredentials: true })
                        .then(res => {
                          setTenantConfig({ ...tenantConfig, featuresImageUrl: res.data.featuresImageUrl });
                          toast.success('Image Features mise à jour');
                        })
                        .catch(() => toast.error('Erreur upload image'));
                    } else {
                      toast.error('Le fichier doit faire moins de 5Mo');
                    }
                  }}
                />
                {tenantConfig.featuresImageUrl ? (
                  <div className="space-y-3">
                    <img src={tenantConfig.featuresImageUrl} alt="Features" className="w-full h-32 object-cover rounded-md" />
                    <p className="text-sm text-slate-600">Cliquez pour changer l'image</p>
                  </div>
                ) : (
                  <><Upload className="h-8 w-8 mx-auto mb-2 text-slate-400" /><p className="text-sm text-slate-600">Glissez-déposez votre image ici</p><p className="text-xs text-slate-400">JPG, PNG, WebP (max 5Mo)</p></>
                )}
              </div>
              {tenantConfig.featuresImageUrl && (
                <button
                  onClick={() => {
                    setTenantConfig({ ...tenantConfig, featuresImageUrl: null });
                    toast.success('Image Features supprimée');
                  }}
                  className="mt-2 text-sm text-red-600 hover:text-red-700"
                >
                  Supprimer l'image
                </button>
              )}
            </div>

            {/* About Image Upload */}
            <div>
              <label className="block text-sm font-medium mb-2 text-slate-700">Image About (section à propos)</label>
              <div
                className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors hover:border-green-400"
                style={{ borderColor: tenantConfig.aboutImageUrl ? '#16A34A' : '#E2E8F0' }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files[0];
                  if (file && file.size <= 5 * 1024 * 1024) {
                    const form = new FormData();
                    form.append('about', file);
                    axiosInstance.put(`/api/superadmin/tenants/${selectedTenant.id}/config/about`, form, { withCredentials: true })
                      .then(res => {
                        setTenantConfig({ ...tenantConfig, aboutImageUrl: res.data.aboutImageUrl });
                        toast.success('Image About mise à jour');
                      })
                      .catch(() => toast.error('Erreur upload image'));
                  } else {
                    toast.error('Le fichier doit faire moins de 5Mo');
                  }
                }}
                onClick={() => document.getElementById('about-input').click()}
              >
                <input
                  id="about-input"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file && file.size <= 5 * 1024 * 1024) {
                      const form = new FormData();
                      form.append('about', file);
                      axiosInstance.put(`/api/superadmin/tenants/${selectedTenant.id}/config/about`, form, { withCredentials: true })
                        .then(res => {
                          setTenantConfig({ ...tenantConfig, aboutImageUrl: res.data.aboutImageUrl });
                          toast.success('Image About mise à jour');
                        })
                        .catch(() => toast.error('Erreur upload image'));
                    } else {
                      toast.error('Le fichier doit faire moins de 5Mo');
                    }
                  }}
                />
                {tenantConfig.aboutImageUrl ? (
                  <div className="space-y-3">
                    <img src={tenantConfig.aboutImageUrl} alt="About" className="w-full h-32 object-cover rounded-md" />
                    <p className="text-sm text-slate-600">Cliquez pour changer l'image</p>
                  </div>
                ) : (
                  <><Upload className="h-8 w-8 mx-auto mb-2 text-slate-400" /><p className="text-sm text-slate-600">Glissez-déposez votre image ici</p><p className="text-xs text-slate-400">JPG, PNG, WebP (max 5Mo)</p></>
                )}
              </div>
              {tenantConfig.aboutImageUrl && (
                <button
                  onClick={() => {
                    setTenantConfig({ ...tenantConfig, aboutImageUrl: null });
                    toast.success('Image About supprimée');
                  }}
                  className="mt-2 text-sm text-red-600 hover:text-red-700"
                >
                  Supprimer l'image
                </button>
              )}
            </div>

            {/* Hero Video Upload */}
            <div>
              <label className="block text-sm font-medium mb-2 text-slate-700">Vidéo Hero (section principale)</label>
              <div
                className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors hover:border-green-400"
                style={{ borderColor: tenantConfig.heroVideoUrl ? '#16A34A' : '#E2E8F0' }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files[0];
                  if (file && file.size <= 50 * 1024 * 1024) {
                    const form = new FormData();
                    form.append('hero-video', file);
                    axiosInstance.put(`/api/superadmin/tenants/${selectedTenant.id}/config/hero-video`, form, { withCredentials: true })
                      .then(res => {
                        setTenantConfig({ ...tenantConfig, heroVideoUrl: res.data.heroVideoUrl });
                        toast.success('Vidéo Hero mise à jour');
                      })
                      .catch(() => toast.error('Erreur upload vidéo'));
                  } else {
                    toast.error('Le fichier doit faire moins de 50Mo');
                  }
                }}
                onClick={() => document.getElementById('hero-video-input').click()}
              >
                <input
                  id="hero-video-input"
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file && file.size <= 50 * 1024 * 1024) {
                      const form = new FormData();
                      form.append('hero-video', file);
                      axiosInstance.put(`/api/superadmin/tenants/${selectedTenant.id}/config/hero-video`, form, { withCredentials: true })
                        .then(res => {
                          setTenantConfig({ ...tenantConfig, heroVideoUrl: res.data.heroVideoUrl });
                          toast.success('Vidéo Hero mise à jour');
                        })
                        .catch(() => toast.error('Erreur upload vidéo'));
                    } else {
                      toast.error('Le fichier doit faire moins de 50Mo');
                    }
                  }}
                />
                {tenantConfig.heroVideoUrl ? (
                  <div className="space-y-3">
                    <video src={tenantConfig.heroVideoUrl} controls className="w-full h-32 object-cover rounded-md" />
                    <p className="text-sm text-slate-600">Cliquez pour changer la vidéo</p>
                  </div>
                ) : (
                  <><Upload className="h-8 w-8 mx-auto mb-2 text-slate-400" /><p className="text-sm text-slate-600">Glissez-déposez votre vidéo ici</p><p className="text-xs text-slate-400">MP4, WebM, OGG, MOV (max 50Mo)</p></>
                )}
              </div>
              {tenantConfig.heroVideoUrl && (
                <button
                  onClick={() => {
                    setTenantConfig({ ...tenantConfig, heroVideoUrl: null });
                    toast.success('Vidéo Hero supprimée');
                  }}
                  className="mt-2 text-sm text-red-600 hover:text-red-700"
                >
                  Supprimer la vidéo
                </button>
              )}
            </div>

            {/* Features Video Upload */}
            <div>
              <label className="block text-sm font-medium mb-2 text-slate-700">Vidéo Features (section fonctionnalités)</label>
              <div
                className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors hover:border-green-400"
                style={{ borderColor: tenantConfig.featuresVideoUrl ? '#16A34A' : '#E2E8F0' }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files[0];
                  if (file && file.size <= 50 * 1024 * 1024) {
                    const form = new FormData();
                    form.append('features-video', file);
                    axiosInstance.put(`/api/superadmin/tenants/${selectedTenant.id}/config/features-video`, form, { withCredentials: true })
                      .then(res => {
                        setTenantConfig({ ...tenantConfig, featuresVideoUrl: res.data.featuresVideoUrl });
                        toast.success('Vidéo Features mise à jour');
                      })
                      .catch(() => toast.error('Erreur upload vidéo'));
                  } else {
                    toast.error('Le fichier doit faire moins de 50Mo');
                  }
                }}
                onClick={() => document.getElementById('features-video-input').click()}
              >
                <input
                  id="features-video-input"
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file && file.size <= 50 * 1024 * 1024) {
                      const form = new FormData();
                      form.append('features-video', file);
                      axiosInstance.put(`/api/superadmin/tenants/${selectedTenant.id}/config/features-video`, form, { withCredentials: true })
                        .then(res => {
                          setTenantConfig({ ...tenantConfig, featuresVideoUrl: res.data.featuresVideoUrl });
                          toast.success('Vidéo Features mise à jour');
                        })
                        .catch(() => toast.error('Erreur upload vidéo'));
                    } else {
                      toast.error('Le fichier doit faire moins de 50Mo');
                    }
                  }}
                />
                {tenantConfig.featuresVideoUrl ? (
                  <div className="space-y-3">
                    <video src={tenantConfig.featuresVideoUrl} controls className="w-full h-32 object-cover rounded-md" />
                    <p className="text-sm text-slate-600">Cliquez pour changer la vidéo</p>
                  </div>
                ) : (
                  <><Upload className="h-8 w-8 mx-auto mb-2 text-slate-400" /><p className="text-sm text-slate-600">Glissez-déposez votre vidéo ici</p><p className="text-xs text-slate-400">MP4, WebM, OGG, MOV (max 50Mo)</p></>
                )}
              </div>
              {tenantConfig.featuresVideoUrl && (
                <button
                  onClick={() => {
                    setTenantConfig({ ...tenantConfig, featuresVideoUrl: null });
                    toast.success('Vidéo Features supprimée');
                  }}
                  className="mt-2 text-sm text-red-600 hover:text-red-700"
                >
                  Supprimer la vidéo
                </button>
              )}
            </div>

            {/* About Video Upload */}
            <div>
              <label className="block text-sm font-medium mb-2 text-slate-700">Vidéo About (section à propos)</label>
              <div
                className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors hover:border-green-400"
                style={{ borderColor: tenantConfig.aboutVideoUrl ? '#16A34A' : '#E2E8F0' }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files[0];
                  if (file && file.size <= 50 * 1024 * 1024) {
                    const form = new FormData();
                    form.append('about-video', file);
                    axiosInstance.put(`/api/superadmin/tenants/${selectedTenant.id}/config/about-video`, form, { withCredentials: true })
                      .then(res => {
                        setTenantConfig({ ...tenantConfig, aboutVideoUrl: res.data.aboutVideoUrl });
                        toast.success('Vidéo About mise à jour');
                      })
                      .catch(() => toast.error('Erreur upload vidéo'));
                  } else {
                    toast.error('Le fichier doit faire moins de 50Mo');
                  }
                }}
                onClick={() => document.getElementById('about-video-input').click()}
              >
                <input
                  id="about-video-input"
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file && file.size <= 50 * 1024 * 1024) {
                      const form = new FormData();
                      form.append('about-video', file);
                      axiosInstance.put(`/api/superadmin/tenants/${selectedTenant.id}/config/about-video`, form, { withCredentials: true })
                        .then(res => {
                          setTenantConfig({ ...tenantConfig, aboutVideoUrl: res.data.aboutVideoUrl });
                          toast.success('Vidéo About mise à jour');
                        })
                        .catch(() => toast.error('Erreur upload vidéo'));
                    } else {
                      toast.error('Le fichier doit faire moins de 50Mo');
                    }
                  }}
                />
                {tenantConfig.aboutVideoUrl ? (
                  <div className="space-y-3">
                    <video src={tenantConfig.aboutVideoUrl} controls className="w-full h-32 object-cover rounded-md" />
                    <p className="text-sm text-slate-600">Cliquez pour changer la vidéo</p>
                  </div>
                ) : (
                  <><Upload className="h-8 w-8 mx-auto mb-2 text-slate-400" /><p className="text-sm text-slate-600">Glissez-déposez votre vidéo ici</p><p className="text-xs text-slate-400">MP4, WebM, OGG, MOV (max 50Mo)</p></>
                )}
              </div>
              {tenantConfig.aboutVideoUrl && (
                <button
                  onClick={() => {
                    setTenantConfig({ ...tenantConfig, aboutVideoUrl: null });
                    toast.success('Vidéo About supprimée');
                  }}
                  className="mt-2 text-sm text-red-600 hover:text-red-700"
                >
                  Supprimer la vidéo
                </button>
              )}
            </div>

            <PreviewCard config={tenantConfig} nom={selectedTenant?.nom} />
          </div>
        )}
        {configModalTab === 'modules' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 p-2 rounded-lg bg-blue-50 text-blue-700 text-xs">
              <Shield className="h-4 w-4" />
              <span>Plan actuel : <strong>{PLANS[selectedTenant?.plan]?.label || selectedTenant?.plan}</strong>. Les modules grisés nécessitent un plan supérieur. Les modules marqués d'un bouclier sont obligatoires.</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-96 overflow-y-auto">
              {MODULES_CONFIG.map((m) => (
                <ModuleToggle
                  key={m.key}
                  data-testid={`toggle-${m.key}`}
                  module={m}
                  tenantPlan={selectedTenant?.plan}
                  value={tenantConfig[m.key]}
                  onChange={(v) => setTenantConfig({ ...tenantConfig, [m.key]: v })}
                />
              ))}
            </div>
          </div>
        )}
        {configModalTab === 'settings' && (
          <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-1">
            {/* SEO */}
            <div className="p-4 rounded-lg border border-slate-200 bg-slate-50 space-y-3">
              <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-2"><Globe className="h-4 w-4" /> SEO & Réseaux sociaux</h4>
              <div>
                <label className="block text-xs font-medium mb-1 text-slate-500">Meta title</label>
                <input type="text" value={tenantConfig.metaTitle || ''} onChange={(e) => setTenantConfig({ ...tenantConfig, metaTitle: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-900" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1 text-slate-500">Meta description</label>
                <textarea value={tenantConfig.metaDescription || ''} onChange={(e) => setTenantConfig({ ...tenantConfig, metaDescription: e.target.value })} rows={2} className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-900" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1 text-slate-500">Mots-clés (séparés par des virgules)</label>
                <input type="text" value={tenantConfig.metaKeywords || ''} onChange={(e) => setTenantConfig({ ...tenantConfig, metaKeywords: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-900" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1 text-slate-500">URL OG image (partage réseaux)</label>
                <input type="text" value={tenantConfig.ogImageUrl || ''} onChange={(e) => setTenantConfig({ ...tenantConfig, ogImageUrl: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-900" />
              </div>
            </div>

            {/* Commerce */}
            <div className="p-4 rounded-lg border border-slate-200 bg-slate-50 space-y-3">
              <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-2"><ShoppingCart className="h-4 w-4" /> Commerce</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1 text-slate-500">Devise</label>
                  <select value={tenantConfig.devise} onChange={(e) => setTenantConfig({ ...tenantConfig, devise: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-900">
                    {DEVISES.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1 text-slate-500">Affichage des prix</label>
                  <select value={tenantConfig.modePrix} onChange={(e) => setTenantConfig({ ...tenantConfig, modePrix: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-900">
                    <option value="TTC">TTC</option>
                    <option value="HT">HT</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div><label className="block text-xs font-medium mb-1 text-slate-500">Taux TVA (%)</label><input type="number" value={tenantConfig.tauxTVA} onChange={(e) => setTenantConfig({ ...tenantConfig, tauxTVA: parseFloat(e.target.value) })} className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-900" /></div>
                <div><label className="block text-xs font-medium mb-1 text-slate-500">Année scolaire courante</label><input type="text" value={tenantConfig.anneeScolaire || ''} onChange={(e) => setTenantConfig({ ...tenantConfig, anneeScolaire: e.target.value })} placeholder="2025-2026" className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-900" /></div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1 text-slate-500">Modes de paiement acceptés</label>
                <div className="flex flex-wrap gap-2">
                  {['especes', 'mobile_money', 'carte', 'virement'].map((mode) => (
                    <label key={mode} className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-sm">
                      <input
                        type="checkbox"
                        checked={(tenantConfig.modesPaiement || []).includes(mode)}
                        onChange={(e) => {
                          const current = tenantConfig.modesPaiement || [];
                          const next = e.target.checked ? [...current, mode] : current.filter(m => m !== mode);
                          setTenantConfig({ ...tenantConfig, modesPaiement: next });
                        }}
                      />
                      {mode === 'especes' ? 'Espèces' : mode === 'mobile_money' ? 'Mobile Money' : mode === 'carte' ? 'Carte' : 'Virement'}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Année scolaire & alertes */}
            <div className="p-4 rounded-lg border border-slate-200 bg-slate-50 space-y-3">
              <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Alertes & Notifications</h4>
              <div>
                <label className="block text-xs font-medium mb-1 text-slate-500">Email de réception des alertes</label>
                <input type="email" value={tenantConfig.emailAlertes || ''} onChange={(e) => setTenantConfig({ ...tenantConfig, emailAlertes: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-900" />
              </div>
            </div>

            {/* Sécurité */}
            <div className="p-4 rounded-lg border border-slate-200 bg-slate-50 space-y-3">
              <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-2"><Shield className="h-4 w-4" /> Sécurité</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className="block text-xs font-medium mb-1 text-slate-500">Durée session (minutes)</label><input type="number" value={tenantConfig.dureeSessionMinutes} onChange={(e) => setTenantConfig({ ...tenantConfig, dureeSessionMinutes: parseInt(e.target.value) || 0 })} className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-900" /></div>
                <div className="flex items-center gap-2 pt-5">
                  <input id="forcer2fa" type="checkbox" checked={tenantConfig.forcer2FA} onChange={(e) => setTenantConfig({ ...tenantConfig, forcer2FA: e.target.checked })} />
                  <label htmlFor="forcer2fa" className="text-sm text-slate-700">Forcer la 2FA pour le staff</label>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1 text-slate-500">IP whitelist (séparées par virgule)</label>
                <input type="text" value={Array.isArray(tenantConfig.ipWhitelist) ? tenantConfig.ipWhitelist.join(', ') : ''} onChange={(e) => setTenantConfig({ ...tenantConfig, ipWhitelist: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-900" />
              </div>
            </div>

            {/* RGPD & Consentement */}
            <div className="p-4 rounded-lg border border-slate-200 bg-slate-50 space-y-3">
              <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-2"><Cookie className="h-4 w-4" /> RGPD & Consentement</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className="block text-xs font-medium mb-1 text-slate-500">URL politique de confidentialité</label><input type="text" value={tenantConfig.privacyPolicyUrl || ''} onChange={(e) => setTenantConfig({ ...tenantConfig, privacyPolicyUrl: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-900" placeholder="https://..." /></div>
                <div><label className="block text-xs font-medium mb-1 text-slate-500">URL conditions d'utilisation</label><input type="text" value={tenantConfig.termsOfServiceUrl || ''} onChange={(e) => setTenantConfig({ ...tenantConfig, termsOfServiceUrl: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-900" placeholder="https://..." /></div>
                <div><label className="block text-xs font-medium mb-1 text-slate-500">URL politique des cookies</label><input type="text" value={tenantConfig.cookiePolicyUrl || ''} onChange={(e) => setTenantConfig({ ...tenantConfig, cookiePolicyUrl: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-900" placeholder="https://..." /></div>
                <div className="flex items-center gap-2 pt-5">
                  <input id="cookieBannerEnabled" type="checkbox" checked={tenantConfig.cookieBannerEnabled} onChange={(e) => setTenantConfig({ ...tenantConfig, cookieBannerEnabled: e.target.checked })} />
                  <label htmlFor="cookieBannerEnabled" className="text-sm text-slate-700">Afficher la bannière de cookies</label>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1 text-slate-500">Texte personnalisé de la bannière</label>
                <textarea value={tenantConfig.cookieBannerText || ''} onChange={(e) => setTenantConfig({ ...tenantConfig, cookieBannerText: e.target.value })} rows={2} className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-900" />
              </div>
              <div className="flex items-center gap-2">
                <input id="analyticsEnabled" type="checkbox" checked={tenantConfig.analyticsEnabled} onChange={(e) => setTenantConfig({ ...tenantConfig, analyticsEnabled: e.target.checked })} />
                <label htmlFor="analyticsEnabled" className="text-sm text-slate-700">Activer les cookies analytiques par défaut (après consentement)</label>
              </div>
            </div>
          </div>
        )}
        {configModalTab === 'access' && <TenantAccessSection tenant={selectedTenant} />}
      </Modal>

      <Modal open={staffModalOpen} onClose={() => setStaffModalOpen(false)} title={`Créer gérant — ${selectedTenant?.nom}`} size="md" footer={<><Button variant="ghost" onClick={() => setStaffModalOpen(false)}>Fermer</Button>{!createdStaff && <Button variant="primary" onClick={handleCreateStaff} loading={loading}>Créer</Button>}</>}>
        {createdStaff ? (
          <div className="text-center space-y-4">
            <div className="w-12 h-12 rounded-full mx-auto flex items-center justify-center bg-green-100">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <h3 className="font-semibold text-slate-900">Compte créé avec succès !</h3>
            <div className="text-left p-4 rounded-lg bg-slate-50">
              <p className="text-sm text-slate-700">Email : {createdStaff.staff?.email || createdStaff.email}</p>
              {(createdStaff.motDePasseProvisoire || createdStaff.staff?.motDePasseProvisoire) && (
                <div className="mt-3">
                  <p className="text-xs text-slate-500 mb-1">Mot de passe provisoire :</p>
                  <div className="flex items-center justify-between p-2 rounded bg-white border border-slate-200">
                    <span className="font-mono text-sm text-slate-900">
                      {createdStaff.motDePasseProvisoire || createdStaff.staff?.motDePasseProvisoire}
                    </span>
                    <button 
                      onClick={() => copyToClipboard(createdStaff.motDePasseProvisoire || createdStaff.staff?.motDePasseProvisoire)} 
                      className="p-1.5 hover:bg-slate-100 rounded transition-colors"
                      title="Copier"
                    >
                      <Copy className="h-4 w-4 text-slate-500" />
                    </button>
                  </div>
                  <p className="text-xs mt-2 text-amber-600">⚠️ Notez ce mot de passe maintenant. Il ne sera plus affiché.</p>
                </div>
              )}
            </div>
            <Button variant="secondary" onClick={() => { setCreatedStaff(null); setStaffForm({ nom: '', prenom: '', email: '', role: 'directeur' }); }}>Créer un autre</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className="block text-sm font-medium mb-1 text-slate-700">Nom *</label><input type="text" value={staffForm.nom} onChange={(e) => setStaffForm({ ...staffForm, nom: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-900" /></div>
              <div><label className="block text-sm font-medium mb-1 text-slate-700">Prénom *</label><input type="text" value={staffForm.prenom} onChange={(e) => setStaffForm({ ...staffForm, prenom: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-900" /></div>
            </div>
            <div><label className="block text-sm font-medium mb-1 text-slate-700">Email *</label><input type="email" value={staffForm.email} onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-900" /></div>
            <div><label className="block text-sm font-medium mb-1 text-slate-700">Rôle</label><select value={staffForm.role} onChange={(e) => setStaffForm({ ...staffForm, role: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-900"><option value="directeur">Directeur</option><option value="admin">Admin</option></select></div>
          </div>
        )}
      </Modal>

      {/* ═════════════════════════════════════════════════════════════════════════════
          MODALE : LISTE DES GÉRANTS
         ═════════════════════════════════════════════════════════════════════════════ */}
      <Modal
        open={viewStaffModalOpen}
        onClose={() => setViewStaffModalOpen(false)}
        title={`Gérants — ${selectedTenant?.nom}`}
        size="lg"
        footer={<Button variant="ghost" onClick={() => setViewStaffModalOpen(false)}>Fermer</Button>}
      >
        <div className="space-y-4 max-h-96 overflow-y-auto">
          {staffList.length === 0 ? (
            <p className="text-center text-slate-500 py-4">Aucun gérant enregistré</p>
          ) : (
            staffList.map((staff) => (
              <div key={staff.id} className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-slate-900">{staff.prenom} {staff.nom}</p>
                    <p className="text-sm text-slate-600">{staff.email}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">{staff.role}</span>
                      {staff.actif ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">Actif</span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">Inactif</span>
                      )}
                      {staff.mustChangePassword && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">MDP à changer</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right text-xs text-slate-400">
                    Créé le {new Date(staff.createdAt).toLocaleDateString('fr-FR')}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </Modal>
    </div>
  );
};

export default SuperAdminPanel;
