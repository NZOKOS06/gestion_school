import { Shield } from 'lucide-react';
import Badge from '../../components/ui/Badge';
import { PLANS, PALETTES, isModuleAvailableForPlan, getInitials } from './constants';

export const Avatar = ({ src, nom, size = 36 }) => (
  <div
    className="rounded-full flex items-center justify-center font-semibold text-white"
    style={{
      width: size,
      height: size,
      background: src ? 'transparent' : 'linear-gradient(135deg, var(--color-primary), var(--color-secondary, var(--color-primary)))',
      fontSize: size > 40 ? 16 : 12,
    }}
  >
    {src ? (
      <img src={src} alt={nom} className="w-full h-full rounded-full object-cover" />
    ) : (
      getInitials(nom)
    )}
  </div>
);

export const TabButton = ({ active, onClick, children, icon: Icon, 'data-testid': testId, ...rest }) => (
  <button
    data-testid={testId}
    onClick={onClick}
    className="flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all duration-150"
    style={{
      color: active ? 'var(--color-primary)' : 'var(--text-secondary)',
      borderBottom: active ? '2px solid var(--color-primary)' : '2px solid transparent',
    }}
    {...rest}
  >
    {Icon && <Icon className="h-4 w-4" />}
    {children}
  </button>
);

export const StatusBadge = ({ actif }) => (
  <Badge variant={actif ? 'success' : 'danger'} dot>
    {actif ? 'Actif' : 'Inactif'}
  </Badge>
);

export const PlanBadge = ({ plan }) => {
  const config = PLANS[plan] || PLANS.starter;
  return <Badge variant={config.color}>{config.label}</Badge>;
};

export const ModuleToggle = ({ module, value, onChange, onConfirm, tenantPlan, 'data-testid': testId }) => {
  const Icon = module.icon;
  const isLocked = module.locked;
  const available = isModuleAvailableForPlan(module.planMinimum, tenantPlan);

  const handleToggle = () => {
    if (isLocked || !available) return;
    if (value && onConfirm) {
      onConfirm(module, () => onChange(!value));
    } else {
      onChange(!value);
    }
  };

  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg ${!available ? 'opacity-60' : ''}`} style={{ background: 'var(--surface-overlay)' }}>
      <div
        className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: value ? 'color-mix(in srgb, var(--color-primary) 15%, transparent)' : 'var(--surface-hover)' }}
      >
        <Icon className="h-5 w-5" style={{ color: value ? 'var(--color-primary)' : 'var(--text-muted)' }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>
            {module.label}
            {isLocked && <Shield className="h-3 w-3 inline ml-1" style={{ color: 'var(--color-primary)' }} title="Obligatoire" />}
            {!available && <Badge variant="warning" className="ml-2 text-[10px] px-1.5 py-0">{module.planMinimum}+</Badge>}
          </span>
          <button
            data-testid={testId}
            role="switch"
            aria-checked={value}
            onClick={handleToggle}
            disabled={isLocked || !available}
            className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors"
            style={{
              background: value ? 'var(--color-primary)' : 'var(--border-default)',
              cursor: (isLocked || !available) ? 'not-allowed' : 'pointer',
              opacity: (isLocked || !available) ? 0.5 : 1,
            }}
          >
            <span
              className="inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform"
              style={{ transform: value ? 'translateX(18px)' : 'translateX(2px)' }}
            />
          </button>
        </div>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{module.desc}</p>
      </div>
    </div>
  );
};

export const ColorPicker = ({ label, value, onChange }) => (
  <div className="space-y-1.5">
    <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{label}</label>
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-9 rounded cursor-pointer border-0 p-0"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 px-3 py-1.5 text-sm rounded-md"
        style={{
          background: 'var(--surface-overlay)',
          border: '1px solid var(--border-subtle)',
          color: 'var(--text-primary)',
        }}
      />
    </div>
  </div>
);

export const PaletteSelector = ({ selected, onSelect }) => (
  <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
    {PALETTES.map((palette) => (
      <button
        key={palette.id}
        data-testid={`palette-${palette.id}`}
        onClick={() => onSelect(palette)}
        className="flex flex-col items-center gap-2 p-2 rounded-lg transition-all"
        style={{
          background: selected?.id === palette.id ? 'var(--surface-hover)' : 'transparent',
          border: selected?.id === palette.id ? '2px solid var(--color-primary)' : '2px solid transparent',
        }}
      >
        <div
          className="w-12 h-12 rounded-lg shadow-sm"
          style={{ background: `linear-gradient(135deg, ${palette.primary}, ${palette.second})` }}
        />
        <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{palette.label}</span>
      </button>
    ))}
  </div>
);

export const PreviewCard = ({ config, nom }) => (
  <div
    className="p-4 rounded-lg"
    style={{
      background: 'var(--surface-raised)',
      border: '1px solid var(--border-subtle)',
    }}
  >
    <p className="text-xs font-medium mb-3" style={{ color: 'var(--text-muted)' }}>Aperçu</p>
    <div className="space-y-3">
      <h4
        className="text-lg font-bold"
        style={{
          fontFamily: config.police || 'var(--font-sans)',
          color: 'var(--text-primary)',
        }}
      >
        {nom || 'Votre Établissement'}
      </h4>
      <div className="flex items-center gap-2">
        <button
          className="px-4 py-2 rounded-md text-sm font-medium text-white"
          style={{
            background: config.couleurPrimaire || '#16A34A',
            fontFamily: config.police || 'var(--font-sans)',
          }}
        >
          Bouton primaire
        </button>
        <span
          className="px-2 py-1 rounded text-xs font-medium"
          style={{
            background: `color-mix(in srgb, ${config.couleurPrimaire || '#16A34A'} 15%, transparent)`,
            color: config.couleurPrimaire || '#16A34A',
          }}
        >
          Badge
        </span>
      </div>
    </div>
  </div>
);
