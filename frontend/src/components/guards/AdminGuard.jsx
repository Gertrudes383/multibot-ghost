import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@stores/authStore';

export default function AdminGuard() {
  const { isAuthenticated, hydrated, session } = useAuthStore();
  const user = session?.user;

  if (!hydrated) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.banned) return <Navigate to="/banned" replace />;
  if (user?.role === 'support') return <Navigate to="/assistant" replace />;
  if (user?.role !== 'admin' && user?.role !== 'owner') return <Navigate to="/user" replace />;

  return <Outlet />;
}
