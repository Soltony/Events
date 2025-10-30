import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth-middleware';

// Example protected API route that requires Events:Read permission
export const GET = requirePermission('Events:Read')(async (req: NextRequest, user) => {
  try {
    // This handler only runs if user is authenticated and has Events:Read permission
    return NextResponse.json({
      message: 'Access granted',
      user: {
        id: user.id,
        name: `${user.firstName} ${user.lastName}`,
        role: user.role.name
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

// Example of a route that only requires authentication (no specific permission)
import { requireAuth } from '@/lib/auth-middleware';

export const POST = requireAuth(async (req: NextRequest, user) => {
  try {
    // This handler only runs if user is authenticated
    const body = await req.json();
    
    return NextResponse.json({
      message: 'Action completed',
      userId: user.id
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});
