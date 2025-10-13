
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { CardContainer, CardBody, CardItem } from "@/components/ui/3d-card";
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
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";

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
        'All': <Ticket className="h-4 w-4" style={{ color: '#f59e0b' }} />,
        'Technology': <Presentation className="h-4 w-4" style={{ color: '#3b82f6' }} />,
        'Music': <Mic className="h-4 w-4" style={{ color: '#8b5cf6' }} />,
        'Art': <Drama className="h-4 w-4" style={{ color: '#ec4899' }} />,
        'Community': <MessageSquareHeart className="h-4 w-4" style={{ color: '#22c55e' }} />,
        'Business': <Gamepad2 className="h-4 w-4" style={{ color: '#6366f1' }} />,
        'Food & Drink': <Utensils className="h-4 w-4" style={{ color: '#f97316' }} />,
        'Food': <Utensils className="h-4 w-4" style={{ color: '#f97316' }} />,
        'Other': <Ticket className="h-4 w-4" style={{ color: '#f59e0b' }} />
    };

    return (
        <div className="relative">
            <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6">
                {categories.map((category) => {
                    const Icon = categoryIcons[category] || <Ticket className="h-4 w-4" style={{ color: '#f59e0b' }} />;
                    return (
                        <TooltipProvider key={category}>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button
                                        onClick={() => onSelectCategory(category)}
                                        className={cn(
                                            "w-12 h-12 rounded-full border-2 flex items-center justify-center transition-all duration-300",
                                            selectedCategory === category
                                                ? "bg-primary/20 border-primary"
                                                : "bg-white border-gray-200 hover:border-primary/50"
                                        )}
                                        aria-label={category}
                                    >
                                        {Icon}
                                        <span className="sr-only">{category}</span>
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <span>{category}</span>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
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
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);


  const getCategoryBadgeClass = (category: string) => {
    switch (category) {
      case 'Technology':
        return 'bg-blue-100 border-transparent text-black';
      case 'Music':
        return 'bg-purple-100 border-transparent text-black';
      case 'Art':
        return 'bg-pink-100 border-transparent text-black';
      case 'Community':
        return 'bg-green-100 border-transparent text-black';
      case 'Business':
          return 'bg-indigo-100 border-transparent text-black';
      default:
        return 'bg-gray-100 border-transparent text-black';
    }
  }
  
  const getContentGradient = () => {
    const yellowColor = '#FDE047'; // yellow
    return {
      background: `linear-gradient(to top, ${yellowColor}, ${yellowColor}40)`
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
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsSearchFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);


  const categories = useMemo(() => {
    const allCategories = new Set(events.map(event => event.category));
    return ['All', ...Array.from(allCategories)];
  }, [events]);

  const searchSuggestions = useMemo(() => {
    if (!searchQuery) return [];
    return events.filter(event => 
      event.name.toLowerCase().includes(searchQuery.toLowerCase())
    ).slice(0, 5);
  }, [events, searchQuery]);

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
  
  const navbarStyle = { background: '#fefce5' };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
       <header className="fixed top-0 w-full z-50" style={navbarStyle}>
        <nav className="container mx-auto px-4 sm:px-6 py-2 flex justify-between items-center h-14">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <Image
                src="/image/nibtickets.jpg"
                alt="Nibtera Tickets Logo"
                width={120}
                height={28}
                className="object-contain"
                data-ai-hint="logo nibtera"
            />
          </Link>
          
          <div className="hidden md:flex items-center gap-4">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button asChild variant="outline" size="icon" className="bg-accent text-accent-foreground hover:bg-accent/90 hover:text-accent-foreground rounded-full">
                    <Link href="/tickets">
                      <Ticket className="h-4 w-4" />
                      <span className="sr-only">My Tickets</span>
                    </Link>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>My Tickets</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <AuthStatus />
          </div>

          <div className="md:hidden flex items-center gap-2">
             <Button asChild variant="ghost" className="text-sm h-8 px-3">
              <Link href="/tickets">
                <Ticket className="h-4 w-4" />
                <span className="sr-only">My Tickets</span>
              </Link>
            </Button>
            <AuthStatus />
          </div>
        </nav>
      </header>

      <main className="flex-grow pt-14">
        <section className="relative w-full">
            <EventsCarousel events={upcomingEvents} />

           <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center text-center text-white p-4 pointer-events-none">
                <h2 className="text-3xl md:text-5xl lg:text-6xl font-bold tracking-tight">UPCOMING EVENTS AND TICKET</h2>

                <p className="mt-4 text-base md:text-lg max-w-2xl">From music festivals to tech conferences, find your next experience with us. Secure and simple ticketing for every event.</p>
                <div ref={searchRef} className="relative w-full max-w-lg lg:max-w-2xl mt-8 pointer-events-auto">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input 
                    placeholder="Search events, artists, or venues..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onFocus={() => setIsSearchFocused(true)}
                    className="pl-12 pr-4 py-6 text-base md:text-lg bg-white/90 text-black placeholder:text-muted-foreground rounded-full focus:bg-white"
                  />
                  {isSearchFocused && searchSuggestions.length > 0 && (
                      <div className="absolute top-full mt-2 w-full bg-white rounded-lg shadow-lg overflow-hidden z-10">
                        <ul>
                          {searchSuggestions.map(event => (
                            <li key={event.id}>
                              <Link 
                                href={`/events/${event.id}`} 
                                className="flex items-center gap-4 p-3 hover:bg-gray-100"
                                onClick={() => setIsSearchFocused(false)}
                              >
                                <Image 
                                    src={event.image || DEFAULT_IMAGE_PLACEHOLDER}
                                    alt={event.name} 
                                    width={40} 
                                    height={40} 
                                    className="object-cover rounded-md"
                                />
                                <div>
                                    <p className="font-semibold text-black">{event.name}</p>
                                    <p className="text-sm text-gray-500">{event.location}</p>
                                </div>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                  )}
                </div>
                <div className="mt-6 w-full max-w-lg lg:max-w-2xl pointer-events-auto">
                  <CategoryFilter categories={categories} selectedCategory={selectedCategory} onSelectCategory={setSelectedCategory} />
                </div>
            </div>
        </section>


        <section className="py-12 md:pt-16">
            <div className="container mx-auto px-4 lg:px-6">
                <h2 className="text-2xl font-bold tracking-tight mb-8">
                    Upcoming Events
                </h2>
                <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 items-stretch">
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
                      const imageSource = event.image || DEFAULT_IMAGE_PLACEHOLDER;
                      return (
                        <CardContainer key={event.id} className="inter-var w-full h-[420px]">
                          <CardBody className="bg-white relative group/card w-full h-full rounded-xl p-0 border border-black/[0.1] flex flex-col justify-between">
                            <CardItem translateZ="50" className="w-full">
                               <div className="relative w-full h-[200px] bg-muted rounded-t-xl overflow-hidden">
                                  <Image src={imageSource} alt={event.name} fill className="object-cover" data-ai-hint={event.hint ?? 'event'} onError={(e) => { const target = e.target as HTMLImageElement; target.src = DEFAULT_IMAGE_PLACEHOLDER; target.srcset = ''; }} />
                               </div>
                            </CardItem>
                            <div className="p-4 flex flex-col flex-grow justify-between rounded-b-xl" style={getContentGradient()}>
                                <div className="h-28">
                                  <CardItem as="div" translateZ="40">
                                    <Badge variant="outline" className={cn("text-xs mb-2", getCategoryBadgeClass(event.category))}>{event.category}</Badge>
                                    <h3 className="font-bold text-lg text-black truncate">{event.name}</h3>
                                    <p className="text-xs text-black mt-1">{formatEventDate(event.startDate, event.endDate)}</p>
                                  </CardItem>
                                </div>
                                <CardItem translateZ="30" className="mt-auto pt-4">
                                    <Button asChild className="w-full rounded-full bg-accent text-accent-foreground hover:bg-accent/90">
                                        <Link href={`/events/${event.id}`}>
                                            Buy Ticket
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

        <section className="py-12">
            <div className="container mx-auto px-4 lg:px-6">
                <h2 className="text-2xl font-bold tracking-tight mb-6">
                    Top Selling Events
                </h2>
                <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 items-stretch">
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
                      const imageSource = event.image || DEFAULT_IMAGE_PLACEHOLDER;
                      return (
                         <CardContainer key={event.id} className="inter-var w-full h-[420px]">
                          <CardBody className="bg-white relative group/card w-full h-full rounded-xl p-0 border border-black/[0.1] flex flex-col justify-between">
                            <CardItem translateZ="50" className="w-full">
                               <div className="relative w-full h-[200px] bg-muted rounded-t-xl overflow-hidden">
                                  <Image src={imageSource} alt={event.name} fill className="object-cover" data-ai-hint={event.hint ?? 'event'} onError={(e) => { const target = e.target as HTMLImageElement; target.src = DEFAULT_IMAGE_PLACEHOLDER; target.srcset = ''; }} />
                               </div>
                            </CardItem>
                            <div className="p-4 flex flex-col flex-grow justify-between rounded-b-xl" style={getContentGradient()}>
                                <div className="h-28">
                                   <CardItem as="div" translateZ="40">
                                    <Badge variant="outline" className={cn("text-xs mb-2", getCategoryBadgeClass(event.category))}>{event.category}</Badge>
                                    <h3 className="font-bold text-lg text-black truncate">{event.name}</h3>
                                    <p className="text-xs text-black mt-1">{formatEventDate(event.startDate, event.endDate)}</p>
                                  </CardItem>
                                </div>
                                 <CardItem translateZ="30" className="mt-auto pt-4">
                                    <Button asChild className="w-full rounded-full bg-accent text-accent-foreground hover:bg-accent/90">
                                        <Link href={`/events/${event.id}`}>
                                            Buy Ticket
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
