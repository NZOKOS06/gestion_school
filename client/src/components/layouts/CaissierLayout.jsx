import { useEffect, useMemo, useState } from 'react';
import AppShell from './AppShell';
import { CAISSIER_NAV, CAISSIER_ROUTE_LABELS } from './navConfig';
import { useTenant } from '../../contexts/TenantContext';
import { useAxios } from '../../hooks/useAxios';

const PAIE_PATH = '/caissier/paie';

/**
 * Espace gestionnaire. L'entrée « Paie » n'apparaît qu'une fois une période de paie
 * ouverte par le directeur ou le secrétaire (et jusqu'à son décaissement).
 */
const CaissierLayout = () => {
  const { isModuleActive } = useTenant();
  const { get } = useAxios();
  const [paieOuverte, setPaieOuverte] = useState(false);
  const paieActive = isModuleActive('paie');

  useEffect(() => {
    if (!paieActive) return undefined;
    let stop = false;
    const charger = () => get('/api/paie/prochaine', { silent: true })
      .then((res) => { if (!stop) setPaieOuverte((res?.periodesEnCours || []).length > 0); })
      .catch(() => {});
    charger();
    const timer = setInterval(charger, 5 * 60 * 1000);
    return () => {
      stop = true;
      clearInterval(timer);
    };
  }, [get, paieActive]);

  const navGroups = useMemo(
    () => CAISSIER_NAV.map((g) => ({ ...g, items: g.items.filter((i) => i.path !== PAIE_PATH || paieOuverte) })),
    [paieOuverte]
  );

  return (
    <AppShell
      navGroups={navGroups}
      routeLabels={CAISSIER_ROUTE_LABELS}
      homePath="/caissier"
      homeLabel="Gestionnaire"
      brandSubtitle="Gestionnaire"
      sidebarWidth={240}
    />
  );
};

export default CaissierLayout;
