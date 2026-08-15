import AppShell from './AppShell';
import { CAISSIER_NAV, CAISSIER_ROUTE_LABELS } from './navConfig';

const CaissierLayout = () => (
  <AppShell
    navGroups={CAISSIER_NAV}
    routeLabels={CAISSIER_ROUTE_LABELS}
    homePath="/caissier"
    homeLabel="Gestionnaire"
    brandSubtitle="Gestionnaire"
    sidebarWidth={240}
  />
);

export default CaissierLayout;
