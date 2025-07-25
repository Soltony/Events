
'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useRouter } from 'next/navigation';
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
  passwordChangeRequired: boolean;
  hasPermission: (permission: string) => boolean;
  login: (data: any) => Promise<void>;
  logout: (options?: { reason?: string }) => Promise<void>;
  forcePasswordChangeStatus: (status: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const SESSION_TIMEOUT_DURATION = 15 * 60 * 1000; // 15 minutes

export function AuthProvider({ children }: { children: ReactNode }) {
  const [tokens, setTokens] = useState<AuthTokens | null>(null);
  const [user, setUser] = useState<UserWithRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [passwordChangeRequired, setPasswordChangeRequired] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const forcePasswordChangeStatus = useCallback((status: boolean) => {
      setPasswordChangeRequired(status);
      localStorage.setItem('passwordChangeRequired', String(status));
  }, []);
  
  const logout = useCallback(async (options?: { reason?: string }) => {
    const { reason } = options || {};
    const currentTokens = JSON.parse(localStorage.getItem('authTokens') || 'null');

    setUser(null);
    setTokens(null);
    setPasswordChangeRequired(false);
    setAuthToken(null);
    localStorage.removeItem('authTokens');
    localStorage.removeItem('authUser');
    localStorage.removeItem('passwordChangeRequired');
    
    if (reason) {
        toast({
            title: 'Session Expired',
            description: reason,
        });
    }
    
    // We push to login before the async call to ensure immediate UI feedback
    router.push('/login');

    if (currentTokens) {
        try {
            // This call invalidates tokens on the server.
            // It might fail if tokens are already expired, which is fine.
            await api.post('/api/auth/logout', {
                token: currentTokens.accessToken,
                refreshToken: currentTokens.refreshToken,
            });
        } catch(error) {
            // Silently fail. The client session is cleared regardless.
            // This is important for scenarios like post-password-change,
            // where the token is already invalid.
            console.error("Server logout failed, but client is logged out.", error);
        }
    }
  }, [router, toast]);


  useEffect(() => {
    try {
      const storedTokens = localStorage.getItem('authTokens');
      const storedUser = localStorage.getItem('authUser');
      const storedPasswordStatus = localStorage.getItem('passwordChangeRequired');

      if (storedTokens && storedUser) {
        const parsedTokens = JSON.parse(storedTokens);
        const parsedUser = JSON.parse(storedUser);
        setTokens(parsedTokens);
        setUser(parsedUser);
        setAuthToken(parsedTokens.accessToken);
        if (storedPasswordStatus === 'true') {
            setPasswordChangeRequired(true);
        }
      }
    } catch (error) {
        console.error("Failed to parse auth data from localStorage", error);
        logout({ reason: 'Your session was corrupted. Please log in again.'});
    } finally {
        setIsLoading(false);
    }
  }, [logout]);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const resetTimeout = () => {
      clearTimeout(timeoutId);
      if (localStorage.getItem('authTokens')) {
          timeoutId = setTimeout(() => {
            logout({ reason: 'You have been logged out due to inactivity.' });
          }, SESSION_TIMEOUT_DURATION);
      }
    };

    const events = ['mousemove', 'keydown', 'click', 'scroll'];

    const handleActivity = () => {
        resetTimeout();
    };

    if (tokens) {
      events.forEach(event => window.addEventListener(event, handleActivity));
      resetTimeout();
    }

    return () => {
      clearTimeout(timeoutId);
      events.forEach(event => window.removeEventListener(event, handleActivity));
    };
  }, [tokens, logout]);

  const login = async (data: any) => {
    setIsLoading(true);
    try {
      const requestData = {
        phoneNumber: data.phoneNumber,
        password: data.password,
      };
      const response = await api.post('/api/auth/login', requestData);

      if (response.data && response.data.isSuccess) {
        const { accessToken, refreshToken, AccessToken, RefreshToken } = response.data;
        const resolvedAccessToken = accessToken || AccessToken;
        const resolvedRefreshToken = refreshToken || RefreshToken;

        if (resolvedAccessToken) {
          const newTokens = { accessToken: resolvedAccessToken, refreshToken: resolvedRefreshToken };
          setTokens(newTokens);
          setAuthToken(resolvedAccessToken);
          localStorage.setItem('authTokens', JSON.stringify(newTokens));
          
          // Force a fresh fetch of user data from DB to get correct role/permissions
          const userData = await getUserByPhoneNumber(data.phoneNumber);
          if (!userData) {
            throw new Error('Failed to retrieve user data after login.');
          }
          setUser(userData);
          localStorage.setItem('authUser', JSON.stringify(userData));

          const needsPasswordChange = userData.passwordChangeRequired;
          // Directly set the password change status from the fresh user data
          forcePasswordChangeStatus(needsPasswordChange);
          
          toast({
            title: 'Login Successful',
            description: 'Redirecting...',
          });
          
          if (needsPasswordChange) {
            router.push('/dashboard/profile');
          } else {
            // Role-based redirection
            switch(userData.role?.name) {
                case 'Organizer':
                    router.push('/dashboard/events');
                    break;
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
        throw new Error(response.data.errors?.join(', ') || 'Login failed');
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.errors?.join(', ') || error.message || 'An error occurred during login.';
      toast({
        variant: 'destructive',
        title: 'Login Failed',
        description: errorMessage,
      });
      console.error('Login error:', error);
    } finally {
        setIsLoading(false);
    }
  };
  
  const hasPermission = (permission: string) => {
    if (!user || !user.role?.permissions) {
      return false;
    }
    // Admin has all permissions
    if (user.role.name === 'Admin') return true;
    
    const userPermissions = user.role.permissions.split(',');
    return userPermissions.includes(permission);
  };

  const isAuthenticated = !isLoading && !!tokens && !!user;

  return (
    <AuthContext.Provider value={{ tokens, user, isAuthenticated, isLoading, passwordChangeRequired, hasPermission, login, logout, forcePasswordChangeStatus }}>
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
