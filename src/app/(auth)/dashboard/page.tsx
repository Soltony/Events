
'use client';

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { PlusCircle, ArrowUpRight, DollarSign, Ticket as TicketIcon, Calendar as CalendarIcon } from "lucide-react";
import Link from 'next/link';
import Image from 'next/image';
import RecommendationTool from '@/components/recommendation-tool';
import { getEvents, type Event } from '@/lib/store';
import { ticketTypes } from '@/lib/mock-data';
import { Badge } from '@/components/ui/badge';

export default function DashboardPage() {
  const [events, setEvents] = useState<Event[]>([]);

  useEffect(() => {
    setEvents(getEvents());
  }, []);

  const totalRevenue = ticketTypes.reduce((sum, t) => sum + (t.sold * t.price), 0);
  const totalTicketsSold = ticketTypes.reduce((sum, t) => sum + t.sold, 0);
  const totalEvents = events.length;

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

      <h2 className="text-2xl font-bold tracking-tight mt-4">Your Events</h2>
      
      <div className="grid gap-4 md:gap-8 lg:grid-cols-2 xl:grid-cols-3">
        {events.length > 0 ? (
          events.map((event) => (
            <Card key={event.id} className="flex flex-col hover:shadow-lg transition-shadow duration-300">
              <CardHeader className="p-0">
                <Image src={event.image} alt={event.name} width={600} height={400} className="rounded-t-lg object-cover aspect-[3/2]" data-ai-hint={event.hint} />
              </CardHeader>
              <CardContent className="p-6 flex-1 space-y-2">
                <Badge variant="outline">{event.category}</Badge>
                <CardTitle>{event.name}</CardTitle>
                <CardDescription>{event.date} - {event.location}</CardDescription>
              </CardContent>
              <CardFooter className="p-6 pt-0">
                <Button asChild className="w-full">
                  <Link href={`/dashboard/events/${event.id}`}>Manage Event <ArrowUpRight className="ml-auto h-4 w-4" /></Link>
                </Button>
              </CardFooter>
            </Card>
          ))
        ) : (
            <Card className="md:col-span-2 lg:col-span-3 flex items-center justify-center p-8 text-center">
                <div>
                    <h3 className="text-2xl font-semibold tracking-tight">You haven't created any events yet</h3>
                    <p className="text-muted-foreground mt-2 mb-6">Let's get your first event set up.</p>
                    <Button asChild>
                        <Link href="/dashboard/events/new">
                        <PlusCircle className="mr-2 h-4 w-4" /> Create Event
                        </Link>
                    </Button>
                </div>
            </Card>
        )}
      </div>

      <RecommendationTool />
    </div>
  );
}
