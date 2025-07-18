
'use client';

import { useState, useEffect, useRef } from 'react';
import { notFound, useParams } from 'next/navigation';
import QRCode from 'qrcode';
import { format } from 'date-fns';
import { CheckCircle2, Download, Calendar, MapPin, Ticket as TicketIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { getTicketDetailsForConfirmation } from '@/lib/actions';
import type { Attendee, Event, TicketType } from '@prisma/client';
import Link from 'next/link';

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

export default function TicketConfirmationPage() {
    const params = useParams<{ id: string }>();
    const attendeeId = parseInt(params.id, 10);

    const [ticket, setTicket] = useState<TicketDetails | null>(null);
    const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const qrCodeRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isNaN(attendeeId)) {
            setLoading(false);
            notFound();
            return;
        }

        async function fetchTicketAndGenerateQR() {
            try {
                setLoading(true);
                const ticketDetails = await getTicketDetailsForConfirmation(attendeeId);
                
                if (!ticketDetails) {
                    setLoading(false);
                    notFound();
                    return;
                }
                
                setTicket(ticketDetails);

                const qrCodeData = JSON.stringify({
                    ticketId: ticketDetails.id,
                    eventId: ticketDetails.eventId,
                    attendeeName: ticketDetails.name,
                });

                const dataUrl = await QRCode.toDataURL(qrCodeData, {
                    errorCorrectionLevel: 'H',
                    type: 'image/png',
                    quality: 0.92,
                    margin: 1,
                    color: {
                        dark: '#0D1A2E',
                        light: '#FFFFFF',
                    },
                });
                setQrCodeDataUrl(dataUrl);

            } catch (error) {
                console.error("Failed to fetch ticket or generate QR code:", error);
            } finally {
                setLoading(false);
            }
        }

        fetchTicketAndGenerateQR();
    }, [attendeeId]);
    
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
            <div className="container mx-auto py-12 max-w-2xl">
                <Card>
                    <CardHeader className="text-center items-center">
                        <Skeleton className="h-16 w-16 rounded-full" />
                        <Skeleton className="h-8 w-64 mt-4" />
                        <Skeleton className="h-5 w-80 mt-2" />
                    </CardHeader>
                    <CardContent className="space-y-8">
                        <div className="flex justify-center">
                            <Skeleton className="h-64 w-64" />
                        </div>
                        <div className="border-t pt-6 space-y-4">
                            <Skeleton className="h-6 w-full" />
                            <Skeleton className="h-5 w-3/4" />
                            <Skeleton className="h-5 w-1/2" />
                        </div>
                        <Skeleton className="h-12 w-full" />
                    </CardContent>
                </Card>
            </div>
        )
    }

    if (!ticket) {
        return notFound();
    }

    return (
        <div className="container mx-auto py-12 max-w-2xl">
            <Card className="shadow-lg">
                <CardHeader className="text-center items-center bg-secondary/30 p-8">
                    <CheckCircle2 className="h-16 w-16 text-green-500 mb-4" />
                    <CardTitle className="text-3xl">Purchase Successful!</CardTitle>
                    <CardDescription className="text-lg">Thank you! Your ticket is confirmed.</CardDescription>
                </CardHeader>
                <CardContent className="p-8">
                    <div className="flex flex-col items-center space-y-6">
                        <p className="text-center text-muted-foreground">
                            Present this QR code at the event entrance for scanning.
                        </p>
                        <div ref={qrCodeRef} className="p-4 border-4 border-muted rounded-lg bg-white">
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

                    <div className="flex justify-center">
                        <Button asChild variant="outline">
                            <Link href="/">Back to All Events</Link>
                        </Button>
                    </div>

                </CardContent>
            </Card>
        </div>
    );
}
