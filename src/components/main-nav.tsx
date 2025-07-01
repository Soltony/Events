"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Ticket, PlusCircle, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { getEvents, type Event } from '@/lib/store';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

export function MainNav() {
  const pathname = usePathname();
  const [events, setEvents] = useState<Event[]>([]);
  const isManagingEvents = pathname.startsWith('/events/') && pathname !== '/events/new';
  const [isEventsOpen, setIsEventsOpen] = useState(isManagingEvents);


  useEffect(() => {
    setEvents(getEvents());
  }, []);
  
  useEffect(() => {
    setIsEventsOpen(isManagingEvents);
  }, [isManagingEvents]);

  return (
    <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
      <Link
        href="/"
        className={cn(
          'flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary',
          pathname === '/' && 'bg-muted text-primary'
        )}
      >
        <Home className="h-4 w-4" />
        Dashboard
      </Link>

      <Collapsible open={isEventsOpen} onOpenChange={setIsEventsOpen} className="w-full">
        <CollapsibleTrigger className={cn(
            'flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary w-full',
            isManagingEvents && 'bg-muted text-primary'
        )}>
            <Ticket className="h-4 w-4" />
            <span>Manage Events</span>
            <ChevronDown className={cn("ml-auto h-4 w-4 shrink-0 transition-transform duration-200", isEventsOpen && "rotate-180")} />
        </CollapsibleTrigger>
        <CollapsibleContent className="py-1">
            <div className="ml-4 pl-4 border-l space-y-1">
                {events.map((event) => (
                    <Link
                        key={event.id}
                        href={`/events/${event.id}`}
                        className={cn(
                        'block rounded-md px-3 py-2 text-muted-foreground transition-colors hover:text-primary',
                        pathname === `/events/${event.id}` && 'bg-muted text-primary'
                        )}
                    >
                        {event.name}
                    </Link>
                ))}
                {events.length === 0 && (
                    <span className="block px-3 py-2 text-muted-foreground text-xs">No events created yet.</span>
                )}
            </div>
        </CollapsibleContent>
      </Collapsible>
      
      <Link
        href="/events/new"
        className={cn(
          'flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary',
          pathname === '/events/new' && 'bg-muted text-primary'
        )}
      >
        <PlusCircle className="h-4 w-4" />
        Create Event
      </Link>
    </nav>
  );
}
