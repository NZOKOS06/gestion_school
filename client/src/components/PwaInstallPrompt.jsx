/**
 * PwaInstallPrompt.jsx
 *
 * Bouton d'installation native Desktop / Mobile de GestSchool via PWA.
 * Exports:
 *   - usePwaInstall()   → hook partagé
 *   - PwaNavButton      → bouton compact pour la barre de navigation (header)
 *   - default           → ancien composant flottant (conservé pour compatibilité)
 */

import React, { useState, useEffect } from 'react';
import { Download, Monitor } from 'lucide-react';

// ─── Hook partagé ───────────────────────────────────────────────────────────

export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    if (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true
    ) {
      setIsInstalled(true);
      return;
    }

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    });

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setIsInstalled(true);
    setDeferredPrompt(null);
  };

  return { deferredPrompt, isInstalled, handleInstall };
}

// ─── Bouton navbar compact ───────────────────────────────────────────────────
// Visible uniquement quand l'installation PWA est disponible

export function PwaNavButton() {
  const { deferredPrompt, isInstalled, handleInstall } = usePwaInstall();

  if (isInstalled || !deferredPrompt) return null;

  return (
    <button
      type="button"
      onClick={handleInstall}
      className="inline-flex items-center justify-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-semibold transition-all active:scale-95 shrink-0"
      style={{
        background: 'var(--color-primary)',
        color: 'var(--color-primary-fg)',
        boxShadow: '0 1px 4px rgba(0,0,0,0.18)',
      }}
      title="Installer GestSchool comme application (PWA)"
    >
      <Download className="w-3.5 h-3.5 shrink-0" />
      <span className="hidden sm:inline whitespace-nowrap">Installer l'app</span>
    </button>
  );
}

// ─── Composant flottant par défaut (non utilisé après intégration navbar) ───

export default function PwaInstallPrompt() {
  const { deferredPrompt, isInstalled, handleInstall } = usePwaInstall();

  if (isInstalled || !deferredPrompt) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-slate-900/95 backdrop-blur border border-slate-700 text-white p-3.5 rounded-xl shadow-2xl flex items-center space-x-3.5 max-w-md animate-in fade-in slide-in-from-bottom-4">
      <div className="bg-blue-600/30 p-2.5 rounded-lg text-blue-400 border border-blue-500/30">
        <Monitor className="w-5 h-5" />
      </div>
      <div className="flex-1 text-xs">
        <p className="font-semibold text-sm text-slate-100">Installer GestSchool sur ce PC</p>
        <p className="text-slate-400">Accès direct sur votre bureau avec mode hors-ligne activé.</p>
      </div>
      <button
        onClick={handleInstall}
        className="bg-blue-600 hover:bg-blue-500 text-white px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all shadow-md active:scale-95"
      >
        <Download className="w-4 h-4" />
        <span>Installer</span>
      </button>
    </div>
  );
}
