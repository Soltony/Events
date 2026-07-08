
import { redirect } from 'next/navigation';
import { getCurrentSuperAdmin } from '@/lib/super-admin-auth';
import { hasPermission } from '@/lib/permissions';
import CreateRolePageContent from './page-content';

export default async function SuperAdminNewRolePage() {
  const superAdmin = await getCurrentSuperAdmin();
  if (!superAdmin) {
    redirect('/super-admin/login');
  }
  if (!hasPermission(superAdmin.role, 'Roles:Create')) {
    redirect('/super-admin/dashboard');
  }
  return <CreateRolePageContent />;
}
