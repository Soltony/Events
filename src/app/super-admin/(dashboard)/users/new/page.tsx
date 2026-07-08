
import { redirect } from 'next/navigation';
import { getCurrentSuperAdmin } from '@/lib/super-admin-auth';
import { hasPermission } from '@/lib/permissions';
import UserRegistrationPageContent from './page-content';

export default async function SuperAdminUserNewPage() {
  const superAdmin = await getCurrentSuperAdmin();
  if (!superAdmin) {
    redirect('/super-admin/login');
  }
  if (!hasPermission(superAdmin.role, 'Users:Create')) {
    redirect('/super-admin/dashboard');
  }
  return <UserRegistrationPageContent />;
}
