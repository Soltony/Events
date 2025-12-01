'use client';

import React, { createContext, useContext, ReactNode, useCallback, useEffect } from 'react';
import { SessionProvider, useSession, signOut, signIn } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import type { User, Role, Branch } from '@prisma/client';

export interface UserWithRole extends User {
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
  logout: () => void;
  refreshUser: () => void; // This is now a wrapper around session update
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Ensure CSRF token is present before state-changing operations
// This is now less critical as NextAuth has its own CSRF protection, but good to keep.
export async function ensureCsrfToken() {
  // This logic can be simplified or removed if relying solely on NextAuth's CSRF
}

function AuthProviderContent({ children }: { children: ReactNode }) {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  const user = session?.user as UserWithRole | null;
  const isLoading = status === 'loading';
  const isAuthenticated = status === 'authenticated';

  useEffect(() => {
    if (isLoading) return;

    if (isAuthenticated) {
        if (user?.passwordChangeRequired && pathname !== '/profile') {
            router.replace('/profile');
        }
    } else if (pathname.startsWith('/dashboard') || pathname === '/profile') {
        router.replace('/login');
    }
  }, [isLoading, isAuthenticated, user, pathname, router]);

  const hasPermission = useCallback((permission: string) => {
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
      if (permissions.trim().startsWith('[') && permissions.trim().endsWith(']')) {
        userPermissions = JSON.parse(permissions);
      } else if (permissions) {
        userPermissions = permissions.split(',').filter(p => p);
      } else {
        userPermissions = [];
      }
      
      return Array.isArray(userPermissions) && userPermissions.includes(permission);
    } catch (error) {
      console.error('Failed to parse permissions:', permissions, error);
      return false;
    }
  }, [user]);

  const login = async (data: any): Promise<boolean> => {
    const result = await signIn('credentials', {
      redirect: false,
      phoneNumber: data.phoneNumber,
      password: data.password,
    });

    if (result?.ok) {
        await update(); // Force session update
        return true;
    }
    return false;
  };

  const logout = () => {
    signOut({ callbackUrl: '/login' });
  };
  
  const refreshUser = async () => {
    await update();
  };

  const authContextValue = {
    user,
    isAuthenticated,
    isLoading,
    hasPermission,
    login,
    logout,
    refreshUser
  };

  return (
    <AuthContext.Provider value={authContextValue}>
      {children}
    </AuthContext.Provider>
  );
}


export function AuthProvider({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <AuthProviderContent>{children}</AuthProviderContent>
    </SessionProvider>
  );
}

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
