import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@stores/authStore';

export default function SuperAdminGuard() {
  const { isAuthenticated, hydrated, session } = useAuthStore();
  const user = session?.user;

  if (!hydrated) return null;
  if (!isAuthenticated) return <Navigate to="/superadmin/login" replace />;
  if (user?.role !== 'superadmin') return <Navigate to="/superadmin/login" replace />;

  return <Outlet />;
}
