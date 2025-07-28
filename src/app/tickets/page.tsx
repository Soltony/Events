
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { format } from 'date-fns';
import type { Attendee, Event, TicketType } from '@prisma/client';

import { getTicketsByUserId } from '@/lib/actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowUpRight, Ticket } from 'lucide-react';
import { useAuth } from '@/context/auth-context';

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
  const { user, isLoading: isAuthLoading } = useAuth();

  useEffect(() => {
    async function fetchMyTickets() {
      if (isAuthLoading) return;
      
      setLoading(true);
      
      const localTicketIds = JSON.parse(localStorage.getItem('myTickets') || '[]') as number[];
      
      const fetchedTickets = await getTicketsByUserId(user?.id ?? null, localTicketIds);
      
      // Merge and deduplicate tickets
      const ticketMap = new Map<number, FullTicket>();
      fetchedTickets.forEach(ticket => {
        ticketMap.set(ticket.id, ticket);
      });
      setTickets(Array.from(ticketMap.values()));
      
      setLoading(false);
    }
    fetchMyTickets();
  }, [user, isAuthLoading]);

  if (isAuthLoading) {
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

  // If not logged in and not loading, check if there are any local tickets
  if (!user && !loading && tickets.length === 0) {
     return (
         <div className="flex flex-col items-center justify-center text-center py-16 border-2 border-dashed rounded-lg container mx-auto mt-8">
            <Ticket className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-2xl font-semibold tracking-tight">You don't have any tickets yet</h3>
            <p className="text-muted-foreground mt-2 mb-6">Your purchased tickets will appear here.</p>
            <div className="flex gap-4">
                <Button asChild>
                    <Link href="/">Explore Events</Link>
                </Button>
                 <Button asChild variant="outline">
                    <Link href="/login">Organizer Login</Link>
                </Button>
            </div>
        </div>
     )
  }

  return (
    <div className="container mx-auto py-8">
        <div className="space-y-2 mb-8">
            <h1 className="text-3xl font-bold tracking-tight">My Tickets</h1>
            <p className="text-muted-foreground">
                {user ? "Here are the tickets associated with your account and any guest purchases from this device." : "Here are the tickets you've purchased in this session."}
            </p>
        </div>

        {loading ? (
             <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {[...Array(3)].map((_, i) => (
                    <Card key={i}>
                        <CardHeader className="p-0"><Skeleton className="w-full aspect-video rounded-t-lg" /></CardHeader>
                        <CardContent className="p-4 space-y-2"><Skeleton className="h-5 w-3/4" /><Skeleton className="h-4 w-1/2" /></CardContent>
                        <CardFooter className="p-4 pt-0"><Skeleton className="h-10 w-full" /></CardFooter>
                    </Card>
                ))}
            </div>
        ) : tickets.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {tickets.map((ticket) => {
                     const imageUrl = ticket.event.image || DEFAULT_IMAGE_PLACEHOLDER;
                    return (
                        <Card key={ticket.id} className="flex flex-col hover:shadow-lg transition-shadow duration-300">
                             <CardHeader className="p-0">
                                <Image src={imageUrl} alt={ticket.event.name} width={600} height={338} className="rounded-t-lg object-cover aspect-video" data-ai-hint={ticket.event.hint ?? 'event'} onError={(e) => { const target = e.target as HTMLImageElement; target.src = DEFAULT_IMAGE_PLACEHOLDER; target.srcset = ''; }} />
                            </CardHeader>
                             <CardContent className="p-4 flex-1 space-y-1">
                                <CardTitle className="text-xl">{ticket.event.name}</CardTitle>
                                <CardDescription>{formatEventDate(ticket.event.startDate, ticket.event.endDate)}</CardDescription>
                                <p className="font-semibold pt-2">{ticket.ticketType.name}</p>
                            </CardContent>
                            <CardFooter className="p-4 pt-0">
                                <Button asChild className="w-full">
                                    <Link href={`/ticket/${ticket.id}/confirmation`}>
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
