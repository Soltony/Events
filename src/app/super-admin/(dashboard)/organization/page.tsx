
import { redirect } from 'next/navigation';
import { getCurrentSuperAdmin } from '@/lib/super-admin-auth';
import { hasPermission } from '@/lib/permissions';
import OrganizationPageContent from './page-content';

export default async function SuperAdminOrganizationPage() {
  const superAdmin = await getCurrentSuperAdmin();
  if (!superAdmin) {
    redirect('/super-admin/login');
  }
  if (!hasPermission(superAdmin.role, 'Organization:Read')) {
    redirect('/super-admin/dashboard');
  }
  return <OrganizationPageContent />;
}
