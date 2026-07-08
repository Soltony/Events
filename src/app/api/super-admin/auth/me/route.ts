
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSuperAdmin } from '@/lib/super-admin-auth';

export async function GET(req: NextRequest) {
  const superAdmin = await getCurrentSuperAdmin();

  if (!superAdmin) {
    return NextResponse.json({ message: 'Not authenticated.' }, { status: 401 });
  }

  return NextResponse.json({ superAdmin }, { status: 200 });
}
