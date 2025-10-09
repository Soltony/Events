

'use client';

import * as React from 'react';
import Autoplay from "embla-carousel-autoplay";
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import type { Event, TicketType } from '@prisma/client';

interface EventWithTickets extends Event {
    ticketTypes: TicketType[];
}

const DEFAULT_IMAGE_PLACEHOLDER = '/image/nibtickets.jpg';

export default function EventsCarousel({ events }: { events: EventWithTickets[] }) {
  const plugin = React.useRef(
    Autoplay({ delay: 5000, stopOnInteraction: true, stopOnMouseEnter: true })
  );
  
  if (events.length === 0) {
    return (
        <div className="w-full aspect-video bg-gray-200 flex items-center justify-center text-muted-foreground">
            <p>No upcoming events to display.</p>
        </div>
    );
  }

  return (
    <Carousel
    plugins={[plugin.current]}
    className="w-full"
    onMouseEnter={plugin.current.stop}
    onMouseLeave={plugin.current.play}
    opts={{
        loop: true,
    }}
    >
    <CarouselContent>
        {events.map((event) => {
            const imageUrl = event.image || DEFAULT_IMAGE_PLACEHOLDER;
            return (
                <CarouselItem key={event.id}>
                    <div className="relative w-full aspect-video">
                         <Image
                            src={imageUrl}
                            alt={event.name}
                            fill
                            className="object-cover"
                            priority={events.indexOf(event) === 0}
                             onError={(e) => { const target = e.target as HTMLImageElement; target.src = DEFAULT_IMAGE_PLACEHOLDER; target.srcset = ''; }}
                        />
                    </div>
                </CarouselItem>
            )
        })}
    </CarouselContent>
    <CarouselPrevious className="absolute left-4 top-1/2 -translate-y-1/2 text-white bg-black/30 hover:bg-black/50 border-none" />
    <CarouselNext className="absolute right-4 top-1/2 -translate-y-1/2 text-white bg-black/30 hover:bg-black/50 border-none" />
    </Carousel>
  );
}
