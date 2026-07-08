
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import UserRegistrationPageContent from './page-content';

export default async function DashboardUserNewPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  if (!hasPermission(user.role, 'Users:Create')) {
    redirect('/dashboard');
  }

  return <UserRegistrationPageContent />;
}
