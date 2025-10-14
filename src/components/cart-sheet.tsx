

'use client';

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Loader2, MinusCircle, PlusCircle, ShoppingCart, X } from "lucide-react";
import type { SelectedTicket } from "@/app/events/[id]/page";
import type { PromoCode } from "@prisma/client";

interface CartSheetProps {
  children: React.ReactNode;
  selectedTickets: Record<number, SelectedTicket>;
  subtotal: number;
  discount: number;
  total: number;
  totalItems: number;
  promoCode: string;
  setPromoCode: (code: string) => void;
  appliedPromo: PromoCode | null;
  isPromoLoading: boolean;
  handleApplyPromoCode: () => void;
  removePromoCode: () => void;
  updateTicketQuantity: (ticket: SelectedTicket, quantity: number) => void;
  eventColor?: string | null;
}

export default function CartSheet({
  children,
  selectedTickets,
  subtotal,
  discount,
  total,
  totalItems,
  promoCode,
  setPromoCode,
  appliedPromo,
  isPromoLoading,
  handleApplyPromoCode,
  removePromoCode,
  updateTicketQuantity,
}: CartSheetProps) {

  return (
    <>
    <Sheet>
        <SheetTrigger asChild>
            <div className="fixed right-6 top-1/2 -translate-y-1/2 z-50">
                <Button className="h-14 w-14 rounded-full shadow-lg" size="icon">
                    <ShoppingCart className="h-6 w-6" />
                    <Badge variant="secondary" className="absolute -top-1 -right-1 h-6 w-6 justify-center rounded-full bg-primary text-primary-foreground">{totalItems}</Badge>
                    <span className="sr-only">View Cart</span>
                </Button>
            </div>
        </SheetTrigger>
        <SheetContent 
          className="flex flex-col bg-card text-card-foreground sm:max-w-md"
        >
            <SheetHeader className="text-left">
                <SheetTitle className="text-card-foreground">Your Cart</SheetTitle>
                <SheetDescription>
                    Review your order and proceed to checkout.
                </SheetDescription>
            </SheetHeader>
            <ScrollArea className="flex-1 my-4">
                <div className="space-y-4 pr-4">
                {Object.values(selectedTickets).map(ticket => {
                    const remaining = ticket.total - ticket.sold;
                    return (
                        <div key={ticket.id} className="flex items-center gap-4 p-3 rounded-lg bg-secondary">
                            <div className="flex-1">
                                <p className="font-semibold">{ticket.name}</p>
                                <p className="text-sm text-accent font-bold">ETB {ticket.price.toFixed(2)}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateTicketQuantity(ticket, Math.max(0, ticket.quantity - 1))} disabled={ticket.quantity === 0}>
                                    <MinusCircle className="h-4 w-4" />
                                </Button>
                                <span className="w-8 text-center font-bold text-sm">{ticket.quantity}</span>
                                <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateTicketQuantity(ticket, Math.min(remaining, ticket.quantity + 1))} disabled={remaining === 0 || ticket.quantity >= remaining}>
                                    <PlusCircle className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    )
                })}
                </div>
            </ScrollArea>
            <SheetFooter className="mt-auto flex flex-col gap-4 !space-x-0 border-t border-border pt-4">
                 <div className="space-y-2">
                    <div className="flex justify-between">
                        <span>Subtotal</span>
                        <span className="font-semibold">ETB {subtotal.toFixed(2)}</span>
                    </div>
                    {appliedPromo && (
                        <div className="flex justify-between text-green-600 dark:text-green-400">
                            <span>Discount ({appliedPromo.code})</span>
                            <span className="font-semibold">-ETB {discount.toFixed(2)}</span>
                        </div>
                    )}
                    <div className="border-t border-border my-2"></div>
                    <div className="flex justify-between text-xl font-bold">
                        <span>Total</span>
                        <span>ETB {total.toFixed(2)}</span>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="flex gap-2">
                        <Input 
                            placeholder="Promo Code" 
                            value={promoCode}
                            onChange={e => setPromoCode(e.target.value)}
                            className="flex-grow placeholder:text-muted-foreground"
                            disabled={!!appliedPromo}
                        />
                        {appliedPromo ? (
                            <Button onClick={removePromoCode} variant="outline" size="icon">
                                <X className="h-4 w-4" />
                            </Button>
                        ) : (
                            <Button onClick={handleApplyPromoCode} disabled={isPromoLoading || !promoCode} variant="secondary">
                                {isPromoLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Apply
                            </Button>
                        )}
                    </div>
                    {children}
                </div>
            </SheetFooter>
        </SheetContent>
    </Sheet>
    </>
  );
}
