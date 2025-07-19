
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
import { ScrollArea } from '@/components/ui/scroll-area';

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
        <div className="container mx-auto p-0 md:p-8">
             <div className="grid grid-cols-1 md:grid-cols-2 max-w-6xl mx-auto shadow-xl rounded-lg overflow-hidden">
                <div className="h-64 md:h-full"><Skeleton className="w-full h-full" /></div>
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
    ? event.image.split(',').filter(img => img) 
    : [];
  
  const displayImages = images.length > 0 ? images : ['https://placehold.co/1200x600.png'];

  return (
    <div className="container mx-auto p-0 md:p-8">
      <div className="grid grid-cols-1 md:grid-cols-2 max-w-6xl mx-auto shadow-xl rounded-lg overflow-hidden bg-card">
        <div className="relative">
            <Carousel className="w-full h-full">
                <CarouselContent className="h-full">
                {displayImages.map((img, index) => (
                    <CarouselItem key={index} className="h-full">
                        <div className="relative w-full h-64 md:h-full min-h-[300px]">
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
        </div>
        <div className="p-8 flex flex-col max-h-[90vh] md:max-h-auto">
            <div className="text-left mb-4">
                <Badge variant="outline" className="mb-2 w-min whitespace-nowrap">{event.category}</Badge>
                <h1 className="text-3xl font-bold tracking-tight">{event.name}</h1>
                <div className="text-lg text-muted-foreground space-y-2 pt-2">
                        <div className="flex items-center gap-2">
                        <Calendar className="h-5 w-5" />
                        <span>{formatEventDate(event.startDate, event.endDate)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <MapPin className="h-5 w-5" />
                        <span>{event.location}</span>
                    </div>
                </div>
            </div>

            <div className="flex-grow min-h-0 flex flex-col gap-6">
                <div>
                    <h3 className="text-xl font-semibold mb-2">About this Event</h3>
                    <p className="text-base text-muted-foreground whitespace-pre-wrap leading-relaxed">{event.description}</p>
                </div>
                
                <div className="flex flex-col min-h-0">
                        <h3 className="text-xl font-semibold mb-4">Tickets</h3>
                        <ScrollArea className="flex-1 -mr-6 pr-6">
                            <div className="space-y-3">
                                {event.ticketTypes.length > 0 ? (
                                    event.ticketTypes.map(ticket => (
                                        <div key={ticket.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 rounded-lg border bg-secondary/50">
                                            <div className="mb-3 sm:mb-0">
                                                <h4 className="font-semibold text-base">{ticket.name}</h4>
                                                <p style={{ color: 'hsl(var(--accent))' }} className="font-bold text-lg">ETB {Number(ticket.price).toFixed(2)}</p>
                                                <p className="text-xs text-muted-foreground">{ticket.total - ticket.sold > 0 ? `${ticket.total - ticket.sold} remaining` : 'Sold Out'}</p>
                                            </div>
                                            <Button 
                                                onClick={() => handlePurchase(ticket.id)}
                                                disabled={isPending || ticket.total - ticket.sold <= 0}
                                                className="w-full sm:w-auto shrink-0 bg-accent hover:bg-accent/90 text-accent-foreground"
                                            >
                                                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Ticket className="mr-2 h-4 w-4" />}
                                                {ticket.total - ticket.sold > 0 ? 'Buy Ticket' : 'Sold Out'}
                                            </Button>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-muted-foreground">Tickets are not yet available for this event.</p>
                                )}
                            </div>
                        </ScrollArea>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}
