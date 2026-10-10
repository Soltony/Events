import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import AuditLogsPageContent from '@/app/super-admin/(dashboard)/audit-logs/page-content';

export default async function DashboardAuditLogsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }
  if (!hasPermission(user.role, 'Audit Logs:Read')) {
    redirect('/dashboard');
  }
  return <AuditLogsPageContent />;
}
