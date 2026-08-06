import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  User,
  Mail,
  Phone,
  Shield,
  Building2,
  KeyRound,
  Pencil,
  X,
  Check,
  Clock,
  Calendar,
  Save,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useAxios } from '../../hooks/useAxios';
import { useI18n } from '../../contexts/I18nContext';
import { Button, Card, Badge, PageHeader } from '../../components/ui';

const ROLE_LABELS = {
  super_admin: 'Super Admin',
  directeur: 'Directeur',
  secretaire: 'Secrétaire',
  enseignant: 'Enseignant',
  surveillant: 'Surveillant',
  comptable: 'Comptable',
  parent: 'Parent',
};

const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const memberSince = (dateStr) => {
  if (!dateStr) return '-';
  const months = Math.floor((Date.now() - new Date(dateStr)) / 2592000000);
  if (months < 1) return 'ce mois';
  if (months < 12) return `${months} mois`;
  return `${Math.floor(months / 12)} an${Math.floor(months / 12) > 1 ? 's' : ''}`;
};

const Profil = () => {
  const { user, setUser } = useAuth();
  const { get, put, loading } = useAxios();
  const { t } = useI18n();
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    prenom: '',
    nom: '',
    email: '',
    telephone: '',
  });

  const initials = useMemo(
    () => `${profile?.prenom?.[0] ?? ''}${profile?.nom?.[0] ?? ''}`.toUpperCase(),
    [profile]
  );

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const data = await get('/api/staff/profile/me');
        setProfile(data);
        setFormData({
          prenom: data.prenom || '',
          nom: data.nom || '',
          email: data.email || '',
          telephone: data.telephone || '',
        });
      } catch (err) {
        // erreur déjà affichée par useAxios
      }
    };
    loadProfile();
  }, [get]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCancel = () => {
    setFormData({
      prenom: profile?.prenom || '',
      nom: profile?.nom || '',
      email: profile?.email || '',
      telephone: profile?.telephone || '',
    });
    setIsEditing(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!profile?.id) return;

    try {
      const updated = await put(`/api/staff/${profile.id}`, {
        prenom: formData.prenom.trim(),
        nom: formData.nom.trim(),
        email: formData.email.trim(),
        telephone: formData.telephone.trim(),
      });

      setProfile((prev) => ({ ...prev, ...updated }));
      setUser((prev) => (prev ? { ...prev, ...updated } : prev));
      setIsEditing(false);
      toast.success(t('profile_update_success'));
    } catch (err) {
      // erreur déjà affichée par useAxios
    }
  };

  if (!profile && !loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[var(--color-primary)]" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={t('profile_title')}
        subtitle={t('profile_subtitle')}
      />

      <div className="space-y-6">
        {/* Hero / Avatar */}
        <div
          className="flex flex-col sm:flex-row items-start sm:items-center gap-5 p-6 rounded-lg"
          style={{
            background: 'var(--surface-raised)',
            border: '1px solid var(--border-subtle)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <div
            className="h-20 w-20 rounded-full flex items-center justify-center text-2xl font-bold text-white shrink-0"
            style={{ background: 'var(--color-primary)' }}
          >
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-3 mb-1">
              <h2 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
                {profile?.prenom} {profile?.nom}
              </h2>
              <Badge variant="success" dot>
                {t('active')}
              </Badge>
            </div>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {profile?.email}
            </p>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
              {ROLE_LABELS[profile?.role] || profile?.role}
              {profile?.tenant?.nom && ` · ${profile.tenant.nom}`}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Informations personnelles */}
          <div className="lg:col-span-2">
            <Card
              title={t('personal_info')}
              subtitle={t('personal_info_desc')}
              icon={User}
              action={
                !isEditing && (
                  <Button variant="secondary" size="sm" icon={Pencil} onClick={() => setIsEditing(true)}>
                    {t('modify')}
                  </Button>
                )
              }
            >
              <form id="profile-form" onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                      {t('field_firstname')}
                    </label>
                    <input
                      type="text"
                      name="prenom"
                      value={formData.prenom}
                      onChange={handleChange}
                      disabled={!isEditing}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--color-primary)] disabled:bg-[var(--surface-hover)] disabled:cursor-not-allowed"
                      style={{ borderColor: 'var(--border-subtle)', background: isEditing ? 'var(--surface-raised)' : 'var(--surface-hover)' }}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                      {t('field_lastname')}
                    </label>
                    <input
                      type="text"
                      name="nom"
                      value={formData.nom}
                      onChange={handleChange}
                      disabled={!isEditing}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--color-primary)] disabled:bg-[var(--surface-hover)] disabled:cursor-not-allowed"
                      style={{ borderColor: 'var(--border-subtle)', background: isEditing ? 'var(--surface-raised)' : 'var(--surface-hover)' }}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                    {t('field_email')}
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--text-muted)' }} />
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      disabled={!isEditing}
                      className="w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--color-primary)] disabled:bg-[var(--surface-hover)] disabled:cursor-not-allowed"
                      style={{ borderColor: 'var(--border-subtle)', background: isEditing ? 'var(--surface-raised)' : 'var(--surface-hover)' }}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                    {t('field_phone')}
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--text-muted)' }} />
                    <input
                      type="tel"
                      name="telephone"
                      value={formData.telephone}
                      onChange={handleChange}
                      disabled={!isEditing}
                      className="w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--color-primary)] disabled:bg-[var(--surface-hover)] disabled:cursor-not-allowed"
                      style={{ borderColor: 'var(--border-subtle)', background: isEditing ? 'var(--surface-raised)' : 'var(--surface-hover)' }}
                    />
                  </div>
                </div>

                {isEditing && (
                  <div className="flex items-center justify-end gap-3 pt-2">
                    <Button variant="ghost" type="button" icon={X} onClick={handleCancel}>
                      {t('btn_cancel')}
                    </Button>
                    <Button type="submit" icon={Save} loading={loading}>
                      {t('btn_save')}
                    </Button>
                  </div>
                )}
              </form>
            </Card>
          </div>

          {/* Colonne latérale */}
          <div className="space-y-6">
            <Card title={t('account_info')} subtitle={t('account_info_desc')} icon={Shield}>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('role')}</span>
                  <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    {ROLE_LABELS[profile?.role] || profile?.role}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('status')}</span>
                  <Badge variant="success">{t('active')}</Badge>
                </div>
                <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
                  <Clock className="h-4 w-4" />
                  <span>{t('last_login')} : {formatDate(profile?.derniereConnexion)}</span>
                </div>
                <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
                  <Calendar className="h-4 w-4" />
                  <span>{t('member_since')} : {memberSince(profile?.createdAt)}</span>
                </div>
              </div>
            </Card>

            <Card title={t('pharmacy_info')} subtitle={t('pharmacy_info_desc')} icon={Building2}>
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    {profile?.tenant?.nom || '-'}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {profile?.tenant?.adresse || ''}
                  </p>
                </div>
                {profile?.tenant?.telephone && (
                  <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    <Phone className="h-4 w-4" />
                    {profile.tenant.telephone}
                  </div>
                )}
                {profile?.tenant?.email && (
                  <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    <Mail className="h-4 w-4" />
                    {profile.tenant.email}
                  </div>
                )}
              </div>
            </Card>

            <Card title={t('security')} subtitle={t('security_desc')} icon={KeyRound}>
              <Button
                variant="secondary"
                className="w-full"
                icon={KeyRound}
                onClick={() => navigate('/changer-mot-de-passe')}
              >
                {t('change_password')}
              </Button>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profil;
