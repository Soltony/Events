
'use client';

import { useEffect, Suspense } from 'react';
import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, CheckCircle2 } from 'lucide-react';

function ProcessingPaymentContent() {
function ProcessingPaymentContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const transactionId = searchParams.get('transaction_id');
    const sessionId = searchParams.get('session_id');

    useEffect(() => {
        let isCancelled = false;

        const completeAndRedirect = async () => {
            if (!transactionId && !sessionId) return;

            const idToUse = sessionId || transactionId!;

            try {
                // Attempt to mark paid in mock/local flow
                await fetch('/api/payment/complete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: idToUse })
                }).catch(() => {});

                // Poll status briefly until COMPLETED
                const poll = async (retries = 8, delay = 800) => {
                    for (let i = 0; i < retries; i++) {
                        const res = await fetch(`/api/payment/status/${idToUse}`);
                        if (res.ok) {
                            const data = await res.json();
                            if (data.status === 'COMPLETED' && data.attendeeId) {
                                return data.attendeeId as number;
                            }
                            if (data.status === 'FAILED') {
                                throw new Error('Payment failed');
                            }
                        }
                        await new Promise(r => setTimeout(r, delay));
                    }
                    return null;
                };

                const attendeeId = await poll();
                // Short UX delay before redirect
                await new Promise(r => setTimeout(r, 700));
                if (!isCancelled) {
                    router.replace(`/payment/success?transaction_id=${transactionId || idToUse}`);
                }
            } catch {
                if (!isCancelled) {
                    router.replace(`/payment/failure`);
                }
            }
        };

        completeAndRedirect();
        return () => { isCancelled = true; };
    }, [router, sessionId, transactionId]);

    return (
        <div className="container mx-auto p-8 max-w-lg">
            <div className="bg-card border rounded-xl p-8 text-center space-y-4">
                <Loader2 className="h-10 w-10 mx-auto animate-spin text-primary" />
                <h1 className="text-2xl font-semibold">Processing Payment</h1>
                <p className="text-muted-foreground">Please wait while we confirm your payment...</p>
                <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Do not close this window.</span>
                </div>
            </div>
        </div>
    );
}

export default function ProcessingPaymentPage() {
    return (
        <Suspense fallback={
             <div className="container mx-auto p-8 max-w-lg">
                <div className="bg-card border rounded-xl p-8 text-center space-y-4">
                    <Loader2 className="h-10 w-10 mx-auto animate-spin text-primary" />
                    <h1 className="text-2xl font-semibold">Loading...</h1>
                </div>
            </div>
        }>
            <ProcessingPaymentContent />
        </Suspense>
    );
}
