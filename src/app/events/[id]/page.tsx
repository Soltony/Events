

'use client';

import { getEventById } from '@/lib/actions';
import Image from 'next/image';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Ticket, Calendar, MapPin, Loader2 } from 'lucide-react';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { notFound, useParams } from 'next/navigation';
import { format } from 'date-fns';
import type { Event, TicketType } from '@prisma/client';
import { useEffect, useState, useTransition } from 'react';
import { purchaseTicket } from '@/lib/actions';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

interface EventWithTickets extends Event {
    ticketTypes: TicketType[];
}

function formatEventDate(startDate: Date, endDate: Date | null | undefined): string {
    if (endDate) {
      return `${format(new Date(startDate), 'LLL dd, y')} - ${format(new Date(endDate), 'LLL dd, y')}`;
    }
    return format(new Date(startDate), 'LLL dd, y');
}

export default function PublicEventDetailPage({ params }: { params: { id: string } }) {
  const eventId = parseInt(params.id, 10);
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [event, setEvent] = useState<EventWithTickets | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isNaN(eventId)) {
        notFound();
    }
    async function fetchEvent() {
        setLoading(true);
        const eventData = await getEventById(eventId);
        if (!eventData) {
            notFound();
        }
        setEvent(eventData);
        setLoading(false);
    }
    fetchEvent();
  }, [eventId]);

  const handlePurchase = (ticketTypeId: number) => {
    startTransition(async () => {
      const result = await purchaseTicket(ticketTypeId, eventId);
      if (result?.error) {
        toast({
          variant: 'destructive',
          title: 'Purchase Failed',
          description: result.error,
        });
      }
    });
  };
  
  if (loading || !event) {
    return (
        <div className="container mx-auto py-8">
            <Card className="overflow-hidden shadow-xl">
                <Skeleton className="w-full aspect-[2/1]" />
                <CardContent className="p-6 md:p-10 space-y-8">
                    <Skeleton className="h-6 w-24" />
                    <Skeleton className="h-12 w-3/4" />
                    <div className="flex gap-6">
                        <Skeleton className="h-6 w-1/3" />
                        <Skeleton className="h-6 w-1/3" />
                    </div>
                    <div className="border-t my-8"></div>
                    <Skeleton className="h-8 w-48 mb-4" />
                    <Skeleton className="h-24 w-full" />
                </CardContent>
            </Card>
        </div>
    )
  }
  
  const images = typeof event.image === 'string' && event.image ? event.image.split(',') : ['https://placehold.co/1200x600.png'];

  return (
    <div className="container mx-auto py-8">
      <Card className="overflow-hidden shadow-xl">
        <Carousel className="w-full">
            <CarouselContent>
            {images.map((img, index) => (
                <CarouselItem key={index}>
                <Image src={img} alt={`${event.name} image ${index + 1}`} width={1200} height={600} className="w-full object-cover aspect-[2/1]" data-ai-hint={event.hint ?? 'event'} />
                </CarouselItem>
            ))}
            </CarouselContent>
            {images.length > 1 && (
                <>
                    <CarouselPrevious className="absolute left-4 hidden sm:flex" />
                    <CarouselNext className="absolute right-4 hidden sm:flex" />
                </>
            )}
        </Carousel>
        <CardContent className="p-6 md:p-10">
            <div className="grid gap-8">
                <div>
                    <Badge variant="outline" className="mb-4 text-sm">{event.category}</Badge>
                    <h1 className="text-4xl md:text-5xl font-bold tracking-tight">{event.name}</h1>
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-muted-foreground mt-4 text-lg">
                        <div className="flex items-center gap-2">
                            <Calendar className="h-5 w-5" />
                            <span>{formatEventDate(event.startDate, event.endDate)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <MapPin className="h-5 w-5" />
                            <span>{event.location}</span>
                        </div>
                    </div>

                    <div className="border-t my-8"></div>

                    <div>
                        <h2 className="text-3xl font-semibold mb-4">About this Event</h2>
                        <p className="text-base text-muted-foreground whitespace-pre-wrap leading-relaxed">{event.description}</p>
                    </div>

                    <div className="border-t my-8"></div>

                    <div>
                        <h2 className="text-3xl font-semibold mb-6">Tickets</h2>
                        <div className="space-y-4">
                            {event.ticketTypes.length > 0 ? (
                                event.ticketTypes.map(ticket => (
                                    <Card key={ticket.id} className="flex flex-col md:flex-row justify-between items-start md:items-center p-6 bg-card border-2 border-transparent hover:border-primary transition-colors rounded-lg">
                                        <div className="mb-4 md:mb-0">
                                            <h3 className="font-bold text-xl">{ticket.name}</h3>
                                            <p className="text-primary font-bold text-2xl">ETB {Number(ticket.price).toFixed(2)}</p>
                                            <p className="text-sm text-muted-foreground">{ticket.total - ticket.sold > 0 ? `${ticket.total - ticket.sold} tickets remaining` : 'Sold Out'}</p>
                                        </div>
                                        <Button 
                                          size="lg" 
                                          className="shrink-0"
                                          onClick={() => handlePurchase(ticket.id)}
                                          disabled={isPending || ticket.total - ticket.sold <= 0}
                                        >
                                            {isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Ticket className="mr-2 h-5 w-5" />}
                                            {ticket.total - ticket.sold > 0 ? 'Buy Ticket' : 'Sold Out'}
                                        </Button>
                                    </Card>
                                ))
                            ) : (
                                <p className="text-muted-foreground">Tickets are not yet available for this event.</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </CardContent>
      </Card>
    </div>
  );
}
