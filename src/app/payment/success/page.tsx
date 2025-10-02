
'use client';

import { useState, useEffect, Suspense, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import QRCode from 'qrcode';
import { format } from 'date-fns';
import { CheckCircle2, Download, Calendar, MapPin, Ticket as TicketIcon, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { getTicketDetailsForConfirmation } from '@/lib/actions';
import type { Attendee, Event, TicketType } from '@prisma/client';
import Link from 'next/link';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { revalidatePath } from 'next/cache';

interface TicketDetails extends Attendee {
    event: Event;
    ticketType: TicketType;
}

function formatEventDate(startDate: Date, endDate: Date | null | undefined): string {
    if (endDate) {
        return `${format(new Date(startDate), 'LLL dd, y')} - ${format(new Date(endDate), 'LLL dd, y')}`;
    }
    return format(new Date(startDate), 'LLL dd, y');
}

function SuccessContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const transactionId = searchParams.get('transaction_id');
    const sessionId = searchParams.get('session_id');
    const idToCheck = sessionId || transactionId; // prefer sessionId
    
    const [ticket, setTicket] = useState<TicketDetails | null>(null);
    const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isSuccessDialogOpen, setIsSuccessDialogOpen] = useState(false);

    useEffect(() => {
        if (!idToCheck) {
            setError("Transaction or Session ID is missing from the URL.");
            setLoading(false);
            return;
        }

        const pollForStatus = async (retries = 10, delay = 2000): Promise<{attendeeId: number | null, isMock: boolean}> => {
            for (let i = 0; i < retries; i++) {
                try {
                    const response = await fetch(`/api/payment/status/${idToCheck}`);
                    if (!response.ok) {
                        await new Promise(resolve => setTimeout(resolve, delay));
                        continue;
                    }
                    const data = await response.json();
                    if (data.status === 'COMPLETED' && data.attendeeId) {
                        return { attendeeId: data.attendeeId, isMock: false };
                    }
                     // MOCK FLOW: If status is still PENDING after a while, we proceed.
                    if (data.status === 'PENDING' && i > 1) { 
                        // The backend will create the attendee from the pending order
                        const mockResponse = await fetch('/api/payment/arifpay/notify', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ sessionId: idToCheck, transaction: { transactionStatus: 'SUCCESS' }})
                        });
                        if (mockResponse.ok) {
                            // Give it a moment to process, then retry polling.
                            await new Promise(resolve => setTimeout(resolve, 1000));
                            continue;
                        }
                    }
                    if (data.status === 'FAILED') {
                        throw new Error('Payment failed.');
                    }
                } catch (e) {
                     console.error("Polling error:", e);
                }
                await new Promise(resolve => setTimeout(resolve, delay));
            }
            return { attendeeId: null, isMock: false };
        };

        const fetchTicketData = async (attendeeId: number) => {
             try {
                const ticketDetails = await getTicketDetailsForConfirmation(attendeeId);
                if (!ticketDetails) throw new Error("Could not retrieve ticket details.");
                setTicket(ticketDetails);
                
                const myTickets = JSON.parse(localStorage.getItem('myTickets') || '[]') as number[];
                if (!myTickets.includes(ticketDetails.id)) {
                    myTickets.push(ticketDetails.id);
                    localStorage.setItem('myTickets', JSON.stringify(myTickets));
                }

                const qrCodeData = JSON.stringify({ ticketId: ticketDetails.id });
                const dataUrl = await QRCode.toDataURL(qrCodeData, { errorCorrectionLevel: 'H', type: 'image/png', quality: 0.92, margin: 1 });
                setQrCodeDataUrl(dataUrl);

                setIsSuccessDialogOpen(true); // Show success dialog
                setLoading(false);

            } catch (err: any) {
                setError(err.message || "Failed to load ticket data.");
                setLoading(false);
            }
        };

        pollForStatus().then(({ attendeeId, isMock }) => {
            if (attendeeId) {
                fetchTicketData(attendeeId);
            } else {
                setError("Payment confirmation timed out. Please check 'My Tickets' page later or contact support.");
                setLoading(false);
            }
        }).catch(err => {
            const eventId = searchParams.get('event_id');
            router.replace(`/payment/failure?event_id=${eventId}`);
        });

    }, [idToCheck, searchParams, router]);

    const handleDownload = () => {
        if (!qrCodeDataUrl || !ticket) return;
        const link = document.createElement('a');
        link.href = qrCodeDataUrl;
        link.download = `ticket-qr-${ticket.event.name.replace(/\s+/g, '_')}-${ticket.id}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (loading) {
        return (
             <Card className="shadow-lg">
                <CardHeader className="text-center items-center bg-secondary/30 p-8">
                    <Loader2 className="h-16 w-16 text-primary animate-spin mb-4" />
                    <CardTitle className="text-3xl">Processing Payment...</CardTitle>
                    <CardDescription className="text-lg">
                        Your payment is being confirmed. Please wait a moment.
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-8 text-center">
                    <p className="text-muted-foreground mb-6">
                        This should only take a few seconds. Please do not close this window.
                    </p>
                </CardContent>
            </Card>
        );
    }
    
    if (error) {
        // This is a fallback, though usually it redirects to failure page
        return (
            <Card className="shadow-lg border-destructive">
                <CardHeader>
                    <CardTitle>Error</CardTitle>
                    <CardDescription>{error}</CardDescription>
                </CardHeader>
            </Card>
        )
    }

    if (!ticket) {
        // This should not happen if loading is false and there's no error
        return null;
    }

    return (
        <>
            <Card className="shadow-lg">
                <CardHeader className="text-center items-center bg-green-50 dark:bg-green-900/10 p-8">
                    <CheckCircle2 className="h-16 w-16 text-green-500 mb-4" />
                    <CardTitle className="text-3xl">Transaction Successful!</CardTitle>
                    <CardDescription className="text-lg">Thank you for your purchase. Your ticket is confirmed.</CardDescription>
                </CardHeader>
                <CardContent className="p-8">
                    <div className="flex flex-col items-center space-y-6">
                        <p className="text-center text-muted-foreground">
                            Present this QR code at the event entrance for scanning.
                        </p>
                        <div className="p-4 border-4 border-muted rounded-lg bg-white">
                             {qrCodeDataUrl && <img src={qrCodeDataUrl} alt="Ticket QR Code" className="h-64 w-64" />}
                        </div>
                        <Button onClick={handleDownload}>
                            <Download className="mr-2 h-4 w-4" />
                            Download QR Code
                        </Button>
                    </div>

                    <div className="border-t my-8"></div>

                    <div className="space-y-4">
                        <h3 className="text-2xl font-semibold">{ticket.event.name}</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-muted-foreground">
                            <div className="flex items-start gap-3">
                                <TicketIcon className="h-5 w-5 mt-1 text-primary" />
                                <div>
                                    <span className="font-semibold text-foreground">{ticket.ticketType.name}</span>
                                    <p>Attendee: {ticket.name}</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <Calendar className="h-5 w-5 mt-1 text-primary" />
                                <div>
                                    <span className="font-semibold text-foreground">{formatEventDate(ticket.event.startDate, ticket.event.endDate)}</span>
                                    <p>Date of Purchase: {format(new Date(ticket.createdAt), 'LLL dd, y')}</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3 col-span-full">
                                <MapPin className="h-5 w-5 mt-1 text-primary" />
                                <div>
                                    <span className="font-semibold text-foreground">{ticket.event.location}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                     <div className="border-t my-8"></div>

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

            <AlertDialog open={isSuccessDialogOpen} onOpenChange={setIsSuccessDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader className="text-center items-center">
                        <CheckCircle2 className="h-12 w-12 text-green-500 mb-4" />
                        <AlertDialogTitle className="text-2xl">Transaction Successful!</AlertDialogTitle>
                        <AlertDialogDescription>
                            Your ticket details are now ready.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogAction onClick={() => setIsSuccessDialogOpen(false)} className="w-full">
                        View Ticket
                    </AlertDialogAction>
                </AlertDialogContent>
            </AlertDialog>
        </>
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
