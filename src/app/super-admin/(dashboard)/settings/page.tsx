
import { redirect } from 'next/navigation';
import { getCurrentSuperAdmin } from '@/lib/super-admin-auth';
import { hasPermission } from '@/lib/permissions';
import { SETTINGS_NAV_ITEMS } from '@/lib/settings-nav-items';
import SettingsPageContent from './page-content';

export default async function SuperAdminSettingsPage() {
  const superAdmin = await getCurrentSuperAdmin();
  if (!superAdmin) {
    redirect('/super-admin/login');
  }

  const canViewSettings = SETTINGS_NAV_ITEMS.some((item) => hasPermission(superAdmin.role, item.permission));

  if (!canViewSettings) {
    redirect('/super-admin/dashboard');
  }

  return <SettingsPageContent />;
}
