
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import PerformanceBranchesContent from '@/app/super-admin/(dashboard)/branches/page-content';

export default async function DashboardPerformanceBranchesPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  if (!hasPermission(user.role, 'Performance:Branch Comparison')) {
    redirect('/dashboard');
  }

  return <PerformanceBranchesContent />;
}
