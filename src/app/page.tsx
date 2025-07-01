import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { PlusCircle, ArrowUpRight } from "lucide-react";
import Link from 'next/link';
import Image from 'next/image';
import RecommendationTool from '@/components/recommendation-tool';

const events = [
  { id: 1, name: 'Tech Conference 2024', date: '2024-10-26', location: 'Metropolis Convention Center', image: 'https://placehold.co/600x400.png', hint: 'conference technology' },
  { id: 2, name: 'Summer Music Festival', date: '2024-08-15', location: 'Greenfield Park', image: 'https://placehold.co/600x400.png', hint: 'music festival' },
  { id: 3, name: 'Art & Design Expo', date: '2024-11-05', location: 'The Modern Gallery', image: 'https://placehold.co/600x400.png', hint: 'art gallery' },
];

export default function DashboardPage() {
  return (
    <div className="flex flex-1 flex-col gap-4 md:gap-8">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Here&apos;s a list of your events.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" /> Create Event
          </Button>
        </div>
      </div>
      
      <div className="grid gap-4 md:gap-8 lg:grid-cols-2 xl:grid-cols-3">
        {events.map((event) => (
          <Card key={event.id} className="flex flex-col">
            <CardHeader className="p-0">
              <Image src={event.image} alt={event.name} width={600} height={400} className="rounded-t-lg object-cover aspect-[3/2]" data-ai-hint={event.hint} />
            </CardHeader>
            <CardContent className="p-6 flex-1">
              <CardTitle>{event.name}</CardTitle>
              <CardDescription>{event.date} - {event.location}</CardDescription>
            </CardContent>
            <CardFooter className="p-6 pt-0">
              <Button asChild className="w-full">
                <Link href={`/events/${event.id}`}>Manage Event <ArrowUpRight className="ml-auto h-4 w-4" /></Link>
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      <RecommendationTool />
    </div>
  );
}
