

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
  type CarouselApi,
} from '@/components/ui/carousel';
import type { Event, TicketType } from '@prisma/client';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface EventWithTickets extends Event {
    ticketTypes: TicketType[];
}

const DEFAULT_IMAGE_PLACEHOLDER = '/image/nibtickets.jpg';

export default function EventsCarousel({ events }: { events: EventWithTickets[] }) {
  const plugin = React.useRef(
    Autoplay({ delay: 1500, stopOnInteraction: false, stopOnMouseEnter: true, playOnInit: true })
  );
  
  const [api, setApi] = React.useState<CarouselApi>();
  const [current, setCurrent] = React.useState(0);
  const [count, setCount] = React.useState(0);

  React.useEffect(() => {
    if (!api) {
      return;
    }

    setCount(api.scrollSnapList().length);
    setCurrent(api.selectedScrollSnap());

    api.on("select", () => {
      setCurrent(api.selectedScrollSnap());
    });
  }, [api]);


  if (events.length === 0) {
    return null;
  }

  return (
    <div>
        <Carousel
        setApi={setApi}
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
                                <Card className="flex flex-col h-full group-hover:shadow-lg transition-shadow duration-300 overflow-hidden bg-card text-card-foreground">
                                    <CardContent className="p-0 relative aspect-video bg-transparent overflow-hidden">
                                        <Image
                                            src={imageUrl}
                                            alt={event.name}
                                            fill
                                            className="object-cover rounded-lg z-0"
                                            onError={(e) => { const target = e.target as HTMLImageElement; target.src = DEFAULT_IMAGE_PLACEHOLDER; target.srcset = ''; }}
                                        />
                                        <div className="pointer-events-none absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/60 to-transparent rounded-b-lg z-10">
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
        <div className="flex justify-center gap-2 mt-4">
            {Array.from({ length: count }).map((_, index) => (
                <button
                    key={index}
                    onClick={() => api?.scrollTo(index)}
                    className={cn(
                        "h-2 w-2 rounded-full transition-all",
                        current === index ? "w-8 bg-primary" : "bg-primary/50"
                    )}
                    aria-label={`Go to slide ${index + 1}`}
                />
            ))}
        </div>
    </div>
  );
}
