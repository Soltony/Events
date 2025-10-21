
'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import api, { setAuthToken } from '@/lib/api';
import { getUserByPhoneNumber } from '@/lib/actions';
import type { User, Role } from '@prisma/client';
import Cookies from 'js-cookie';

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
        const sessionResponse = await fetch('/api/auth/session');

        if (sessionResponse.ok) {
            const sessionData = await sessionResponse.json();
            if (sessionData.accessToken) {
                setTokens({ accessToken: sessionData.accessToken, refreshToken: sessionData.refreshToken || '' });
                setAuthToken(sessionData.accessToken);
                const storedUser = localStorage.getItem('authUser');
                if (storedUser) {
                    setUser(JSON.parse(storedUser));
                } else {
                    // If no user in local storage, try to fetch it
                    await refreshUser();
                }
            } else {
                 await clearAuthData();
            }
        } else {
             // Fallback to header-based initialization if session cookie is not found/valid
            const initResponse = await fetch('/api/auth/init', { method: 'POST' });
            if (initResponse.ok) {
                const { user: initializedUser, isSuccess } = await initResponse.json();
                if (isSuccess && initializedUser) {
                    setUser(initializedUser);
                    localStorage.setItem('authUser', JSON.stringify(initializedUser));
                    const newSessionResponse = await fetch('/api/auth/session');
                    if (newSessionResponse.ok) {
                        const newSessionData = await newSessionResponse.json();
                        setAuthToken(newSessionData.accessToken);
                    }
                }
            } else {
                await clearAuthData();
            }
        }
      } catch (error) {
        console.error("Failed to initialize auth state", error);
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
      const requestData = {
        phoneNumber: data.phoneNumber,
        password: data.password,
      };
      const response = await api.post('/api/auth/login', requestData);

      if (response.data && response.data.isSuccess) {
        setFailedAttempts(0);
        setLockoutUntil(null);
        // Clear stored failed attempts and lockout on successful login
        localStorage.removeItem('failedLoginAttempts');
        localStorage.removeItem('lockoutUntil');

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
          
          // The CSRF token will be set by the middleware automatically upon successful login request.
          // Forcing a page reload will ensure the new token is picked up by the API client.
          
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
        // Persist failed attempts to localStorage
        localStorage.setItem('failedLoginAttempts', currentFailed.toString());

        if (currentFailed >= MAX_LOGIN_ATTEMPTS) {
            const newLockoutUntil = Date.now() + LOCKOUT_DURATION;
            setLockoutUntil(newLockoutUntil);
            setFailedAttempts(0);
            // Persist lockout state to localStorage
            localStorage.setItem('lockoutUntil', newLockoutUntil.toString());
            localStorage.removeItem('failedLoginAttempts'); // Reset failed attempts after lockout
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
      // Handle failed attempts for network errors or other exceptions
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
        setIsLoading(false);
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
