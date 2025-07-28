
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
  hasPermission: (permission: string) => boolean;
  login: (data: any) => Promise<void>;
  logout: (options?: { reason?: string }) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const SESSION_TIMEOUT_DURATION = 15 * 60 * 1000; // 15 minutes

function setCookie(name: string, value: string, days: number) {
    let expires = "";
    if (days) {
        const date = new Date();
        date.setTime(date.getTime() + (days*24*60*60*1000));
        expires = "; expires=" + date.toUTCString();
    }
    document.cookie = name + "=" + (value || "")  + expires + "; path=/; SameSite=Lax; Secure";
}

function eraseCookie(name: string) {   
    document.cookie = name+'=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [tokens, setTokens] = useState<AuthTokens | null>(null);
  const [user, setUser] = useState<UserWithRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const { toast } = useToast();

  const logout = useCallback(async (options?: { reason?: string }) => {
    const { reason } = options || {};
    
    // Clear client-side state and storage first
    setUser(null);
    setTokens(null);
    setAuthToken(null);
    localStorage.removeItem('authUser');
    eraseCookie('authTokens');
    
    if (reason) {
        toast({
            title: 'Session Expired',
            description: reason,
        });
    }
    
    // We push to login after clearing state
    router.push('/login');

  }, [router, toast]);


  useEffect(() => {
    try {
      const storedUser = localStorage.getItem('authUser');

      if (storedUser) {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
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
      if (localStorage.getItem('authUser')) { // Check for user presence instead of tokens
          timeoutId = setTimeout(() => {
            logout({ reason: 'You have been logged out due to inactivity.' });
          }, SESSION_TIMEOUT_DURATION);
      }
    };

    const events = ['mousemove', 'keydown', 'click', 'scroll'];

    const handleActivity = () => {
        resetTimeout();
    };

    if (user) { // Trigger based on user state
      events.forEach(event => window.addEventListener(event, handleActivity));
      resetTimeout();
    }

    return () => {
      clearTimeout(timeoutId);
      events.forEach(event => window.removeEventListener(event, handleActivity));
    };
  }, [user, logout]);

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
          setCookie('authTokens', JSON.stringify(newTokens), 1);
          
          // Force a fresh fetch of user data from DB to get correct role/permissions
          const userData = await getUserByPhoneNumber(data.phoneNumber);
          if (!userData) {
            throw new Error('Failed to retrieve user data after login.');
          }
          setUser(userData);
          localStorage.setItem('authUser', JSON.stringify(userData));
          
          toast({
            title: 'Login Successful',
            description: 'Redirecting...',
          });
          
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

  const isAuthenticated = !isLoading && !!user;

  return (
    <AuthContext.Provider value={{ tokens, user, isAuthenticated, isLoading, hasPermission, login, logout }}>
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

    