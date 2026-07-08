
import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdminPermission } from '@/lib/super-admin-auth';

export async function POST(req: NextRequest) {
  try {
    try {
      // Shared by both the add-slide and edit-slide flows in the same dialog.
      await requireSuperAdminPermission('Homepage Carousel:Create').catch(() =>
        requireSuperAdminPermission('Homepage Carousel:Update')
      );
    } catch {
      return NextResponse.json({ success: false, error: 'Authentication required.' }, { status: 401 });
    }

    const { file } = await req.json();

    if (!file || typeof file !== 'string' || !file.startsWith('data:image/')) {
      return NextResponse.json({ success: false, error: 'Invalid file data provided. Expected a data URI.' }, { status: 400 });
    }

    // Same prototype approach as the main app's /api/upload: return the data URI directly.
    const imageUrl = file;

    return NextResponse.json({ success: true, url: imageUrl });
  } catch (error) {
    console.error('Super admin upload API error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error.' }, { status: 500 });
  }
}
