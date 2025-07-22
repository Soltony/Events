
'use client';

import { getEventById } from '@/lib/actions';
import Image from 'next/image';
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

export default function PublicEventDetailPage() {
  const params = useParams<{ id: string }>();
  const eventId = params ? parseInt(params.id, 10) : NaN;
  const [isPending, startTransition] = useTransition();
  const [loadingTicketId, setLoadingTicketId] = useState<number | null>(null);
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
    setLoadingTicketId(ticketTypeId);
    startTransition(async () => {
      await purchaseTicket(ticketTypeId, eventId);
    });
  };
  
  if (loading || !event) {
    return (
        <div className="container mx-auto p-4 md:p-8 max-w-4xl">
             <div className="bg-card shadow-xl rounded-lg overflow-hidden">
                <Skeleton className="w-full aspect-video" />
                <div className="p-8 space-y-6">
                    <Skeleton className="h-6 w-24" />
                    <Skeleton className="h-10 w-3/4" />
                    <div className="space-y-4 pt-2">
                        <Skeleton className="h-6 w-1/2" />
                        <Skeleton className="h-6 w-1/3" />
                    </div>
                     <div className="border-t my-6"></div>
                     <div className="space-y-4">
                        <Skeleton className="h-6 w-40" />
                        <Skeleton className="h-16 w-full" />
                     </div>
                     <div className="border-t my-6"></div>
                      <div className="space-y-4">
                        <Skeleton className="h-6 w-32" />
                        <Skeleton className="h-20 w-full" />
                        <Skeleton className="h-20 w-full" />
                     </div>
                </div>
            </div>
        </div>
    )
  }
  
  const images = (typeof event.image === 'string' && event.image) 
    ? event.image.split(',').filter(img => img && img.trim() !== '') 
    : [];
  
  const displayImages = images.length > 0 ? images : ['https://placehold.co/1200x600.png'];

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-4xl">
      <div className="bg-card shadow-xl rounded-lg overflow-hidden">
        <Carousel className="w-full">
            <CarouselContent>
            {displayImages.map((img, index) => (
                <CarouselItem key={index}>
                    <div className="relative w-full aspect-video">
                        <Image src={img} alt={`${event.name} image ${index + 1}`} fill className="object-cover" data-ai-hint={event.hint ?? 'event'} />
                    </div>
                </CarouselItem>
            ))}
            </CarouselContent>
                {displayImages.length > 1 && (
                <>
                    <CarouselPrevious className="absolute left-4 hidden sm:flex" />
                    <CarouselNext className="absolute right-4 hidden sm:flex" />
                </>
            )}
        </Carousel>

        <div className="p-6 md:p-8 space-y-8">
            <div>
                <Badge variant="outline" className="mb-2 w-min whitespace-nowrap">{event.category}</Badge>
                <h1 className="text-3xl md:text-4xl font-bold tracking-tight">{event.name}</h1>
                <div className="text-lg text-muted-foreground space-y-2 pt-4">
                    <div className="flex items-center gap-3">
                        <Calendar className="h-5 w-5" />
                        <span>{formatEventDate(event.startDate, event.endDate)}</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <MapPin className="h-5 w-5" />
                        <span>{event.location}</span>
                    </div>
                </div>
            </div>

            <div className="border-t"></div>

            <div>
                <h3 className="text-2xl font-semibold mb-4">About this Event</h3>
                <p className="text-base text-muted-foreground whitespace-pre-wrap leading-relaxed">{event.description}</p>
            </div>
            
            <div className="border-t"></div>

            <div>
                <h3 className="text-2xl font-semibold mb-4">Tickets</h3>
                <div className="space-y-4">
                    {event.ticketTypes.length > 0 ? (
                        event.ticketTypes.map(ticket => {
                            const isLoading = isPending && loadingTicketId === ticket.id;
                            return (
                                <div key={ticket.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 rounded-lg border bg-secondary/50">
                                    <div className="mb-3 sm:mb-0">
                                        <h4 className="font-semibold text-lg">{ticket.name}</h4>
                                        <p style={{ color: 'hsl(var(--accent))' }} className="font-bold text-xl">ETB {Number(ticket.price).toFixed(2)}</p>
                                        <p className="text-sm text-muted-foreground">{ticket.total - ticket.sold > 0 ? `${ticket.total - ticket.sold} remaining` : 'Sold Out'}</p>
                                    </div>
                                    <Button 
                                        onClick={() => handlePurchase(ticket.id)}
                                        disabled={isLoading || ticket.total - ticket.sold <= 0}
                                        className="w-full sm:w-auto shrink-0 bg-accent hover:bg-accent/90 text-accent-foreground"
                                        size="lg"
                                    >
                                        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Ticket className="mr-2 h-4 w-4" />}
                                        {ticket.total - ticket.sold > 0 ? 'Buy Ticket' : 'Sold Out'}
                                    </Button>
                                </div>
                            )
                        })
                    ) : (
                        <p className="text-muted-foreground">Tickets are not yet available for this event.</p>
                    )}
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}

    