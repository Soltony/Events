
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import RolesPageContent from '@/app/super-admin/(dashboard)/roles/page-content';

export default async function DashboardRolesPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }
  if (!hasPermission(user.role, 'Roles:Read')) {
    redirect('/dashboard');
  }
  return <RolesPageContent basePath="/dashboard" />;
}
