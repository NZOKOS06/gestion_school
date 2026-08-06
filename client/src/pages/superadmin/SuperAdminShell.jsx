import { useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import SuperAdminPanel from './SuperAdminPanel';
import { SUPERADMIN_TABS, tabFromPathname } from './constants';

/**
 * Thin URL-synced wrapper around SuperAdminPanel.
 * Maps /super-admin/{tab} ↔ activeTab.
 * App.jsx can keep importing SuperAdminPanel directly — that export
 * also syncs with the URL; this shell is available for explicit routing.
 */
export default function SuperAdminShell() {
  const location = useLocation();
  const navigate = useNavigate();

  const activeTab = useMemo(
    () => tabFromPathname(location.pathname),
    [location.pathname]
  );

  const setActiveTab = useCallback((tab) => {
    const next = SUPERADMIN_TABS.includes(tab) ? tab : 'dashboard';
    navigate(`/super-admin/${next}`, { replace: false });
  }, [navigate]);

  return (
    <SuperAdminPanel activeTab={activeTab} setActiveTab={setActiveTab} />
  );
}
