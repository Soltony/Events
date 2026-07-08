
import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdminPermission } from '@/lib/super-admin-auth';
import { getPermissionsGroups } from '@/lib/permissions';

export async function GET(req: NextRequest) {
  try {
    await requireSuperAdminPermission('Roles:Read');
  } catch {
    return NextResponse.json({ message: 'Not authenticated.' }, { status: 401 });
  }

  return NextResponse.json({ permissions: getPermissionsGroups() }, { status: 200 });
}
