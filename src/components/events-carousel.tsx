
'use client';

import * as React from 'react';
import Autoplay from "embla-carousel-autoplay";
import Image from 'next/image';
import type { EmblaCarouselType } from 'embla-carousel';

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import type { Event, TicketType } from '@prisma/client';
import { cn } from '@/lib/utils';
import { useCallback, useEffect, useState } from 'react';

interface EventWithTickets extends Event {
    ticketTypes: TicketType[];
}

const DEFAULT_IMAGE_PLACEHOLDER = '/images/nibtickets.jpg';

export default function EventsCarousel({ events }: { events: EventWithTickets[] }) {
  const [api, setApi] = useState<EmblaCarouselType | undefined>();
  const [current, setCurrent] = useState(0);

  const plugin = React.useRef(
    Autoplay({ delay: 5000, stopOnInteraction: true, stopOnMouseEnter: true })
  );

  const eventsWithImages = events.filter(event => event.image);

  useEffect(() => {
    if (!api) {
      return;
    }

    setCurrent(api.selectedScrollSnap());

    const onSelect = () => {
      setCurrent(api.selectedScrollSnap());
    };

    api.on("select", onSelect);

    return () => {
      api.off("select", onSelect);
    };
  }, [api]);

  if (eventsWithImages.length === 0) {
    return (
        <div className="relative w-full aspect-square md:aspect-video">
            <Image
                src={DEFAULT_IMAGE_PLACEHOLDER}
                alt="No upcoming events"
                fill
                className="object-cover"
                priority
            />
        </div>
    );
  }

  return (
    <div className="relative w-full">
        <Carousel
            setApi={setApi}
            plugins={[plugin.current]}
            className="w-full"
            onMouseEnter={() => plugin.current.stop()}
            onMouseLeave={() => plugin.current.play()}
            opts={{
                loop: true,
            }}
        >
            <CarouselContent>
                {eventsWithImages.map((event, index) => {
                    const imageUrl = event.image && !event.image.startsWith('/') ? `/${event.image}` : (event.image || DEFAULT_IMAGE_PLACEHOLDER);
                    return (
                        <CarouselItem key={event.id}>
                            <div className="relative w-full aspect-square md:aspect-video">
                                <Image
                                    src={imageUrl}
                                    alt={event.name}
                                    fill
                                    className="object-cover"
                                    priority={index === 0}
                                    onError={(e) => { 
                                        const target = e.target as HTMLImageElement;
                                        target.srcset = '';
                                        target.src = DEFAULT_IMAGE_PLACEHOLDER;
                                     }}
                                />
                            </div>
                        </CarouselItem>
                    )
                })}
            </CarouselContent>
            <CarouselPrevious className="absolute left-4 top-1/2 -translate-y-1/2 text-white bg-black/40 hover:bg-black/60 border-none rounded-full h-10 w-10 flex items-center justify-center" aria-label="Previous slide" />
            <CarouselNext className="absolute right-4 top-1/2 -translate-y-1/2 text-white bg-black/40 hover:bg-black/60 border-none rounded-full h-10 w-10 flex items-center justify-center" aria-label="Next slide" />
        </Carousel>
        {api && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2">
                {api.scrollSnapList().map((_, index) => (
                    <button
                        key={index}
                        onClick={() => api.scrollTo(index)}
                        className={cn(
                            "h-2 w-2 rounded-full transition-all",
                            current === index ? "w-4 bg-white" : "bg-white/50 hover:bg-white"
                        )}
                        aria-label={`Go to slide ${index + 1}`}
                    />
                ))}
            </div>
        )}
    </div>
  );
}
