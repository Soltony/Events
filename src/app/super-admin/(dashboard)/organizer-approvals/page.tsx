
import { redirect } from 'next/navigation';
import { getCurrentSuperAdmin } from '@/lib/super-admin-auth';
import { hasPermission } from '@/lib/permissions';
import OrganizerApprovalsPageContent from './page-content';

export default async function SuperAdminOrganizerApprovalsPage() {
  const superAdmin = await getCurrentSuperAdmin();
  if (!superAdmin) {
    redirect('/super-admin/login');
  }
  if (!hasPermission(superAdmin.role, 'Organizer Approvals:Access')) {
    redirect('/super-admin/dashboard');
  }
  return <OrganizerApprovalsPageContent basePath="/super-admin" />;
}
