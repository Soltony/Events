
'use client';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, Suspense } from "react";

function SuccessContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const transactionId = searchParams.get('transaction_id');

    useEffect(() => {
        if (!transactionId) {
            router.replace('/'); // No transaction ID, go home.
            return;
        };

        const interval = setInterval(async () => {
             try {
                // Poll the server to check if the pending order has been processed by the webhook
                const response = await fetch(`/api/payment/status/${transactionId}`);
                if (response.ok) {
                    const data = await response.json();
                    if (data.status === 'COMPLETED' && data.attendeeId) {
                        clearInterval(interval);
                        router.replace(`/ticket/${data.attendeeId}/confirmation`);
                    } else if (data.status === 'FAILED') {
                        clearInterval(interval);
                        // Redirect to a failure page or show a toast
                        router.replace(`/`);
                    }
                }
             } catch (error) {
                console.error("Error polling for payment status:", error);
             }
        }, 3000); // Poll every 3 seconds

        // Cleanup on component unmount
        return () => clearInterval(interval);

    }, [transactionId, router]);


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
                <p className="text-muted-foreground mb-6">
                    This page will automatically redirect once your ticket is confirmed. Please do not close this window.
                </p>
                <div className="flex justify-center gap-4">
                    <Button asChild variant="outline">
                        <Link href="/">Back to All Events</Link>
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}

function SuccessSkeleton() {
    return (
        <Card>
            <CardHeader className="text-center items-center p-8">
                <Skeleton className="h-16 w-16 rounded-full" />
                <Skeleton className="h-8 w-64 mt-4" />
                <Skeleton className="h-5 w-80 mt-2" />
            </CardHeader>
            <CardContent className="p-8 space-y-4 text-center">
                <Skeleton className="h-5 w-full" />
                <div className="flex justify-center">
                    <Skeleton className="h-10 w-36" />
                </div>
            </CardContent>
        </Card>
    )
}

export default function PaymentSuccessPage() {
    return (
        <div className="container mx-auto py-12 max-w-2xl">
            <Suspense fallback={<SuccessSkeleton />}>
                <SuccessContent />
            </Suspense>
        </div>
    )
}
