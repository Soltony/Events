
'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import api, { setAuthToken } from '@/lib/api';
import { getUserByPhoneNumber } from '@/lib/actions';
import type { User, Role, Branch } from '@prisma/client';
import Cookies from 'js-cookie';

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

interface UserWithRole extends User {
  role: Role;
  branch?: Branch | null;
}

interface AuthContextType {
  tokens: AuthTokens | null;
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
      throw error; // Re-throw to be caught by the caller
    }
  } else {
      console.log('[ensureCsrfToken] CSRF tokens already exist.');
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [tokens, setTokens] = useState<AuthTokens | null>(null);
  const [user, setUser] = useState<UserWithRole | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isCsrfReady, setIsCsrfReady] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();

  // Combined loading state
  const isLoading = isAuthLoading || !isCsrfReady;

  // Initialize failed attempts and lockout from localStorage
  useEffect(() => {
    const storedFailedAttempts = localStorage.getItem('failedLoginAttempts');
    const storedLockoutUntil = localStorage.getItem('lockoutUntil');
    
    if (storedFailedAttempts) {
      setFailedAttempts(parseInt(storedFailedAttempts, 10));
    }
    
    if (storedLockoutUntil) {
      const lockoutTime = parseInt(storedLockoutUntil, 10);
      // Only set lockout if it hasn't expired yet
      if (Date.now() < lockoutTime) {
        setLockoutUntil(lockoutTime);
      } else {
        // Clear expired lockout
        localStorage.removeItem('lockoutUntil');
        localStorage.removeItem('failedLoginAttempts');
      }
    }
  }, []);

  const clearAuthData = useCallback(async () => {
    setUser(null);
    setTokens(null);
    setAuthToken(null);
    localStorage.removeItem('authUser');
    // Clear CSRF cookies on logout
    Cookies.remove('csrf_token');
    Cookies.remove('csrf_secret');
    await fetch('/api/auth/session', { method: 'DELETE' });
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
    
    // Only redirect if they are on a protected route.
    if (isProtectedRoute) {
        router.push('/login');
    }

  }, [router, toast, clearAuthData, pathname]);

  const refreshUser = useCallback(async (phoneNumber?: string) => {
    const phoneToFetch = phoneNumber || user?.phoneNumber;
    if (!phoneToFetch) return;

    try {
        const freshUserData = await getUserByPhoneNumber(phoneToFetch);
        if (freshUserData) {
            setUser(freshUserData);
            localStorage.setItem('authUser', JSON.stringify(freshUserData));
        } else {
            await logout({ reason: 'Your session could not be verified. Please log in again.' });
        }
    } catch (error) {
        console.error("Failed to refresh user data", error);
        await logout({ reason: 'Could not verify your session. Please log in again.' });
    }
  }, [user?.phoneNumber, logout]);


  useEffect(() => {
    async function initializeAuth() {
      try {
        await ensureCsrfToken();
        setIsCsrfReady(true);
      } catch {
        // If CSRF token fetching fails, we're in a bad state.
        // You might want to show a global error message here.
        setIsCsrfReady(false);
        setIsAuthLoading(false);
        return;
      }
      
      try {
        const sessionResponse = await fetch('/api/auth/session');

        if (sessionResponse.ok) {
            const sessionData = await sessionResponse.json();
            if (sessionData.accessToken && sessionData.phoneNumber) {
                const newTokens = { accessToken: sessionData.accessToken, refreshToken: sessionData.refreshToken || '' };
                setTokens(newTokens);
                setAuthToken(newTokens.accessToken); // Set token for API calls
                
                await refreshUser(sessionData.phoneNumber);

            } else {
                 await clearAuthData();
            }
        } else {
            await clearAuthData();
        }
      } catch (error) {
        console.error("Failed to initialize auth state", error);
        await clearAuthData();
      } finally {
        setIsAuthLoading(false);
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
    if (!isCsrfReady) {
        toast({
            variant: 'destructive',
            title: 'Initialization Error',
            description: 'The application is not ready. Please wait a moment and try again.',
        });
        return;
    }

    if (lockoutUntil && Date.now() < lockoutUntil) {
        const timeLeft = Math.ceil((lockoutUntil - Date.now()) / 1000);
        toast({
            variant: 'destructive',
            title: 'Login Locked',
            description: `Too many failed attempts. Please try again in ${timeLeft} seconds.`,
        });
        return;
    }

    setIsAuthLoading(true);
    try {
      await ensureCsrfToken(); // Ensure token exists before login attempt
      
      const requestData = {
        phoneNumber: data.phoneNumber,
        password: data.password,
      };
      const response = await api.post('/api/auth/login', requestData);

      if (response.data && response.data.isSuccess) {
        const userData = await getUserByPhoneNumber(data.phoneNumber);
        if (!userData) {
          throw new Error('Failed to retrieve user data after login.');
        }

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

        const { accessToken, refreshToken, AccessToken, RefreshToken } = response.data;
        const resolvedAccessToken = accessToken || AccessToken;
        const resolvedRefreshToken = refreshToken || RefreshToken;

        if (resolvedAccessToken) {
          const newTokens = { 
              accessToken: resolvedAccessToken, 
              refreshToken: resolvedRefreshToken,
              phoneNumber: data.phoneNumber,
          };
          
          await fetch('/api/auth/session', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(newTokens),
            credentials: 'include'
          });
          
          setTokens({ accessToken: newTokens.accessToken, refreshToken: newTokens.refreshToken });
          setAuthToken(resolvedAccessToken);
          
          setUser(userData);
          localStorage.setItem('authUser', JSON.stringify(userData));
          
          toast({
            title: 'Login Successful',
            description: 'Redirecting...',
          });
          
          if (userData.passwordChangeRequired) {
              router.push('/profile');
          } else {
              switch(userData.role?.name) {
                  case 'Admin':
                  default:
                      router.push('/dashboard');
                      break;
              }
          }
          router.refresh();
        } else {
          throw new Error('Login failed: Authentication tokens were not provided in the response.');
        }

      } else {
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
            const errorMessage = response.data.errors?.join(', ') || 'Login failed. Please check your credentials.';
            throw new Error(errorMessage);
        }
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
          const errorMessage = error.response?.data?.errors?.join(', ') || error.message || 'An error occurred during login.';
          toast({
            variant: 'destructive',
            title: 'Login Failed',
            description: errorMessage,
          });
          console.error('Login error:', error);
      }
    } finally {
        setIsAuthLoading(false);
    }
  };
  
  const hasPermission = (permission: string) => {
    if (!user || !user.role?.permissions) {
      return false;
    }
    if (user.role.name === 'Admin') return true;
    
    try {
      // Handle both JSON array and comma-separated formats for backward compatibility
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
    <AuthContext.Provider value={{ tokens, user, isAuthenticated, isLoading, hasPermission, login, logout, refreshUser: () => refreshUser() }}>
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
