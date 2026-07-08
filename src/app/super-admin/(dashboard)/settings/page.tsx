
import { redirect } from 'next/navigation';
import { getCurrentSuperAdmin } from '@/lib/super-admin-auth';
import { hasPermission } from '@/lib/permissions';
import SettingsPageContent from './page-content';

export default async function SuperAdminSettingsPage() {
  const superAdmin = await getCurrentSuperAdmin();
  if (!superAdmin) {
    redirect('/super-admin/login');
  }

  const canViewSettings = [
    'Users:Read',
    'Roles:Read',
    'Staff:Read',
    'Organization:Read',
    'Homepage Carousel:Read',
  ].some((p) => hasPermission(superAdmin.role, p));

  if (!canViewSettings) {
    redirect('/super-admin/dashboard');
  }

  return <SettingsPageContent />;
}
