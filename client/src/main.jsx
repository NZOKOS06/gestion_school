import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import * as Sentry from '@sentry/react';
import axios from 'axios';

import App from './App.jsx';
import './styles/index.css';

// Anti-FOUC : appliquer le thème sauvegardé avant le premier rendu
const savedTheme = localStorage.getItem('gestschool-theme')
  || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
if (savedTheme === 'dark') {
  document.documentElement.classList.add('dark');
}

// Désinscrire l'ancien service worker qui interceptait les requêtes API et causait des erreurs CORS
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => {
      registration.unregister().then(() => {
        console.log('[SW] Service worker désinscrit');
      }).catch((err) => {
        console.error('[SW] Échec de désinscription:', err);
      });
    });
  });
}

// Base URL API — production via env var, dev via proxy Vite
axios.defaults.baseURL = import.meta.env.VITE_API_URL || '';
axios.defaults.withCredentials = true;

// Initialisation Sentry React
if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    release: 'gestschool@1.0.0',
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: false,
        blockAllMedia: false,
      }),
    ],
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
  });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Sentry.ErrorBoundary
      fallback={({ error, resetError }) => (
        <div style={{
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          height: '100vh', gap: 16, fontFamily: 'sans-serif'
        }}>
          <h2>Une erreur inattendue est survenue</h2>
          <p style={{ color: '#666' }}>{error.message}</p>
          <button onClick={resetError}
            style={{ padding: '8px 16px', cursor: 'pointer' }}>
            Réessayer
          </button>
        </div>
      )}
    >
      <BrowserRouter>
        <App />
        <Toaster 
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: 'var(--surface-raised)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '12px',
              boxShadow: 'var(--shadow-dropdown)',
            },
            success: {
              duration: 3000,
              iconTheme: {
                primary: '#16a34a',
                secondary: '#fff',
              },
            },
            error: {
              duration: 4000,
              iconTheme: {
                primary: '#ef4444',
                secondary: '#fff',
              },
            },
          }}
        />
      </BrowserRouter>
    </Sentry.ErrorBoundary>
  </StrictMode>
);
