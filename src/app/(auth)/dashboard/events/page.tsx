

'use client';

import { useState, useEffect, useCallback } from 'react';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { PlusCircle, ArrowUpRight, Pencil, Trash2, MapPin, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import Link from 'next/link';
import Image from 'next/image';
import { getEvents, deleteEvent, updateEventStatus } from '@/lib/actions';
import { Badge } from '@/components/ui/badge';
import type { Event, EventStatus } from '@prisma/client';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/auth-context';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

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

const EventCard = ({ event, isAdmin, onApprove, onReject, onDelete }: { event: Event, isAdmin: boolean, onApprove: (e: Event) => void, onReject: (e: Event) => void, onDelete: (e: Event) => void }) => {
    const imageUrl = event.image || '/image/nibtickets.jpg';
    
    const statusBadge = (status: string) => {
        return (
            <Badge variant="outline" className={cn(
                'absolute top-2 right-2 text-xs',
                status === 'APPROVED' && 'bg-green-100 text-green-800 border-transparent',
                status === 'PENDING' && 'bg-yellow-100 text-yellow-800 border-transparent',
                status === 'REJECTED' && 'bg-red-100 text-red-800 border-transparent'
            )}>
                {status}
            </Badge>
        );
    }
    
    return (
        <Card className="flex flex-col hover:shadow-lg transition-shadow duration-300 relative">
        {isAdmin && event.status && statusBadge(event.status)}
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
            {event.status === 'REJECTED' && event.rejectionReason && (
                <CardDescription className="text-xs text-destructive pt-1 italic">
                    Reason: {event.rejectionReason}
                </CardDescription>
            )}
            </div>
        </CardContent>
        <CardFooter className="p-2 border-t flex justify-end gap-1">
            {event.status === 'PENDING' && isAdmin ? (
                <>
                    <Button variant="outline" className="w-full" onClick={() => onApprove(event)}>
                        <CheckCircle2 className="h-4 w-4 mr-2" /> Approve
                    </Button>
                    <Button variant="destructive" className="w-full" onClick={() => onReject(event)}>
                        <XCircle className="h-4 w-4 mr-2" /> Reject
                    </Button>
                </>
            ) : (
                <>
                    <Button asChild variant="ghost" size="icon">
                        <Link href={`/dashboard/events/${event.id}/edit`} aria-label="Edit Event">
                            <Pencil className="h-4 w-4" />
                        </Link>
                    </Button>
                    <Button 
                        variant="ghost" 
                        size="icon"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => onDelete(event)}
                        aria-label="Delete Event"
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                    <Button asChild size="icon" className="ml-auto">
                        <Link href={`/dashboard/events/${event.id}`} aria-label="Manage Event">
                            <ArrowUpRight className="h-4 w-4" />
                        </Link>
                    </Button>
                </>
            )}
        </CardFooter>
        </Card>
    );
};


const EventGrid = ({ events, isLoading, isAdmin, onApprove, onReject, onDelete }: { events: Event[], isLoading: boolean, isAdmin: boolean, onApprove: (e: Event) => void, onReject: (e: Event) => void, onDelete: (e: Event) => void }) => {
    if (isLoading) {
        return (
            <div className="grid gap-4 md:gap-8 md:grid-cols-2 lg:grid-cols-4">
                {[...Array(4)].map((_, i) => (
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
                ))}
            </div>
        );
    }

    if (events.length === 0) {
        return (
            <Card className="md:col-span-2 lg:col-span-4 flex items-center justify-center p-8 text-center">
                <div>
                    <h3 className="text-2xl font-semibold tracking-tight">No events found in this category.</h3>
                </div>
            </Card>
        );
    }
    
    return (
        <div className="grid gap-4 md:gap-8 md:grid-cols-2 lg:grid-cols-4">
            {events.map(event => (
                <EventCard 
                    key={event.id}
                    event={event}
                    isAdmin={isAdmin}
                    onApprove={onApprove}
                    onReject={onReject}
                    onDelete={onDelete}
                />
            ))}
        </div>
    );
}


