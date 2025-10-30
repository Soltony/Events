import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import { decryptSessionPayload } from '@/lib/sessionCrypto';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest) {
	try {
		const cookieStore = await cookies();
		const sessionCookie = cookieStore.get('auth');
		if (!sessionCookie?.value) {
			return NextResponse.json({ status: 'NOT_AUTHENTICATED' }, { status: 401 });
		}

		const decrypted = await decryptSessionPayload(sessionCookie.value);
		const { phoneNumber } = JSON.parse(decrypted || '{}');
		if (!phoneNumber) {
			return NextResponse.json({ status: 'NO_PHONE' }, { status: 400 });
		}

		// Find the latest pendingOrder for this phone (either PENDING/COMPLETED/FAILED)
		const order = await prisma.pendingOrder.findFirst({
			where: {
				AND: [
					{ attendeeData: { path: ['phone'], equals: phoneNumber } as any },
					{ status: { in: ['PENDING', 'COMPLETED', 'FAILED'] } },
				],
			},
			orderBy: { createdAt: 'desc' },
			select: { status: true, transactionId: true, attendeeId: true },
		});

		if (!order) {
			return NextResponse.json({ status: 'NOT_FOUND' }, { status: 404 });
		}

		return NextResponse.json(order);
	} catch (error) {
		console.error('by-session status error', error);
		return NextResponse.json({ error: 'Failed to check status' }, { status: 500 });
	}
}


