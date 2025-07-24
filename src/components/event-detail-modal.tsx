
'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, MapPin, Ticket, Loader2, X } from 'lucide-react';
import type { Event, TicketType } from '@prisma/client';
import { format } from 'date-fns';
import { ScrollArea } from './ui/scroll-area';
import { useTransition, useState } from 'react';
import { purchaseTickets } from '@/lib/actions';
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
  const [loadingTicketId, setLoadingTicketId] = useState<number | null>(null);

  if (!event) return null;
  
  const handlePurchase = (ticketType: TicketType) => {
    setLoadingTicketId(ticketType.id);
    startTransition(async () => {
      // The purchaseTickets function expects an array of tickets.
      // We are buying one type of ticket here, with quantity 1.
      await purchaseTickets({
        eventId: event.id,
        tickets: [{ id: ticketType.id, quantity: 1, name: ticketType.name, price: Number(ticketType.price) }]
      });
      // The redirect is handled inside the server action, so no need for toast here on success.
    });
  };

  const firstImage = event.image?.split(',')[0].trim() || 'https://placehold.co/800x600.png';


  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl p-0 grid grid-cols-1 md:grid-cols-2 gap-0">
         <div className="relative order-1 md:order-2">
            <div className="relative w-full h-64 md:h-full">
                <Image src={firstImage} alt={`${event.name} image`} fill className="object-cover rounded-t-lg md:rounded-r-lg md:rounded-t-none" data-ai-hint={event.hint ?? 'event'} />
            </div>
             <DialogClose className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground md:hidden">
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
            </DialogClose>
        </div>
        <div className="p-6 flex flex-col order-2 md:order-1 max-h-[90vh] md:max-h-auto">
            <DialogHeader className="text-left mb-4">
                <Badge variant="outline" className="mb-2 w-min whitespace-nowrap">{event.category}</Badge>
                <DialogTitle className="text-2xl font-bold tracking-tight">{event.name}</DialogTitle>
                <div className="text-base text-muted-foreground space-y-1 pt-2">
                        <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        <span>{formatEventDate(event.startDate, event.endDate)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        <span>{event.location}</span>
                    </div>
                </div>
            </DialogHeader>

            <div className="flex-grow min-h-0 flex flex-col gap-4">
                <div>
                    <h3 className="text-lg font-semibold mb-1">About this Event</h3>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{event.description}</p>
                </div>
                
                <div className="flex flex-col min-h-0">
                        <h3 className="text-lg font-semibold mb-2">Tickets</h3>
                        <ScrollArea className="flex-1 -mr-4 pr-4">
                            <div className="space-y-3">
                                {event.ticketTypes.length > 0 ? (
                                    event.ticketTypes.map(ticket => {
                                        const isLoading = isPending && loadingTicketId === ticket.id;
                                        return (
                                            <div key={ticket.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-3 rounded-lg border bg-secondary/50">
                                                <div className="mb-2 sm:mb-0">
                                                    <h4 className="font-semibold text-base">{ticket.name}</h4>
                                                    <p style={{ color: 'hsl(var(--accent))' }} className="font-bold text-base">ETB {Number(ticket.price).toFixed(2)}</p>
                                                    <p className="text-xs text-muted-foreground">{ticket.total - ticket.sold > 0 ? `${ticket.total - ticket.sold} remaining` : 'Sold Out'}</p>
                                                </div>
                                                <Button 
                                                    onClick={() => handlePurchase(ticket)}
                                                    disabled={isLoading || ticket.total - ticket.sold <= 0}
                                                    className="w-full sm:w-auto shrink-0 bg-accent hover:bg-accent/90 text-accent-foreground"
                                                    size="sm"
                                                >
                                                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Ticket className="mr-2 h-4 w-4" />}
                                                    {ticket.total - ticket.sold > 0 ? 'Buy' : 'Sold Out'}
                                                </Button>
                                            </div>
                                        )
                                    })
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
