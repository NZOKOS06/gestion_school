import { useEffect, useState, useRef } from 'react';
import { useAxios } from '../../hooks/useAxios';
import { useTenant } from '../../contexts/TenantContext';
import {
  PageHeader,
  Button,
  Badge,
  Modal
} from '../../components/ui';
import {
  Settings,
  Save,
  Upload,
  Image,
  Palette,
  Sliders,
  AlertTriangle,
  Check,
  Building2,
  GraduationCap,
  CalendarDays,
  Users,
  FileBarChart,
  ClipboardList,
  Wallet,
  BookOpen,
  FileText,
  Award,
  Gavel,
  Layers
} from 'lucide-react';
import toast from 'react-hot-toast';

const palettes = [
  { name: 'Émeraude Scolaire', primary: '#16A34A', secondary: '#0D9488' },
  { name: 'Bleu Académique', primary: '#2563EB', secondary: '#0EA5E9' },
  { name: 'Ardoise Pro', primary: '#0F172A', secondary: '#475569' },
  { name: 'Or Prestige', primary: '#B45309', secondary: '#D97706' },
  { name: 'Congo Vert', primary: '#15803D', secondary: '#166534' },
  { name: 'Nuit Professionnelle', primary: '#1E1B4B', secondary: '#4338CA' }
];

const polices = ['DM Sans', 'Inter', 'Poppins', 'Roboto'];

const devises = ['FCFA', 'XOF', 'USD', 'EUR', 'CDF'];

const moduleDefinitions = [
  { key: 'moduleEleves', label: 'Élèves', description: 'Inscriptions et dossiers élèves', icon: GraduationCap, locked: true },
  { key: 'moduleClasses', label: 'Classes', description: 'Classes, niveaux et cycles', icon: Building2, locked: true },
  { key: 'moduleMatieres', label: 'Matières', description: 'Matières et coefficients', icon: BookOpen },
  { key: 'moduleNotes', label: 'Notes & Bulletins', description: 'Saisie des notes et génération de bulletins', icon: FileText },
  { key: 'moduleEmploiDuTemps', label: 'Emploi du temps', description: 'Planification des cours', icon: CalendarDays },
  { key: 'moduleAbsences', label: 'Absences', description: 'Appel et suivi des absences', icon: ClipboardList },
  { key: 'moduleSanctions', label: 'Sanctions', description: 'Discipline et sanctions', icon: Gavel },
  { key: 'modulePaiements', label: 'Paiements', description: 'Scolarités et échéances', icon: Wallet },
  { key: 'moduleCertificats', label: 'Certificats', description: 'Attestations et certificats', icon: Award },
  { key: 'modulePersonnel', label: 'Personnel', description: 'Comptes et rôles', icon: Users },
  { key: 'moduleRapports', label: 'Rapports', description: 'Statistiques et analytics', icon: FileBarChart },
  { key: 'moduleActualites', label: 'Actualités', description: 'Publications et communication', icon: Layers }
];

