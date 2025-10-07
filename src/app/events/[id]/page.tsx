

'use client';

import { getEventById, validatePromoCode } from '@/lib/actions';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Ticket, Calendar, MapPin, Loader2, MinusCircle, PlusCircle, ShoppingCart, Info, User, Phone, ArrowLeft, X, UserCircle } from 'lucide-react';
import { notFound, useParams, useRouter } from 'next/navigation';
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
import { cn } from '@/lib/utils';


interface EventWithTickets extends Event {
    ticketTypes: TicketType[];
    color?: string | null;
    organizerName?: string | null;
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
  const router = useRouter();
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
      <div className="container mx-auto max-w-5xl py-8 px-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-2 space-y-8">
                <Skeleton className="h-9 w-40" />
                <Skeleton className="w-full aspect-[4/3] rounded-lg" />
                <div className="space-y-4">
                    <Skeleton className="h-10 w-3/4" />
                    <Skeleton className="h-6 w-1/2" />
                    <Skeleton className="h-6 w-1/3" />
                </div>
                <div className="space-y-4">
                    <Skeleton className="h-8 w-48" />
                    <Skeleton className="h-5 w-full" />
                    <Skeleton className="h-5 w-full" />
                    <Skeleton className="h-5 w-3/4" />
                </div>
            </div>
            <div className="space-y-8">
                <Skeleton className="h-8 w-24" />
                <Skeleton className="h-24 w-full rounded-lg" />
                <Skeleton className="h-24 w-full rounded-lg" />
            </div>
        </div>
      </div>
    )
  }
  
  const imageUrl = event.image || DEFAULT_IMAGE_PLACEHOLDER;
  const gradientStyle = event.color
    ? { backgroundColor: event.color }
    : { backgroundColor: '#864b20' };

  return (
    <>
      <div 
        className={cn(
          "w-full min-h-screen",
          event.color ? '' : 'bg-[#864b20]'
        )}
        style={event.color ? { backgroundColor: event.color } : {}}
      >
        <div className="container mx-auto max-w-5xl py-8 px-4">
           <Button asChild variant="outline" className="absolute top-4 left-4 bg-white/80 hover:bg-white text-black">
              <Link href="/">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to all events
              </Link>
            </Button>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-16">
            <div className="md:col-span-2 space-y-8">
                <div className="w-full aspect-[4/3] relative rounded-lg overflow-hidden shadow-lg">
                    <Image src={imageUrl} alt={`${event.name} image`} fill className="object-cover" data-ai-hint={event.hint ?? 'event'} onError={(e) => { const target = e.target as HTMLImageElement; target.src = DEFAULT_IMAGE_PLACEHOLDER; target.srcset = ''; }} />
                </div>

                <div className="bg-card/80 backdrop-blur-sm rounded-lg p-6 shadow-md">
                  <Badge variant="outline" className={`mb-2 w-min whitespace-nowrap ${getCategoryBadgeClass(event.category)}`}>{event.category}</Badge>
                  <h1 className="text-4xl font-bold tracking-tight">{event.name}</h1>
                   {event.organizerName && (
                      <div className="flex items-center gap-2 text-lg text-muted-foreground pt-3">
                        <UserCircle className="h-5 w-5" />
                        <span>By {event.organizerName}</span>
                      </div>
                    )}
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

                <div className="bg-card/80 backdrop-blur-sm rounded-lg p-6 shadow-md">
                  <h3 className="text-2xl font-semibold mb-4">About this Event</h3>
                  <p className="text-base text-muted-foreground whitespace-pre-wrap leading-relaxed">{event.description}</p>
                </div>
            </div>

            <div className="space-y-8">
              <div className="bg-card/80 backdrop-blur-sm rounded-lg p-6 shadow-md">
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
