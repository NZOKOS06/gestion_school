import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import * as Sentry from '@sentry/react';
import axios from 'axios';

import App from './App.jsx';
import './styles/index.css';

// Anti-FOUC : clé unifiée GestSchool-theme (+ migration ancienne clé)
const savedTheme = localStorage.getItem('GestSchool-theme')
  || localStorage.getItem('gestschool-theme')
  || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
if (localStorage.getItem('gestschool-theme') && !localStorage.getItem('GestSchool-theme')) {
  localStorage.setItem('GestSchool-theme', localStorage.getItem('gestschool-theme'));
  localStorage.removeItem('gestschool-theme');
}
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
      fallback={({ error, resetError }) => {
        const isChunkError =
          error?.message?.includes('dynamically imported module') ||
          error?.message?.includes('Loading chunk') ||
          error?.message?.includes('Failed to fetch');

        return (
          <div style={{
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            height: '100vh', gap: 16, fontFamily: 'sans-serif',
            background: 'var(--surface-base, #0F172A)',
            color: 'var(--text-primary, #F8FAFC)',
            padding: 24, textAlign: 'center'
          }}>
            <h2 style={{ fontSize: 20, fontWeight: 600 }}>
              {isChunkError ? 'Mise à jour de l\'application disponible' : 'Une erreur inattendue est survenue'}
            </h2>
            <p style={{ color: 'var(--text-secondary, #94A3B8)', maxWidth: 480, fontSize: 14 }}>
              {isChunkError
                ? 'Une nouvelle version a été déployée. Veuillez actualiser la page.'
                : error.message}
            </p>
            <button
              onClick={() => {
                if (isChunkError) {
                  window.location.reload();
                } else {
                  resetError();
                }
              }}
              style={{
                padding: '10px 20px',
                cursor: 'pointer',
                background: 'var(--color-primary, #2563EB)',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 500,
                fontSize: 14
              }}
            >
              {isChunkError ? 'Actualiser la page' : 'Réessayer'}
            </button>
          </div>
        );
      }}
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
