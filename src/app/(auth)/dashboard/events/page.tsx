
'use client';

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { PlusCircle, ArrowUpRight, Pencil, Trash2, MapPin } from "lucide-react";
import Link from 'next/link';
import Image from 'next/image';
import { getEvents, deleteEvent } from '@/lib/actions';
import { Badge } from '@/components/ui/badge';
import type { Event } from '@prisma/client';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

function formatEventDate(startDate: Date, endDate: Date | null | undefined): string {
    const startDateFormat = 'LLL dd, y, hh:mm a';
    
    if (endDate) {
      const endDateFormat = format(new Date(endDate), 'LLL dd, y') === format(new Date(startDate), 'LLL dd, y') 
        ? 'hh:mm a'
        : startDateFormat;
      return `${format(new Date(startDate), startDateFormat)} - ${format(new Date(endDate), endDateFormat)}`;
    }
    return format(new Date(startDate), startDateFormat);
}

export default function ManageEventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [eventToDelete, setEventToDelete] = useState<Event | null>(null);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const { toast } = useToast();

  const fetchEvents = async () => {
    try {
        setLoading(true);
        const fetchedEvents = await getEvents();
        setEvents(fetchedEvents);
    } catch (error) {
        console.error("Failed to fetch events:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to load events.' });
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);
  
  const handleOpenDeleteDialog = (event: Event) => {
    setEventToDelete(event);
    setIsAlertOpen(true);
  };

  const handleDelete = async () => {
    if (!eventToDelete) return;

    try {
        await deleteEvent(eventToDelete.id);
        toast({
            title: 'Event Deleted',
            description: `"${eventToDelete.name}" has been successfully deleted.`,
        });
        fetchEvents(); // Re-fetch events to update the list
    } catch (error) {
        console.error("Failed to delete event:", error);
        toast({
            variant: 'destructive',
            title: 'Error',
            description: 'Failed to delete the event.',
        });
    } finally {
        setIsAlertOpen(false);
        setEventToDelete(null);
    }
  };


  return (
    <div className="flex flex-1 flex-col gap-4 md:gap-8">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Manage Events</h1>
          <p className="text-muted-foreground">
            Select an event to view its details and manage it.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button asChild>
            <Link href="/dashboard/events/new">
              <PlusCircle className="mr-2 h-4 w-4" /> Create Event
            </Link>
          </Button>
        </div>
      </div>
      
      <div className="grid gap-4 md:gap-8 md:grid-cols-2 lg:grid-cols-4">
        {loading ? (
            [...Array(4)].map((_, i) => (
                <Card key={i}>
                    <CardHeader className="p-0"><Skeleton className="w-full aspect-[3/2] rounded-t-lg" /></CardHeader>
                    <CardContent className="p-4 space-y-2">
                      <Skeleton className="h-5 w-20" />
                      <Skeleton className="h-7 w-3/4" />
                      <Skeleton className="h-5 w-1/2" />
                    </CardContent>
                    <CardFooter className="p-4">
                      <Skeleton className="h-9 w-full" />
                    </CardFooter>
                </Card>
            ))
        ) : events.length > 0 ? (
          events.map((event) => {
            const imageUrl = event.image || '/image/nibtickets.jpg';
            return (
              <Card key={event.id} className="flex flex-col hover:shadow-lg transition-shadow duration-300">
                <CardHeader className="p-0">
                  <Image src={imageUrl} alt={event.name} width={600} height={400} className="rounded-t-lg object-cover aspect-[3/2]" data-ai-hint={event.hint ?? 'event'} />
                </CardHeader>
                <CardContent className="p-4 flex-1 space-y-2">
                  <Badge variant="outline" className="text-xs">{event.category}</Badge>
                  <CardTitle className="text-lg leading-tight">{event.name}</CardTitle>
                  <div className="space-y-1 pt-1">
                    <CardDescription className="text-xs">{formatEventDate(event.startDate, event.endDate)}</CardDescription>
                    <CardDescription className="flex items-center gap-1.5 pt-1 text-xs">
                        <MapPin className="h-3 w-3" />
                        {event.location}
                    </CardDescription>
                  </div>
                </CardContent>
                 <CardFooter className="p-2 border-t flex justify-end gap-1">
                    <Button asChild variant="ghost" size="icon">
                        <Link href={`/dashboard/events/${event.id}/edit`} aria-label="Edit Event">
                            <Pencil className="h-4 w-4" />
                        </Link>
                    </Button>
                    <Button 
                        variant="ghost" 
                        size="icon"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleOpenDeleteDialog(event)}
                        aria-label="Delete Event"
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                    <Button asChild size="icon" className="ml-auto">
                        <Link href={`/dashboard/events/${event.id}`} aria-label="Manage Event">
                            <ArrowUpRight className="h-4 w-4" />
                        </Link>
                    </Button>
                </CardFooter>
              </Card>
            )
          })
        ) : (
            <Card className="md:col-span-2 lg:col-span-4 flex items-center justify-center p-8 text-center">
                <div>
                    <h3 className="text-2xl font-semibold tracking-tight">You haven't created any events yet</h3>
                    <p className="text-muted-foreground mt-2 mb-6">Let's get your first event set up.</p>
                    <Button asChild>
                        <Link href="/dashboard/events/new">
                        <PlusCircle className="mr-2 h-4 w-4" /> Create Event
                        </Link>
                    </Button>
                </div>
            </Card>
        )}
      </div>

       <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the event
              <strong className="mx-1">"{eventToDelete?.name}"</strong>
              and all of its associated data, including tickets and attendees.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              Delete Event
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
