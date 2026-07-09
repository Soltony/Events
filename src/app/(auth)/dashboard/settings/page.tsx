
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { SETTINGS_NAV_ITEMS } from '@/lib/settings-nav-items';
import DashboardSettingsPageContent from './page-content';

export default async function DashboardSettingsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  const canViewSettings = SETTINGS_NAV_ITEMS.some((item) => hasPermission(user.role, item.permission));

  if (!canViewSettings) {
    redirect('/dashboard');
  }

  return <DashboardSettingsPageContent />;
}