export default function ManageEventsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [eventToModify, setEventToModify] = useState<Event | null>(null);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const { toast } = useToast();

  const [pendingEvents, setPendingEvents] = useState<Event[]>([]);
  const [approvedEvents, setApprovedEvents] = useState<Event[]>([]);
  const [rejectedEvents, setRejectedEvents] = useState<Event[]>([]);
  const [allEvents, setAllEvents] = useState<Event[]>([]);
  
  const isAdmin = user?.role?.name === 'Admin';
  const [activeTab, setActiveTab] = useState(isAdmin ? 'pending' : 'all');

  const fetchEventsByStatus = useCallback(async (status: EventStatus | 'all') => {
      setLoading(true);
      try {
          const fetchedEvents = await getEvents(status);
          switch(status) {
              case 'PENDING': setPendingEvents(fetchedEvents); break;
              case 'APPROVED': setApprovedEvents(fetchedEvents); break;
              case 'REJECTED': setRejectedEvents(fetchedEvents); break;
              case 'all': setAllEvents(fetchedEvents); break;
          }
      } catch (error) {
          console.error(`Failed to fetch ${status} events:`, error);
          toast({ variant: 'destructive', title: 'Error', description: `Failed to load ${status} events.` });
      } finally {
          setLoading(false);
      }
  }, [toast]);
  
  useEffect(() => {
    fetchEventsByStatus(activeTab as EventStatus | 'all');
  }, [activeTab, fetchEventsByStatus]);

  const refreshCurrentTabData = useCallback(() => {
    fetchEventsByStatus(activeTab as EventStatus | 'all');
  }, [activeTab, fetchEventsByStatus]);

  const refreshAllTabs = useCallback(async () => {
    if (isAdmin) {
        await Promise.all([
            fetchEventsByStatus('PENDING'),
            fetchEventsByStatus('APPROVED'),
            fetchEventsByStatus('REJECTED'),
            fetchEventsByStatus('all'),
        ]);
    } else {
        await fetchEventsByStatus('all');
    }
  }, [isAdmin, fetchEventsByStatus]);

  
  const handleOpenDeleteDialog = (event: Event) => {
    setEventToModify(event);
    setIsAlertOpen(true);
  };

  const handleOpenRejectDialog = (event: Event) => {
    setEventToModify(event);
    setIsRejectDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!eventToModify) return;
    setActionLoading(true);
    try {
        await deleteEvent(eventToModify.id);
        toast({
            title: 'Event Deleted',
            description: `"${eventToModify.name}" has been successfully deleted.`,
        });
        refreshCurrentTabData();
    } catch (error) {
        console.error("Failed to delete event:", error);
        toast({
            variant: 'destructive',
            title: 'Error',
            description: 'Failed to delete the event.',
        });
    } finally {
        setIsAlertOpen(false);
        setEventToModify(null);
        setActionLoading(false);
    }
  };

  const handleApprove = async (event: Event) => {
    setActionLoading(true);
    try {
      await updateEventStatus(event.id, 'APPROVED');
      toast({ title: 'Event Approved', description: `"${event.name}" is now live.`});
      await refreshAllTabs(); // Refresh all tabs data after status change
      setActiveTab('approved'); // Switch to approved tab
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to approve event.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!eventToModify) return;
    setActionLoading(true);
    try {
      await updateEventStatus(eventToModify.id, 'REJECTED', rejectionReason);
      toast({ title: 'Event Rejected' });
      await refreshAllTabs(); // Refresh all tabs data
      setActiveTab('rejected'); // Switch to rejected tab
    } catch (error) {
       toast({ variant: 'destructive', title: 'Error', description: 'Failed to reject event.' });
    } finally {
      setActionLoading(false);
      setIsRejectDialogOpen(false);
      setEventToModify(null);
      setRejectionReason('');
    }
  }


  return (
    <div className="flex flex-1 flex-col gap-4 md:gap-8">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Manage Events</h1>
          <p className="text-muted-foreground">
            {isAdmin ? 'Review, approve, and manage all events.' : 'Select an event to view its details and manage it.'}
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
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        {isAdmin ? (
            <TabsList>
                <TabsTrigger value="pending">Pending ({pendingEvents.length})</TabsTrigger>
                <TabsTrigger value="approved">Approved ({approvedEvents.length})</TabsTrigger>
                <TabsTrigger value="rejected">Rejected ({rejectedEvents.length})</TabsTrigger>
                <TabsTrigger value="all">All Events ({allEvents.length})</TabsTrigger>
            </TabsList>
        ) : (
             <TabsList>
                 <TabsTrigger value="all">My Events</TabsTrigger>
            </TabsList>
        )}
        <TabsContent value="pending" className="mt-4">
            <EventGrid events={pendingEvents} isLoading={loading} isAdmin={isAdmin} onApprove={handleApprove} onReject={handleOpenRejectDialog} onDelete={handleOpenDeleteDialog} />
        </TabsContent>
        <TabsContent value="approved" className="mt-4">
            <EventGrid events={approvedEvents} isLoading={loading} isAdmin={isAdmin} onApprove={handleApprove} onReject={handleOpenRejectDialog} onDelete={handleOpenDeleteDialog} />
        </TabsContent>
        <TabsContent value="rejected" className="mt-4">
            <EventGrid events={rejectedEvents} isLoading={loading} isAdmin={isAdmin} onApprove={handleApprove} onReject={handleOpenRejectDialog} onDelete={handleOpenDeleteDialog} />
        </TabsContent>
        <TabsContent value="all" className="mt-4">
            <EventGrid events={allEvents} isLoading={loading} isAdmin={isAdmin} onApprove={handleApprove} onReject={handleOpenRejectDialog} onDelete={handleOpenDeleteDialog} />
        </TabsContent>
      </Tabs>


       <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the event
              <strong className="mx-1">"{eventToModify?.name}"</strong>
              and all of its associated data, including tickets and attendees.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90" disabled={actionLoading}>
              {actionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Delete Event
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

        <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Reject Event: {eventToModify?.name}</DialogTitle>
                    <DialogDescription>Please provide a reason for rejecting this event. This will be visible to the organizer.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="rejection-reason" className="text-right">Reason</Label>
                        <Textarea 
                            id="rejection-reason"
                            value={rejectionReason}
                            onChange={(e) => setRejectionReason(e.target.value)}
                            className="col-span-3"
                            placeholder="e.g., Missing required information, event not suitable for platform."
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => setIsRejectDialogOpen(false)}>Cancel</Button>
                    <Button variant="destructive" onClick={handleReject} disabled={actionLoading}>
                        {actionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Confirm Rejection
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </div>
  );
}
