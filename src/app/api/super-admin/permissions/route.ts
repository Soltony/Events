
import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdminPermission } from '@/lib/super-admin-auth';
import { getPermissionsGroups } from '@/lib/permissions';
import { withApiErrorHandling } from '@/lib/api-handler';

export const GET = withApiErrorHandling(async function GET(req: NextRequest) {
  try {
    await requireSuperAdminPermission('Roles:Read');
  } catch {
    return NextResponse.json({ message: 'Not authenticated.' }, { status: 401 });
  }

  return NextResponse.json({ permissions: getPermissionsGroups() }, { status: 200 });
});
