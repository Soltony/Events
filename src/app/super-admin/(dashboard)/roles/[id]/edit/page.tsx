
import { redirect } from 'next/navigation';
import { getCurrentSuperAdmin } from '@/lib/super-admin-auth';
import { hasPermission } from '@/lib/permissions';
import EditRolePageContent from './page-content';

export default async function SuperAdminEditRolePage() {
  const superAdmin = await getCurrentSuperAdmin();
  if (!superAdmin) {
    redirect('/super-admin/login');
  }
  if (!hasPermission(superAdmin.role, 'Roles:Update')) {
    redirect('/super-admin/dashboard');
  }
  return <EditRolePageContent />;
}
