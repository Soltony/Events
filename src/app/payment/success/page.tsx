
'use client';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, Suspense } from "react";

function SuccessContent() {
    const searchParams = useSearchParams();
    const sessionId = searchParams.get('sessionId');

    useEffect(() => {
        // Here you might want to fetch order details based on the sessionId
        // to show a more detailed confirmation page, but for now, we just
        // show a generic success message.
        console.log("Payment success for session:", sessionId);
    }, [sessionId]);

    return (
        <Card className="shadow-lg">
            <CardHeader className="text-center items-center bg-secondary/30 p-8">
                <CheckCircle2 className="h-16 w-16 text-green-500 mb-4" />
                <CardTitle className="text-3xl">Payment Processing!</CardTitle>
                <CardDescription className="text-lg">
                    Your payment is being processed. You will receive your ticket shortly.
                </CardDescription>
            </CardHeader>
            <CardContent className="p-8 text-center">
                <p className="text-muted-foreground mb-6">
                    Thank you for your purchase. Please check the "My Tickets" page soon. Your ticket will appear there once the payment is fully confirmed.
                </p>
                <div className="flex justify-center gap-4">
                    <Button asChild variant="outline">
                        <Link href="/">Back to All Events</Link>
                    </Button>
                     <Button asChild>
                        <Link href="/tickets">Go to My Tickets</Link>
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
            <CardContent className="p-8 space-y-4">
                <Skeleton className="h-5 w-full" />
                <div className="flex justify-center gap-4">
                    <Skeleton className="h-10 w-36" />
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
