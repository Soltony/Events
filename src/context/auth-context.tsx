
'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import api, { setAuthToken } from '@/lib/api';
import { getUserByPhoneNumber } from '@/lib/actions';
import type { User, Role } from '@prisma/client';

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

interface UserWithRole extends User {
  role: Role;
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [tokens, setTokens] = useState<AuthTokens | null>(null);
  const [user, setUser] = useState<UserWithRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();

  const clearAuthData = useCallback(async () => {
    setUser(null);
    setTokens(null);
    setAuthToken(null);
    localStorage.removeItem('authUser');
    await fetch('/api/auth/session', { method: 'DELETE' });
  }, []);

  const logout = useCallback(async (options?: { reason?: string }) => {
    const { reason } = options || {};
    
    await clearAuthData();
    
    if (reason) {
        toast({
            title: 'Session Expired',
            description: reason,
        });
    }
    
    // Only redirect if they are on a protected route.
    if (pathname.startsWith('/dashboard')) {
        router.push('/login');
    }

  }, [router, toast, clearAuthData, pathname]);

  const refreshUser = useCallback(async () => {
    const storedUser = localStorage.getItem('authUser');
    if (!storedUser) return;
    
    const parsedUser = JSON.parse(storedUser) as UserWithRole;

    if (parsedUser?.phoneNumber) {
        try {
            const freshUserData = await getUserByPhoneNumber(parsedUser.phoneNumber);
            if (freshUserData) {
                setUser(freshUserData);
                localStorage.setItem('authUser', JSON.stringify(freshUserData));
            } else {
                 logout({ reason: 'Your session could not be verified. Please log in again.' });
            }
        } catch (error) {
            console.error("Failed to refresh user data", error);
            logout({ reason: 'Could not verify your session. Please log in again.' });
        }
    }
  }, [logout]);


  useEffect(() => {
    async function initializeAuth() {
        try {
            const storedUser = localStorage.getItem('authUser');
            const response = await fetch('/api/auth/session');

            if (storedUser && response.ok) {
                const { accessToken } = await response.json();
                if (accessToken) {
                    setAuthToken(accessToken);
                    const parsedUser = JSON.parse(storedUser);
                    setUser(parsedUser);
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
            setIsLoading(false);
        }
    }
    initializeAuth();
}, [clearAuthData]);


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
      const requestData = {
        phoneNumber: data.phoneNumber,
        password: data.password,
      };
      const response = await api.post('/api/auth/login', requestData);

      if (response.data && response.data.isSuccess) {
        setFailedAttempts(0);
        setLockoutUntil(null);

        const { accessToken, refreshToken, AccessToken, RefreshToken } = response.data;
        const resolvedAccessToken = accessToken || AccessToken;
        const resolvedRefreshToken = refreshToken || RefreshToken;

        if (resolvedAccessToken) {
          
          const userData = await getUserByPhoneNumber(data.phoneNumber);
          if (!userData) {
            throw new Error('Failed to retrieve user data after login.');
          }

          if (userData.status === 'INACTIVE') {
            throw new Error('Your account is inactive. Please contact an administrator.');
          }
          
          const newTokens = { accessToken: resolvedAccessToken, refreshToken: resolvedRefreshToken };
          
          await fetch('/api/auth/session', {
            method: 'POST',
            body: JSON.stringify(newTokens),
          });
          
          setTokens(newTokens);
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

        if (currentFailed >= MAX_LOGIN_ATTEMPTS) {
            const newLockoutUntil = Date.now() + LOCKOUT_DURATION;
            setLockoutUntil(newLockoutUntil);
            setFailedAttempts(0);
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
      if (failedAttempts < MAX_LOGIN_ATTEMPTS -1) {
          const errorMessage = error.response?.data?.errors?.join(', ') || error.message || 'An error occurred during login.';
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
    
    const userPermissions = user.role.permissions.split(',');
    return userPermissions.includes(permission);
  };

  const isAuthenticated = !isLoading && !!user;

  return (
    <AuthContext.Provider value={{ tokens, user, isAuthenticated, isLoading, hasPermission, login, logout, refreshUser }}>
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
