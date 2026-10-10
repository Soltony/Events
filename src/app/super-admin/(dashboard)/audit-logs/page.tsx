import { redirect } from 'next/navigation';
import { getCurrentSuperAdmin } from '@/lib/super-admin-auth';
import { hasPermission } from '@/lib/permissions';
import AuditLogsPageContent from './page-content';

export default async function SuperAdminAuditLogsPage() {
  const superAdmin = await getCurrentSuperAdmin();
  if (!superAdmin) {
    redirect('/super-admin/login');
  }
  if (!hasPermission(superAdmin.role, 'Audit Logs:Read')) {
    redirect('/super-admin/dashboard');
  }
  return <AuditLogsPageContent />;
}
