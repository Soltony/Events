
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { getPublicEvents } from '@/lib/actions';
import { format } from 'date-fns';
import type { Event } from '@prisma/client';

function formatEventDate(startDate: Date, endDate: Date | null | undefined): string {
    if (endDate) {
      return `${format(new Date(startDate), 'LLL dd, y')} - ${format(new Date(endDate), 'LLL dd, y')}`;
    }
    return format(new Date(startDate), 'LLL dd, y');
}


export default async function PublicHomePage() {
  const events: Event[] = await getPublicEvents();

  return (
    <div className="flex flex-1 flex-col gap-4 md:gap-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Upcoming Events</h1>
        <p className="text-muted-foreground">
          Discover events and get your tickets.
        </p>
      </div>
      
       <div className="grid gap-4 md:gap-8 md:grid-cols-2 lg:grid-cols-4">
        {events.length > 0 ? (
          events.map((event) => (
            <Card key={event.id} className="flex flex-col hover:shadow-lg transition-shadow duration-300">
              <CardHeader className="p-0">
                <Image src={(event.image as string).split(',')[0]} alt={event.name} width={600} height={400} className="rounded-t-lg object-cover aspect-[3/2]" data-ai-hint={event.hint ?? 'event'} />
              </CardHeader>
              <CardContent className="p-6 flex-1 space-y-2">
                <Badge variant="outline">{event.category}</Badge>
                <CardTitle>{event.name}</CardTitle>
                <CardDescription>{formatEventDate(event.startDate, event.endDate)} - {event.location}</CardDescription>
              </CardContent>
              <CardFooter className="p-6 pt-0">
                  <Button asChild className="w-full">
                      <Link href={`/events/${event.id}`}>View Details & Buy Tickets <ArrowUpRight className="ml-auto h-4 w-4" /></Link>
                  </Button>
              </CardFooter>
            </Card>
          ))
        ) : (
            <Card className="md:col-span-2 lg:col-span-4 flex items-center justify-center p-8 text-center">
                <div>
                    <h3 className="text-2xl font-semibold tracking-tight">No upcoming events available right now.</h3>
                    <p className="text-muted-foreground mt-2 mb-6">Please check back later!</p>
                </div>
            </Card>
        )}
      </div>
    </div>
  );
}
