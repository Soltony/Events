
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import HomeAdsPageContent from '@/app/super-admin/(dashboard)/homeads/page-content';

export default async function DashboardHomeAdsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }
  if (!hasPermission(user.role, 'Homepage Carousel:Read')) {
    redirect('/dashboard');
  }
  return <HomeAdsPageContent />;
}
