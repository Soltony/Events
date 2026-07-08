
import { redirect } from 'next/navigation';
import { getCurrentSuperAdmin } from '@/lib/super-admin-auth';
import { hasPermission } from '@/lib/permissions';
import UserManagementPage from './page-content';

export default async function SuperAdminUsersPage() {
  const superAdmin = await getCurrentSuperAdmin();
  if (!superAdmin) {
    redirect('/super-admin/login');
  }
  if (!hasPermission(superAdmin.role, 'Users:Read')) {
    redirect('/super-admin/dashboard');
  }
  return <UserManagementPage />;
}
