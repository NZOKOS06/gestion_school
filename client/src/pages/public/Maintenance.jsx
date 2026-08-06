import { useTenant } from '../../contexts/TenantContext';
import { Construction } from 'lucide-react';

const Maintenance = () => {
  const { config } = useTenant();
  const nom = config?.nomApp || config?.nom || 'GestSchool';

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--surface-base)' }}>
      <div className="text-center max-w-md">
        <div className="h-20 w-20 rounded-full flex items-center justify-center mx-auto mb-6" style={{ background: 'color-mix(in srgb, var(--color-primary) 12%, transparent)' }}>
          <Construction className="h-10 w-10" style={{ color: 'var(--color-primary)' }} />
        </div>
        <h1 className="text-2xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>{nom} est en maintenance</h1>
        <p className="text-base leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          Le site de cet établissement est temporairement indisponible. Veuillez réessayer plus tard.
        </p>
      </div>
    </div>
  );
};

export default Maintenance;
