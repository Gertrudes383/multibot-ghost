import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@stores/authStore';
import { loginRequest, registerRequest } from '@services/auth.service';

export function useAuth() {
  const navigate = useNavigate();
  const { session, isAuthenticated, hydrated, isValidatingSession, setSession, logout: storeLogout } = useAuthStore();
  const user = session?.user;

  const login = useCallback(async (credentials) => {
    const response = await loginRequest(credentials);
    setSession(response);
    navigate('/user');
  }, [setSession, navigate]);

  const register = useCallback(async (credentials) => {
    const response = await registerRequest(credentials);
    setSession(response);
    navigate('/user');
  }, [setSession, navigate]);

  const logout = useCallback(() => {
    storeLogout();
    navigate('/login');
  }, [storeLogout, navigate]);

  return {
    user,
    token: session?.token || null,
    isLoading: isValidatingSession,
    isAuthenticated,
    hydrated,
    login,
    register,
    logout,
    role: user?.role || null,
    isAdmin: user?.role === 'admin' || user?.role === 'owner',
    isSupport: user?.role === 'support',
    isBanned: user?.banned === true,
  };
}

export default useAuth;
