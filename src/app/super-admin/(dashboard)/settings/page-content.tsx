
'use client';

import { Settings } from 'lucide-react';
import { useSuperAdminAuth } from '@/context/super-admin-auth-context';
import { SettingsHubCards } from '@/components/settings-hub-cards';

export default function SettingsPageContent() {
  const { hasPermission } = useSuperAdminAuth();

  return (
    <div className="flex flex-1 flex-col gap-4 md:gap-8">
      <div className="flex items-center gap-4">
        <Settings className="h-8 w-8" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">
            Manage users, roles, staff, organization, and homepage content.
          </p>
        </div>
      </div>

      <SettingsHubCards basePath="/super-admin" hasPermission={hasPermission} />
    </div>
  );
}
