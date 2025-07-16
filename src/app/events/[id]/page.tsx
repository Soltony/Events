
import { getEventById } from '@/lib/actions';
import Image from 'next/image';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Ticket, Calendar, MapPin } from 'lucide-react';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { notFound } from 'next/navigation';
import { format } from 'date-fns';
import type { Event, TicketType } from '@prisma/client';

interface EventWithTickets extends Event {
    ticketTypes: TicketType[];
}

function formatEventDate(startDate: Date, endDate: Date | null | undefined): string {
    if (endDate) {
      return `${format(new Date(startDate), 'LLL dd, y')} - ${format(new Date(endDate), 'LLL dd, y')}`;
    }
    return format(new Date(startDate), 'LLL dd, y');
}

export default async function PublicEventDetailPage({ params }: { params: { id: string } }) {
  const eventId = parseInt(params.id, 10);
  if (isNaN(eventId)) {
    notFound();
  }

  const event: EventWithTickets | null = await getEventById(eventId);

  if (!event) {
    notFound();
  }
  
<<<<<<< HEAD
  const images = Array.isArray(event.image) ? event.image : [event.image];
  
  return (
    <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <Card className="overflow-hidden shadow-lg rounded-xl">
            <Carousel className="w-full">
                <CarouselContent>
                {images.map((img, index) => (
                    <CarouselItem key={index}>
                    <Image src={img} alt={`${event.name} image ${index + 1}`} width={1200} height={600} className="w-full object-cover aspect-video" data-ai-hint={event.hint ?? 'event'} />
                    </CarouselItem>
                ))}
                </CarouselContent>
                {images.length > 1 && (
                    <>
                        <CarouselPrevious className="absolute left-4 hidden sm:flex" />
                        <CarouselNext className="absolute right-4 hidden sm:flex" />
                    </>
                )}
            </Carousel>
            <CardContent className="p-6 md:p-8">
                <div className="grid gap-8">
                    <div>
                        <Badge variant="outline" className="mb-3 text-sm">{event.category}</Badge>
                        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">{event.name}</h1>
                        <div className="flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center gap-x-6 gap-y-2 text-muted-foreground mt-4 text-md">
                            <div className="flex items-center gap-2">
                                <Calendar className="h-5 w-5" />
                                <span>{formatEventDate(event.startDate, event.endDate)}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <MapPin className="h-5 w-5" />
                                <span>{event.location}</span>
                            </div>
=======
  const images = event.image ? (event.image as string).split(',') : ['https://placehold.co/1200x600.png'];

  return (
    <div className="max-w-5xl mx-auto py-8">
      <Card className="overflow-hidden shadow-xl">
        <Carousel className="w-full">
            <CarouselContent>
            {images.map((img, index) => (
                <CarouselItem key={index}>
                <Image src={img} alt={`${event.name} image ${index + 1}`} width={1200} height={600} className="w-full object-cover aspect-[2/1]" data-ai-hint={event.hint ?? 'event'} />
                </CarouselItem>
            ))}
            </CarouselContent>
            <CarouselPrevious className="absolute left-4 hidden sm:flex" />
            <CarouselNext className="absolute right-4 hidden sm:flex" />
        </Carousel>
        <CardContent className="p-6 md:p-10">
            <div className="grid gap-8">
                <div>
                    <Badge variant="outline" className="mb-4 text-sm">{event.category}</Badge>
                    <h1 className="text-4xl md:text-5xl font-bold tracking-tight">{event.name}</h1>
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-muted-foreground mt-4 text-lg">
                        <div className="flex items-center gap-2">
                            <Calendar className="h-5 w-5" />
                            <span>{formatEventDate(event.startDate, event.endDate)}</span>
>>>>>>> 73c52e249cbb696d18533b1e0da241d74abcbd4e
                        </div>
                    </div>

                    <div className="border-t pt-8">
                        <h2 className="text-2xl font-semibold mb-4">About this Event</h2>
                        <p className="text-base text-muted-foreground whitespace-pre-wrap leading-relaxed">{event.description}</p>
                    </div>

                    <div className="border-t pt-8">
                        <h2 className="text-2xl font-semibold mb-6">Tickets</h2>
                        <div className="space-y-4">
                            {event.ticketTypes.length > 0 ? (
                                event.ticketTypes.map(ticket => (
                                    <Card key={ticket.id} className="flex flex-col md:flex-row justify-between items-start md:items-center p-4 sm:p-6 bg-card border-2 border-transparent hover:border-primary transition-colors rounded-lg">
                                        <div className="mb-4 md:mb-0">
                                            <h3 className="font-bold text-lg">{ticket.name}</h3>
                                            <p className="text-primary font-bold text-xl">ETB {Number(ticket.price).toFixed(2)}</p>
                                            <p className="text-sm text-muted-foreground">{ticket.total - ticket.sold} tickets remaining</p>
                                        </div>
                                        <Button size="lg" className="shrink-0">
                                            <Ticket className="mr-2 h-5 w-5" />
                                            Buy Ticket
                                        </Button>
                                    </Card>
                                ))
                            ) : (
                                <p className="text-muted-foreground">Tickets are not yet available for this event.</p>
                            )}
                        </div>
                    </div>
                </div>
<<<<<<< HEAD
            </CardContent>
        </Card>
      </div>
=======

                <div className="border-t pt-8">
                    <h2 className="text-3xl font-semibold mb-4">About this Event</h2>
                    <p className="text-base text-muted-foreground whitespace-pre-wrap leading-relaxed">{event.description}</p>
                </div>

                <div className="border-t pt-8">
                    <h2 className="text-3xl font-semibold mb-6">Tickets</h2>
                    <div className="space-y-4">
                        {event.ticketTypes.length > 0 ? (
                            event.ticketTypes.map(ticket => (
                                <Card key={ticket.id} className="flex flex-col md:flex-row justify-between items-start md:items-center p-6 bg-secondary border-2 border-transparent hover:border-primary transition-colors">
                                    <div className="mb-4 md:mb-0">
                                        <h3 className="font-bold text-xl">{ticket.name}</h3>
                                        <p className="text-primary font-bold text-2xl">ETB {Number(ticket.price).toFixed(2)}</p>
                                        <p className="text-sm text-muted-foreground">{ticket.total - ticket.sold} tickets remaining</p>
                                    </div>
                                    <Button size="lg">
                                        <Ticket className="mr-2 h-5 w-5" />
                                        Buy Ticket
                                    </Button>
                                 </Card>
                            ))
                        ) : (
                            <p className="text-muted-foreground">Tickets are not yet available for this event.</p>
                        )}
                    </div>
                </div>
            </div>
        </CardContent>
      </Card>
>>>>>>> 73c52e249cbb696d18533b1e0da241d74abcbd4e
    </div>
  );
}

