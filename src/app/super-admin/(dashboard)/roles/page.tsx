
import { redirect } from 'next/navigation';
import { getCurrentSuperAdmin } from '@/lib/super-admin-auth';
import { hasPermission } from '@/lib/permissions';
import RolesPageContent from './page-content';

export default async function SuperAdminRolesPage() {
  const superAdmin = await getCurrentSuperAdmin();
  if (!superAdmin) {
    redirect('/super-admin/login');
  }
  if (!hasPermission(superAdmin.role, 'Roles:Read')) {
    redirect('/super-admin/dashboard');
  }
  return <RolesPageContent />;
}
