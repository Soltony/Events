
'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import Image from 'next/image';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, MapPin, Ticket } from 'lucide-react';
import type { Event, TicketType } from '@prisma/client';
import { format } from 'date-fns';
import { ScrollArea } from './ui/scroll-area';

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
  if (!event) return null;

  const images = event.image && typeof event.image === 'string' ? event.image.split(',') : ['https://placehold.co/1200x600.png'];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl p-0">
        <div className="grid md:grid-cols-2">
            <div className="p-8 flex flex-col order-2 md:order-1">
                <ScrollArea className="flex-1 pr-6 -mr-6">
                    <DialogHeader className="text-left mb-6">
                        <Badge variant="outline" className="mb-2 w-min whitespace-nowrap">{event.category}</Badge>
                        <DialogTitle className="text-3xl font-bold tracking-tight">{event.name}</DialogTitle>
                        <DialogDescription as="div" className="text-lg text-muted-foreground space-y-2 pt-2">
                             <div className="flex items-center gap-2">
                                <Calendar className="h-5 w-5" />
                                <span>{formatEventDate(event.startDate, event.endDate)}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <MapPin className="h-5 w-5" />
                                <span>{event.location}</span>
                            </div>
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-6">
                        <div>
                            <h3 className="text-xl font-semibold mb-2">About this Event</h3>
                            <p className="text-base text-muted-foreground whitespace-pre-wrap leading-relaxed">{event.description}</p>
                        </div>
                        
                        <div>
                             <h3 className="text-xl font-semibold mb-4">Tickets</h3>
                            <div className="space-y-3">
                                {event.ticketTypes.length > 0 ? (
                                    event.ticketTypes.map(ticket => (
                                        <div key={ticket.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 rounded-lg border bg-secondary/50">
                                            <div className="mb-3 sm:mb-0">
                                                <h4 className="font-semibold text-base">{ticket.name}</h4>
                                                <p style={{ color: 'hsl(var(--accent))' }} className="font-bold text-lg">ETB {Number(ticket.price).toFixed(2)}</p>
                                                <p className="text-xs text-muted-foreground">{ticket.total - ticket.sold} remaining</p>
                                            </div>
                                            <Button className="w-full sm:w-auto shrink-0 bg-accent hover:bg-accent/90 text-accent-foreground">
                                                <Ticket className="mr-2 h-4 w-4" />
                                                Buy Ticket
                                            </Button>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-muted-foreground">Tickets are not yet available for this event.</p>
                                )}
                            </div>
                        </div>
                    </div>
                </ScrollArea>
            </div>
             <div className="order-1 md:order-2">
                <Carousel className="w-full h-full">
                    <CarouselContent className="h-full">
                    {images.map((img, index) => (
                        <CarouselItem key={index} className="h-full">
                            <div className="relative w-full h-64 md:h-full">
                                <Image src={img} alt={`${event.name} image ${index + 1}`} fill className="object-cover rounded-t-lg md:rounded-r-lg md:rounded-t-none" data-ai-hint={event.hint ?? 'event'} />
                            </div>
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
             </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
