
'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

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
        api.defaults.headers.common['Authorization'] = `Bearer ${parsedTokens.accessToken}`;
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
      const response = await api.post('/api/Auth/login', data);
      if (response.data.isSuccess) {
        const { accessToken, refreshToken } = response.data;
        const newTokens = { accessToken, refreshToken };
        setTokens(newTokens);
        localStorage.setItem('authTokens', JSON.stringify(newTokens));
        api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
        toast({
          title: 'Login Successful',
          description: 'Redirecting to your dashboard...',
        });
        router.push('/dashboard');
        router.refresh();
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
            await api.post('/api/Auth/logout', tokens);
        }
    } catch(error) {
        console.error("Logout failed on server, proceeding with client-side logout.", error);
    } finally {
        setTokens(null);
        delete api.defaults.headers.common['Authorization'];
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
