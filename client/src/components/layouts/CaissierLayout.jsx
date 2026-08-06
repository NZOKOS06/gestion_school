import AppShell from './AppShell';
import { CAISSIER_NAV, CAISSIER_ROUTE_LABELS } from './navConfig';

const CaissierLayout = () => (
  <AppShell
    navGroups={CAISSIER_NAV.map((g) => ({
      ...g,
      label: 'Caisse',
      items: g.items.map((item) => ({
        ...item,
        label:
          item.path === '/caissier'
            ? 'Caisse du jour'
            : item.path === '/caissier/retards'
              ? 'Retards'
              : 'Historique',
      })),
    }))}
    routeLabels={CAISSIER_ROUTE_LABELS}
    homePath="/caissier"
    homeLabel="Caisse"
    brandSubtitle="Gestionnaire"
    sidebarWidth={240}
  />
);

export default CaissierLayout;
