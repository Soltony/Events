
'use client';

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PlusCircle, DollarSign, Ticket as TicketIcon, Calendar as CalendarIcon } from "lucide-react";
import Link from 'next/link';
import { getEvents, type Event } from '@/lib/store';
import { ticketTypes } from '@/lib/mock-data';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts';

export default function DashboardPage() {
  const [events, setEvents] = useState<Event[]>([]);

  useEffect(() => {
    setEvents(getEvents());
  }, []);

  const totalRevenue = ticketTypes.reduce((sum, t) => sum + (t.sold * t.price), 0);
  const totalTicketsSold = ticketTypes.reduce((sum, t) => sum + t.sold, 0);
  const totalEvents = events.length;

  const salesData = events.map(event => {
    const eventTickets = ticketTypes.filter(t => t.eventId === event.id);
    const ticketsSold = eventTickets.reduce((sum, t) => sum + t.sold, 0);
    return { name: event.name, ticketsSold: ticketsSold };
  }).filter(e => e.ticketsSold > 0);

  const chartConfig = {
    ticketsSold: {
      label: "Tickets Sold",
      color: "hsl(var(--primary))",
    },
  };


  return (
    <div className="flex flex-1 flex-col gap-4 md:gap-8">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            An overview of all your events.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button asChild>
            <Link href="/dashboard/events/new">
              <PlusCircle className="mr-2 h-4 w-4" /> Create Event
            </Link>
          </Button>
        </div>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalRevenue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">From all ticket sales</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tickets Sold</CardTitle>
            <TicketIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">+{totalTicketsSold.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Across all events</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Events</CardTitle>
            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalEvents}</div>
            <p className="text-xs text-muted-foreground">Managed in the system</p>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
            <CardTitle>Ticket Sales Overview</CardTitle>
            <CardDescription>A summary of tickets sold per event.</CardDescription>
        </CardHeader>
        <CardContent>
            {salesData.length > 0 ? (
                <ChartContainer config={chartConfig} className="min-h-[250px] w-full">
                    <BarChart accessibilityLayer data={salesData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid vertical={false} />
                        <XAxis dataKey="name" tickLine={false} tickMargin={10} axisLine={false} />
                        <YAxis />
                        <Tooltip cursor={{fill: 'hsl(var(--muted))'}} content={<ChartTooltipContent />} />
                        <Bar dataKey="ticketsSold" fill="var(--color-ticketsSold)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ChartContainer>
            ) : (
                <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                    No ticket sales data to display.
                </div>
            )}
        </CardContent>
      </Card>
    </div>
  );
}
