import { Construction } from 'lucide-react';

const PagePlaceholder = ({ title, description }) => {
  return (
    <div className="space-y-8">
      <h1 className="text-[22px] font-semibold tracking-tight" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-sans)' }}>
        {title}
      </h1>
      <div
        className="rounded-xl p-12 flex flex-col items-center justify-center text-center"
        style={{
          background: 'var(--surface-raised)',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <div
          className="h-16 w-16 rounded-full flex items-center justify-center mb-4"
          style={{ background: 'color-mix(in srgb, var(--color-primary) 15%, transparent)' }}
        >
          <Construction className="h-8 w-8" style={{ color: 'var(--color-primary)' }} />
        </div>
        <h2 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
          Module en construction
        </h2>
        <p className="max-w-md" style={{ color: 'var(--text-muted)' }}>
          {description || 'Cette section sera bientôt disponible.'}
        </p>
      </div>
    </div>
  );
};

export default PagePlaceholder;
