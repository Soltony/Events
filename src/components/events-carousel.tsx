
'use client';

import * as React from 'react';
import Autoplay from "embla-carousel-autoplay";
import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import type { Event, TicketType } from '@prisma/client';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { ArrowUpRight } from 'lucide-react';

interface EventWithTickets extends Event {
    ticketTypes: TicketType[];
}

const DEFAULT_IMAGE_PLACEHOLDER = '/image/nibtickets.jpg';

export default function EventsCarousel({ events }: { events: EventWithTickets[] }) {
  const plugin = React.useRef(
    Autoplay({ delay: 5000, stopOnInteraction: true })
  );

  return (
    <Carousel
      plugins={[plugin.current]}
      className="w-full max-w-6xl mx-auto"
      onMouseEnter={plugin.current.stop}
      onMouseLeave={plugin.current.reset}
      opts={{
        align: "start",
        loop: true,
      }}
    >
      <CarouselContent>
        {events.map((event) => {
            const imageUrl = event.image || DEFAULT_IMAGE_PLACEHOLDER;
            return (
                <CarouselItem key={event.id} className="md:basis-1/2 lg:basis-1/3">
                    <div className="p-1">
                        <Link href={`/events/${event.id}`} className="group">
                             <Card className="flex flex-col h-full group-hover:shadow-lg transition-shadow duration-300 overflow-hidden">
                                <CardContent className="p-0 relative aspect-video">
                                    <Image
                                        src={imageUrl}
                                        alt={event.name}
                                        fill
                                        className="object-cover"
                                        onError={(e) => { const target = e.target as HTMLImageElement; target.src = DEFAULT_IMAGE_PLACEHOLDER; target.srcset = ''; }}
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                                    <div className="absolute bottom-0 left-0 p-4">
                                        <Badge variant="destructive" className="mb-2">LIVE NOW</Badge>
                                        <h3 className="text-lg font-bold text-white leading-tight">{event.name}</h3>
                                    </div>
                                </CardContent>
                                <CardFooter className="p-3">
                                      <Button asChild className="w-full" size="sm">
                                        <span >
                                            Get Tickets <ArrowUpRight className="h-4 w-4" />
                                        </span>
                                    </Button>
                                </CardFooter>
                            </Card>
                        </Link>
                    </div>
                </CarouselItem>
            )
        })}
      </CarouselContent>
      <CarouselPrevious className="absolute left-[-20px] top-1/2 -translate-y-1/2 hidden sm:flex" />
      <CarouselNext className="absolute right-[-20px] top-1/2 -translate-y-1/2 hidden sm:flex" />
    </Carousel>
  );
}
