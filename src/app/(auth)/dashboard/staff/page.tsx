
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import StaffPageContent from '@/app/super-admin/(dashboard)/staff/page-content';

export default async function DashboardStaffPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }
  if (!hasPermission(user.role, 'Staff:Read')) {
    redirect('/dashboard');
  }
  return <StaffPageContent />;
}
