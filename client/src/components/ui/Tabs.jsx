import * as RadixTabs from '@radix-ui/react-tabs';

const Tabs = ({ value, onValueChange, items = [], className = '', children }) => (
  <RadixTabs.Root value={value} onValueChange={onValueChange} className={className}>
    <RadixTabs.List
      className="inline-flex gap-1 p-1 rounded-lg"
      style={{ background: 'var(--surface-overlay)', border: '1px solid var(--border-subtle)' }}
    >
      {items.map((item) => (
        <RadixTabs.Trigger
          key={item.value}
          value={item.value}
          className="px-3 py-1.5 text-sm font-medium rounded-md transition-all data-[state=active]:shadow-sm"
          style={{
            color: value === item.value ? 'var(--color-primary)' : 'var(--text-secondary)',
            background: value === item.value ? 'var(--surface-raised)' : 'transparent',
          }}
        >
          {item.icon && <item.icon className="h-3.5 w-3.5 inline mr-1.5 -mt-0.5" />}
          {item.label}
        </RadixTabs.Trigger>
      ))}
    </RadixTabs.List>
    {children}
  </RadixTabs.Root>
);

const TabsContent = ({ value, children, className = '' }) => (
  <RadixTabs.Content value={value} className={`mt-4 outline-none ${className}`}>
    {children}
  </RadixTabs.Content>
);

export { TabsContent };
export default Tabs;
