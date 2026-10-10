
'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import api, { refreshSession } from '@/lib/api';
import type { User, Role, Branch } from '@prisma/client';
import { ensureCsrfToken } from '@/lib/csrf-client';
import { navItems } from '@/components/main-nav';

interface UserWithRole extends User {
  role: Role & { permissions?: string[] };
  branch?: Branch | null;
  isGuest?: boolean;
}

interface AuthContextType {
  user: UserWithRole | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  hasPermission: (permission: string) => boolean;
  login: (data: any) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Importing csrf-client also installs the fetch wrapper that adds X-CSRF-Token to
// Server Action and other same-origin state-changing requests (AuthProvider is in the root layout).
export { ensureCsrfToken } from '@/lib/csrf-client';

/**
 * Where to go after signing in: the `next` page the middleware recorded when it redirected
 * to /login, if it is a same-site path (never `//host` or `/\host`, which would leave the site).
 */
export function postLoginPath(): string {
  if (typeof window === 'undefined') return '/dashboard';
  const next = new URLSearchParams(window.location.search).get('next') ?? '';
  const isLocalPath = next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\');
  return isLocalPath ? next : '/dashboard';
}

const IDLE_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

/** Session cookie state computed by the root layout (see sessionState in src/app/layout.tsx). */
export type SessionState = 'none' | 'active' | 'expired';

/**
 * `session`: without a session cookie there is nothing to restore, so no API call is made;
 * with an expired access token the session is refreshed first instead of failing /me with 401.
 */
export function AuthProvider({ children, session = 'active' }: { children: ReactNode; session?: SessionState }) {
  const [user, setUser] = useState<UserWithRole | null>(null);
  // Known up front when there is no session, so server and client render the same
  // "signed out" state and no update races hydration.
  const [isLoading, setIsLoading] = useState(session !== 'none');
  const router = useRouter();
  const { toast } = useToast();
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);

  const logout = useCallback(async (options: { reason?: string; silent?: boolean } = {}) => {
    const { reason, silent = false } = options;
    const wasAuthenticated = !!user;
    
    setUser(null);

    try {
        await ensureCsrfToken().catch(() => {});
        await api.post('/api/auth/logout');
    } catch (error) {
        console.error("Logout API call failed, but user is logged out on client.", error);
    } finally {
        if (wasAuthenticated && !silent) {
            toast({ title: 'Logged Out', description: reason || 'You have been successfully logged out.' });
            window.location.href = '/login';
        } else if (wasAuthenticated) {
            window.location.href = '/login';
        }
    }
   
  }, [toast, user]);

  const resetIdleTimer = useCallback(() => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
    }
    idleTimerRef.current = setTimeout(() => {
      logout({ reason: 'Your session has expired due to inactivity.' });
    }, IDLE_TIMEOUT_MS);
  }, [logout]);

  useEffect(() => {
    if (user && !isLoading) {
      const activityEvents = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
      
      const handleActivity = () => {
        resetIdleTimer();
      };
      
      activityEvents.forEach(event => {
        window.addEventListener(event, handleActivity);
      });
      
      resetIdleTimer();

      return () => {
        activityEvents.forEach(event => {
          window.removeEventListener(event, handleActivity);
        });
        if (idleTimerRef.current) {
          clearTimeout(idleTimerRef.current);
        }
      };
    }
  }, [user, isLoading, resetIdleTimer]);
  
  const refreshUser = useCallback(async () => {
    try {
      const { data } = await api.get('/api/auth/me');
      if (!data.user) {
        throw new Error('No user data in response');
      }
      setUser(data.user);
    } catch (error) {
      setUser(null);
    }
  }, []);


  useEffect(() => {
    async function initializeAuth() {
        if (session === 'none') return;
        try {
            await ensureCsrfToken().catch(() => {});
            if (session === 'expired') await refreshSession();
            // Should the access token still be rejected, the api.ts interceptor refreshes once
            // and retries; a valid access token costs no refresh call at all.
            await refreshUser();
        } catch (error) {
            // This is expected if there's no valid refresh token.
            // Silently fail and set user to null.
            setUser(null);
        } finally {
            setIsLoading(false);
        }
    }
    initializeAuth();
  }, [refreshUser, session]);


  const login = async (data: any): Promise<boolean> => {
    setIsLoading(true);
    try {
      await ensureCsrfToken();
      await api.post('/api/auth/login', {
        phoneNumber: data.phoneNumber,
        password: data.password,
      });

      // After successful login, refresh the user state from the server
      await refreshUser();

      // Ensure loading state is cleared so consumers (AuthGuard) can
      // immediately recognise the authenticated state without requiring
      // a manual page refresh.
      setIsLoading(false);
      
      toast({ title: 'Login Successful', description: 'Redirecting...' });

      // After refreshing, the `user` state will be updated, so we can check it
      // in the AuthGuard. The router.push will trigger the guard.
      // A small delay can help ensure the state is propagated.
      setTimeout(() => {
        router.push(postLoginPath());
        router.refresh(); // This might still be useful to reload server components
      }, 100);

      return true;

    } catch (error: any) {
      const serverMessage = error.response?.data?.message || 'An unknown error occurred during login.';
      toast({ variant: 'destructive', title: 'Login Failed', description: serverMessage });
      console.error('Login error:', serverMessage, error);
      setIsLoading(false); // Make sure to stop loading on error
      return false;
    } finally {
        // isLoading will be set to false in the initializeAuth effect after refresh
    }
  };
  
  const hasPermission = (permission: string) => {
    if (!user || !user.role || !user.role.permissions) return false;

    try {
      const userPermissions = Array.isArray(user.role.permissions) ? user.role.permissions : JSON.parse(user.role.permissions);
      return Array.isArray(userPermissions) && userPermissions.includes(permission);
    } catch (error) {
      console.error('Failed to check permissions:', user.role.permissions, error);
      return false;
    }
  };

  const isAuthenticated = !isLoading && !!user;

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, isLoading, hasPermission, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
