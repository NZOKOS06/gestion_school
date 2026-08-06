/**
 * Tenant theme engine — derives a full CSS-variable palette from brand colors.
 * Used by TenantContext (live apply) and Configuration preview.
 */

const clamp = (n, min = 0, max = 255) => Math.min(max, Math.max(min, Math.round(n)));

export function parseHex(hex) {
  if (!hex || typeof hex !== 'string') return null;
  let h = hex.trim().replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

export function toHex({ r, g, b }) {
  return `#${[r, g, b].map((v) => clamp(v).toString(16).padStart(2, '0')).join('')}`;
}

function mix(a, b, t) {
  return {
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
  };
}

function relativeLuminance({ r, g, b }) {
  const lin = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

/** WCAG contrast-safe foreground for a background color */
export function contrastForeground(bgHex) {
  const rgb = parseHex(bgHex);
  if (!rgb) return '#ffffff';
  return relativeLuminance(rgb) > 0.45 ? '#0f172a' : '#ffffff';
}

function shadeScale(baseHex) {
  const base = parseHex(baseHex) || parseHex('#1e3a8a');
  const white = { r: 255, g: 255, b: 255 };
  const black = { r: 0, g: 0, b: 0 };
  return {
    50: toHex(mix(white, base, 0.08)),
    100: toHex(mix(white, base, 0.16)),
    200: toHex(mix(white, base, 0.3)),
    300: toHex(mix(white, base, 0.45)),
    400: toHex(mix(white, base, 0.65)),
    500: toHex(base),
    600: toHex(mix(base, black, 0.12)),
    700: toHex(mix(base, black, 0.24)),
    800: toHex(mix(base, black, 0.38)),
    900: toHex(mix(base, black, 0.52)),
  };
}

/**
 * @param {{ couleurPrimaire?: string, couleurSecondaire?: string, couleurTexte?: string, couleurAlerte?: string, couleurErreur?: string, couleurSucces?: string, police?: string, isDark?: boolean }} opts
 * @returns {Record<string, string>} CSS custom properties
 */
export function derivePalette(opts = {}) {
  const primary = opts.couleurPrimaire || '#1e3a8a';
  const secondary = opts.couleurSecondaire || '#0d9488';
  const alert = opts.couleurAlerte || '#f59e0b';
  const error = opts.couleurErreur || '#ef4444';
  const success = opts.couleurSucces || '#22c55e';
  const font = opts.police || 'Plus Jakarta Sans';
  const isDark = Boolean(opts.isDark);

  const scale = shadeScale(primary);
  const primaryFg = contrastForeground(primary);
  const brandSoft = isDark
    ? `color-mix(in srgb, ${primary} 18%, transparent)`
    : `color-mix(in srgb, ${primary} 10%, transparent)`;
  const brandMuted = isDark
    ? `color-mix(in srgb, ${primary} 28%, transparent)`
    : `color-mix(in srgb, ${primary} 16%, transparent)`;

  return {
    '--color-primary': primary,
    '--color-primary-fg': primaryFg,
    '--color-primary-50': scale[50],
    '--color-primary-100': scale[100],
    '--color-primary-200': scale[200],
    '--color-primary-300': scale[300],
    '--color-primary-400': scale[400],
    '--color-primary-500': scale[500],
    '--color-primary-600': scale[600],
    '--color-primary-700': scale[700],
    '--color-primary-800': scale[800],
    '--color-primary-900': scale[900],
    '--color-secondary': secondary,
    '--color-text': opts.couleurTexte || (isDark ? '#e6edf3' : '#1f2937'),
    '--color-alert': alert,
    '--color-warning': alert,
    '--color-error': error,
    '--color-danger': error,
    '--color-success': success,
    '--color-info': secondary,
    '--surface-brand-soft': brandSoft,
    '--surface-brand-muted': brandMuted,
    '--ring-primary': `color-mix(in srgb, ${primary} 28%, transparent)`,
    '--chart-1': primary,
    '--chart-2': secondary,
    '--chart-3': success,
    '--chart-4': alert,
    '--chart-5': scale[300],
    '--font-family': font,
    '--font-sans': `'${font}', system-ui, sans-serif`,
  };
}

/** Apply CSS variables to an element (default: documentElement) */
export function applyThemeVars(vars, el = typeof document !== 'undefined' ? document.documentElement : null) {
  if (!el || !vars) return;
  Object.entries(vars).forEach(([key, value]) => {
    if (value != null) el.style.setProperty(key, value);
  });
}

export const THEME_STORAGE_KEY = 'GestSchool-theme';
