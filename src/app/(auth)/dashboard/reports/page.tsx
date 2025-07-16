
'use client';

import { useState, useEffect } from 'react';
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
import { getReportsData } from '@/lib/actions';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import type { TicketType, PromoCode } from '@prisma/client';

interface DailySale {
    date: Date;
    eventName: string;
    ticketsSold: number;
    revenue: number;
}

interface ProductSale extends TicketType {
    event: { name: string };
}

interface PromoCodeReport extends PromoCode {
    event: { name: string };
    totalDiscount: number;
}

interface ReportsData {
    productSales: ProductSale[];
    dailySales: DailySale[];
    promoCodes: PromoCodeReport[];
}

export default function ReportsPage() {
    const [data, setData] = useState<ReportsData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchData() {
            try {
                setLoading(true);
                const reportsData = await getReportsData();
                setData(reportsData);
            } catch (error) {
                console.error("Failed to fetch reports data:", error);
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, []);

    if (loading || !data) {
        return (
            <div className="flex flex-1 flex-col gap-4 md:gap-8">
                <div className="space-y-2">
                    <Skeleton className="h-8 w-32" />
                    <Skeleton className="h-4 w-96" />
                </div>
                <div className="space-y-8">
                    {[...Array(3)].map((_, i) => (
                        <Card key={i}>
                            <CardHeader className="flex flex-row items-center justify-between">
                                <div className="space-y-2">
                                    <Skeleton className="h-6 w-48" />
                                    <Skeleton className="h-4 w-80" />
                                </div>
                                <Skeleton className="h-10 w-40" />
                            </CardHeader>
                            <CardContent>
                               <Skeleton className="h-40 w-full" />
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        )
    }

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
                {data.productSales.map((ticket) => (
                    <TableRow key={ticket.id}>
                      <TableCell className="font-medium">{ticket.name}</TableCell>
                      <TableCell className="text-muted-foreground">{ticket.event?.name || 'N/A'}</TableCell>
                      <TableCell className="text-right">{ticket.sold}</TableCell>
                      <TableCell className="text-right">ETB {Number(ticket.price).toFixed(2)}</TableCell>
                      <TableCell className="text-right">ETB {(ticket.sold * Number(ticket.price)).toLocaleString()}</TableCell>
                    </TableRow>
                ))}
                {data.productSales.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center h-24">No product sales data.</TableCell></TableRow>
                )}
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
                {data.dailySales.map((sale, index) => (
                    <TableRow key={index}>
                        <TableCell>{format(new Date(sale.date), 'LLL dd, y')}</TableCell>
                        <TableCell className="font-medium">{sale.eventName}</TableCell>
                        <TableCell className="text-right">{sale.ticketsSold.toLocaleString()}</TableCell>
                        <TableCell className="text-right">ETB {sale.revenue.toLocaleString()}</TableCell>
                    </TableRow>
                ))}
                 {data.dailySales.length === 0 && (
                    <TableRow>
                        <TableCell colSpan={4} className="text-center h-24">No sales data available.</TableCell>
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
                {data.promoCodes.map((code) => (
                    <TableRow key={code.id}>
                        <TableCell className="font-mono">{code.code}</TableCell>
                        <TableCell className="text-muted-foreground">{code.event?.name || 'N/A'}</TableCell>
                        <TableCell className="text-right">{code.uses} / {code.maxUses}</TableCell>
                        <TableCell className="text-right">ETB {code.totalDiscount.toFixed(2)}</TableCell>
                    </TableRow>
                ))}
                 {data.promoCodes.length === 0 && (
                    <TableRow>
                        <TableCell colSpan={4} className="text-center h-24">No promo code data available.</TableCell>
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
