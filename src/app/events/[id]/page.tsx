
'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { getEventById, type Event } from '@/lib/store';
import { ticketTypes } from '@/lib/mock-data';
import Image from 'next/image';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Ticket, Calendar, MapPin } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export default function PublicEventDetailPage() {
  const params = useParams<{ id: string }>();
  const eventId = params.id ? parseInt(params.id, 10) : -1;
  const [event, setEvent] = useState<Event | undefined | null>(null);

  useEffect(() => {
    if (eventId !== -1) {
      const foundEvent = getEventById(eventId);
      setEvent(foundEvent);
    } else {
      setEvent(undefined);
    }
  }, [eventId]);

  // Loading state
  if (event === null) {
    return (
        <div className="max-w-4xl mx-auto">
            <Skeleton className="w-full h-96 rounded-lg" />
            <div className="mt-8 space-y-4">
                <Skeleton className="h-10 w-3/4" />
                <Skeleton className="h-6 w-1/2" />
                <Skeleton className="h-20 w-full" />
            </div>
        </div>
    );
  }

  // Not found state
  if (!event) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card>
          <CardHeader>
            <CardTitle>Event Not Found</CardTitle>
            <CardDescription>The event you are looking for does not exist.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }
  
  const eventTicketTypes = ticketTypes.filter((t) => t.eventId === event.id);

  return (
    <div className="max-w-4xl mx-auto">
      <Card className="overflow-hidden">
        <CardHeader className="p-0">
            <Image src={event.image} alt={event.name} width={1200} height={600} className="w-full object-cover aspect-[2/1]" data-ai-hint={event.hint} />
        </CardHeader>
        <CardContent className="p-6 md:p-8">
            <div className="grid gap-6">
                <div>
                    <Badge variant="outline" className="mb-2">{event.category}</Badge>
                    <h1 className="text-4xl font-bold tracking-tight">{event.name}</h1>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-muted-foreground mt-2">
                        <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            <span>{event.date}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4" />
                            <span>{event.location}</span>
                        </div>
                    </div>
                </div>

                <div>
                    <h2 className="text-2xl font-semibold mb-2">About this Event</h2>
                    <p className="text-muted-foreground whitespace-pre-wrap">{event.description}</p>
                </div>

                <div>
                    <h2 className="text-2xl font-semibold mb-4">Tickets</h2>
                    <div className="space-y-4">
                        {eventTicketTypes.length > 0 ? (
                            eventTicketTypes.map(ticket => (
                                <Card key={ticket.id} className="flex flex-col md:flex-row justify-between items-start md:items-center p-4">
                                    <div className="mb-4 md:mb-0">
                                        <h3 className="font-bold text-lg">{ticket.name}</h3>
                                        <p className="text-primary font-semibold text-xl">${ticket.price.toFixed(2)}</p>
                                        <p className="text-sm text-muted-foreground">{ticket.total - ticket.sold} tickets remaining</p>
                                    </div>
                                    <Button size="lg">
                                        <Ticket className="mr-2 h-5 w-5" />
                                        Buy Ticket
                                    </Button>
                                </Card>
                            ))
                        ) : (
                            <p className="text-muted-foreground">Tickets are not yet available for this event.</p>
                        )}
                    </div>
                </div>
            </div>
        </CardContent>
      </Card>
    </div>
  );
}
