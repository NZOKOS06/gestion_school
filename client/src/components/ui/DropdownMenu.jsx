import * as Dropdown from '@radix-ui/react-dropdown-menu';

const DropdownMenu = ({ trigger, children, align = 'end', sideOffset = 6 }) => (
  <Dropdown.Root>
    <Dropdown.Trigger asChild>{trigger}</Dropdown.Trigger>
    <Dropdown.Portal>
      <Dropdown.Content
        align={align}
        sideOffset={sideOffset}
        className="z-50 min-w-[180px] rounded-lg p-1 shadow-dropdown animate-modal-enter"
        style={{
          background: 'var(--surface-raised)',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-dropdown)',
        }}
      >
        {children}
      </Dropdown.Content>
    </Dropdown.Portal>
  </Dropdown.Root>
);

const DropdownItem = ({ children, onSelect, danger, icon: Icon, disabled, className = '' }) => (
  <Dropdown.Item
    disabled={disabled}
    onSelect={onSelect}
    className={`flex items-center gap-2 px-2.5 py-2 text-sm rounded-md outline-none cursor-pointer transition-colors data-[disabled]:opacity-40 data-[highlighted]:bg-[var(--surface-hover)] ${className}`}
    style={{ color: danger ? 'var(--color-danger)' : 'var(--text-primary)' }}
  >
    {Icon && <Icon className="h-4 w-4 shrink-0" />}
    {children}
  </Dropdown.Item>
);

const DropdownSeparator = () => (
  <Dropdown.Separator className="my-1 h-px" style={{ background: 'var(--border-subtle)' }} />
);

const DropdownLabel = ({ children }) => (
  <Dropdown.Label className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
    {children}
  </Dropdown.Label>
);

export { DropdownItem, DropdownSeparator, DropdownLabel };
export default DropdownMenu;
