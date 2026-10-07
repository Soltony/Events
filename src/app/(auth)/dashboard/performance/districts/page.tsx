
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import PerformanceDistrictsContent from '@/app/super-admin/(dashboard)/districts/page-content';

export default async function DashboardPerformanceDistrictsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  if (!hasPermission(user.role, 'Performance:District Comparison')) {
    redirect('/dashboard');
  }

  return <PerformanceDistrictsContent />;
}
