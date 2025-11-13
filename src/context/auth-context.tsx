
'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import api, { setAuthToken } from '@/lib/api';
import type { User, Role, Branch } from '@prisma/client';
import Cookies from 'js-cookie';

interface AuthTokens {
  accessToken: string;
}

interface UserWithRole extends User {
  role: Role;
  branch?: Branch | null;
}

interface AuthContextType {
  user: UserWithRole | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  hasPermission: (permission: string) => boolean;
  login: (data: any) => Promise<void>;
  logout: (options?: { reason?: string }) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const SESSION_TIMEOUT_DURATION = 15 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 30 * 1000; // 30 seconds

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
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();

  useEffect(() => {
    const storedFailedAttempts = localStorage.getItem('failedLoginAttempts');
    const storedLockoutUntil = localStorage.getItem('lockoutUntil');
    
    if (storedFailedAttempts) {
      setFailedAttempts(parseInt(storedFailedAttempts, 10));
    }
    
    if (storedLockoutUntil) {
      const lockoutTime = parseInt(storedLockoutUntil, 10);
      if (Date.now() < lockoutTime) {
        setLockoutUntil(lockoutTime);
      } else {
        localStorage.removeItem('lockoutUntil');
        localStorage.removeItem('failedLoginAttempts');
      }
    }
  }, []);

  const clearAuthData = useCallback(async () => {
    setUser(null);
    setAuthToken(null);
    localStorage.removeItem('authUser');
    await api.post('/api/auth/logout');
  }, []);

  const logout = useCallback(async (options?: { reason?: string }) => {
    const { reason } = options || {};
    
    await clearAuthData();
    
    const isProtectedRoute = pathname.startsWith('/dashboard');

    if (reason && isProtectedRoute) {
        toast({
            title: 'Session Expired',
            description: reason,
        });
    }
    
    if (isProtectedRoute) {
        router.push('/login');
    }

  }, [router, toast, clearAuthData, pathname]);

  const refreshUser = useCallback(async () => {
    try {
        const { data } = await api.get('/api/auth/me');
        if (data.user) {
            setUser(data.user);
            localStorage.setItem('authUser', JSON.stringify(data.user));
        } else {
             await logout({ reason: 'Your session could not be verified. Please log in again.' });
        }
    } catch (error) {
        console.error("Failed to refresh user data", error);
        await logout({ reason: 'Could not verify your session. Please log in again.' });
    }
  }, [logout]);


  useEffect(() => {
    async function initializeAuth() {
        setIsLoading(true);
        try {
            await refreshUser();
        } catch (error) {
            await clearAuthData();
        } finally {
            setIsLoading(false);
        }
    }
    initializeAuth();
  }, [clearAuthData, refreshUser]);


  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const resetTimeout = () => {
      clearTimeout(timeoutId);
      if (localStorage.getItem('authUser')) { 
          timeoutId = setTimeout(() => {
            logout({ reason: 'You have been logged out due to inactivity.' });
          }, SESSION_TIMEOUT_DURATION);
      }
    };

    const events = ['mousemove', 'keydown', 'click', 'scroll'];

    const handleActivity = () => {
        resetTimeout();
    };

    if (user) { 
      events.forEach(event => window.addEventListener(event, handleActivity));
      resetTimeout();
    }

    return () => {
      clearTimeout(timeoutId);
      events.forEach(event => window.removeEventListener(event, handleActivity));
    };
  }, [user, logout]);

  const login = async (data: any) => {
    if (lockoutUntil && Date.now() < lockoutUntil) {
        const timeLeft = Math.ceil((lockoutUntil - Date.now()) / 1000);
        toast({
            variant: 'destructive',
            title: 'Login Locked',
            description: `Too many failed attempts. Please try again in ${timeLeft} seconds.`,
        });
        return;
    }

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

        setFailedAttempts(0);
        setLockoutUntil(null);
        localStorage.removeItem('failedLoginAttempts');
        localStorage.removeItem('lockoutUntil');

        setUser(userData);
        localStorage.setItem('authUser', JSON.stringify(userData));
        
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

      } else {
        throw new Error('Login failed: Invalid response from server.');
      }
    } catch (error: any) {
      const currentFailed = failedAttempts + 1;
      setFailedAttempts(currentFailed);
      localStorage.setItem('failedLoginAttempts', currentFailed.toString());

      if (currentFailed >= MAX_LOGIN_ATTEMPTS) {
          const newLockoutUntil = Date.now() + LOCKOUT_DURATION;
          setLockoutUntil(newLockoutUntil);
          setFailedAttempts(0);
          localStorage.setItem('lockoutUntil', newLockoutUntil.toString());
          localStorage.removeItem('failedLoginAttempts');
          toast({
              variant: 'destructive',
              title: 'Login Locked',
              description: `Too many failed attempts. Please try again in ${LOCKOUT_DURATION / 1000} seconds.`,
          });
      } else {
          const errorMessage = error.response?.data?.message || error.message || 'An error occurred during login.';
          toast({
            variant: 'destructive',
            title: 'Login Failed',
            description: errorMessage,
          });
          console.error('Login error:', error);
      }
    } finally {
        setIsLoading(false);
    }
  };
  
  const hasPermission = (permission: string) => {
    if (!user || !user.role?.permissions) {
      return false;
    }
    if (user.role.name === 'Admin') return true;
    
    try {
      let userPermissions: string[];
      if (user.role.permissions.startsWith('[')) {
        userPermissions = JSON.parse(user.role.permissions);
      } else {
        userPermissions = user.role.permissions.split(',');
      }
      
      return userPermissions.includes(permission);
    } catch (error) {
      console.error('Failed to parse permissions:', error);
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
