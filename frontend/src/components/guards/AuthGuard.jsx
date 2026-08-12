import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@stores/authStore';

export default function AuthGuard() {
  const { isAuthenticated, hydrated, session } = useAuthStore();
  const user = session?.user;

  if (!hydrated) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.banned) return <Navigate to="/banned" replace />;

  return <Outlet />;
}
