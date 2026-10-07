
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import OrganizerApprovalsPageContent from '@/app/super-admin/(dashboard)/organizer-approvals/page-content';

export default async function DashboardOrganizerApprovalsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }
  if (!hasPermission(user.role, 'Organizer Approvals:Access')) {
    redirect('/dashboard');
  }
  return <OrganizerApprovalsPageContent basePath="/dashboard" />;
}
