
import { redirect } from 'next/navigation';
import { getCurrentSuperAdmin } from '@/lib/super-admin-auth';
import { hasPermission } from '@/lib/permissions';
import HomeAdsPageContent from './page-content';

export default async function SuperAdminHomeAdsPage() {
  const superAdmin = await getCurrentSuperAdmin();
  if (!superAdmin) {
    redirect('/super-admin/login');
  }
  if (!hasPermission(superAdmin.role, 'Homepage Carousel:Read')) {
    redirect('/super-admin/dashboard');
  }
  return <HomeAdsPageContent />;
}
