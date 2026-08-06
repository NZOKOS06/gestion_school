import AppShell from './AppShell';
import { PARENT_NAV, PARENT_ROUTE_LABELS } from './navConfig';

const ParentLayout = () => (
  <AppShell
    navGroups={PARENT_NAV}
    routeLabels={PARENT_ROUTE_LABELS}
    homePath="/parent/dashboard"
    homeLabel="Parent"
    brandSubtitle="Espace parent"
    sidebarWidth={240}
    contentPadding="1.75rem"
    densityToggle={false}
  />
);

export default ParentLayout;
