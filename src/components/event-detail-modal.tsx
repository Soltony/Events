
'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, MapPin, Ticket, Loader2, X, User, Phone } from 'lucide-react';
import type { Event, TicketType } from '@prisma/client';
import { format } from 'date-fns';
import { ScrollArea } from './ui/scroll-area';
import { useTransition, useState } from 'react';
import { purchaseTickets } from '@/lib/actions';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/auth-context';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from './ui/input';
import { Label } from './ui/label';

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
  const { user } = useAuth();
  const [loadingTicketId, setLoadingTicketId] = useState<number | null>(null);
  
  const [purchaseState, setPurchaseState] = useState<{ ticket: TicketType | null; isOpen: boolean }>({ ticket: null, isOpen: false });
  const [attendeeName, setAttendeeName] = useState(user ? `${user.firstName} ${user.lastName}` : '');
  const [attendeePhone, setAttendeePhone] = useState(user ? user.phoneNumber : '');


  if (!event) return null;
  
  const handlePurchase = () => {
    if (!purchaseState.ticket) return;

    if (!attendeeName || !attendeePhone) {
      toast({ variant: 'destructive', title: "Missing Information", description: "Please enter the attendee's name and phone number." });
      return;
    }

    setLoadingTicketId(purchaseState.ticket.id);

    startTransition(() => {
        purchaseTickets({
          eventId: event.id,
          tickets: [{ id: purchaseState.ticket!.id, quantity: 1, name: purchaseState.ticket!.name, price: Number(purchaseState.ticket!.price) }],
          attendeeDetails: {
            name: attendeeName,
            phone: attendeePhone,
          }
        });
        setPurchaseState({ ticket: null, isOpen: false });
    });
  };

  const openPurchaseDialog = (ticket: TicketType) => {
    setPurchaseState({ ticket, isOpen: true });
  }

  const firstImage = event.image?.split(',')[0].trim() || 'https://placehold.co/800x600.png';

  return (
    <>
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
                                        const isSoldOut = ticket.total - ticket.sold <= 0;
                                        return (
                                            <div key={ticket.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-3 rounded-lg border bg-secondary/50">
                                                <div className="mb-2 sm:mb-0">
                                                    <h4 className="font-semibold text-base">{ticket.name}</h4>
                                                    <p style={{ color: 'hsl(var(--accent))' }} className="font-bold text-base">ETB {Number(ticket.price).toFixed(2)}</p>
                                                    <p className="text-xs text-muted-foreground">{!isSoldOut ? `${ticket.total - ticket.sold} remaining` : 'Sold Out'}</p>
                                                </div>
                                                <Button 
                                                    onClick={() => openPurchaseDialog(ticket)}
                                                    disabled={isLoading || isSoldOut}
                                                    className="w-full sm:w-auto shrink-0 bg-accent hover:bg-accent/90 text-accent-foreground"
                                                    size="sm"
                                                >
                                                    {isLoading && loadingTicketId === ticket.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Ticket className="mr-2 h-4 w-4" />}
                                                    Get Ticket
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
     <AlertDialog open={purchaseState.isOpen} onOpenChange={(open) => !open && setPurchaseState({ticket: null, isOpen: false})}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Attendee Information</AlertDialogTitle>
                <AlertDialogDescription>
                    Please provide the name and phone number for the ticket holder.
                </AlertDialogDescription>
            </AlertDialogHeader>
             <div className="space-y-4">
                <div className="grid gap-2">
                    <Label htmlFor="name">Full Name</Label>
                     <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input id="name" placeholder="Enter full name" value={attendeeName} onChange={e => setAttendeeName(e.target.value)} className="pl-10" />
                    </div>
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input id="phone" placeholder="e.g., 0912345678" value={attendeePhone} onChange={e => setAttendeePhone(e.target.value)} className="pl-10" />
                    </div>
                </div>
            </div>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction 
                    onClick={handlePurchase}
                    disabled={isPending}
                >
                    {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Ticket className="mr-2 h-4 w-4" />}
                    Proceed to Payment
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
   </>
  );
}
