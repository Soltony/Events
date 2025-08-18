
'use client';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, Suspense, useState } from "react";


function SuccessContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const transactionId = searchParams.get('transaction_id');
    const [countdown, setCountdown] = useState(10);
    const [finalAttendeeId, setFinalAttendeeId] = useState<number | null>(null);

    // Polling for status
    useEffect(() => {
        if (!transactionId) return;

        const interval = setInterval(async () => {
             try {
                const response = await fetch(`/api/payment/status/${transactionId}`);
                if (response.ok) {
                    const data = await response.json();
                    if (data.status === 'COMPLETED' && data.attendeeId) {
                        setFinalAttendeeId(data.attendeeId);
                        clearInterval(interval);
                    } else if (data.status === 'FAILED') {
                        // This case shouldn't happen on success page, but handle it
                        clearInterval(interval);
                        const eventId = searchParams.get('event_id');
                        router.replace(`/payment/failure?event_id=${eventId}`);
                    }
                }
             } catch (error) {
                console.error("Error polling for payment status:", error);
             }
        }, 2000); // Poll every 2 seconds

        // Cleanup on component unmount
        return () => clearInterval(interval);

    }, [transactionId, router, searchParams]);

    // Countdown and redirect
    useEffect(() => {
      if (finalAttendeeId) {
        const countdownInterval = setInterval(() => {
          setCountdown(prev => prev - 1);
        }, 1000);

        const redirectTimeout = setTimeout(() => {
          window.location.href = `/ticket/${finalAttendeeId}/confirmation`;
        }, 10000);

        return () => {
          clearInterval(countdownInterval);
          clearTimeout(redirectTimeout);
        };
      }
    }, [finalAttendeeId]);


    return (
        <Card className="shadow-lg">
            <CardHeader className="text-center items-center bg-secondary/30 p-8">
                <Loader2 className="h-16 w-16 text-primary animate-spin mb-4" />
                <CardTitle className="text-3xl">Finalizing Your Purchase...</CardTitle>
                <CardDescription className="text-lg">
                    Your payment is being processed. Please wait a moment.
                </CardDescription>
            </CardHeader>
            <CardContent className="p-8 text-center">
                {finalAttendeeId ? (
                   <>
                     <p className="text-muted-foreground mb-2">
                        Your ticket has been confirmed!
                     </p>
                     <p className="text-muted-foreground mb-6">
                        Redirecting you to your ticket in {countdown} seconds...
                     </p>
                   </>
                ) : (
                    <p className="text-muted-foreground mb-6">
                        This page will automatically redirect once your ticket is confirmed. Please do not close this window.
                    </p>
                )}
                <div className="flex justify-center gap-4">
                    <Button asChild variant="outline">
                        <Link href="/">Back to All Events</Link>
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}

export default function PaymentSuccessPage() {
    return (
        <div className="container mx-auto py-12 max-w-2xl">
            <Suspense fallback={<div>Loading...</div>}>
                <SuccessContent />
            </Suspense>
        </div>
    )
}
