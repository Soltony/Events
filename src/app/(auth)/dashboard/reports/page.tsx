
'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { FileDown } from 'lucide-react';
import { ticketTypes, promoCodes, events } from '@/lib/mock-data';

export default function ReportsPage() {
    
    const promoCodeData = promoCodes.map(code => {
        let totalDiscount = 0;
        if (code.type === 'percentage') {
            const avgTicketPrice = 50;
            totalDiscount = code.uses * (avgTicketPrice * (code.value / 100));
        } else {
            totalDiscount = code.uses * code.value;
        }
        return {
            ...code,
            totalDiscount,
        };
    });

    const dailySalesData = events.map(event => {
        const eventTickets = ticketTypes.filter(t => t.eventId === event.id);
        const ticketsSold = eventTickets.reduce((sum, t) => sum + t.sold, 0);
        const revenue = eventTickets.reduce((sum, t) => sum + (t.sold * t.price), 0);
        return {
            date: event.date,
            eventName: event.name,
            ticketsSold,
            revenue
        }
    });

  return (
    <div className="flex flex-1 flex-col gap-4 md:gap-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
        <p className="text-muted-foreground">
          View and download reports for your events. Only completed orders are included.
        </p>
      </div>

      <div className="space-y-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Product Sales</CardTitle>
              <CardDescription>Product sales, revenue, and other metrics.</CardDescription>
            </div>
            <Button variant="outline">
                <FileDown className="mr-2 h-4 w-4" />
                Download Report
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead className="text-right">Quantity Sold</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ticketTypes.map((ticket) => {
                  const event = events.find(e => e.id === ticket.eventId);
                  return (
                    <TableRow key={ticket.id}>
                      <TableCell className="font-medium">{ticket.name}</TableCell>
                      <TableCell className="text-muted-foreground">{event?.name || 'N/A'}</TableCell>
                      <TableCell className="text-right">{ticket.sold}</TableCell>
                      <TableCell className="text-right">${ticket.price.toFixed(2)}</TableCell>
                      <TableCell className="text-right">${(ticket.sold * ticket.price).toLocaleString()}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Daily Sales Report</CardTitle>
              <CardDescription>A summary of sales for each event date.</CardDescription>
            </div>
             <Button variant="outline">
                <FileDown className="mr-2 h-4 w-4" />
                Download Report
            </Button>
          </CardHeader>
          <CardContent>
             <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead className="text-right">Tickets Sold</TableHead>
                  <TableHead className="text-right">Net Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dailySalesData.map((sale, index) => (
                    <TableRow key={index}>
                        <TableCell>{sale.date}</TableCell>
                        <TableCell className="font-medium">{sale.eventName}</TableCell>
                        <TableCell className="text-right">{sale.ticketsSold.toLocaleString()}</TableCell>
                        <TableCell className="text-right">${sale.revenue.toLocaleString()}</TableCell>
                    </TableRow>
                ))}
                 {dailySalesData.length === 0 && (
                    <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground">No sales data available.</TableCell>
                    </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Promo Codes Report</CardTitle>
              <CardDescription>Promo code usage and discount breakdown.</CardDescription>
            </div>
             <Button variant="outline">
                <FileDown className="mr-2 h-4 w-4" />
                Download Report
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead className="text-right">Usage</TableHead>
                  <TableHead className="text-right">Total Discount (est.)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {promoCodeData.map((code) => {
                     const event = events.find(e => e.id === code.eventId);
                     return (
                        <TableRow key={code.id}>
                            <TableCell className="font-mono">{code.code}</TableCell>
                            <TableCell className="text-muted-foreground">{event?.name || 'N/A'}</TableCell>
                            <TableCell className="text-right">{code.uses} / {code.maxUses}</TableCell>
                            <TableCell className="text-right">${code.totalDiscount.toFixed(2)}</TableCell>
                        </TableRow>
                     )
                })}
                 {promoCodeData.length === 0 && (
                    <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground">No promo code data available.</TableCell>
                    </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
