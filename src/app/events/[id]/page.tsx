
'use client';

import { getEventById, validatePromoCode } from '@/lib/actions';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Ticket, Calendar, MapPin, Loader2, MinusCircle, PlusCircle, ShoppingCart, Info } from 'lucide-react';
import { notFound, useParams } from 'next/navigation';
import { format } from 'date-fns';
import type { Event, TicketType, PromoCode } from '@prisma/client';
import { useEffect, useState, useTransition, useMemo } from 'react';
import { purchaseTickets } from '@/lib/actions';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

interface EventWithTickets extends Event {
    ticketTypes: TicketType[];
}

type SelectedTicket = {
  id: number;
  name: string;
  price: number;
  quantity: number;
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
  const [event, setEvent] = useState<EventWithTickets | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTickets, setSelectedTickets] = useState<Record<number, SelectedTicket>>({});
  const [promoCode, setPromoCode] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<PromoCode | null>(null);
  const [discount, setDiscount] = useState(0);
  const [isPromoLoading, setIsPromoLoading] = useState(false);
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

  const updateTicketQuantity = (ticketType: TicketType, quantity: number) => {
    setSelectedTickets(prev => {
      const newSelected = { ...prev };
      if (quantity > 0) {
        newSelected[ticketType.id] = {
          id: ticketType.id,
          name: ticketType.name,
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
        const result = await validatePromoCode(eventId, promoCode);
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
  
  useEffect(() => {
    if (appliedPromo) {
      if (appliedPromo.type === 'PERCENTAGE') {
        setDiscount(subtotal * (Number(appliedPromo.value) / 100));
      } else if (appliedPromo.type === 'FIXED') {
        setDiscount(Number(appliedPromo.value));
      }
    } else {
      setDiscount(0);
    }
  }, [appliedPromo, subtotal]);

  const handlePurchase = () => {
    startTransition(async () => {
      await purchaseTickets({
          eventId,
          tickets: Object.values(selectedTickets),
          promoCode: appliedPromo?.code,
      });
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
  
  const firstImage = event.image?.split(',')[0].trim() || 'https://placehold.co/1200x600.png';

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-4xl">
      <div className="bg-card shadow-xl rounded-lg overflow-hidden">
        <div className="relative w-full aspect-video">
          <Image src={firstImage} alt={`${event.name} image`} fill className="object-cover" data-ai-hint={event.hint ?? 'event'} />
        </div>

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
            
            <div className="border-t"></div>

            <div>
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

            {totalItems > 0 && (
                 <Card>
                    <CardHeader>
                        <CardTitle>Order Summary</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex justify-between">
                            <span>Subtotal ({totalItems} items)</span>
                            <span className="font-semibold">ETB {subtotal.toFixed(2)}</span>
                        </div>
                        <div className="flex gap-2">
                            <Input 
                                placeholder="Promo Code" 
                                value={promoCode}
                                onChange={e => setPromoCode(e.target.value)}
                                className="flex-grow"
                            />
                            <Button onClick={handleApplyPromoCode} disabled={isPromoLoading || !promoCode}>
                                {isPromoLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Apply
                            </Button>
                        </div>
                        {appliedPromo && (
                             <div className="flex justify-between text-green-600">
                                <span>Discount ({appliedPromo.code})</span>
                                <span className="font-semibold">- ETB {discount.toFixed(2)}</span>
                            </div>
                        )}
                        <div className="border-t"></div>
                        <div className="flex justify-between text-xl font-bold">
                            <span>Total</span>
                            <span>ETB {total.toFixed(2)}</span>
                        </div>
                    </CardContent>
                    <CardFooter>
                         <Button 
                            onClick={handlePurchase}
                            disabled={isPending || totalItems === 0}
                            className="w-full bg-accent hover:bg-accent/90 text-accent-foreground"
                            size="lg"
                        >
                            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShoppingCart className="mr-2 h-4 w-4" />}
                            Purchase Tickets
                        </Button>
                    </CardFooter>
                </Card>
            )}

        </div>
      </div>
    </div>
  );
}
