
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
import { CardBody, CardContainer, CardItem } from "@/components/ui/3d-card";


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

  const getCategoryBadgeClass = (category: string) => {
    switch (category) {
      case 'Technology':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Music':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'Art':
        return 'bg-pink-100 text-pink-800 border-pink-200';
      case 'Community':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'Business':
          return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  }

  useEffect(() => {
    setLoading(true);
    async function fetchData() {
        try {
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
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const filteredEvents = events.filter(event => {
        const matchesCategory = selectedCategory === 'All' || event.category === selectedCategory;
        const matchesSearch = !searchQuery || 
          event.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
          event.description.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesCategory && matchesSearch;
      });

    const upcoming = filteredEvents.filter(event => new Date(event.startDate) >= today);

    return { 
        upcomingEvents: upcoming,
        otherEvents: filteredEvents
    };
  }, [events, searchQuery, selectedCategory]);

  return (
    <div className="relative flex flex-col h-screen overflow-hidden">
      <Image
        src="/image/bg.jpg"
        alt="Background"
        fill
        className="-z-10 object-cover"
      />
      <div className="flex flex-1 flex-col bg-background/80 backdrop-blur-sm">
        {/* Hero / Controls */}
          <div className="relative">
           <div className="absolute inset-0 bg-gradient-to-r from-[#fff4d6] via-[#ffe2a3] to-[#ffcf6b]" />
           <div className="relative container mx-auto px-4 lg:px-6 py-3 space-y-2">
              <div className="flex flex-col md:flex-row items-center justify-between gap-3 w-full text-[#3b2900]">
              <div className="flex items-center gap-3">
                <Image src="/image/nibtickets.jpg" alt="NibTera Tickets Logo" width={200} height={50} data-ai-hint="logo nibtera" />
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                <div className="relative flex-1 md:flex-initial w-full sm:w-auto md:w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-[#6b4e16]" />
                  <Input
                    placeholder="Search events..."
                    className="pl-10 rounded-full bg-white/95 border-[#e8c15a] focus-visible:ring-2 focus-visible:ring-[#b97a0b] focus-visible:border-[#b97a0b] text-black placeholder:text-black/60"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="w-full sm:w-44 rounded-full bg-white/95 border-[#e8c15a] text-black">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button asChild className="w-full sm:w-auto rounded-full bg-[#7a4b22] hover:bg-[#6b3f1d] text-white shadow">
                  <Link href="/tickets">
                    <Ticket className="mr-2 h-4 w-4" />
                    My Tickets
                  </Link>
                </Button>
                <div className="w-full sm:w-auto">
                  <AuthStatus />
                </div>
              </div>
            </div>
            
          </div>
        </div>
        
        <div className="flex-1 flex flex-col min-h-0">
          {/* Title below header for better hierarchy */}
          <div className="container mx-auto px-4 lg:px-6 mt-3 text-center">
            <h2 className="text-3xl font-bold tracking-tight">Upcoming Events</h2>
            <p className="text-muted-foreground mt-1">Check out these exciting upcoming events!</p>
          </div>

          <EventsCarousel events={upcomingEvents} />

          <div className="flex-1 grid gap-4 md:gap-8 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 p-4 lg:p-6 mt-8">
            {loading ? (
                [...Array(10)].map((_, i) => (
                    <Card key={i}>
                        <CardHeader className="p-0"><Skeleton className="w-full aspect-video rounded-t-lg" /></CardHeader>
                        <CardContent className="p-3 space-y-1"><Skeleton className="h-4 w-16" /><Skeleton className="h-5 w-3/4" /><Skeleton className="h-4 w-1/2" /></CardContent>
                        <CardFooter className="p-3 pt-0"><Skeleton className="h-9 w-full" /></CardFooter>
                    </Card>
                ))
            ) : (otherEvents.length > 0) ? (
              otherEvents.map((event) => {
                const imageUrl = event.image || DEFAULT_IMAGE_PLACEHOLDER;
                const gradientStyle = { background: `linear-gradient(to top, #ffc72e, #ffc72e00)` };

                  return (
                    <Link href={`/events/${event.id}`} key={event.id} className="group h-full">
                      <CardContainer containerClassName="py-0 h-full">
                        <CardBody className="bg-yellow-300 relative group/card  w-auto h-full rounded-xl p-4 border flex flex-col">
                            <CardItem translateZ="100" className="w-full relative">
                              <Image
                                src={imageUrl}
                                height="1000"
                                width="1000"
                                className="h-48 w-full object-cover rounded-xl group-hover/card:shadow-xl"
                                alt={event.name}
                                data-ai-hint={event.hint ?? 'event'}
                                onError={(e) => { const target = e.target as HTMLImageElement; target.src = DEFAULT_IMAGE_PLACEHOLDER; target.srcset = ''; }}
                              />
                            </CardItem>
                            <div
                              className="flex-1 flex flex-col justify-between rounded-b-xl"
                              style={gradientStyle}
                            >
                                    <CardItem
                                      as="div"
                                      translateZ="50"
                                      className="p-3 flex-1 space-y-1 bg-transparent text-black"
                                    >
                                      <Badge variant="outline" className={`text-xs ${getCategoryBadgeClass(event.category)}`}>{event.category}</Badge>
                                      <h3 className="text-base font-bold leading-tight text-black">{event.name}</h3>
                                      <p className="text-xs text-black/90 min-h-[2.5rem]">{formatEventDate(event.startDate, event.endDate)}</p>
                                    </CardItem>
                                    <div className="flex justify-between items-center mt-auto px-3 pb-3">
                                      <CardItem
                                        translateZ={20}
                                        as="button"
                                        className="w-full rounded-full bg-primary hover:bg-primary/90 text-primary-foreground p-2 text-xs font-bold"
                                      >
                                        Buy Ticket
                                      </CardItem>
                                    </div>
                            </div>
                        </CardBody>
                      </CardContainer>
                    </Link>
                  )
                })
              ) : (
                  <Card className="sm:col-span-2 lg:col-span-3 xl:col-span-5 flex items-center justify-center p-8 text-center bg-card/80">
                      <div>
                          <h3 className="text-2xl font-semibold tracking-tight">No Events Found</h3>
                          <p className="text-muted-foreground mt-2 mb-6">Try adjusting your search or filter criteria.</p>
                      </div>
                  </Card>
              )}
            </div>
        </div>
      </div>
    </div>
  );
}
