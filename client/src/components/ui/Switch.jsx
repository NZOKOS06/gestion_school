import * as RadixSwitch from '@radix-ui/react-switch';

const Switch = ({ checked, onCheckedChange, disabled, id, label, className = '' }) => (
  <label
    htmlFor={id}
    className={`inline-flex items-center gap-2.5 cursor-pointer select-none ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
  >
    <RadixSwitch.Root
      id={id}
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      className="w-10 h-5 rounded-full relative transition-colors data-[state=checked]:bg-[var(--color-primary)] outline-none"
      style={{ background: checked ? undefined : 'var(--border-default)' }}
    >
      <RadixSwitch.Thumb
        className="block h-4 w-4 rounded-full bg-white shadow transition-transform translate-x-0.5 data-[state=checked]:translate-x-[22px]"
      />
    </RadixSwitch.Root>
    {label && <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{label}</span>}
  </label>
);

export default Switch;
