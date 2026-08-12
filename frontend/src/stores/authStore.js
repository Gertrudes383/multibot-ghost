import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { validateSessionRequest, refreshTokenRequest, logoutRequest } from '../services/auth.service.js';
import { setRefreshHandler, setTokenGetter } from '../services/apiFetch.js';

const STORAGE_KEY = 'multibot:webapp:auth';

function hasSessionToken(session) {
  return Boolean(session?.token);
}

function buildSession(payload, fallbackToken = '') {
  const rawToken = String(payload?.token || fallbackToken || '').trim();
  const token = rawToken.replace(/^Bearer\s+/i, '').trim();

  if (!token) return null;

  return {
    authenticatedAt: new Date().toISOString(),
    token,
    refreshToken: String(payload?.refreshToken || '').trim() || null,
    user: payload?.user || null,
  };
}

function getPersistedSession(session) {
  if (!hasSessionToken(session)) return { session: null };
  return {
    session: {
      token: session.token,
      refreshToken: session.refreshToken || null,
    },
  };
}

export const useAuthStore = create(
  persist(
    (set, get) => ({
      session: null,
      isAuthenticated: false,
      hydrated: false,
      isValidatingSession: false,

      setSession: (payload, fallbackToken = '') => {
        const session = buildSession(payload, fallbackToken);
        set({
          session,
          hydrated: true,
          isAuthenticated: hasSessionToken(session),
          isValidatingSession: false,
        });
        return session;
      },

      patchSessionUser: (updates = {}) => {
        set((state) => {
          if (!state.session) return state;
          return {
            ...state,
            session: {
              ...state.session,
              user: { ...(state.session.user || {}), ...updates },
            },
          };
        });
      },

      logout: () => {
        const refreshToken = get().session?.refreshToken;
        if (refreshToken) {
          logoutRequest({ refreshToken }).catch(() => {});
        }
        set({ session: null, isAuthenticated: false, isValidatingSession: false, hydrated: true });
      },

      refreshSession: async () => {
        const session = get().session;
        const refreshToken = session?.refreshToken;
        if (!refreshToken) return false;

        try {
          const response = await refreshTokenRequest({ refreshToken });
          const newSession = buildSession(response);
          if (!newSession) return false;

          set({
            session: newSession,
            hydrated: true,
            isAuthenticated: true,
            isValidatingSession: false,
          });
          return newSession.token;
        } catch {
          set({
            session: null,
            hydrated: true,
            isAuthenticated: false,
            isValidatingSession: false,
          });
          return false;
        }
      },

      validatePersistedSession: async () => {
        const session = get().session;

        if (!hasSessionToken(session)) {
          set({ session: null, hydrated: true, isAuthenticated: false, isValidatingSession: false });
          return false;
        }

        set({ isValidatingSession: true, hydrated: false });

        try {
          const response = await validateSessionRequest({ token: session.token });
          const isValid = Boolean(response?.valid);

          if (!isValid) throw new Error('Sessao invalida.');

          set({
            session: {
              ...session,
              user: response?.user || session.user || null,
            },
            hydrated: true,
            isAuthenticated: true,
            isValidatingSession: false,
          });
          return true;
        } catch (err) {
          if ((err?.status === 401 || err?.status === 404) && session?.refreshToken) {
            return get().refreshSession();
          }

          set({ session: null, hydrated: true, isAuthenticated: false, isValidatingSession: false });
          return false;
        }
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => getPersistedSession(state.session),
      onRehydrateStorage: () => (state) => {
        state?.validatePersistedSession?.();
      },
    },
  ),
);

setRefreshHandler(() => {
  const store = useAuthStore.getState();
  return store.refreshSession();
});

setTokenGetter(() => useAuthStore.getState().session?.token || '');
