
import { redirect } from 'next/navigation';
import { getCurrentSuperAdmin } from '@/lib/super-admin-auth';
import { hasPermission } from '@/lib/permissions';
import DistrictsPageContent from './page-content';

export default async function SuperAdminDistrictsPage() {
  const superAdmin = await getCurrentSuperAdmin();
  if (!superAdmin) {
    redirect('/super-admin/login');
  }
  if (!hasPermission(superAdmin.role, 'Performance:District Comparison')) {
    redirect('/super-admin/dashboard');
  }
  return <DistrictsPageContent />;
}
