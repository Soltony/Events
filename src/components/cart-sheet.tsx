
'use client';

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
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
            <Button className="fixed bottom-6 right-6 rounded-full h-16 w-16 shadow-lg z-50 bg-accent text-accent-foreground hover:bg-accent/90">
                <ShoppingCart className="h-6 w-6" />
                <Badge variant="secondary" className="absolute -top-1 -right-1 h-6 w-6 justify-center rounded-full bg-primary text-primary-foreground">{totalItems}</Badge>
                <span className="sr-only">Open Cart</span>
            </Button>
        </SheetTrigger>
        <SheetContent className="flex flex-col">
            <SheetHeader>
                <SheetTitle>Your Cart</SheetTitle>
                <SheetDescription>
                    Review your order and proceed to checkout.
                </SheetDescription>
            </SheetHeader>
            <div className="flex-1 min-h-0">
                <ScrollArea className="h-full pr-4 -mr-6">
                    <div className="space-y-4">
                    {Object.values(selectedTickets).map(ticket => {
                        const remaining = ticket.total - ticket.sold;
                        return (
                            <div key={ticket.id} className="flex items-center gap-4">
                                <div className="flex-1">
                                    <p className="font-semibold">{ticket.name}</p>
                                    <p className="text-sm text-muted-foreground">ETB {ticket.price.toFixed(2)}</p>
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
            </div>
            <SheetFooter className="flex-col space-y-4 pt-4 border-t">
                 <div className="space-y-2">
                    <div className="flex justify-between">
                        <span>Subtotal</span>
                        <span className="font-semibold">ETB {subtotal.toFixed(2)}</span>
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
                </div>

                <div className="flex gap-2">
                    <Input 
                        placeholder="Promo Code" 
                        value={promoCode}
                        onChange={e => setPromoCode(e.target.value)}
                        className="flex-grow"
                        disabled={!!appliedPromo}
                    />
                    {appliedPromo ? (
                        <Button onClick={removePromoCode} variant="outline" size="icon">
                            <X className="h-4 w-4" />
                        </Button>
                    ) : (
                        <Button onClick={handleApplyPromoCode} disabled={isPromoLoading || !promoCode}>
                            {isPromoLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Apply
                        </Button>
                    )}
                </div>
                {children}
            </SheetFooter>
        </SheetContent>
    </Sheet>
    </>
  );
}
