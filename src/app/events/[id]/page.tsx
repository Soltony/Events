
'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { getEventById, type Event, getTicketTypes, type TicketType } from '@/lib/store';
import Image from 'next/image';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Ticket, Calendar, MapPin } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';

export default function PublicEventDetailPage() {
  const params = useParams<{ id: string }>();
  const eventId = params.id ? parseInt(params.id, 10) : -1;
  const [event, setEvent] = useState<Event | undefined | null>(null);
  const [eventTicketTypes, setEventTicketTypes] = useState<TicketType[]>([]);

  useEffect(() => {
    if (eventId !== -1) {
      const foundEvent = getEventById(eventId);
      setEvent(foundEvent);
      const allTicketTypes = getTicketTypes();
      setEventTicketTypes(allTicketTypes.filter((t) => t.eventId === eventId));
    } else {
      setEvent(undefined);
    }
  }, [eventId]);

  // Loading state
  if (event === null) {
    return (
        <div className="max-w-5xl mx-auto py-8">
            <Card className="overflow-hidden shadow-xl">
              <Skeleton className="w-full h-[300px] md:h-[500px]" />
              <CardContent className="p-6 md:p-10">
                <div className="space-y-8">
                  <div className="space-y-4">
                    <Skeleton className="h-6 w-24 rounded-full" />
                    <Skeleton className="h-12 w-3/4" />
                    <div className="flex gap-6">
                      <Skeleton className="h-6 w-48" />
                      <Skeleton className="h-6 w-48" />
                    </div>
                  </div>
                  <div className="border-t pt-8 space-y-4">
                    <Skeleton className="h-8 w-64" />
                    <Skeleton className="h-5 w-full" />
                    <Skeleton className="h-5 w-full" />
                    <Skeleton className="h-5 w-2/3" />
                  </div>
                  <div className="border-t pt-8 space-y-6">
                    <Skeleton className="h-8 w-48" />
                    <Skeleton className="h-32 w-full rounded-lg" />
                    <Skeleton className="h-32 w-full rounded-lg" />
                  </div>
                </div>
              </CardContent>
            </Card>
        </div>
    );
  }

  // Not found state
  if (!event) {
    return (
      <div className="flex items-center justify-center h-full py-20">
        <Card className="p-8">
          <CardHeader>
            <CardTitle>Event Not Found</CardTitle>
            <CardDescription>The event you are looking for does not exist.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="max-w-5xl mx-auto py-8">
      <Card className="overflow-hidden shadow-xl">
        <Carousel className="w-full">
            <CarouselContent>
            {event.image.map((img, index) => (
                <CarouselItem key={index}>
                <Image src={img} alt={`${event.name} image ${index + 1}`} width={1200} height={600} className="w-full object-cover aspect-[2/1]" data-ai-hint={event.hint} />
                </CarouselItem>
            ))}
            </CarouselContent>
            <CarouselPrevious className="absolute left-4 hidden sm:flex" />
            <CarouselNext className="absolute right-4 hidden sm:flex" />
        </Carousel>
        <CardContent className="p-6 md:p-10">
            <div className="grid gap-8">
                <div>
                    <Badge variant="outline" className="mb-4 text-sm">{event.category}</Badge>
                    <h1 className="text-4xl md:text-5xl font-bold tracking-tight">{event.name}</h1>
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-muted-foreground mt-4 text-lg">
                        <div className="flex items-center gap-2">
                            <Calendar className="h-5 w-5" />
                            <span>{event.date}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <MapPin className="h-5 w-5" />
                            <span>{event.location}</span>
                        </div>
                    </div>
                </div>

                <div className="border-t pt-8">
                    <h2 className="text-3xl font-semibold mb-4">About this Event</h2>
                    <p className="text-base text-muted-foreground whitespace-pre-wrap leading-relaxed">{event.description}</p>
                </div>

                <div className="border-t pt-8">
                    <h2 className="text-3xl font-semibold mb-6">Tickets</h2>
                    <div className="space-y-4">
                        {eventTicketTypes.length > 0 ? (
                            eventTicketTypes.map(ticket => (
                                <Card key={ticket.id} className="flex flex-col md:flex-row justify-between items-start md:items-center p-6 bg-secondary border-2 border-transparent hover:border-primary transition-colors">
                                    <div className="mb-4 md:mb-0">
                                        <h3 className="font-bold text-xl">{ticket.name}</h3>
                                        <p className="text-primary font-bold text-2xl">${ticket.price.toFixed(2)}</p>
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
