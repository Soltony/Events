
import { redirect } from 'next/navigation';
import { getCurrentSuperAdmin } from '@/lib/super-admin-auth';

export default async function SuperAdminIndexPage() {
  const superAdmin = await getCurrentSuperAdmin();
  redirect(superAdmin ? '/super-admin/dashboard' : '/super-admin/login');
}
