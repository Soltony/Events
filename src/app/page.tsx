
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import Image from 'next/image';
import { getEvents, type Event } from '@/lib/store';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';

export default function PublicHomePage() {
  const [events, setEvents] = useState<Event[] | null>(null);

  useEffect(() => {
    setEvents(getEvents());
  }, []);

  return (
    <div className="flex flex-1 flex-col gap-4 md:gap-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Upcoming Events</h1>
        <p className="text-muted-foreground">
          Discover events and get your tickets.
        </p>
      </div>
      
      {events === null && (
        <div className="grid gap-4 md:gap-8 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <Skeleton className="h-[266px] w-full rounded-t-lg" />
              <CardContent className="p-6 space-y-2">
                <Skeleton className="h-5 w-1/4" />
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-5 w-1/2" />
              </CardContent>
              <CardFooter className="p-6 pt-0">
                  <Skeleton className="h-10 w-full" />
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {events && (
         <div className="grid gap-4 md:gap-8 md:grid-cols-2 lg:grid-cols-3">
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
                        <Link href={`/events/${event.id}`}>View Details & Buy Tickets <ArrowUpRight className="ml-auto h-4 w-4" /></Link>
                    </Button>
                </CardFooter>
              </Card>
            ))
          ) : (
              <Card className="md:col-span-2 lg:col-span-3 flex items-center justify-center p-8 text-center">
                  <div>
                      <h3 className="text-2xl font-semibold tracking-tight">No events available right now.</h3>
                      <p className="text-muted-foreground mt-2 mb-6">Please check back later!</p>
                  </div>
              </Card>
          )}
        </div>
      )}
    </div>
  );
}
