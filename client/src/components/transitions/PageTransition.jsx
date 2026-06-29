import { useLocation, Outlet } from 'react-router-dom';

const PageTransition = () => {
  const { pathname } = useLocation();
  return (
    <div key={pathname} className="page-transition-enter" style={{ height: '100%' }}>
      <Outlet />
    </div>
  );
};

export default PageTransition;
