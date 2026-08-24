/**
 * Grille KPI responsive — évite l’empilement pleine largeur sur mobile.
 * cols: nombre de KPI (défaut 4). Sur mobile toujours 2 colonnes.
 */
const COLS = {
  2: 'grid-cols-2',
  3: 'grid-cols-2 sm:grid-cols-3',
  4: 'grid-cols-2 lg:grid-cols-4',
  5: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5',
  6: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6',
};

const KpiGrid = ({ children, cols, className = '' }) => {
  const count = cols
    ?? (Array.isArray(children) ? children.filter(Boolean).length : 1);
  const clamped = Math.min(6, Math.max(2, count || 4));
  const grid = COLS[clamped] || COLS[4];

  return (
    <div className={`grid ${grid} gap-3 sm:gap-4 ${className}`}>
      {children}
    </div>
  );
};

export default KpiGrid;
