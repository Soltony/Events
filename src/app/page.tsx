
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowUpRight, Search, Ticket } from 'lucide-react';
import { getPublicEvents } from '@/lib/actions';
import { format } from 'date-fns';
import type { Event, TicketType } from '@prisma/client';
import { useState, useEffect, useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AuthStatus } from "@/components/auth-status";
import EventsCarousel from "@/components/events-carousel";


interface EventWithTickets extends Event {
    ticketTypes: TicketType[];
}

function formatEventDate(startDate: Date, endDate: Date | null | undefined): string {
    const startDateFormat = 'LLL dd, y, hh:mm a';
    
    if (endDate) {
      const endDateFormat = format(new Date(endDate), 'LLL dd, y') === format(new Date(startDate), 'LLL dd, y') 
        ? 'hh:mm a'
        : startDateFormat;
      return `${format(new Date(startDate), startDateFormat)} - ${format(new Date(endDate), endDateFormat)}`;
    }
    return format(new Date(startDate), startDateFormat);
}

const DEFAULT_IMAGE_PLACEHOLDER = '/image/nibtickets.jpg';

export default function PublicHomePage() {
  const [events, setEvents] = useState<EventWithTickets[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  useEffect(() => {
    async function fetchData() {
        try {
            setLoading(true);
            const fetchedEvents = await getPublicEvents();
            setEvents(fetchedEvents);
        } catch (error) {
            console.error("Failed to fetch events:", error);
        } finally {
            setLoading(false);
        }
    }
    fetchData();
  }, []);

  const categories = useMemo(() => {
    const allCategories = new Set(events.map(event => event.category));
    return ['All', ...Array.from(allCategories)];
  }, [events]);

  const { upcomingEvents, otherEvents } = useMemo(() => {
    const now = new Date();
    
    const filteredEvents = events.filter(event => {
        const matchesCategory = selectedCategory === 'All' || event.category === selectedCategory;
        const matchesSearch = !searchQuery || 
          event.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
          event.description.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesCategory && matchesSearch;
      });

    const upcoming = filteredEvents.filter(event => new Date(event.startDate) > now);
    const other = filteredEvents.filter(event => new Date(event.startDate) <= now);

    return { 
        upcomingEvents: upcoming,
        otherEvents: other
    };
  }, [events, searchQuery, selectedCategory]);

  return (
    <div className="flex flex-1 flex-col">
    <div className="flex flex-col md:flex-row items-center justify-between gap-4 px-4 lg:px-6 py-4">
        <div className="flex-shrink-0">
          <Image src="/image/nibtickets.jpg"alt="NibTera Tickets Logo" width={200} height={50} data-ai-hint="logo nibtera" />
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
          <div className="relative flex-1 md:flex-initial w-full sm:w-auto md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input 
              placeholder="Search events..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex gap-4 w-full sm:w-auto">
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Filter by category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map(category => (
                  <SelectItem key={category} value={category}>{category}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button asChild variant="outline" className="w-full">
                <Link href="/tickets">
                    <Ticket className="mr-2 h-4 w-4" />
                    My Tickets
                </Link>
            </Button>
          </div>
          <div className="w-full sm:w-auto">
             <AuthStatus />
          </div>
        </div>
      </div>
      
      {loading ? (
        <div className="p-4 lg:p-6"><Skeleton className="h-[400px] w-full" /></div>
      ) : upcomingEvents.length > 0 ? (
        <div className="py-6">
            <h2 className="text-3xl font-bold tracking-tight text-center mb-4">Upcoming Events</h2>
            <EventsCarousel events={upcomingEvents} />
        </div>
      ) : null}
      
       <div className="grid gap-4 md:gap-8 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 p-4 lg:p-6">
        {loading ? (
             [...Array(10)].map((_, i) => (
                <Card key={i}>
                    <CardHeader className="p-0"><Skeleton className="w-full aspect-video rounded-t-lg" /></CardHeader>
                    <CardContent className="p-3 space-y-1"><Skeleton className="h-4 w-16" /><Skeleton className="h-5 w-3/4" /><Skeleton className="h-4 w-1/2" /></CardContent>
                    <CardFooter className="p-3 pt-0"><Skeleton className="h-9 w-full" /></CardFooter>
                </Card>
            ))
        ) : otherEvents.length > 0 ? (
          otherEvents.map((event) => {
            const imageUrl = event.image || DEFAULT_IMAGE_PLACEHOLDER;
            return (
              <Link href={`/events/${event.id}`} key={event.id} className="group">
                <Card className="flex flex-col h-full group-hover:shadow-lg transition-shadow duration-300">
                  <CardHeader className="p-0">
                    <Image src={imageUrl} alt={event.name} width={600} height={338} className="rounded-t-lg object-cover aspect-video" data-ai-hint={event.hint ?? 'event'} onError={(e) => { const target = e.target as HTMLImageElement; target.src = DEFAULT_IMAGE_PLACEHOLDER; target.srcset = ''; }}/>
                  </CardHeader>
                  <CardContent className="p-3 flex-1 space-y-1">
                    <Badge variant="outline" className="text-xs">{event.category}</Badge>
                    <CardTitle className="text-base leading-tight">{event.name}</CardTitle>
                    <CardDescription className="text-xs">{formatEventDate(event.startDate, event.endDate)}</CardDescription>
                  </CardContent>
                  <CardFooter className="p-3 pt-0">
                      <Button asChild className="w-full" size="sm">
                         <span >
                           Buy Tickets <ArrowUpRight className="h-4 w-4" />
                         </span>
                      </Button>
                  </CardFooter>
                </Card>
              </Link>
            )
          })
        ) : (
             !loading && upcomingEvents.length > 0 && otherEvents.length === 0 ? null :
            <Card className="sm:col-span-2 lg:col-span-3 xl:col-span-5 flex items-center justify-center p-8 text-center">
                <div>
                    <h3 className="text-2xl font-semibold tracking-tight">No Events Found</h3>
                    <p className="text-muted-foreground mt-2 mb-6">Try adjusting your search or filter criteria.</p>
                </div>
            </Card>
        )}
      </div>
    </div>
  );
}
