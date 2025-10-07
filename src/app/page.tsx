

'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowUpRight, Search, Ticket, CheckCircle, ShoppingCart, CreditCard, Facebook, Linkedin, Instagram, Youtube, Send, Mic, Drama, MessageSquareHeart, Gamepad2, Presentation, Utensils } from 'lucide-react';
import { getPublicEvents } from '@/lib/actions';
import { format } from 'date-fns';
import type { Event, TicketType } from '@prisma/client';
import { useState, useEffect, useMemo, useRef } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AuthStatus } from "@/components/auth-status";
import EventsCarousel from "@/components/events-carousel";
import { cn } from '@/lib/utils';


interface EventWithTickets extends Event {
    ticketTypes: TicketType[];
}

function formatEventDate(startDate: Date, endDate: Date | null | undefined): string {
    const startDateFormat = 'LLL dd, y, hh:mm a';
    
    if (endDate) {
      const endDay = format(new Date(endDate), 'dd');
      const startDay = format(new Date(startDate), 'dd');
      const endMonthYear = format(new Date(endDate), 'LLL, y');
      const startMonthYear = format(new Date(startDate), 'LLL, y');

      if (startMonthYear !== endMonthYear) {
         return `${format(new Date(startDate), 'LLL dd, y, hh:mm a')} - ${format(new Date(endDate), 'LLL dd, y, hh:mm a')}`;
      }
      
      if (startDay !== endDay) {
        return `${format(new Date(startDate), 'LLL dd, hh:mm a')} - ${format(new Date(endDate), 'dd, hh:mm a')}`;
      }
    }
    return format(new Date(startDate), startDateFormat);
}

const DEFAULT_IMAGE_PLACEHOLDER = '/image/nibtickets.jpg';

const CategoryFilter = ({ categories, selectedCategory, onSelectCategory }: { categories: string[], selectedCategory: string, onSelectCategory: (category: string) => void }) => {
    
    const categoryIcons: { [key: string]: React.ReactNode } = {
        'All': <Ticket />,
        'Technology': <Presentation />,
        'Music': <Mic />,
        'Art': <Drama />,
        'Community': <MessageSquareHeart />,
        'Business': <Gamepad2 />,
        'Food & Drink': <Utensils />
    };

    return (
        <div className="relative">
            <div className="flex justify-around items-center w-full">
                {categories.map((category) => {
                     const Icon = categoryIcons[category] || <Ticket />;
                    return (
                        <div key={category} className="flex-shrink-0 text-center">
                            <button
                                onClick={() => onSelectCategory(category)}
                                className={cn(
                                    "w-20 h-20 rounded-full border-2 flex items-center justify-center transition-all duration-300",
                                    selectedCategory === category
                                        ? "bg-primary/20 border-primary"
                                        : "bg-white border-gray-200 hover:border-primary/50"
                                )}
                            >
                                {Icon}
                            </button>
                            <p className="mt-2 text-sm font-medium">{category}</p>
                        </div>
                    )
                })}
            </div>
        </div>
    );
};


