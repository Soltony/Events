
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { format } from 'date-fns';
import type { Attendee, Event, TicketType } from '@prisma/client';
import { useRouter } from 'next/navigation';

import { getTicketsForUser } from '@/lib/actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowUpRight, Ticket } from 'lucide-react';
import api from '@/lib/api';

interface FullTicket extends Attendee {
  event: Event;
  ticketType: TicketType;
}

function formatEventDate(startDate: Date, endDate: Date | null | undefined): string {
    const startDateFormat = 'LLL dd, y, hh:mm a';
    
    if (endDate) {
      const endDateFormat = format(new Date(endDate), 'LLL dd, y') === format(new Date(startDate), 'LLL dd, y') 
        ? 'hh:mm a'
        : startDateFormat;
      return `${format(new Date(startDate), startDateFormat)} - ${format(new Date(endDate), endDateFormat)}`;
    }
    return format(new Date(startDate), startDateFormat);
}

const DEFAULT_IMAGE_PLACEHOLDER = '/image/nibtickets.jpg';

export default function MyTicketsPage() {
  const [tickets, setTickets] = useState<FullTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function fetchGuestTickets() {
      setLoading(true);
      try {
        // This endpoint securely reads the HTTP-only cookie and returns the phone number if available.
        const response = await api.get('/api/auth/cookie-data');
        const phoneNumber = response.data?.data?.phoneNumber;

        if (phoneNumber) {
          // Pass the phone number to the server action to fetch tickets.
          const fetchedTickets = await getTicketsForUser(undefined, phoneNumber);
          setTickets(fetchedTickets);
        } else {
          // No phone number in session, so the user is a true guest with no tickets yet.
          setTickets([]);
        }
      } catch (error) {
        console.error("Failed to fetch guest tickets:", error);
        setTickets([]);
      } finally {
        setLoading(false);
      }
    }
    
    fetchGuestTickets();
  }, []);

  if (loading) {
     return (
        <div className="container mx-auto py-8">
            <div className="space-y-2 mb-8">
                <Skeleton className="h-9 w-48" />
                <Skeleton className="h-5 w-96" />
            </div>
             <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {[...Array(3)].map((_, i) => (
                    <Card key={i}>
                        <CardHeader className="p-0"><Skeleton className="w-full aspect-video rounded-t-lg" /></CardHeader>
                        <CardContent className="p-4 space-y-2"><Skeleton className="h-5 w-3/4" /><Skeleton className="h-4 w-1/2" /></CardContent>
                        <CardFooter className="p-4 pt-0"><Skeleton className="h-10 w-full" /></CardFooter>
                    </Card>
                ))}
            </div>
        </div>
     )
  }

  return (
    <div className="container mx-auto py-8">
        <div className="space-y-2 mb-8">
            <h1 className="text-3xl font-bold tracking-tight">My Tickets</h1>
            <p className="text-muted-foreground">
                Here are the tickets you've purchased.
            </p>
        </div>

        {tickets.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {tickets.map((ticket) => {
                     const imageSource = ticket.event.image || DEFAULT_IMAGE_PLACEHOLDER;
                    return (
                        <Card key={ticket.id} className="flex flex-col hover:shadow-lg transition-shadow duration-300">
                             <CardHeader className="p-0 relative aspect-video">
                                <Image src={imageSource} alt={ticket.event.name} fill className="object-cover rounded-t-lg" data-ai-hint={ticket.event.hint ?? 'event'} onError={(e) => { const target = e.target as HTMLImageElement; target.src = DEFAULT_IMAGE_PLACEHOLDER; target.srcset = ''; }} />
                            </CardHeader>
                             <CardContent className="p-4 flex-1 space-y-1">
                                <CardTitle className="text-xl">{ticket.event.name}</CardTitle>
                                <CardDescription>{formatEventDate(ticket.event.startDate, ticket.event.endDate)}</CardDescription>
                                <p className="font-semibold pt-2">{ticket.ticketType.name}</p>
                            </CardContent>
                            <CardFooter className="p-4 pt-0">
                                <Button asChild className="w-full">
                                    <Link href={`/payment/success?attendee_id=${ticket.id}`}>
                                        View QR Code & Details
                                        <ArrowUpRight className="ml-auto h-4 w-4" />
                                    </Link>
                                </Button>
                            </CardFooter>
                        </Card>
                    )
                })}
            </div>
        ) : (
             <div className="flex flex-col items-center justify-center text-center py-16 border-2 border-dashed rounded-lg">
                <Ticket className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-2xl font-semibold tracking-tight">You don't have any tickets yet</h3>
                <p className="text-muted-foreground mt-2 mb-6">Your purchased tickets will appear here.</p>
                <Button asChild>
                    <Link href="/">Explore Events</Link>
                </Button>
            </div>
        )}
    </div>
  )
}
