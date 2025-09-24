
'use client';

import * as React from 'react';
import Autoplay from "embla-carousel-autoplay";
import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import type { Event, TicketType } from '@prisma/client';
import { format } from 'date-fns';

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
            const gradientStyle = event.color
              ? { background: `linear-gradient(to top, ${event.color}BF, transparent)` }
              : { background: `linear-gradient(to top, #000000BF, transparent)` };

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
                                    <div className="absolute inset-0" style={gradientStyle}></div>
                                    <div className="absolute bottom-0 left-0 p-4">
                                        <h3 className="text-lg font-bold text-white leading-tight">{event.name}</h3>
                                        <p className="text-xs text-white/80">{format(new Date(event.startDate), 'LLL dd, y')}</p>
                                    </div>
                                </CardContent>
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

