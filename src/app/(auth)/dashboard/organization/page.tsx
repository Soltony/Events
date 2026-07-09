
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import OrganizationPageContent from '@/app/super-admin/(dashboard)/organization/page-content';

export default async function DashboardOrganizationPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }
  if (!hasPermission(user.role, 'Organization:Read')) {
    redirect('/dashboard');
  }
  return <OrganizationPageContent />;
}
