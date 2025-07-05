
'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import api, { setAuthToken } from '@/lib/api';

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

interface AuthContextType {
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (data: any) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [tokens, setTokens] = useState<AuthTokens | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    try {
      const storedTokens = localStorage.getItem('authTokens');
      if (storedTokens) {
        const parsedTokens = JSON.parse(storedTokens);
        setTokens(parsedTokens);
        setAuthToken(parsedTokens.accessToken);
      }
    } catch (error) {
        console.error("Failed to parse auth tokens from localStorage", error);
        localStorage.removeItem('authTokens');
    } finally {
        setIsLoading(false);
    }
  }, []);

  const login = async (data: any) => {
    try {
      const requestData = {
        PhoneNumber: data.phoneNumber,
        Password: data.password,
      };
      const response = await api.post('/api/Auth/login', requestData);

      if (response.data && response.data.isSuccess) {
        // Handle both camelCase (accessToken) and PascalCase (AccessToken) from server
        const { accessToken, refreshToken, AccessToken, RefreshToken } = response.data;
        const resolvedAccessToken = accessToken || AccessToken;
        const resolvedRefreshToken = refreshToken || RefreshToken;

        if (resolvedAccessToken) {
          const newTokens = { accessToken: resolvedAccessToken, refreshToken: resolvedRefreshToken };
          setTokens(newTokens);
          localStorage.setItem('authTokens', JSON.stringify(newTokens));
          setAuthToken(resolvedAccessToken);
          
          toast({
            title: 'Login Successful',
            description: 'Redirecting to your dashboard...',
          });
          
          router.push('/dashboard');
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
    }
  };
  
  const logout = async () => {
    setIsLoading(true);
    try {
        if(tokens){
            const requestData = {
                AccessToken: tokens.accessToken,
                RefreshToken: tokens.refreshToken,
            };
            await api.post('/api/Auth/logout', requestData);
        }
    } catch(error) {
        console.error("Logout failed on server, proceeding with client-side logout.", error);
    } finally {
        setTokens(null);
        setAuthToken(null);
        localStorage.removeItem('authTokens');
        // also clear event data for a full reset
        localStorage.removeItem('events-app-storage');
        localStorage.removeItem('ticket-types-app-storage');
        router.push('/');
        setIsLoading(false);
    }
  };

  const isAuthenticated = !isLoading && !!tokens;

  return (
    <AuthContext.Provider value={{ tokens, isAuthenticated, isLoading, login, logout }}>
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
