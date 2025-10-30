'use client';

import { useState, useEffect } from 'react';
import { notFound, useParams } from 'next/navigation';
import QRCode from 'qrcode';
import { format } from 'date-fns';
import {
  CheckCircle2,
  Calendar,
  MapPin,
  Ticket as TicketIcon,
  User,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { getTicketDetailsForConfirmation } from '@/lib/actions';
import type { Attendee, Event, TicketType } from '@prisma/client';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';

interface TicketDetails extends Attendee {
  event: Event;
  ticketType: TicketType;
}

function formatEventDate(startDate: Date, endDate: Date | null | undefined): string {
  const startDateFormat = 'EEE, LLL dd, yyyy @ hh:mm a';

  if (endDate) {
    const endDateFormat =
      format(new Date(endDate), 'LLL dd, y') === format(new Date(startDate), 'LLL dd, y')
        ? 'hh:mm a'
        : startDateFormat;
    return `${format(new Date(startDate), startDateFormat)} - ${format(
      new Date(endDate),
      endDateFormat
    )}`;
  }
  return format(new Date(startDate), startDateFormat);
}

export default function TicketConfirmationPage() {
  const params = useParams<{ id: string }>();
  const attendeeId = parseInt(params.id, 10);
  const { toast } = useToast();

  const [ticket, setTicket] = useState<TicketDetails | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isNaN(attendeeId)) {
      setLoading(false);
      notFound();
      return;
    }

    const showToast = sessionStorage.getItem('showSuccessToast');
    if (showToast) {
      toast({
        title: 'Purchase Successful!',
        description: 'Your ticket is confirmed.',
        variant: 'default',
      });
      sessionStorage.removeItem('showSuccessToast');
    }

    async function fetchTicketAndGenerateQR() {
      try {
        setLoading(true);
        const ticketDetails = await getTicketDetailsForConfirmation(attendeeId.toString());

        if (!ticketDetails) {
          setLoading(false);
          notFound();
          return;
        }

        setTicket(ticketDetails);

        const qrCodeData = ticketDetails.id.toString();

        const dataUrl = await QRCode.toDataURL(qrCodeData, {
          errorCorrectionLevel: 'H',
          type: 'image/png',
          margin: 1,
          color: {
            dark: '#0D1A2E',
            light: '#FFFFFF',
          },
        });
        setQrCodeDataUrl(dataUrl);
      } catch (error) {
        console.error('Failed to fetch ticket or generate QR code:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchTicketAndGenerateQR();
  }, [attendeeId, toast]);

  if (loading) {
    return (
      <div className="container mx-auto py-12 max-w-lg">
        <Card className="bg-card/90 backdrop-blur-sm">
          <CardHeader className="text-center items-center p-6">
            <Skeleton className="h-12 w-12 rounded-full" />
            <Skeleton className="h-8 w-48 mt-4" />
            <Skeleton className="h-5 w-64 mt-2" />
          </CardHeader>
          <CardContent className="space-y-6 p-6">
            <div className="flex justify-center">
              <Skeleton className="h-56 w-56" />
            </div>
            <div className="border-t pt-6 space-y-4">
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-5 w-1/2" />
            </div>
            <div className="flex flex-col gap-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!ticket) {
    return notFound();
  }

  return (
    <div className="container mx-auto py-8 md:py-12 max-w-lg">
      <Card className="shadow-2xl rounded-2xl overflow-hidden bg-card/90 backdrop-blur-sm border-primary/20">
        <CardHeader className="text-center items-center bg-primary/10 p-6 space-y-3">
          <CheckCircle2 className="h-12 w-12 text-primary" />
          <CardTitle className="text-3xl font-bold text-primary-foreground">
            Thank You!
          </CardTitle>
          <CardDescription className="text-lg text-muted-foreground">
            Your ticket has been confirmed.
          </CardDescription>
        </CardHeader>

        <CardContent className="p-6 md:p-8">
          <div className="flex flex-col items-center space-y-4">
            <div className="p-3 border-4 border-muted rounded-lg bg-white shadow-md">
              {qrCodeDataUrl && (
                <img
                  id="qr-code-image"
                  src={qrCodeDataUrl}
                  alt="Ticket QR Code"
                  className="w-48 h-48 md:w-56 md:h-56"
                />
              )}
            </div>
            <p className="text-center text-sm text-muted-foreground max-w-xs">
              Please have this QR code ready for scanning before entering the event.
            </p>
          </div>

          <div className="border-t my-6"></div>

          <div className="space-y-4 text-sm">
            <h3 className="text-xl font-semibold text-center mb-4">
              {ticket.event.name}
            </h3>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground flex items-center gap-2">
                <User className="h-4 w-4" /> Attendee
              </span>
              <span className="font-semibold">{ticket.name}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground flex items-center gap-2">
                <TicketIcon className="h-4 w-4" /> Ticket Type
              </span>
              <span className="font-semibold">
                {ticket.ticketType.name.split(' - ')[0]}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground flex items-center gap-2">
                <Calendar className="h-4 w-4" /> Date
              </span>
              <span className="font-semibold text-right">
                {formatEventDate(ticket.event.startDate, ticket.event.endDate)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground flex items-center gap-2">
                <MapPin className="h-4 w-4" /> Location
              </span>
              <span className="font-semibold">
                {ticket.event.location.split('||')[0]}
              </span>
            </div>
          </div>

          <div className="border-t my-6"></div>

          <div className="flex justify-center">
            <Button asChild size="lg" variant="outline" className="w-full">
              <Link href="/tickets">Close</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
