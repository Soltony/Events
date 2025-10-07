
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowUpRight, Search, Ticket, CheckCircle, ShoppingCart, CreditCard, Facebook, Linkedin, Instagram, Youtube, Send } from 'lucide-react';
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
    async function fetchData() {
        setLoading(true);
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
  
  const gradientStyle = { background: `linear-gradient(to right, #fefce8, #fef9c3)` };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
       <header className="sticky top-0 z-50" style={gradientStyle}>
        <nav className="container mx-auto px-4 lg:px-6 py-4 flex justify-between items-center">
            <Link href="/" className="flex items-center gap-2 font-semibold">
                <Image
                    src="/image/nibtickets.jpg"
                    alt="Nibkera Tickets Logo"
                    width={150}
                    height={40}
                    className="object-contain"
                    data-ai-hint="logo nibtera"
                />
            </Link>
            
            <div className="hidden md:flex flex-1 justify-center items-center gap-4">
                <div className="relative w-full max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="Search events..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 bg-white rounded-full"
                    />
                </div>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger className="w-[180px] bg-white rounded-full">
                        <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent>
                        {categories.map(category => (
                            <SelectItem key={category} value={category}>{category}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="flex items-center gap-2">
                <Button asChild variant="outline" className="bg-accent text-accent-foreground hover:bg-accent/90 hover:text-accent-foreground rounded-full">
                  <Link href="/tickets">
                    <Ticket className="mr-2 h-4 w-4" /> My Tickets
                  </Link>
                </Button>
                <AuthStatus />
            </div>
        </nav>
      </header>

      <main className="flex-grow">
        <section className="relative w-full">
            <EventsCarousel events={upcomingEvents} />
        </section>

        <section className="py-12 bg-white">
            <div className="container mx-auto px-4 lg:px-6">
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
                    <div className="flex flex-col items-center">
                        <CheckCircle className="h-10 w-10 text-primary mb-3" />
                        <h3 className="text-lg font-semibold">CHOOSE EVENTS AND TICKETS</h3>
                    </div>
                    <div className="flex flex-col items-center">
                        <ShoppingCart className="h-10 w-10 text-primary mb-3" />
                        <h3 className="text-lg font-semibold">BUY DIRECTLY FROM ORGANIZERS</h3>
                    </div>
                    <div className="flex flex-col items-center">
                        <CreditCard className="h-10 w-10 text-primary mb-3" />
                        <h3 className="text-lg font-semibold">RECEIVE TICKETS</h3>
                    </div>
                 </div>
            </div>
        </section>

        <section className="py-12">
            <div className="container mx-auto px-4 lg:px-6">
                <h2 className="text-2xl font-bold tracking-tight mb-6">
                    Upcoming Events
                </h2>
                <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {loading ? (
                    [...Array(8)].map((_, i) => (
                    <Card key={i} className="overflow-hidden aspect-square">
                        <Skeleton className="w-full h-1/2" />
                        <CardContent className="p-4 space-y-2">
                        <Skeleton className="h-5 w-3/4" />
                        <Skeleton className="h-4 w-1/2" />
                        </CardContent>
                    </Card>
                    ))
                ) : (otherEvents.length > 0) ? (
                    otherEvents.map((event) => {
                      const imageUrl = event.image || DEFAULT_IMAGE_PLACEHOLDER;
                      const gradientStyle = event.color
                        ? { background: `linear-gradient(to top, ${event.color}BF, transparent)` }
                        : { background: `linear-gradient(to top, #f6b313BF, transparent)` };

                      return (
                        <CardContainer key={event.id} className="w-full aspect-square">
                          <CardBody className="bg-gray-50 relative group/card dark:hover:shadow-2xl dark:hover:shadow-emerald-500/[0.1] dark:bg-black dark:border-white/[0.2] border-black/[0.1] w-full h-full rounded-xl p-0 border flex flex-col">
                              <CardItem translateZ="50" className="w-full h-1/2">
                                <Link href={`/events/${event.id}`}>
                                    <div className="relative w-full h-full rounded-t-xl overflow-hidden">
                                        <Image
                                            src={imageUrl}
                                            fill
                                            className="object-cover"
                                            alt={event.name}
                                            data-ai-hint={event.hint ?? 'event'}
                                            onError={(e) => { const target = e.target as HTMLImageElement; target.src = DEFAULT_IMAGE_PLACEHOLDER; target.srcset = ''; }}
                                        />
                                        <div className="absolute inset-0" style={gradientStyle}></div>
                                    </div>
                                </Link>
                              </CardItem>
                              <div className="p-4 flex flex-col flex-grow bg-white rounded-b-xl justify-between">
                                <CardItem translateZ="60" as="div" className="flex-grow">
                                  <h3 className="font-semibold text-lg group-hover/card:text-primary">{event.name}</h3>
                                  <p className="text-sm text-muted-foreground mt-1">{format(new Date(event.startDate), 'LLL dd, y')}</p>
                                </CardItem>
                                <CardItem translateZ="40" as="div" className="mt-4 w-full">
                                  <Button asChild className="w-full bg-accent text-accent-foreground hover:bg-accent/90">
                                    <Link href={`/events/${event.id}`}>
                                      <Ticket className="mr-2 h-4 w-4" /> Buy Ticket
                                    </Link>
                                  </Button>
                                </CardItem>
                              </div>
                          </CardBody>
                        </CardContainer>
                      )
                    })
                ) : (
                    <div className="sm:col-span-2 lg:col-span-3 xl:col-span-4 flex items-center justify-center p-8 text-center bg-gray-100 rounded-lg">
                    <div>
                        <h3 className="text-xl font-semibold tracking-tight">No Events Found</h3>
                        <p className="text-muted-foreground mt-1">Try adjusting your search or filter criteria.</p>
                    </div>
                    </div>
                )}
                </div>
            </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}


const Footer = () => (
    <footer className="py-8" style={{background: 'linear-gradient(to right, #fefce8, #fde047)'}}>
      <div className="container mx-auto px-4 lg:px-6">
         <div className="flex flex-col items-center justify-center gap-4">
          <p className="text-sm text-center text-accent">
            &copy; {new Date().getFullYear()} NibTera Tickets. All rights reserved.
          </p>
           <div className="flex space-x-4 mt-2">
              <Link href="https://web.facebook.com/nib.intbank" target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="text-accent hover:text-primary transition-colors">
                <Facebook className="h-5 w-5" />
              </Link>
              <Link href="https://www.linkedin.com/company/nib-internationalbank" target="_blank" rel="noopener noreferrer" aria-label="Linkedin" className="text-accent hover:text-primary transition-colors">
                <Linkedin className="h-5 w-5" />
              </Link>
              <Link href="https://www.instagram.com/nib_internationalbank/" target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="text-accent hover:text-primary transition-colors">
                <Instagram className="h-5 w-5" />
              </Link>
              <Link href="https://www.youtube.com/channel/UCn_-tUsAPEKdzm_b2BOCOdA" target="_blank" rel="noopener noreferrer" aria-label="Youtube" className="text-accent hover:text-primary transition-colors">
                <Youtube className="h-5 w-5" />
              </Link>
              <Link href="https://t.me/nibinternationalbanksc" target="_blank" rel="noopener noreferrer" aria-label="Telegram" className="text-accent hover:text-primary transition-colors">
                <Send className="h-5 w-5" />
              </Link>
            </div>
        </div>
      </div>
    </footer>
)
