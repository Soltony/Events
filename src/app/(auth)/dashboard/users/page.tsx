
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import UserManagementPage from '@/app/super-admin/(dashboard)/users/page-content';

export default async function DashboardUsersPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }
  if (!hasPermission(user.role, 'Users:Read')) {
    redirect('/dashboard');
  }
  return <UserManagementPage basePath="/dashboard" />;
}
