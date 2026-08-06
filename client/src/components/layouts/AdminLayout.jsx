import AppShell from './AppShell';
import { ADMIN_NAV, ADMIN_ROUTE_LABELS } from './navConfig';

const AdminLayout = () => (
  <AppShell
    navGroups={ADMIN_NAV}
    routeLabels={ADMIN_ROUTE_LABELS}
    homePath="/admin/dashboard"
    homeLabel="GestSchool"
    brandSubtitle="Administration"
    sidebarWidth={256}
    profilePath="/admin/profil"
  />
);

export default AdminLayout;
