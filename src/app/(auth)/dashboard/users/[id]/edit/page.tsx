
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import EditUserPageContent from '@/app/super-admin/(dashboard)/users/[id]/edit/page-content';

export default async function DashboardEditUserPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }
  if (!hasPermission(user.role, 'Users:Update')) {
    redirect('/dashboard');
  }
  return <EditUserPageContent basePath="/dashboard" />;
}
