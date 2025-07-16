
'use client';

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { PlusCircle, ArrowUpRight } from "lucide-react";
import Link from 'next/link';
import Image from 'next/image';
import { getEvents } from '@/lib/actions';
import { Badge } from '@/components/ui/badge';
import type { Event } from '@prisma/client';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';

function formatEventDate(startDate: Date, endDate: Date | null | undefined): string {
    if (endDate) {
      return `${format(new Date(startDate), 'LLL dd, y')} - ${format(new Date(endDate), 'LLL dd, y')}`;
    }
    return format(new Date(startDate), 'LLL dd, y');
}

export default function ManageEventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
        try {
            setLoading(true);
            const fetchedEvents = await getEvents();
            setEvents(fetchedEvents);
        } catch (error) {
            console.error("Failed to fetch events:", error);
        } finally {
            setLoading(false);
        }
    }
    fetchData();
  }, []);

  return (
    <div className="flex flex-1 flex-col gap-4 md:gap-8">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Manage Events</h1>
          <p className="text-muted-foreground">
            Select an event to view its details and manage it.
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
      
      <div className="grid gap-4 md:gap-8 md:grid-cols-2 lg:grid-cols-4">
        {loading ? (
            [...Array(4)].map((_, i) => (
                <Card key={i}>
                    <CardHeader className="p-0"><Skeleton className="w-full aspect-[3/2] rounded-t-lg" /></CardHeader>
                    <CardContent className="p-6 space-y-2"><Skeleton className="h-5 w-20" /><Skeleton className="h-7 w-3/4" /><Skeleton className="h-5 w-1/2" /></CardContent>
                    <CardFooter className="p-6 pt-0"><Skeleton className="h-10 w-full" /></CardFooter>
                </Card>
            ))
        ) : events.length > 0 ? (
          events.map((event) => (
            <Card key={event.id} className="flex flex-col hover:shadow-lg transition-shadow duration-300">
              <CardHeader className="p-0">
                <Image src={Array.isArray(event.image) ? event.image[0] : event.image} alt={event.name} width={600} height={400} className="rounded-t-lg object-cover aspect-[3/2]" data-ai-hint={event.hint ?? 'event'} />
              </CardHeader>
              <CardContent className="p-6 flex-1 space-y-2">
                <Badge variant="outline">{event.category}</Badge>
                <CardTitle>{event.name}</CardTitle>
                <CardDescription>{formatEventDate(event.startDate, event.endDate)} - {event.location}</CardDescription>
              </CardContent>
              <CardFooter className="p-6 pt-0">
                <Button asChild className="w-full">
                  <Link href={`/dashboard/events/${event.id}`}>Manage Event <ArrowUpRight className="ml-auto h-4 w-4" /></Link>
                </Button>
              </CardFooter>
            </Card>
          ))
        ) : (
            <Card className="md:col-span-2 lg:col-span-4 flex items-center justify-center p-8 text-center">
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
    </div>
  );
}
