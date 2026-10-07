
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import PerformanceOverviewContent from '@/app/super-admin/(dashboard)/dashboard/page-content';

export default async function DashboardPerformanceOverviewPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  if (!hasPermission(user.role, 'Performance:Overview')) {
    redirect('/dashboard');
  }

  return <PerformanceOverviewContent />;
}
