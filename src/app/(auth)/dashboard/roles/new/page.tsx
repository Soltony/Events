
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import CreateRolePageContent from '@/app/super-admin/(dashboard)/roles/new/page-content';

export default async function DashboardNewRolePage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }
  if (!hasPermission(user.role, 'Roles:Create')) {
    redirect('/dashboard');
  }
  return <CreateRolePageContent basePath="/dashboard" />;
}
