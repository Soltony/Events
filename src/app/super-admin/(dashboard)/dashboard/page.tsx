
import { redirect } from 'next/navigation';
import { getCurrentSuperAdmin } from '@/lib/super-admin-auth';
import { hasPermission } from '@/lib/permissions';
import DashboardPageContent from './page-content';

export default async function SuperAdminOverviewPage() {
  const superAdmin = await getCurrentSuperAdmin();
  if (!superAdmin) {
    redirect('/super-admin/login');
  }
  if (!hasPermission(superAdmin.role, 'Performance:Overview')) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-center text-muted-foreground">
        You don&apos;t have permission to view this module.
      </div>
    );
  }
  return <DashboardPageContent />;
}
