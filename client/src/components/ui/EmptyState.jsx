import { Inbox } from 'lucide-react';

const EmptyState = ({
  icon: Icon = Inbox,
  title = 'Aucun résultat',
  description = 'Les données apparaîtront ici dès qu\'elles seront disponibles.',
  action,
  className = '',
}) => (
  <div className={`flex flex-col items-center justify-center py-14 px-6 text-center ${className}`}>
    <div
      className="h-14 w-14 rounded-2xl flex items-center justify-center mb-4"
      style={{ background: 'var(--surface-brand-soft)' }}
    >
      <Icon className="h-7 w-7" style={{ color: 'var(--color-primary)' }} strokeWidth={1.4} />
    </div>
    <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
      {title}
    </p>
    {description && (
      <p className="mt-1.5 text-[13px] max-w-sm" style={{ color: 'var(--text-muted)' }}>
        {description}
      </p>
    )}
    {action && <div className="mt-5">{action}</div>}
  </div>
);

export default EmptyState;
