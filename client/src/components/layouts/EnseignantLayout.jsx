import AppShell from './AppShell';
import { ENSEIGNANT_NAV, ENSEIGNANT_ROUTE_LABELS } from './navConfig';

const EnseignantLayout = () => (
  <AppShell
    navGroups={ENSEIGNANT_NAV}
    routeLabels={ENSEIGNANT_ROUTE_LABELS}
    homePath="/enseignant/dashboard"
    homeLabel="Enseignant"
    brandSubtitle="Espace enseignant"
    sidebarWidth={240}
    contentPadding="1.5rem"
  />
);

export default EnseignantLayout;
