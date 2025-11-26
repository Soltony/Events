
'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import QRCode from 'qrcode';
import { format } from 'date-fns';
import { CheckCircle2, Download, Calendar, MapPin, Ticket as TicketIcon, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getTicketDetailsForConfirmation } from '@/lib/actions';
import type { Attendee, Event, TicketType } from '@prisma/client';
import Link from 'next/link';
import api from '@/lib/api';

interface TicketDetails extends Attendee {
    event: Event;
    ticketType: TicketType;
}

function SuccessContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const transactionId = searchParams.get('transaction_id');
    const [status, setStatus] = useState<'polling' | 'redirecting' | 'error'>('polling');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!transactionId) {
            setError("Transaction ID is missing from the URL.");
            setStatus('error');
            return;
        }

        let isCancelled = false;
        let pollCount = 0;
        const maxPolls = 20; // Poll for 40 seconds

        const poll = async () => {
            if (isCancelled || pollCount >= maxPolls) {
                if (!isCancelled) {
                    setError("Payment confirmation timed out. Please check 'My Tickets' later.");
                    setStatus('error');
                }
                return;
            }
            pollCount++;
            
            try {
                const response = await api.get(`/api/payment/status/${transactionId}`);
                if (response.data.status === 'COMPLETED') {
                    if (response.data.attendeeId) {
                        setStatus('redirecting');
                        // Set a flag for the toast before redirecting
                        sessionStorage.setItem('showSuccessToast', 'true');
                        router.replace(`/ticket/${response.data.attendeeId}/confirmation`);
                    } else {
                        throw new Error("Could not retrieve ticket details after confirmation.");
                    }
                    isCancelled = true; // Stop polling
                } else {
                    setTimeout(poll, 2000);
                }
            } catch (error) {
                console.error("Polling error", error);
                setTimeout(poll, 2000);
            }
        };

        poll();

        return () => { isCancelled = true; };
    }, [transactionId, router]);


    if (status === 'error') {
        return (
            <Card className="shadow-lg border-destructive">
                 <CardHeader className="text-center items-center bg-destructive/10 p-8">
                    <CardTitle className="text-3xl text-destructive">Error</CardTitle>
                    <CardDescription className="text-lg">{error}</CardDescription>
                </CardHeader>
                 <CardContent className="p-8 text-center">
                    <Button asChild>
                        <Link href="/">Back to Homepage</Link>
                    </Button>
                </CardContent>
            </Card>
        )
    }

    return (
         <Card className="shadow-lg">
            <CardHeader className="text-center items-center bg-secondary/30 p-8">
                <Loader2 className="h-16 w-16 text-primary animate-spin mb-4" />
                <CardTitle className="text-3xl">Finalizing Your Ticket...</CardTitle>
                <CardDescription className="text-lg">
                    Please wait a moment while we confirm your payment.
                </CardDescription>
            </CardHeader>
            <CardContent className="p-8 text-center">
                <p className="text-muted-foreground mb-6">
                    This should only take a few seconds. Do not close this window.
                </p>
            </CardContent>
        </Card>
    );
}

export default function PaymentSuccessPage() {
    return (
        <div className="container mx-auto py-12 max-w-2xl">
            <Suspense fallback={
                 <Card className="shadow-lg">
                    <CardHeader className="text-center items-center bg-secondary/30 p-8">
                        <Loader2 className="h-16 w-16 text-primary animate-spin mb-4" />
                        <CardTitle className="text-3xl">Loading Payment Details...</CardTitle>
                    </CardHeader>
                </Card>
            }>
                <SuccessContent />
            </Suspense>
        </div>
    );
}
