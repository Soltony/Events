
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import EventApprovalsPageContent from './page-content';

export default async function EventApprovalsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  if (!hasPermission(user.role, 'Event Approvals:Access')) {
    redirect('/dashboard');
  }

  return <EventApprovalsPageContent />;
}
