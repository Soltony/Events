
'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import Image from 'next/image';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, MapPin, Ticket, Loader2, X } from 'lucide-react';
import type { Event, TicketType } from '@prisma/client';
import { format } from 'date-fns';
import { ScrollArea } from './ui/scroll-area';
import { useTransition } from 'react';
import { purchaseTicket } from '@/lib/actions';
import { useToast } from '@/hooks/use-toast';

interface EventWithTickets extends Event {
    ticketTypes: TicketType[];
}

interface EventDetailModalProps {
  event: EventWithTickets;
  isOpen: boolean;
  onClose: () => void;
}

function formatEventDate(startDate: Date, endDate: Date | null | undefined): string {
    if (endDate) {
        return `${format(new Date(startDate), 'LLL dd, y')} - ${format(new Date(endDate), 'LLL dd, y')}`;
    }
    return format(new Date(startDate), 'LLL dd, y');
}

export default function EventDetailModal({ event, isOpen, onClose }: EventDetailModalProps) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  if (!event) return null;
  
  const handlePurchase = (ticketTypeId: number) => {
    startTransition(async () => {
      const result = await purchaseTicket(ticketTypeId, event.id);
      if (result?.error) {
        toast({
          variant: 'destructive',
          title: 'Purchase Failed',
          description: result.error,
        });
      }
    });
  };

  const images = (typeof event.image === 'string' && event.image) 
    ? event.image.split(',').filter(img => img) 
    : [];
  
  const displayImages = images.length > 0 ? images : ['https://placehold.co/1200x600.png'];


  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl p-0 grid grid-cols-1 md:grid-cols-2 gap-0">
         <div className="relative order-1 md:order-2">
            <Carousel className="w-full h-full">
                <CarouselContent className="h-full">
                {displayImages.map((img, index) => (
                    <CarouselItem key={index} className="h-full">
                        <div className="relative w-full h-64 md:h-full">
                            <Image src={img} alt={`${event.name} image ${index + 1}`} fill className="object-cover rounded-t-lg md:rounded-r-lg md:rounded-t-none" data-ai-hint={event.hint ?? 'event'} />
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
             <DialogClose className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground md:hidden">
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
            </DialogClose>
        </div>
        <div className="p-8 flex flex-col order-2 md:order-1 max-h-[90vh] md:max-h-auto">
            <DialogHeader className="text-left mb-4">
                <Badge variant="outline" className="mb-2 w-min whitespace-nowrap">{event.category}</Badge>
                <DialogTitle className="text-3xl font-bold tracking-tight">{event.name}</DialogTitle>
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
            </DialogHeader>

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
      </DialogContent>
    </Dialog>
  );
}
