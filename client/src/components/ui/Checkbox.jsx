import * as RadixCheckbox from '@radix-ui/react-checkbox';
import { Check } from 'lucide-react';

const Checkbox = ({ checked, onCheckedChange, disabled, id, label, className = '' }) => (
  <label
    htmlFor={id}
    className={`inline-flex items-center gap-2 cursor-pointer select-none ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
  >
    <RadixCheckbox.Root
      id={id}
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      className="h-4 w-4 shrink-0 rounded border flex items-center justify-center transition-colors data-[state=checked]:bg-[var(--color-primary)] data-[state=checked]:border-[var(--color-primary)]"
      style={{ borderColor: 'var(--border-default)', background: 'var(--surface-raised)' }}
    >
      <RadixCheckbox.Indicator>
        <Check className="h-3 w-3" style={{ color: 'var(--color-primary-fg)' }} strokeWidth={3} />
      </RadixCheckbox.Indicator>
    </RadixCheckbox.Root>
    {label && <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{label}</span>}
  </label>
);

export default Checkbox;
