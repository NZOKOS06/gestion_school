import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { CalendarClock, Unlock } from 'lucide-react';
import { useAxios } from '../hooks/useAxios';
import { useAuth } from '../contexts/AuthContext';
import { useTenant } from '../contexts/TenantContext';
import Button from './ui/Button';

const ROLES_OUVERTURE = ['directeur', 'secretaire'];

/**
 * Rappel de paie : compte à rebours avant le jour de paie, puis bouton d'ouverture
 * de la paie du mois écoulé (directeur / secrétaire).
 * toujours : afficher même en dehors de la fenêtre de rappel (page Paie).
 */
export default function PaieRappel({ toujours = false, onOuverte }) {
  const { get, post } = useAxios();
  const { user } = useAuth();
  const { isModuleActive } = useTenant();
  const [info, setInfo] = useState(null);
  const [busy, setBusy] = useState(false);
  const paieActive = isModuleActive('paie') && ['directeur', 'secretaire', 'comptable'].includes(user?.role);
  const peutOuvrir = ROLES_OUVERTURE.includes(user?.role);

  const charger = useCallback(async () => {
    try {
      setInfo(await get('/api/paie/prochaine', { silent: true }));
    } catch {
      setInfo(null);
    }
  }, [get]);

  useEffect(() => { if (paieActive) charger(); }, [charger, paieActive]);

  if (!paieActive || !info) return null;
  if (info.dejaOuverte && !toujours) return null;
  if (!info.afficherRappel && !toujours) return null;

  const ouvrir = async () => {
    if (!window.confirm(`Ouvrir la paie de ${info.libelle} ? La gestionnaire pourra ensuite générer les fiches de paie.`)) return;
    setBusy(true);
    try {
      const periode = await post('/api/paie/periodes/ouvrir', {});
      toast.success(`Paie de ${info.libelle} ouverte`);
      await charger();
      onOuverte?.(periode);
    } catch { /* toast via useAxios */ }
    setBusy(false);
  };

  const dateOuverture = new Date(info.dateOuverture).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
  let message;
  if (info.dejaOuverte) {
    message = `La paie de ${info.libelle} est ouverte.`;
  } else if (info.ouvrable) {
    message = `La paie de ${info.libelle} peut être ouverte.`;
  } else {
    message = `Paie de ${info.libelle} : ouverture possible le ${dateOuverture} — dans ${info.joursRestants} jour${info.joursRestants > 1 ? 's' : ''}.`;
  }

  const urgent = info.ouvrable && !info.dejaOuverte;
  return (
    <div
      className="flex items-center gap-3 flex-wrap rounded-xl px-4 py-3 text-sm"
      style={{
        background: `color-mix(in srgb, var(${urgent ? '--color-warning' : '--color-primary'}) 10%, transparent)`,
        border: `1px solid color-mix(in srgb, var(${urgent ? '--color-warning' : '--color-primary'}) 30%, transparent)`,
        color: 'var(--text-primary)',
      }}
    >
      <CalendarClock className="h-5 w-5 shrink-0" />
      <span className="flex-1 min-w-[200px]">{message}</span>
      {urgent && peutOuvrir && (
        <Button size="sm" icon={Unlock} onClick={ouvrir} loading={busy}>Ouvrir la paie de {info.libelle}</Button>
      )}
      {urgent && !peutOuvrir && (
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>En attente d'ouverture par le directeur ou le secrétaire.</span>
      )}
    </div>
  );
}
