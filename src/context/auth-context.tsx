
'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import api from '@/lib/api';
import type { User, Role, Branch } from '@prisma/client';
import Cookies from 'js-cookie';

interface AuthTokens {
  accessToken: string;
}

interface UserWithRole extends User {
  role: Role;
  branch?: Branch | null;
  isGuest?: boolean;
}

interface AuthContextType {
  user: UserWithRole | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  hasPermission: (permission: string) => boolean;
  login: (data: any) => Promise<boolean>;
  logout: (options?: { reason?: string }) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const SESSION_TIMEOUT_DURATION = 15 * 60 * 1000; // 15 minutes

export async function ensureCsrfToken() {
  if (!Cookies.get('csrf_token') || !Cookies.get('csrf_secret')) {
    try {
      console.log('[ensureCsrfToken] CSRF tokens not found, fetching new ones...');
      await api.get('/api/csrf-token');
      console.log('[ensureCsrfToken] Successfully fetched new CSRF tokens.');
    } catch (error) {
      console.error('[ensureCsrfToken] Failed to obtain CSRF token:', error);
      throw error;
    }
  } else {
      console.log('[ensureCsrfToken] CSRF tokens already exist.');
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserWithRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  
  const clearAuthData = useCallback(async () => {
    setUser(null);
    try {
        await api.post('/api/auth/logout');
    } catch (error) {
        console.error("Logout API call failed", error);
    }
  }, []);

  const logout = useCallback(async (options?: { reason?: string }) => {
    const { reason } = options || {};
    
    // Force a full page reload to the login page to avoid UI flickers.
    window.location.href = '/login';
    
    const isProtectedRoute = pathname.startsWith('/dashboard');
    if (reason && isProtectedRoute) {
        toast({
            title: 'Session Expired',
            description: reason,
        });
    }
    
    await clearAuthData();

  }, [toast, clearAuthData, pathname]);

  const refreshUser = useCallback(async () => {
    try {
        const { data } = await api.get('/api/auth/me');
        if (data.user) {
            setUser(data.user);
        } else {
            setUser(null);
        }
    } catch (error) {
        // On 401 or other error, just clear the user state.
        // The AuthGuard will handle the redirect.
        setUser(null);
    }
  }, []);


  useEffect(() => {
    async function initializeAuth() {
        setIsLoading(true);
        try {
            await refreshUser();
        } catch (error) {
            // Even if refreshUser itself throws, clear auth.
            setUser(null);
        } finally {
            setIsLoading(false);
        }
    }
    initializeAuth();
  }, [refreshUser]);


  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const resetTimeout = () => {
      clearTimeout(timeoutId);
      // Check for a valid, non-guest user session before setting a timeout
      if (user && !user.isGuest) { 
          timeoutId = setTimeout(() => {
            logout({ reason: 'You have been logged out due to inactivity.' });
          }, SESSION_TIMEOUT_DURATION);
      }
    };

    const handleActivity = () => {
        resetTimeout();
    };
    
    // Only set up activity listeners if there's a logged-in (non-guest) user
    if (user && !user.isGuest) { 
      const events = ['mousemove', 'keydown', 'click', 'scroll'];
      events.forEach(event => window.addEventListener(event, handleActivity));
      resetTimeout();

      return () => {
        clearTimeout(timeoutId);
        events.forEach(event => window.removeEventListener(event, handleActivity));
      };
    }
  }, [user, logout]);

  const login = async (data: any): Promise<boolean> => {
    setIsLoading(true);
    try {
      const response = await api.post('/api/auth/login', {
        phoneNumber: data.phoneNumber,
        password: data.password,
      });

      if (response.data && response.data.user) {
        const userData: UserWithRole = response.data.user;

        if (userData.status === 'INACTIVE' && userData.passwordChangeRequired) {
            throw new Error('Your account is pending approval. Please contact an administrator.');
        }
        
        if (userData.status === 'INACTIVE') {
          throw new Error('Your account is inactive. Please contact an administrator.');
        }

        setUser(userData);
        
        toast({
          title: 'Login Successful',
          description: 'Redirecting...',
        });
        
        if (userData.passwordChangeRequired) {
            router.push('/profile');
        } else {
            router.push('/dashboard');
        }
        router.refresh();
        return true;
      } else {
        throw new Error('Login failed: Invalid response from server.');
      }
    } catch (error: any) {
        const errorMessage = error.response?.data?.message || error.message || 'An error occurred during login.';
        // Don't show toast here, let the calling component handle it
        console.error('Login error:', errorMessage);
        return false;
    } finally {
        setIsLoading(false);
    }
  };
  
  const hasPermission = (permission: string) => {
    if (!user || !user.role) {
      return false;
    }
    if (user.role.name === 'Admin') return true;

    const permissions = user.role.permissions;
    if (!permissions || typeof permissions !== 'string') {
        return false;
    }
    
    try {
      let userPermissions: string[];
      // First, try to parse as JSON. This is the new, preferred format.
      if (permissions.trim().startsWith('[') && permissions.trim().endsWith(']')) {
        userPermissions = JSON.parse(permissions);
      } else if (permissions) {
        // Fallback for older, comma-separated strings.
        userPermissions = permissions.split(',').filter(p => p);
      } else {
        // Handle empty string case
        userPermissions = [];
      }
      
      return Array.isArray(userPermissions) && userPermissions.includes(permission);
    } catch (error) {
      console.error('Failed to parse permissions:', permissions, error);
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
