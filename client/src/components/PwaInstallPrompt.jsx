/**
 * PwaInstallPrompt.jsx
 *
 * Bouton d'installation native Desktop / Mobile de GestSchool via PWA.
 * Permet d'installer l'application sur le bureau physique de l'école en 1 clic.
 */

import React, { useState, useEffect } from 'react';
import { Download, Monitor, Check } from 'lucide-react';

export default function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Vérifier si déjà en mode standalone (PWA installée)
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true) {
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
    if (outcome === 'accepted') {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  };

  if (isInstalled || !deferredPrompt) {
    return null;
  }

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
