import AppShell from './AppShell';
import { ADMIN_NAV, ADMIN_ROUTE_LABELS } from './navConfig';
import { useTenant } from '../../contexts/TenantContext';

const AdminLayout = () => {
  const { config } = useTenant();
  return (
    <AppShell
      navGroups={ADMIN_NAV}
      routeLabels={ADMIN_ROUTE_LABELS}
      homePath="/admin/dashboard"
      homeLabel={config?.nomEcole || 'GestSchool'}
      brandSubtitle="Administration"
      sidebarWidth={256}
      profilePath="/admin/profil"
    />
  );
};

export default AdminLayout;