const Configuration = () => {
  const { put, post, loading } = useAxios();
  const { config: tenantConfig, slug } = useTenant();
  const fileInputRef = useRef(null);

  const [activeTab, setActiveTab] = useState('identite');
  const [saving, setSaving] = useState(false);
  const [logoPreview, setLogoPreview] = useState('');
  const [logoFile, setLogoFile] = useState(null);

  // Confirmation module
  const [confirmModule, setConfirmModule] = useState(null);

  // Form state
  const [form, setForm] = useState({
    nomApp: 'GestSchool',
    nom: '',
    messageAccueil: '',
    adresse: '',
    telephone: '',
    email: '',
    numeroAutorisation: '',
    nomDirecteur: '',
    horaireOuverture: {},
    couleurPrimaire: '#16A34A',
    couleurSecondaire: '#0D9488',
    police: 'DM Sans',
    devise: 'FCFA',
    tauxTVA: 0,
    moduleEleves: true,
    moduleClasses: true,
    moduleMatieres: true,
    moduleNotes: true,
    moduleEmploiDuTemps: true,
    moduleAbsences: true,
    moduleSanctions: false,
    modulePaiements: true,
    moduleCertificats: true,
    modulePersonnel: true,
    moduleRapports: true,
    moduleActualites: false
  });

  useEffect(() => {
    if (tenantConfig) {
      setForm(prev => ({
        ...prev,
        ...tenantConfig
      }));
      if (tenantConfig.logoUrl) {
        setLogoPreview(tenantConfig.logoUrl);
      }
    }
  }, [tenantConfig]);

  const updateForm = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Veuillez sélectionner une image');
      return;
    }
    setLogoFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setLogoPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Upload logo first if changed
      if (logoFile) {
        const fd = new FormData();
        fd.append('logo', logoFile);
        await post(`/api/config/${slug}/logo`, fd);
      }

      // Update config
      const payload = {
        nomApp: form.nomApp,
        nom: form.nom,
        messageAccueil: form.messageAccueil,
        adresse: form.adresse,
        telephone: form.telephone,
        email: form.email,
        numeroAutorisation: form.numeroAutorisation,
        nomDirecteur: form.nomDirecteur,
        horaireOuverture: form.horaireOuverture,
        couleurPrimaire: form.couleurPrimaire,
        couleurSecondaire: form.couleurSecondaire,
        police: form.police,
        devise: form.devise,
        tauxTVA: parseFloat(form.tauxTVA) || 0,
        moduleEleves: form.moduleEleves,
        moduleClasses: form.moduleClasses,
        moduleMatieres: form.moduleMatieres,
        moduleNotes: form.moduleNotes,
        moduleEmploiDuTemps: form.moduleEmploiDuTemps,
        modulePresences: form.moduleAbsences,
        moduleSanctions: form.moduleSanctions,
        modulePaiements: form.modulePaiements,
        moduleCertificats: form.moduleCertificats,
        modulePersonnel: form.modulePersonnel,
        moduleRapports: form.moduleRapports,
      };

      await put(`/api/config/${slug}`, payload);
      toast.success('Configuration sauvegardée');

      // Refresh tenant context
      window.location.reload();
    } catch (error) {
      console.error('Save config error:', error);
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const handlePaletteClick = (palette) => {
    updateForm('couleurPrimaire', palette.primary);
    updateForm('couleurSecondaire', palette.secondary);
  };

  const handleModuleToggle = (mod) => {
    if (mod.locked) return;
    const currentValue = form[mod.key];
    if (currentValue) {
      // Désactivation : demander confirmation
      setConfirmModule(mod);
    } else {
      // Activation directe
      updateForm(mod.key, true);
    }
  };

  const confirmDisable = () => {
    if (confirmModule) {
      updateForm(confirmModule.key, false);
      setConfirmModule(null);
    }
  };

  const tabs = [
    { id: 'identite', label: 'Identité', icon: Building2 },
    { id: 'apparence', label: 'Apparence', icon: Palette },
    { id: 'operations', label: 'Paramètres opérationnels', icon: Sliders },
    { id: 'modules', label: 'Modules', icon: Layers }
  ];

  const jours = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];

  return (
    <div className="space-y-6 pb-24">
      <PageHeader
        title="Configuration"
        subtitle="Paramétrage de l identité, de l apparence et des modules de l établissement"
        icon={Settings}
      />

      {/* Onglets */}
      <div className="sticky top-0 z-30 bg-[var(--surface-hover)]/80 backdrop-blur-sm -mx-4 px-4 py-2">
        <div className="flex gap-1 bg-[var(--surface-raised)] rounded-xl p-1 shadow-sm border border-[var(--border-subtle)]">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all flex-1 justify-center ${
                  active
                    ? 'text-white shadow-sm'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'
                }`}
                style={active ? { backgroundColor: 'var(--color-primary)' } : {}}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* === ONGLET 1 : IDENTITÉ === */}
      {activeTab === 'identite' && (
        <div className="bg-[var(--surface-raised)] rounded-xl shadow-sm p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Nom de l application</label>
              <input
                type="text"
                value={form.nomApp}
                onChange={e => updateForm('nomApp', e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Nom de l'établissement</label>
              <input
                type="text"
                value={form.nom || ''}
                onChange={e => updateForm('nom', e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Slogan / Message d accueil</label>
              <input
                type="text"
                value={form.messageAccueil || ''}
                onChange={e => updateForm('messageAccueil', e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--color-primary)]"
                placeholder="L'excellence éducative au service de votre avenir..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Adresse</label>
              <textarea
                value={form.adresse || ''}
                onChange={e => updateForm('adresse', e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Téléphone</label>
                <input
                  type="text"
                  value={form.telephone || ''}
                  onChange={e => updateForm('telephone', e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--color-primary)]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Email</label>
                <input
                  type="email"
                  value={form.email || ''}
                  onChange={e => updateForm('email', e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--color-primary)]"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Numéro d'agrément</label>
              <input
                type="text"
                value={form.numeroAutorisation || ''}
                onChange={e => updateForm('numeroAutorisation', e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Nom du directeur</label>
              <input
                type="text"
                value={form.nomDirecteur || ''}
                onChange={e => updateForm('nomDirecteur', e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            </div>
          </div>

          {/* Horaires */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-3">Horaires d ouverture</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {jours.map(jour => (
                <div key={jour} className="flex items-center gap-2">
                  <span className="text-sm text-[var(--text-secondary)] capitalize w-20">{jour}</span>
                  <input
                    type="text"
                    value={form.horaireOuverture?.[jour] || ''}
                    onChange={e => updateForm('horaireOuverture', { ...form.horaireOuverture, [jour]: e.target.value })}
                    placeholder="8h-18h"
                    className="flex-1 px-2 py-1.5 border rounded text-sm focus:ring-1 focus:ring-[var(--color-primary)]"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Logo upload */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-3">Logo</label>
            <div className="flex items-center gap-4">
              <div className="h-24 w-24 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center bg-[var(--surface-hover)] overflow-hidden">
                {logoPreview ? (
                  <img src={logoPreview} alt="Logo preview" className="h-full w-full object-contain p-2" />
                ) : (
                  <Image className="h-8 w-8 text-[var(--text-muted)]" />
                )}
              </div>
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleLogoChange}
                  className="hidden"
                />
                <Button
                  variant="secondary"
                  icon={Upload}
                  onClick={() => fileInputRef.current?.click()}
                >
                  Choisir un logo
                </Button>
                <p className="text-xs text-[var(--text-muted)] mt-1">PNG, JPG ou SVG. Max 2 Mo.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* === ONGLET 2 : APPARENCE === */}
      {activeTab === 'apparence' && (
        <div className="space-y-6">
          <div className="bg-[var(--surface-raised)] rounded-xl shadow-sm p-6 space-y-6">
            {/* Palettes prédéfinies */}
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-3">Palettes prédéfinies</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {palettes.map(p => {
                  const active = form.couleurPrimaire === p.primary;
                  return (
                    <button
                      key={p.name}
                      onClick={() => handlePaletteClick(p)}
                      className={`relative p-3 rounded-xl border-2 transition-all text-left ${
                        active ? 'border-[var(--color-primary)] shadow-sm' : 'border-[var(--border-subtle)] hover:border-gray-300'
                      }`}
                    >
                      <div className="flex gap-1.5 mb-2">
                        <div className="h-6 w-6 rounded-full" style={{ backgroundColor: p.primary }} />
                        <div className="h-6 w-6 rounded-full" style={{ backgroundColor: p.secondary }} />
                      </div>
                      <p className="text-xs font-medium text-[var(--text-secondary)]">{p.name}</p>
                      {active && (
                        <div className="absolute top-2 right-2">
                          <Check className="h-4 w-4" style={{ color: p.primary }} />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Couleurs custom */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Couleur primaire</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={form.couleurPrimaire}
                    onChange={e => updateForm('couleurPrimaire', e.target.value)}
                    className="h-10 w-10 rounded-lg border cursor-pointer"
                  />
                  <input
                    type="text"
                    value={form.couleurPrimaire}
                    onChange={e => updateForm('couleurPrimaire', e.target.value)}
                    className="flex-1 px-3 py-2 border rounded-lg text-sm font-mono uppercase"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Couleur secondaire</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={form.couleurSecondaire}
                    onChange={e => updateForm('couleurSecondaire', e.target.value)}
                    className="h-10 w-10 rounded-lg border cursor-pointer"
                  />
                  <input
                    type="text"
                    value={form.couleurSecondaire}
                    onChange={e => updateForm('couleurSecondaire', e.target.value)}
                    className="flex-1 px-3 py-2 border rounded-lg text-sm font-mono uppercase"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Police</label>
                <select
                  value={form.police}
                  onChange={e => updateForm('police', e.target.value)}
                  className="w-full px-3 py-2.5 border rounded-lg bg-[var(--surface-raised)]"
                  style={{ fontFamily: form.police }}
                >
                  {polices.map(p => (
                    <option key={p} value={p} style={{ fontFamily: p }}>{p}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Preview live */}
          <div className="bg-[var(--surface-raised)] rounded-xl shadow-sm p-6">
            <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-4">Aperçu en direct</h3>
            <div className="border rounded-xl p-6 space-y-4" style={{ fontFamily: form.police }}>
              <div className="flex items-center gap-4">
                {logoPreview && (
                  <img src={logoPreview} alt="Logo" className="h-10 w-10 object-contain" />
                )}
                <div>
                  <h2 className="text-xl font-bold" style={{ color: form.couleurPrimaire }}>
                    {form.nomApp}
                  </h2>
                  {form.messageAccueil && (
                    <p className="text-sm" style={{ color: form.couleurSecondaire }}>{form.messageAccueil}</p>
                  )}
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  className="px-4 py-2 rounded-lg text-white text-sm font-medium"
                  style={{ backgroundColor: form.couleurPrimaire }}
                >
                  Bouton primaire
                </button>
                <button
                  className="px-4 py-2 rounded-lg text-white text-sm font-medium"
                  style={{ backgroundColor: form.couleurSecondaire }}
                >
                  Bouton secondaire
                </button>
              </div>
              <p className="text-sm text-[var(--text-secondary)]">
                Lorem ipsum dolor sit amet, consectetur adipiscing elit.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* === ONGLET 3 : PARAMÈTRES OPÉRATIONNELS === */}
      {activeTab === 'operations' && (
        <div className="bg-[var(--surface-raised)] rounded-xl shadow-sm p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Devise</label>
              <select
                value={form.devise}
                onChange={e => updateForm('devise', e.target.value)}
                className="w-full px-3 py-2 border rounded-lg bg-[var(--surface-raised)]"
              >
                {devises.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Taux TVA (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={form.tauxTVA}
                onChange={e => updateForm('tauxTVA', e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Année scolaire courante</label>
              <input
                type="text"
                value={form.anneeScolaire || ''}
                onChange={e => updateForm('anneeScolaire', e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
                placeholder="2025-2026"
              />
            </div>
          </div>
        </div>
      )}

      {/* === ONGLET 4 : MODULES === */}
      {activeTab === 'modules' && (
        <div className="bg-[var(--surface-raised)] rounded-xl shadow-sm p-6 space-y-4">
          <p className="text-sm text-[var(--text-muted)]">
            Activez ou désactivez les fonctionnalités SaaS disponibles pour votre établissement.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {moduleDefinitions.map(mod => {
              const Icon = mod.icon;
              const isActive = form[mod.key];
              return (
                <div
                  key={mod.key}
                  className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                    mod.locked ? 'bg-[var(--surface-hover)] border-[var(--border-subtle)]' : 'bg-[var(--surface-raised)] border-[var(--border-subtle)] hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                      isActive ? 'bg-[color-mix(in_srgb,#10B981_12%,transparent)] text-[#10B981]' : 'bg-[var(--surface-hover)] text-[var(--text-muted)]'
                    }`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-[var(--text-primary)]">{mod.label}</p>
                        {mod.locked && (
                          <Badge variant="info">Verrouillé</Badge>
                        )}
                      </div>
                      <p className="text-xs text-[var(--text-muted)]">{mod.description}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleModuleToggle(mod)}
                    disabled={mod.locked}
                    className={`relative h-7 w-12 rounded-full transition-colors ${
                      isActive ? 'bg-[var(--color-primary)]' : 'bg-gray-300'
                    } ${mod.locked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-[var(--surface-raised)] shadow transition-transform ${
                      isActive ? 'translate-x-5' : 'translate-x-0'
                    }`} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* === BOUTON SAUVEGARDER FLOTTANT === */}
      <div className="fixed bottom-6 right-6 z-40">
        <Button
          variant="primary"
          size="lg"
          icon={Save}
          loading={saving || loading}
          onClick={handleSave}
        >
          Sauvegarder
        </Button>
      </div>

      {/* === MODAL CONFIRMATION DÉSACTIVATION === */}
      <Modal
        open={!!confirmModule}
        onClose={() => setConfirmModule(null)}
        title={
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-[color-mix(in_srgb,#EF4444_12%,transparent)] flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-[#EF4444]" />
            </div>
            <span>Confirmer la désactivation</span>
          </div>
        }
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmModule(null)}>
              Annuler
            </Button>
            <Button variant="danger" onClick={confirmDisable}>
              Désactiver
            </Button>
          </>
        }
      >
        <p className="text-sm text-[var(--text-secondary)]">
          Désactiver <strong>{confirmModule?.label}</strong> masquera cette section pour tout le staff.
          Les données existantes ne seront pas supprimées.
        </p>
      </Modal>
    </div>
  );
};

export default Configuration;