export default function PublicHomePage() {
  const [events, setEvents] = useState<EventWithTickets[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  const getCategoryBadgeClass = (category: string) => {
    switch (category) {
      case 'Technology':
        return 'bg-blue-100 text-blue-800 border-transparent';
      case 'Music':
        return 'bg-purple-100 text-purple-800 border-transparent';
      case 'Art':
        return 'bg-pink-100 text-pink-800 border-transparent';
      case 'Community':
        return 'bg-green-100 text-green-800 border-transparent';
      case 'Business':
          return 'bg-indigo-100 text-indigo-800 border-transparent';
      default:
        return 'bg-gray-100 text-gray-800 border-transparent';
    }
  }
  
  const getContentGradient = (color?: string | null) => {
    const defaultColor = '#FDE047'; // yellow
    const finalColor = color || defaultColor;
    return {
      background: `linear-gradient(to top, ${finalColor}, ${finalColor}40)`
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

  const filteredEvents = useMemo(() => {
    return events.filter(event => {
        const matchesCategory = selectedCategory === 'All' || event.category === selectedCategory;
        const matchesSearch = !searchQuery || 
          event.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
          event.description.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesCategory && matchesSearch;
      });
  }, [events, searchQuery, selectedCategory]);

  const { upcomingEvents, topSellingEvents } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const upcoming = filteredEvents.filter(event => new Date(event.startDate) >= today);
    
    const topSelling = [...filteredEvents].sort((a, b) => {
        const salesA = a.ticketTypes.reduce((sum, t) => sum + t.sold, 0);
        const salesB = b.ticketTypes.reduce((sum, t) => sum + t.sold, 0);
        if (salesB !== salesA) {
            return salesB - salesA;
        }
        return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
    });

    return { 
        upcomingEvents: upcoming,
        topSellingEvents: topSelling,
    };
  }, [filteredEvents]);
  
  const gradientStyle = { background: `linear-gradient(to right, #fefce8, #fde047)` };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
       <header className="fixed top-0 w-full z-50" style={gradientStyle}>
        <nav className="container mx-auto px-4 lg:px-6 py-0 flex justify-between items-center h-14">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <Image
                src="/image/nibtickets.jpg"
                alt="Nibkera Tickets Logo"
                width={120}
                height={28}
                className="object-contain"
                data-ai-hint="logo nibtera"
            />
          </Link>
          
          <div className="hidden md:flex items-center gap-4">
            <Button asChild variant="outline" size="icon" className="bg-accent text-accent-foreground hover:bg-accent/90 hover:text-accent-foreground rounded-full">
              <Link href="/tickets">
                <Ticket className="h-4 w-4" />
                <span className="sr-only">My Tickets</span>
              </Link>
            </Button>
            <AuthStatus />
          </div>

          <div className="md:hidden flex items-center gap-2">
            <AuthStatus />
          </div>
        </nav>
      </header>

      <main className="flex-grow pt-14">
        <section className="relative w-full">
            <EventsCarousel events={upcomingEvents} />
            <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center text-center text-white p-4">
                <h2 className="text-4xl md:text-6xl font-bold tracking-tight">TICKETBOX EVENTS & TICKETS</h2>
                <p className="mt-4 text-lg md:text-xl max-w-2xl">From music festivals to tech conferences, find your next experience with us. Secure and simple ticketing for every event.</p>
                <div className="relative w-full max-w-2xl mt-8">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input 
                    placeholder="Search events, artists, or venues..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-12 pr-4 py-6 text-lg bg-white/90 text-black placeholder:text-muted-foreground rounded-full focus:bg-white"
                  />
                </div>
            </div>
        </section>

        <section className="py-12 bg-white">
            <div className="container mx-auto px-4 lg:px-6">
                 <CategoryFilter categories={categories} selectedCategory={selectedCategory} onSelectCategory={setSelectedCategory} />
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
                      <Card key={i} className="overflow-hidden">
                          <Skeleton className="w-full h-40" />
                          <CardContent className="p-4 space-y-2">
                            <Skeleton className="h-5 w-20" />
                            <Skeleton className="h-7 w-3/4" />
                            <Skeleton className="h-5 w-1/2" />
                          </CardContent>
                          <CardFooter className="p-4">
                            <Skeleton className="h-10 w-full rounded-full" />
                          </CardFooter>
                      </Card>
                    ))
                ) : (upcomingEvents.length > 0) ? (
                    upcomingEvents.map((event) => {
                      const imageUrl = event.image || DEFAULT_IMAGE_PLACEHOLDER;
                      return (
                        <Card key={event.id} className="w-full flex flex-col rounded-xl overflow-hidden border-2 border-primary/20 hover:shadow-lg transition-shadow">
                          <div className="relative w-full aspect-video bg-muted">
                            <Image
                                src={imageUrl}
                                alt={event.name}
                                fill
                                className="object-cover"
                                data-ai-hint={event.hint ?? 'event'}
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.src = DEFAULT_IMAGE_PLACEHOLDER;
                                  target.srcset = '';
                                }}
                            />
                          </div>
                          <div 
                              className="p-4 flex flex-col flex-grow justify-between"
                              style={getContentGradient(event.color)}
                          >
                              <div className="flex-grow">
                                  <Badge variant="outline" className={cn("text-xs mb-2", getCategoryBadgeClass(event.category))}>{event.category}</Badge>
                                  <h3 className="font-bold text-lg text-accent-foreground">{event.name}</h3>
                                  <p className="text-xs text-accent-foreground/80 mt-1">{formatEventDate(event.startDate, event.endDate)}</p>
                              </div>
                              <div className="mt-4">
                                  <Button asChild className="w-full rounded-full bg-accent text-accent-foreground hover:bg-accent/90">
                                      <Link href={`/events/${event.id}`}>
                                          Buy Ticket
                                      </Link>
                                  </Button>
                              </div>
                          </div>
                        </Card>
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

        <section className="py-12">
            <div className="container mx-auto px-4 lg:px-6">
                <h2 className="text-2xl font-bold tracking-tight mb-6">
                    Top Selling Events
                </h2>
                <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {loading ? (
                    [...Array(4)].map((_, i) => (
                      <Card key={i} className="overflow-hidden">
                          <Skeleton className="w-full h-40" />
                          <CardContent className="p-4 space-y-2">
                            <Skeleton className="h-5 w-20" />
                            <Skeleton className="h-7 w-3/4" />
                            <Skeleton className="h-5 w-1/2" />
                          </CardContent>
                          <CardFooter className="p-4">
                            <Skeleton className="h-10 w-full rounded-full" />
                          </CardFooter>
                      </Card>
                    ))
                ) : (topSellingEvents.length > 0) ? (
                    topSellingEvents.slice(0, 4).map((event) => {
                      const imageUrl = event.image || DEFAULT_IMAGE_PLACEHOLDER;
                      return (
                        <Card key={event.id} className="w-full flex flex-col rounded-xl overflow-hidden border-2 border-primary/20 hover:shadow-lg transition-shadow">
                          <div className="relative w-full aspect-video bg-muted">
                            <Image
                                src={imageUrl}
                                alt={event.name}
                                fill
                                className="object-cover"
                                data-ai-hint={event.hint ?? 'event'}
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.src = DEFAULT_IMAGE_PLACEHOLDER;
                                  target.srcset = '';
                                }}
                            />
                          </div>
                          <div 
                              className="p-4 flex flex-col flex-grow justify-between"
                              style={getContentGradient(event.color)}
                          >
                              <div className="flex-grow">
                                  <Badge variant="outline" className={cn("text-xs mb-2", getCategoryBadgeClass(event.category))}>{event.category}</Badge>
                                  <h3 className="font-bold text-lg text-accent-foreground">{event.name}</h3>
                                  <p className="text-xs text-accent-foreground/80 mt-1">{formatEventDate(event.startDate, event.endDate)}</p>
                              </div>
                              <div className="mt-4">
                                  <Button asChild className="w-full rounded-full bg-accent text-accent-foreground hover:bg-accent/90">
                                      <Link href={`/events/${event.id}`}>
                                          Buy Ticket
                                      </Link>
                                  </Button>
                              </div>
                          </div>
                        </Card>
                      )
                    })
                ) : (
                    <div className="sm:col-span-2 lg:col-span-3 xl:col-span-4 flex items-center justify-center p-8 text-center bg-gray-100 rounded-lg">
                    <div>
                        <h3 className="text-xl font-semibold tracking-tight">No Top Selling Events Found</h3>
                        <p className="text-muted-foreground mt-1">There are no events with ticket sales yet.</p>
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

    

    


