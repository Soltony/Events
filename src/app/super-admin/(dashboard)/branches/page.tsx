
import { redirect } from 'next/navigation';
import { getCurrentSuperAdmin } from '@/lib/super-admin-auth';
import { hasPermission } from '@/lib/permissions';
import BranchesPageContent from './page-content';

export default async function SuperAdminBranchesPage() {
  const superAdmin = await getCurrentSuperAdmin();
  if (!superAdmin) {
    redirect('/super-admin/login');
  }
  if (!hasPermission(superAdmin.role, 'Performance:Branch Comparison')) {
    redirect('/super-admin/dashboard');
  }
  return <BranchesPageContent />;
}
