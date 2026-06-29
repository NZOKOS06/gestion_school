import { Link } from 'react-router-dom';
import { ThemeToggle } from '../../components/ui/ThemeToggle';

const NotFound = () => {
  return (
    <div
      className="relative"
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0f172a',
        textAlign: 'center',
        padding: '2rem',
      }}
    >
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <p
        style={{
          fontSize: 120,
          fontFamily: "'JetBrains Mono', 'Courier New', monospace",
          fontWeight: 700,
          lineHeight: 1,
          color: '#16a34a',
          margin: 0,
          letterSpacing: '-4px',
        }}
      >
        404
      </p>

      <h1
        style={{
          fontSize: 24,
          fontWeight: 600,
          color: '#f1f5f9',
          marginTop: '1.5rem',
          marginBottom: '0.75rem',
        }}
      >
        Page introuvable
      </h1>

      <p
        style={{
          fontSize: 15,
          color: '#94a3b8',
          marginBottom: '2.5rem',
          maxWidth: 380,
        }}
      >
        La page que vous cherchez n&apos;existe pas.
      </p>

      <Link
        to="/"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.625rem 1.5rem',
          background: '#16a34a',
          color: '#ffffff',
          borderRadius: 8,
          fontWeight: 600,
          fontSize: 14,
          textDecoration: 'none',
          transition: 'opacity 0.15s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.85'; }}
        onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
      >
        Retour à l&apos;accueil
      </Link>
    </div>
  );
};

export default NotFound;
