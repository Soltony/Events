
import { redirect } from 'next/navigation';
import { getCurrentSuperAdmin } from '@/lib/super-admin-auth';
import { hasPermission } from '@/lib/permissions';
import StaffPageContent from './page-content';

export default async function SuperAdminStaffPage() {
  const superAdmin = await getCurrentSuperAdmin();
  if (!superAdmin) {
    redirect('/super-admin/login');
  }
  if (!hasPermission(superAdmin.role, 'Staff:Read')) {
    redirect('/super-admin/dashboard');
  }
  return <StaffPageContent />;
}
