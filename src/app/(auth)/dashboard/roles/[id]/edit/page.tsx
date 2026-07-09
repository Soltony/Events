
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import EditRolePageContent from '@/app/super-admin/(dashboard)/roles/[id]/edit/page-content';

export default async function DashboardEditRolePage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }
  if (!hasPermission(user.role, 'Roles:Update')) {
    redirect('/dashboard');
  }
  return <EditRolePageContent basePath="/dashboard" />;
}
