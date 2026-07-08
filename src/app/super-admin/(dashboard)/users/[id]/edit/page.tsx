
import { redirect } from 'next/navigation';
import { getCurrentSuperAdmin } from '@/lib/super-admin-auth';
import { hasPermission } from '@/lib/permissions';
import EditUserPageContent from './page-content';

export default async function SuperAdminEditUserPage() {
  const superAdmin = await getCurrentSuperAdmin();
  if (!superAdmin) {
    redirect('/super-admin/login');
  }
  if (!hasPermission(superAdmin.role, 'Users:Update')) {
    redirect('/super-admin/dashboard');
  }
  return <EditUserPageContent />;
}
