import { CYCLES_ENSEIGNEMENT, CYCLE_LABELS } from '../../constants/cycles.js';

/** Sélecteur cycles proposés par l'établissement (super-admin). */
export default function CyclesSelector({ value, onChange }) {
  const selected = value?.length ? value : [...CYCLES_ENSEIGNEMENT];

  const toggle = (cycle) => {
    const next = new Set(selected);
    if (next.has(cycle)) {
      if (next.size <= 1) return;
      next.delete(cycle);
    } else {
      next.add(cycle);
    }
    onChange(CYCLES_ENSEIGNEMENT.filter((c) => next.has(c)));
  };

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500">
        Cochez les cycles que l&apos;établissement propose. Seuls les niveaux correspondants seront proposés à la création des classes (ex. CP–CM2 si primaire seul).
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {CYCLES_ENSEIGNEMENT.map((cycle) => (
          <label
            key={cycle}
            className="flex items-center gap-2 p-3 rounded-lg border border-slate-200 bg-white cursor-pointer hover:border-green-400 transition-colors"
          >
            <input
              type="checkbox"
              checked={selected.includes(cycle)}
              onChange={() => toggle(cycle)}
              className="rounded border-slate-300 text-green-600 focus:ring-green-500"
            />
            <span className="text-sm font-medium text-slate-800">{CYCLE_LABELS[cycle]}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
