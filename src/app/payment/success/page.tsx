
'use client';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, Suspense } from "react";
import prisma from "@/lib/prisma";

async function getAttendeeIdFromTransaction(transactionId: string | null) {
    if (!transactionId) return null;
    
    // This part must run on the server, we will move it to a server action.
    // For now, we simulate a delay and redirect logic.
    // In a real app, this would be an action:
    // const order = await prisma.pendingOrder.findUnique({ where: { transactionId }});
    // return order?.attendeeId;

    // This is a placeholder for the logic that needs to be moved.
    return new Promise(resolve => setTimeout(() => resolve(null), 2000));
}

function SuccessContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const transactionId = searchParams.get('transaction_id');

    useEffect(() => {
        if (!transactionId) return;

        const interval = setInterval(async () => {
             try {
                // Poll the server to check if the pending order has been processed by the webhook
                const response = await fetch(`/api/payment/status/${transactionId}`);
                if (response.ok) {
                    const data = await response.json();
                    if (data.attendeeId) {
                        clearInterval(interval);
                        router.replace(`/ticket/${data.attendeeId}/confirmation`);
                    }
                }
             } catch (error) {
                console.error("Error polling for payment status:", error);
             }
        }, 2000); // Poll every 2 seconds

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
