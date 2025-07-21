
'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import api, { setAuthToken } from '@/lib/api';
import { getUserByPhoneNumber } from '@/lib/actions';
import type { User } from '@prisma/client';

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

interface AuthContextType {
  tokens: AuthTokens | null;
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (data: any) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [tokens, setTokens] = useState<AuthTokens | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    try {
      const storedTokens = localStorage.getItem('authTokens');
      const storedUser = localStorage.getItem('authUser');

      if (storedTokens && storedUser) {
        const parsedTokens = JSON.parse(storedTokens);
        const parsedUser = JSON.parse(storedUser);
        setTokens(parsedTokens);
        setUser(parsedUser);
        setAuthToken(parsedTokens.accessToken);
      }
    } catch (error) {
        console.error("Failed to parse auth data from localStorage", error);
        localStorage.removeItem('authTokens');
        localStorage.removeItem('authUser');
    } finally {
        setIsLoading(false);
    }
  }, []);

  const login = async (data: any) => {
    try {
      // Use camelCase for the request payload
      const requestData = {
        phoneNumber: data.phoneNumber,
        password: data.password,
      };
      const response = await api.post('/api/auth/login', requestData);

      if (response.data && response.data.isSuccess) {
        // The response might use PascalCase, so handle both possibilities
        const { accessToken, refreshToken, AccessToken, RefreshToken } = response.data;
        const resolvedAccessToken = accessToken || AccessToken;
        const resolvedRefreshToken = refreshToken || RefreshToken;

        if (resolvedAccessToken) {
          const newTokens = { accessToken: resolvedAccessToken, refreshToken: resolvedRefreshToken };
          setTokens(newTokens);
          setAuthToken(resolvedAccessToken);
          
          const userData = await getUserByPhoneNumber(data.phoneNumber);
          setUser(userData);
          
          localStorage.setItem('authTokens', JSON.stringify(newTokens));
          localStorage.setItem('authUser', JSON.stringify(userData));
          
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
    const currentTokens = tokens;
    
    setUser(null);
    setTokens(null);
    setAuthToken(null);
    localStorage.removeItem('authTokens');
    localStorage.removeItem('authUser');
    router.push('/');

    if (currentTokens) {
        try {
            const requestData = {
                AccessToken: currentTokens.accessToken,
                RefreshToken: currentTokens.refreshToken,
            };
            await api.post('/api/auth/logout', requestData);
        } catch(error) {
            console.error("Server logout failed, but client is logged out.", error);
        }
    }
  };

  const isAuthenticated = !isLoading && !!tokens && !!user;

  return (
    <AuthContext.Provider value={{ tokens, user, isAuthenticated, isLoading, login, logout }}>
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
