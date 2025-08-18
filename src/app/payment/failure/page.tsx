
'use client';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { XCircle } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function PaymentFailurePage() {
    const searchParams = useSearchParams();
    const eventId = searchParams.get('event_id');
    const [countdown, setCountdown] = useState(10);

    useEffect(() => {
        const countdownInterval = setInterval(() => {
            setCountdown(prev => prev - 1);
        }, 1000);

        const redirectTimeout = setTimeout(() => {
            if (eventId) {
                window.location.href = `https://nibteratickets.nibbank.com.et/events/${eventId}`;
            } else {
                window.location.href = `https://nibteratickets.nibbank.com.et/`;
            }
        }, 10000);

        return () => {
            clearInterval(countdownInterval);
            clearTimeout(redirectTimeout);
        };
    }, [eventId]);

    return (
        <div className="container mx-auto py-12 max-w-2xl">
            <Card className="shadow-lg border-destructive">
                <CardHeader className="text-center items-center bg-destructive/10 p-8">
                    <XCircle className="h-16 w-16 text-destructive mb-4" />
                    <CardTitle className="text-3xl">Payment Failed</CardTitle>
                    <CardDescription className="text-lg">
                        Unfortunately, we were unable to process your payment.
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-8 text-center">
                    <p className="text-muted-foreground mb-6">
                        Please try again. You will be redirected back to the event page in {countdown} seconds.
                    </p>
                    <div className="flex justify-center gap-4">
                        <Button asChild>
                            <Link href={eventId ? `/events/${eventId}` : '/'}>
                                Back to Event Page
                            </Link>
                        </Button>
                        <Button asChild variant="outline">
                            <Link href="/">Back to All Events</Link>
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
