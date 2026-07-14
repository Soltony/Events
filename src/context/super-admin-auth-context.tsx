
'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface SuperAdminRole {
  id: string;
  name: string;
  description: string | null;
  permissions: string[];
}

interface SuperAdmin {
  id: string;
  fullName: string;
  phoneNumber: string;
  email: string | null;
  status: string;
  lastLoginAt: string | null;
  passwordChangeRequired: boolean;
  role: SuperAdminRole;
}

interface SuperAdminAuthContextType {
  superAdmin: SuperAdmin | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  hasPermission: (permission: string) => boolean;
  login: (phoneNumber: string, password: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => Promise<void>;
}

const SuperAdminAuthContext = createContext<SuperAdminAuthContextType | undefined>(undefined);

export function SuperAdminAuthProvider({ children }: { children: ReactNode }) {
  const [superAdmin, setSuperAdmin] = useState<SuperAdmin | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/super-admin/auth/me', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setSuperAdmin(data.superAdmin);
      } else {
        setSuperAdmin(null);
      }
    } catch {
      setSuperAdmin(null);
    }
  }, []);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      await refresh();
      setIsLoading(false);
    })();
  }, [refresh]);

  const login = useCallback(async (phoneNumber: string, password: string) => {
    try {
      const res = await fetch('/api/super-admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ phoneNumber, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, message: data.message || 'Login failed.' };
      }
      setSuperAdmin(data.superAdmin);
      router.push('/super-admin/dashboard');
      return { success: true };
    } catch (error: any) {
      return { success: false, message: error.message || 'An error occurred during login.' };
    }
  }, [router]);

  const logout = useCallback(async () => {
    try {
      await fetch('/api/super-admin/auth/logout', { method: 'POST', credentials: 'include' });
    } finally {
      setSuperAdmin(null);
      router.push('/super-admin/login');
      router.refresh();
    }
  }, [router]);

  const isAuthenticated = !isLoading && !!superAdmin;

  const hasPermission = useCallback((permission: string) => {
    if (!superAdmin?.role) return false;
    if (superAdmin.role.name === 'Super Admin') return true;
    return superAdmin.role.permissions?.includes(permission) ?? false;
  }, [superAdmin]);

  return (
    <SuperAdminAuthContext.Provider value={{ superAdmin, isAuthenticated, isLoading, hasPermission, login, logout }}>
      {children}
    </SuperAdminAuthContext.Provider>
  );
}

export const useSuperAdminAuth = (): SuperAdminAuthContextType => {
  const context = useContext(SuperAdminAuthContext);
  if (context === undefined) {
    throw new Error('useSuperAdminAuth must be used within a SuperAdminAuthProvider');
  }
  return context;
};
