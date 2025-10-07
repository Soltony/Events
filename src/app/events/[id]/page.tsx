

'use client';

import { getEventById, validatePromoCode } from '@/lib/actions';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Ticket, Calendar, MapPin, Loader2, MinusCircle, PlusCircle, ShoppingCart, Info, User, Phone, ArrowLeft, X } from 'lucide-react';
import { notFound, useParams } from 'next/navigation';
import { format } from 'date-fns';
import type { Event, TicketType, PromoCode } from '@prisma/client';
import { useEffect, useState, useTransition, useMemo } from 'react';
import { purchaseTickets } from '@/lib/actions';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
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
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import CartSheet from '@/components/cart-sheet';


interface EventWithTickets extends Event {
    ticketTypes: TicketType[];
    color?: string | null;
}

export type SelectedTicket = {
  id: number;
  name: string;
  price: number;
  quantity: number;
  total: number;
  sold: number;
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

export default function PublicEventDetailPage() {
  const params = useParams<{ id:string }>();
  const eventId = params ? parseInt(params.id, 10) : NaN;
  const [isPending, startTransition] = useTransition();
  const [event, setEvent] = useState<EventWithTickets | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTickets, setSelectedTickets] = useState<Record<number, SelectedTicket>>({});
  const [promoCode, setPromoCode] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<PromoCode | null>(null);
  const [discount, setDiscount] = useState(0);
  const [isPromoLoading, setIsPromoLoading] = useState(false);
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [attendeeName, setAttendeeName] = useState('');
  const [attendeePhone, setAttendeePhone] = useState('');
  const { toast } = useToast();

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

  const subtotal = useMemo(() => {
    return Object.values(selectedTickets).reduce((acc, ticket) => acc + ticket.price * ticket.quantity, 0);
  }, [selectedTickets]);

  const total = useMemo(() => {
    return subtotal - discount;
  }, [subtotal, discount]);
  
  const totalItems = useMemo(() => {
      return Object.values(selectedTickets).reduce((acc, ticket) => acc + ticket.quantity, 0);
  }, [selectedTickets]);

  const getCategoryBadgeClass = (category: string) => {
    switch (category) {
      case 'Technology':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Music':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'Art':
        return 'bg-pink-100 text-pink-800 border-pink-200';
      case 'Community':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'Business':
        return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  }

  const updateTicketQuantity = (ticketType: TicketType | SelectedTicket, quantity: number) => {
    setSelectedTickets(prev => {
      const newSelected = { ...prev };
      if (quantity > 0) {
        newSelected[ticketType.id] = {
          ...ticketType,
          price: Number(ticketType.price),
          quantity: quantity,
        };
      } else {
        delete newSelected[ticketType.id];
      }
      return newSelected;
    });
  };

  const handleApplyPromoCode = async () => {
    if (!promoCode) return;
    setIsPromoLoading(true);
    try {
        const result = await validatePromoCode(promoCode, eventId);
        if (result) {
            setAppliedPromo(result);
            toast({ title: "Success", description: "Promo code applied!" });
        } else {
            setAppliedPromo(null);
            toast({ variant: 'destructive', title: "Error", description: "Invalid or expired promo code." });
        }
    } catch (e) {
        setAppliedPromo(null);
        toast({ variant: 'destructive', title: "Error", description: "Could not validate promo code." });
    } finally {
        setIsPromoLoading(false);
    }
  };

  const removePromoCode = () => {
    setAppliedPromo(null);
    setPromoCode('');
  }
  
  useEffect(() => {
    if (appliedPromo) {
      if (appliedPromo.type === 'PERCENTAGE') {
        setDiscount(subtotal * (Number(appliedPromo.value) / 100));
      } else if (appliedPromo.type === 'FIXED') {
        setDiscount(Math.min(subtotal, Number(appliedPromo.value)));
      }
    } else {
      setDiscount(0);
    }
  }, [appliedPromo, subtotal]);

  const handlePurchase = () => {
    if (!attendeeName || !attendeePhone) {
      toast({ variant: 'destructive', title: "Missing Information", description: "Please enter your name and phone number." });
      return;
    }

    startTransition(() => {
        purchaseTickets({
            eventId,
            tickets: Object.values(selectedTickets),
            promoCode: appliedPromo?.code,
            attendeeDetails: {
              name: attendeeName,
              phone: attendeePhone,
            }
        });
        setIsPurchaseModalOpen(false);
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
  
  const imageUrl = event.image || DEFAULT_IMAGE_PLACEHOLDER;
  const gradientStyle = event.color
    ? { background: `linear-gradient(to bottom, ${event.color}, #ffffff)` }
    : { background: `linear-gradient(to bottom, #f6b313, #ffffff)` };

  return (
    <>
      <div className="container mx-auto p-4 md:p-8 max-w-4xl space-y-8">
        <div className="mb-4">
            <Button asChild variant="outline">
              <Link href="/">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to all events
              </Link>
            </Button>
        </div>
        <div className="relative bg-card shadow-xl rounded-lg overflow-hidden">
          <div className="absolute inset-0" style={gradientStyle} />
          <div className="relative z-10 w-full aspect-video">
            <Image src={imageUrl} alt={`${event.name} image`} fill className="object-cover" data-ai-hint={event.hint ?? 'event'} onError={(e) => { const target = e.target as HTMLImageElement; target.src = DEFAULT_IMAGE_PLACEHOLDER; target.srcset = ''; }} />
          </div>
          <div className="relative z-10 p-6 md:p-8 space-y-8">
            <div>
              <Badge variant="outline" className={`mb-2 w-min whitespace-nowrap ${getCategoryBadgeClass(event.category)}`}>{event.category}</Badge>
              <h1 className="text-4xl font-bold tracking-tight">{event.name}</h1>
              <div className="text-lg text-muted-foreground space-y-2 pt-4">
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5" />
                  <span>{formatEventDate(event.startDate, event.endDate)}</span>
                </div>
                <div className="flex items-center gap-3">
                  <MapPin className="h-5 w-5" />
                  <span>{event.location}</span>
                </div>
                {event.hint && (
                  <div className="flex items-start gap-3 text-base">
                    <Info className="h-5 w-5 mt-1 flex-shrink-0" />
                    <p className="text-muted-foreground">{event.hint}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="border-t"></div>

            <div>
              <h3 className="text-2xl font-semibold mb-4">About this Event</h3>
              <p className="text-base text-muted-foreground whitespace-pre-wrap leading-relaxed">{event.description}</p>
            </div>
          </div>
        </div>

        <div id="tickets" className="space-y-6 scroll-mt-20">
          <h3 className="text-2xl font-semibold mb-4">Tickets</h3>
          <div className="space-y-4">
            {event.ticketTypes.length > 0 ? (
              event.ticketTypes.map(ticket => {
                const selectedQuantity = selectedTickets[ticket.id]?.quantity || 0;
                const remaining = ticket.total - ticket.sold;
                return (
                  <div key={ticket.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 rounded-lg border bg-secondary/50">
                    <div className="mb-3 sm:mb-0">
                      <h4 className="font-semibold text-lg">{ticket.name}</h4>
                      <p style={{ color: 'hsl(var(--accent))' }} className="font-bold text-xl">ETB {Number(ticket.price).toFixed(2)}</p>
                      <p className="text-sm text-muted-foreground">{remaining > 0 ? `${remaining} remaining` : 'Sold Out'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="icon" variant="outline" onClick={() => updateTicketQuantity(ticket, Math.max(0, selectedQuantity - 1))} disabled={selectedQuantity === 0}>
                        <MinusCircle className="h-4 w-4" />
                      </Button>
                      <span className="w-10 text-center font-bold">{selectedQuantity}</span>
                      <Button size="icon" variant="outline" onClick={() => updateTicketQuantity(ticket, Math.min(remaining, selectedQuantity + 1))} disabled={remaining === 0 || selectedQuantity >= remaining}>
                        <PlusCircle className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )
              })
            ) : (
              <p className="text-muted-foreground">Tickets are not yet available for this event.</p>
            )}
          </div>
        </div>
      </div>
      
      {totalItems > 0 &&
        <CartSheet
          selectedTickets={selectedTickets}
          subtotal={subtotal}
          discount={discount}
          total={total}
          totalItems={totalItems}
          promoCode={promoCode}
          setPromoCode={setPromoCode}
          appliedPromo={appliedPromo}
          isPromoLoading={isPromoLoading}
          handleApplyPromoCode={handleApplyPromoCode}
          removePromoCode={removePromoCode}
          updateTicketQuantity={updateTicketQuantity}
        >
          <AlertDialogTrigger asChild>
            <Button 
                className="w-full bg-accent hover:bg-accent/90 text-accent-foreground"
                size="lg"
            >
                <ShoppingCart className="mr-2 h-4 w-4" />
                Purchase Tickets
            </Button>
          </AlertDialogTrigger>
        </CartSheet>
      }

      <AlertDialog open={isPurchaseModalOpen} onOpenChange={setIsPurchaseModalOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Attendee Information</AlertDialogTitle>
            <AlertDialogDescription>
              Please provide your name and phone number for the ticket.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Full Name</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="name" placeholder="Enter your full name" value={attendeeName} onChange={e => setAttendeeName(e.target.value)} className="pl-10" />
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
            <AlertDialogAction onClick={handlePurchase} disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Proceed to Payment
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
