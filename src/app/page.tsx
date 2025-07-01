
'use client';

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { PlusCircle, ArrowUpRight } from "lucide-react";
import Link from 'next/link';
import Image from 'next/image';
import RecommendationTool from '@/components/recommendation-tool';
import { getEvents, type Event } from '@/lib/store';
import { Badge } from '@/components/ui/badge';

export default function DashboardPage() {
  const [events, setEvents] = useState<Event[]>([]);

  useEffect(() => {
    setEvents(getEvents());
  }, []);

  return (
    <div className="flex flex-1 flex-col gap-4 md:gap-8">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Here&apos;s a list of your events.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button asChild>
            <Link href="/events/new">
              <PlusCircle className="mr-2 h-4 w-4" /> Create Event
            </Link>
          </Button>
        </div>
      </div>
      
      <div className="grid gap-4 md:gap-8 lg:grid-cols-2 xl:grid-cols-3">
        {events.map((event) => (
          <Card key={event.id} className="flex flex-col">
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
                <Link href={`/events/${event.id}`}>Manage Event <ArrowUpRight className="ml-auto h-4 w-4" /></Link>
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      <RecommendationTool />
    </div>
  );
}
